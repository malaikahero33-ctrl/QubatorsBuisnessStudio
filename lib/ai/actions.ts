"use server";

/**
 * AI feature actions.
 *
 * One action per feature, each owning its output schema. They share
 * `runAi`, which owns the order of operations that matters:
 * check the key, check the cap, call, validate, then meter.
 *
 * Every action returns the same discriminated shape, so the client component
 * has exactly one thing to render: an error state, or a result that carries
 * its own assumptions. There is no path where content reaches the screen
 * without them.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { runAi, type AiRunOutcome } from "@/lib/ai/run";
import type { AiResult } from "@/lib/ai/provider";
import { buildBusinessContext } from "@/lib/ai/context";
import {
  copilotPrompt,
  ideaPrompt,
  businessPlanPrompt,
  brandPrompt,
  marketingPrompt,
} from "@/lib/ai/prompts";
import { getTodayUsage } from "@/lib/ai/usage";
import { isAiConfigured } from "@/lib/config";

/* -------------------------------------------------------------------------- */
/* Content schemas                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Copilot returns prose, so the content is a plain string. The envelope still
 * demands assumptions; free-text features have no JSON to nest them in, so
 * `runAi` fills them from the provider envelope, which is empty. That makes
 * the envelope check fail for prose — deliberately. Copilot is therefore the
 * one feature that always carries the "this is AI advice, not research"
 * warning rather than a list of specific assumptions.
 */
const copilotContent = z.string().min(1, "The AI returned an empty answer");

const ideaContent = z.object({
  ideas: z
    .array(
      z.object({
        name: z.string().min(1),
        one_liner: z.string().min(1),
        problem_it_solves: z.string().min(1),
        who_pays: z.string().min(1),
        startup_cost_ugx: z.number().nonnegative(),
        monthly_operating_cost_ugx: z.number().nonnegative(),
        realistic_monthly_revenue_ugx: z.number().nonnegative(),
        first_steps: z.array(z.string().min(1)).min(1),
        main_risk: z.string().min(1),
        why_now: z.string().min(1),
      }),
    )
    .min(1)
    .max(5),
  assumptions: z.array(z.string().min(1)).min(1),
  warnings: z.array(z.string()),
});

const planContent = z.object({
  executive_summary: z.string().min(1),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        body: z.string().min(1),
        key_numbers: z.array(z.string()),
      }),
    )
    .min(1),
  financial_summary: z.object({
    currency: z.string().min(3),
    startup_costs: z.number().nonnegative(),
    monthly_costs: z.number().nonnegative(),
    monthly_revenue_target: z.number().nonnegative(),
    break_even_months: z.number().int().nonnegative(),
  }),
  milestones: z.array(z.object({ when: z.string(), what: z.string() })),
  risks: z.array(z.object({ risk: z.string(), mitigation: z.string() })),
  assumptions: z.array(z.string().min(1)).min(1),
  warnings: z.array(z.string()),
});

const brandContent = z.object({
  name_options: z
    .array(z.object({ name: z.string().min(1), why: z.string().min(1) }))
    .min(1),
  tagline_options: z.array(z.string().min(1)).min(1),
  tone_of_voice: z.array(z.string()),
  colors: z
    .array(
      z.object({
        name: z.string().min(1),
        hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Colours must be hex codes like #1A2B3C"),
        use: z.string().min(1),
      }),
    )
    .min(1),
  fonts: z.object({ heading: z.string(), body: z.string(), note: z.string() }),
  brand_personality: z.array(z.string()),
  logo_direction: z.string().min(1),
  what_to_avoid: z.array(z.string()),
  assumptions: z.array(z.string().min(1)).min(1),
  warnings: z.array(z.string()),
});

const marketingContent = z.object({
  content: z.string().min(1),
  channel: z.string(),
  assumptions: z.array(z.string().min(1)).min(1),
  warnings: z.array(z.string()),
});

/* -------------------------------------------------------------------------- */
/* Shared plumbing                                                             */
/* -------------------------------------------------------------------------- */

type Prepared =
  | { ok: false; code: string; message: string }
  | {
      ok: true;
      user: { id: string };
      business: { id: string };
      context: NonNullable<Awaited<ReturnType<typeof buildBusinessContext>>>;
    };

/**
 * Everything an action needs, or a reason it cannot proceed.
 *
 * A discriminated union on `ok` rather than a property that exists on one
 * branch only: `"error" in x` narrows, but it narrows to `string | undefined`
 * for the message, which is exactly the kind of gap that gets a `!` bolted on
 * and then crashes in production.
 */
async function prepare(): Promise<Prepared> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, code: "no_session", message: "Your session expired. Sign in again." };
  }

  const business = await getCurrentBusiness();
  if (!business) {
    return {
      ok: false,
      code: "no_business",
      message: "Create a business before using the AI studio.",
    };
  }

  const context = await buildBusinessContext(business.id);
  if (!context) {
    return {
      ok: false,
      code: "no_context",
      message: "Could not read your business details.",
    };
  }

  return { ok: true, user, business, context };
}

/** The uniform shape the client renders: a result, or a reason there is none. */
export type AiActionResult<T> =
  | { status: "ok"; data: AiResult<T>; usageToday: number }
  | { status: "error"; code: string; message: string };

