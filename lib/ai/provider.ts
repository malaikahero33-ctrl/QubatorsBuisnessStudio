/**
 * AI provider adapter.
 *
 * Every model call in this app goes through `complete()`. Swapping vendors
 * means implementing this interface and changing one factory — nothing else
 * in the codebase imports a vendor SDK.
 *
 * See docs/DECISIONS.md ADR-3 (why the abstraction exists) and ADR-4
 * (why `assumptions` is mandatory).
 */

import "server-only";

/** Which surface is making the call. Used for cost attribution. */
export type AiFeature =
  | "copilot"
  | "idea"
  | "business_plan"
  | "brand"
  | "marketing";

export type ModelTier = "fast" | "quality";

/**
 * The business facts injected into every prompt. This is what makes the
 * Copilot business-aware rather than a generic chatbot.
 *
 * Sourced from docs/DATABASE.md: businesses plus its products, customers and
 * price range. Built by lib/ai/context.ts.
 */
export type BusinessContext = {
  name: string;
  industry: string;
  location: string;
  stage: string;
  targetCustomer: string;
  currency: string;
  products: Array<{ name: string; priceMinor: number }>;
  priceRangeMinor?: { min: number; max: number };
  brandPersonality?: string;
  goals?: string;
};

/**
 * Every generative response has this shape.
 *
 * `assumptions` is required, not optional. A response without a parseable
 * array is a failure, not a degraded success — the PRD (section 7) forbids
 * presenting unverified information as fact, and a "probably has some
 * assumptions in there somewhere" field would not enforce that.
 */
export type AiResult<TContent> = {
  content: TContent;
  /** Things the model inferred rather than being told. Rendered in the UI. */
  assumptions: string[];
  /** Advisory notes for the user, e.g. "validate market size before relying". */
  warnings: string[];
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
};

export type CompletionRequest = {
  feature: AiFeature;
  system: string;
  prompt: string;
  context: BusinessContext;
  tier: ModelTier;
  /** Force JSON output. Generators must set this. */
  json?: boolean;
  maxOutputTokens?: number;
  /**
   * Repeat this call with the same key and get the original result back
   * without billing the provider twice.
   */
  idempotencyKey?: string;
};

export type CompletionResult = AiResult<unknown>;

/**
 * The interface every provider implements.
 *
 * Note it returns `AiResult<unknown>` rather than a typed shape: parsing into
 * a specific type is the caller's job, via the Zod schema for that feature.
 * A provider cannot be trusted to honour a TypeScript type at runtime.
 */
export interface AiProvider {
  readonly name: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

/** Thrown when the provider is unreachable or rejects our credentials. */
export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

/** Thrown when the provider rate-limits us, or we hit the daily per-user cap. */
export class AiRateLimitError extends Error {
  constructor(
    readonly retryAfterSeconds: number,
    /** True when it was our own cap rather than the provider's. */
    readonly isDailyCap = false,
  ) {
    super(
      isDailyCap
        ? "You have used today's AI allowance"
        : "The AI provider is busy right now",
    );
    this.name = "AiRateLimitError";
  }
}

/** Model selection per tier. Configured in .env.local. */
function modelFor(tier: ModelTier): string {
  return tier === "fast"
    ? (process.env.AI_MODEL_FAST ?? "gpt-4o-mini")
    : (process.env.AI_MODEL_QUALITY ?? "gpt-4o");
}

export function maxOutputTokensFor(tier: ModelTier, override?: number): number {
  if (override) return override;
  return tier === "fast"
    ? Number(process.env.AI_MAX_OUTPUT_TOKENS_CHAT ?? 2000)
    : Number(process.env.AI_MAX_OUTPUT_TOKENS_DOCUMENT ?? 8000);
}

export function dailyRequestCap(): number {
  return Number(process.env.AI_REQUESTS_PER_USER_PER_DAY ?? 50);
}

export function requestTimeoutMs(): number {
  return Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 60_000);
}

export { modelFor };

/**
 * The instruction appended to every system prompt.
 *
 * Centralised so the PRD's AI rules (section 7) cannot drift between
 * features, and so a test can assert they are present on every call.
 */
export const AI_GROUND_RULES = `
You are advising a real business. Follow these rules exactly:

1. State your assumptions. Return an "assumptions" array listing every
   inference you made that was not given to you.
2. Never guarantee revenue, profit, or success. Use ranges and conditions.
3. Distinguish clearly between verified facts and your own suggestions.
   Never present a suggestion as if it were researched market data.
4. If you lack information, say what you need rather than inventing it.
5. Use the business currency and locale for any figures.
6. Be specific and actionable. Avoid generic advice that would apply to
   any business.
`.trim();

/**
 * The provider factory.
 *
 * The only place in the codebase that knows which vendor is in use. Keeping
 * it here means a test can assert the app still builds and behaves when no
 * key is configured, which is the state it ships in.
 */
let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;

  // Imported lazily so that a missing key produces a friendly route-level
  // message rather than a module-load failure at app startup.
  const { OpenAiCompatibleProvider } = require("@/lib/ai/provider-openai") as {
    OpenAiCompatibleProvider: new (name?: string) => AiProvider;
  };

  cached = new OpenAiCompatibleProvider();
  return cached;
}

/** Test seam: drop the cached provider so a new env var takes effect. */
export function resetAiProvider(): void {
  cached = null;
}
