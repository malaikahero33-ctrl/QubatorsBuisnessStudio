/**
 * One place every AI route goes through.
 *
 * The order of operations is the point of this file, and it is not
 * negotiable:
 *
 *   1. Is a key configured?     → no key is a configuration problem, say so plainly
 *   2. Is the user within cap?  → check BEFORE spending money
 *   3. Call the provider        → the only part that can actually cost anything
 *   4. Validate the envelope    → no assumptions means the answer is not shown
 *   5. Record usage             → only now, because only now was there a call
 *
 * Doing (2) after (3) lets the app refuse a call it has already paid for.
 * Doing (4) before (5) means a response that failed validation is not billed,
 * which is right: the user got nothing they can use.
 */

import "server-only";

import {
  AiProviderError,
  AiRateLimitError,
  getAiProvider,
  maxOutputTokensFor,
  type AiFeature,
  type AiResult,
  type CompletionRequest,
  type ModelTier,
} from "@/lib/ai/provider";
import { assertWithinDailyCap, recordUsage } from "@/lib/ai/usage";
import { aiEnvelopeSchema } from "@/lib/validation/schemas";
import { isAiConfigured } from "@/lib/config";
import { getTodayUsage } from "@/lib/ai/usage";
import type { z } from "zod";

/**
 * What a route needs to know to make one call.
 *
 * `TSchema` is the Zod schema; the content type is inferred from it, so a
 * caller writes `runAi({ schema: ideaContent, ... })` and gets back
 * `AiResult<z.infer<typeof ideaContent>>` with no explicit type parameter and
 * no chance of the two drifting apart.
 */
export type AiRunRequest<TSchema extends z.ZodType> = {
  userId: string;
  businessId: string;
  feature: AiFeature;
  tier: ModelTier;
  system: string;
  user: string;
  /**
   * Zod schema for the feature's content. `aiEnvelopeSchema` wraps it, so
   * this is the *inner* schema only.
   */
  schema: TSchema;
  json?: boolean;
  maxOutputTokens?: number;
  /** Turn a thrown provider error into something worth showing a founder. */
  describeError?: (error: unknown) => string;
};

export type AiRunOutcome<TContent> =
  | { ok: true; data: AiResult<TContent>; usageToday: number }
  | { ok: false; code: AiFailureCode; message: string; retryAfterSeconds?: number };

export type AiFailureCode =
  | "not_configured"
  | "rate_limited"
  | "daily_cap"
  | "provider"
  | "invalid_response"
  | "unknown";

/**
 * Make one AI call, safely.
 *
 * Returns a discriminated result rather than throwing, because every caller is
 * a server action rendering a page: a caught failure with a message beats an
 * exception that replaces the page with an error boundary.
 */
export async function runAi<TSchema extends z.ZodType>(
  request: AiRunRequest<TSchema>,
): Promise<AiRunOutcome<z.infer<TSchema>>> {
  // 1. Configuration.
  if (!isAiConfigured()) {
    return {
      ok: false,
      code: "not_configured",
      message:
        "The AI features need an API key. Add AI_API_KEY to .env.local and restart " +
        "the server. Which provider to use is still an open decision — see docs/DECISIONS.md.",
    };
  }

  // 2. Cap, before spending anything.
  try {
    await assertWithinDailyCap(request.userId);
  } catch (error) {
    if (error instanceof AiRateLimitError) {
      return {
        ok: false,
        code: "daily_cap",
        message:
          "You have used all of today's AI requests. They come back at midnight UTC, " +
          "or come back sooner if the daily allowance is raised.",
        retryAfterSeconds: error.retryAfterSeconds,
      };
    }
    // A failed cap check must not block the call. Worst case the cap is
    // slightly wrong for this user today.
  }

  const completion: CompletionRequest = {
    feature: request.feature,
    system: request.system,
    prompt: request.user,
    // Not sent on the wire: the provider does not need it, and passing it
    // means a logging provider could store a copy of the business profile.
    context: {
      name: "",
      industry: "",
      location: "",
      stage: "",
      targetCustomer: "",
      currency: "",
      products: [],
    },
    tier: request.tier,
    json: request.json,
    maxOutputTokens: maxOutputTokensFor(request.tier, request.maxOutputTokens),
  };

  // 3. The call.
  let result;
  try {
    result = await getAiProvider().complete(completion);
  } catch (error) {
    if (request.describeError) {
      return { ok: false, code: "provider", message: request.describeError(error) };
    }
    if (error instanceof AiRateLimitError) {
      return {
        ok: false,
        code: "rate_limited",
        message: "The AI provider is busy. Wait a moment and try again.",
        retryAfterSeconds: error.retryAfterSeconds,
      };
    }
    if (error instanceof AiProviderError) {
      return { ok: false, code: "provider", message: error.message };
    }
    return {
      ok: false,
      code: "unknown",
      message: "Something went wrong talking to the AI provider.",
    };
  }

  // 4. The envelope. ADR-4: fail closed rather than show unverified output.
  //
  // Generators put their own `assumptions` array inside the JSON payload, so
  // it is lifted onto the envelope here. The free-text features have no JSON,
  // so their assumptions are whatever the provider reported — usually none,
  // which is exactly why those responses carry the warning in the UI.
  let content: unknown;
  let assumptions = result.assumptions;

  if (request.json) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(result.content));
    } catch {
      return {
        ok: false,
        code: "invalid_response",
        message:
          "The AI returned something that is not valid JSON, so it cannot be " +
          "shown safely. Try again.",
      };
    }
    content = parsed;

    // Generators nest their own `assumptions` inside the payload, because the
    // prompt asks for one JSON object with the content and the caveats. Lift
    // it onto the envelope so the caller has one place to look. Anything that
    // is not a non-empty string array is ignored here and caught by the
    // envelope's own validation below.
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const nested = (parsed as Record<string, unknown>).assumptions;
      if (
        Array.isArray(nested) &&
        nested.length > 0 &&
        nested.every((a) => typeof a === "string" && a.trim().length > 0)
      ) {
        assumptions = nested;
      }
    }
  } else {
    content = result.content;
  }

  const envelope: AiResult<unknown> = { ...result, content, assumptions };

  const validated = aiEnvelopeSchema(request.schema).safeParse(envelope);

  if (!validated.success) {
    const missingAssumptions = /assumptions/i.test(
      validated.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" "),
    );
    return {
      ok: false,
      code: "invalid_response",
      message: missingAssumptions
        ? "The AI did not state its assumptions, so the answer is not shown. This is " +
          "deliberate: unverified advice must not look like a finding. Try again."
        : "The AI response was not in the expected format. Try rephrasing.",
    };
  }

  // 5. Meter the call. Only now, because only now was there one.
  await recordUsage({
    userId: request.userId,
    businessId: request.businessId,
    feature: request.feature,
    model: validated.data.model,
    inputTokens: validated.data.usage.inputTokens,
    outputTokens: validated.data.usage.outputTokens,
  });

  const usage = await getTodayUsage(request.userId);

  return {
    ok: true,
    data: validated.data as AiResult<z.infer<TSchema>>,
    usageToday: usage.used,
  };
}
