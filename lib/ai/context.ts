/**
 * Build the business context injected into every prompt.
 *
 * Read fresh on each request rather than cached. The context includes the
 * product list and prices, and a founder who adds a product expects the next
 * answer to know about it. A stale context produces confidently wrong advice,
 * which is the specific failure mode the PRD's assumption rules exist to
 * prevent (section 7).
 */

import { createClient } from "@/lib/supabase/server";
import type { BusinessContext } from "@/lib/ai/provider";

/** How many products to include. Enough to be useful, bounded for the prompt. */
const MAX_PRODUCTS = 20;

export async function buildBusinessContext(
  businessId: string,
): Promise<BusinessContext | null> {
  const supabase = await createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select(
      "id, name, industry, location, stage, currency, target_customer, brand_personality, goals, price_range_minor, price_range_maxor",
    )
    .eq("id", businessId)
    .maybeSingle();

  if (!business) return null;

  // A missing products table must not take the Copilot down with it. An empty
  // catalogue produces slightly blunter advice, which is recoverable; a thrown
  // error produces nothing at all.
  const { data: products } = await supabase
    .from("products")
    .select("name, price_minor")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("name")
    .limit(MAX_PRODUCTS);

  const context: BusinessContext = {
    name: business.name,
    industry: business.industry ?? "Not specified",
    location: business.location ?? "Not specified",
    stage: business.stage ?? "idea",
    targetCustomer: business.target_customer ?? "",
    currency: business.currency ?? "UGX",
    products: (products ?? []).map((p) => ({
      name: p.name,
      priceMinor: p.price_minor,
    })),
  };

  if (business.brand_personality) context.brandPersonality = business.brand_personality;
  if (business.goals) context.goals = business.goals;

  if (
    business.price_range_minor !== null &&
    business.price_range_maxor !== null
  ) {
    context.priceRangeMinor = {
      min: business.price_range_minor,
      max: business.price_range_maxor,
    };
  }

  return context;
}