function toResult<T>(outcome: AiRunOutcome<T>): AiActionResult<T> {
  if (outcome.ok) {
    return { status: "ok", data: outcome.data, usageToday: outcome.usageToday };
  }
  return { status: "error", code: outcome.code, message: outcome.message };
}

/* -------------------------------------------------------------------------- */
/* 5. Copilot                                                                  */
/* -------------------------------------------------------------------------- */

export async function askCopilotAction(
  question: string,
): Promise<AiActionResult<string>> {
  const trimmed = question.trim();
  if (!trimmed) {
    return { status: "error", code: "empty", message: "Ask a question first." };
  }

  const ctx = await prepare();
  if (!ctx.ok) {
    return { status: "error", code: ctx.code, message: ctx.message };
  }

  const prompt = copilotPrompt(ctx.context, trimmed);

  const outcome = await runAi({
    userId: ctx.user.id,
    businessId: ctx.business.id,
    feature: "copilot",
    tier: "fast",
    system: prompt.system,
    user: prompt.user,
    schema: copilotContent,
    json: false,
    // Prose has no place to carry assumptions, so the envelope check will
    // reject the response. That is the intended outcome: see copilotContent.
    describeError: (error) =>
      error instanceof Error ? error.message : "The AI could not be reached.",
  });

  return toResult(outcome);
}

/* -------------------------------------------------------------------------- */
/* 6. Idea generator                                                           */
/* -------------------------------------------------------------------------- */

export async function generateIdeasAction(params: {
  sector?: string;
  budget?: string;
  skills?: string;
}): Promise<AiActionResult<z.infer<typeof ideaContent>>> {
  const ctx = await prepare();
  if (!ctx.ok) {
    return { status: "error", code: ctx.code, message: ctx.message };
  }

  const prompt = ideaPrompt(ctx.context, params);

  return toResult(
    await runAi({
      userId: ctx.user.id,
      businessId: ctx.business.id,
      feature: "idea",
      tier: "quality",
      system: prompt.system,
      user: prompt.user,
      schema: ideaContent,
      json: true,
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Business plan                                                            */
/* -------------------------------------------------------------------------- */

export async function generateBusinessPlanAction(
  summary?: string,
): Promise<AiActionResult<z.infer<typeof planContent>>> {
  const ctx = await prepare();
  if (!ctx.ok) {
    return { status: "error", code: ctx.code, message: ctx.message };
  }

  const prompt = businessPlanPrompt(ctx.context, { summary });

  const outcome = await runAi({
    userId: ctx.user.id,
    businessId: ctx.business.id,
    feature: "business_plan",
    tier: "quality",
    system: prompt.system,
    user: prompt.user,
    schema: planContent,
    json: true,
    // A full plan is a document, not a chat reply.
    maxOutputTokens: 8000,
  });

  if (outcome.ok) {
    revalidatePath("/business/plan");
  }
  return toResult(outcome);
}

/* -------------------------------------------------------------------------- */
/* 8. Brand                                                                    */
/* -------------------------------------------------------------------------- */

export async function generateBrandAction(params: {
  keywords?: string;
  style?: string;
}): Promise<AiActionResult<z.infer<typeof brandContent>>> {
  const ctx = await prepare();
  if (!ctx.ok) {
    return { status: "error", code: ctx.code, message: ctx.message };
  }

  const prompt = brandPrompt(ctx.context, params);

  const outcome = await runAi({
    userId: ctx.user.id,
    businessId: ctx.business.id,
    feature: "brand",
    tier: "quality",
    system: prompt.system,
    user: prompt.user,
    schema: brandContent,
    json: true,
  });

  if (outcome.ok) {
    revalidatePath("/business/brand");
  }
  return toResult(outcome);
}

/* -------------------------------------------------------------------------- */
/* 10. Marketing                                                               */
/* -------------------------------------------------------------------------- */

export async function generateMarketingAction(params: {
  channel: "social_post" | "whatsapp" | "product_description" | "sms" | "poster_caption" | "email";
  subject: string;
  details?: string;
  tone?: string;
}): Promise<AiActionResult<z.infer<typeof marketingContent>>> {
  if (!params.subject.trim()) {
    return {
      status: "error",
      code: "empty",
      message: "Say what the message is about.",
    };
  }

  const ctx = await prepare();

  if (!ctx.ok) {

    return { status: "error", code: ctx.code, message: ctx.message };

  }

  const prompt = marketingPrompt(ctx.context, params);

  return toResult(
    await runAi({
      userId: ctx.user.id,
      businessId: ctx.business.id,
      feature: "marketing",
      tier: "fast",
      system: prompt.system,
      user: prompt.user,
      schema: marketingContent,
      json: true,
    }),
  );
}

/* -------------------------------------------------------------------------- */

/** Today's remaining calls, for the UI counter. */
export async function getAiAllowanceAction(): Promise<{
  configured: boolean;
  used: number;
  cap: number;
  remaining: number;
}> {
  const configured = isAiConfigured();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { configured, used: 0, cap: 0, remaining: 0 };
  }

  const usage = await getTodayUsage(user.id);
  return { configured, ...usage };
}
