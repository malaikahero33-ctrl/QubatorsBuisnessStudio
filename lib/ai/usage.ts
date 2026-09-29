/**
 * AI usage metering.
 *
 * Two jobs, and the order matters:
 *
 * 1. Check the cap BEFORE calling the provider.
 * 2. Record the call AFTER it succeeds.
 *
 * Checking after is how you end up billing a user for a call you refused,
 * which is both unfair and useless as a cost control. Recording after is what
 * makes the count real.
 *
 * A failed write is logged and swallowed. The user already got their answer;
 * losing the metering row is a smaller problem than refusing to serve them
 * because a counter could not be incremented.
 */

import "server-only";

import { createClient } from "@/lib/supabase/server";
import { AiRateLimitError, dailyRequestCap, type AiFeature } from "@/lib/ai/provider";

export type UsageCheck = {
  used: number;
  cap: number;
  remaining: number;
};

/**
 * Today's call count for a user.
 *
 * UTC day, matching the rest of the app's date bucketing. A cap that resets at
 * a different boundary than the usage table would be confusing at midnight.
 */
export async function getTodayUsage(userId: string): Promise<UsageCheck> {
  const cap = dailyRequestCap();
  const supabase = await createClient();

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfToday.toISOString());

  // A read failure must not lock the user out of the AI features. Report the
  // cap as not reached and let the write path deal with reality.
  const used = error ? 0 : (count ?? 0);

  return { used, cap, remaining: Math.max(0, cap - used) };
}

/** Throws AiRateLimitError if the user is out of calls today. */
export async function assertWithinDailyCap(userId: string): Promise<void> {
  const { used, cap } = await getTodayUsage(userId);
  if (used >= cap) {
    throw new AiRateLimitError(secondsUntilUtcMidnight(), true);
  }
}

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.max(60, Math.round((midnight.getTime() - now.getTime()) / 1000));
}

/**
 * Record one completed call.
 *
 * Cost is left at 0 rather than guessed. A wrong price per token produces a
 * confidently wrong total, and open question 1 (which provider, at what rate)
 * has not been answered — so there is no rate to compute from. Once it is,
 * this is the one line that changes.
 */
export async function recordUsage(params: {
  userId: string;
  businessId: string;
  feature: AiFeature;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("ai_usage").insert({
      user_id: params.userId,
      business_id: params.businessId,
      feature: params.feature,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      estimated_cost_micros: 0,
    });

    if (error) {
      // Almost always the missing INSERT policy that 0005 fixes.
      console.error("[ai] could not record usage:", error.message);
    }
  } catch (err) {
    console.error("[ai] usage write threw:", err);
  }
}
