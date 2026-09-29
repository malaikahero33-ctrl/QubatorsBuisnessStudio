/**
 * The signed-in user's business.
 *
 * Every page in the product area needs the same two things: the business row
 * and its currency. Reading it inline each time meant three copies of the same
 * query, and a silent divergence the moment the rule changes.
 *
 * The rule: the earliest business the user created. The PRD's active-business
 * switcher is not built yet, so there is no way for a user to express a
 * preference. When that lands, this is the one function that changes.
 *
 * Returns null rather than throwing, because a brand-new user legitimately has
 * no business yet and the caller wants to show them the "create one" state
 * rather than an error.
 */

import { createClient } from "@/lib/supabase/server";
import type { CurrencyCode } from "@/lib/money";

export type CurrentBusiness = {
  id: string;
  name: string;
  currency: CurrencyCode;
  stage: string | null;
  industry: string | null;
  location: string | null;
};

export async function getCurrentBusiness(): Promise<CurrentBusiness | null> {
  const supabase = await createClient();

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id, name, currency, stage, industry, location")
    .order("created_at", { ascending: true })
    .limit(1);

  // RLS returns no rows rather than an error when the user is not a member, so
  // an empty result is a normal outcome, not a failure.
  if (error) return null;

  const business = businesses?.[0];
  if (!business) return null;

  return {
    id: business.id,
    name: business.name,
    // Cast rather than validate: the column has a CHECK constraint listing the
    // supported codes, so the value is already one of them.
    currency: (business.currency ?? "UGX") as CurrencyCode,
    stage: business.stage ?? null,
    industry: business.industry ?? null,
    location: business.location ?? null,
  };
}
