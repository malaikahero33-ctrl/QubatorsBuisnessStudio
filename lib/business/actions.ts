"use server";

/**
 * Business creation.
 *
 * This is PRD acceptance criterion 3: a new user must be able to create a
 * business. It is the step between "I have an account" and "I have a
 * workspace", so until this exists the dashboard is permanently empty.
 *
 * Two details worth knowing:
 *
 * 1. The `businesses` insert fires a trigger that also creates the owner's
 *    `business_members` row and default `business_settings`. Without that
 *    membership row, RLS would deny the owner access to their own business.
 *    See supabase/migrations/20260928000001_foundation.sql.
 *
 * 2. The slug is unique. A collision appends a short random suffix rather
 *    than failing, because "someone already called that" should never block
 *    someone from starting a business.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  createBusinessSchema,
  slugify,
  toFieldErrors,
} from "@/lib/validation/schemas";
import { parseMoneyInput, type CurrencyCode } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/config";
import type { ActionState } from "@/lib/auth/actions";

/** Postgres error code for a unique-violation. */
const UNIQUE_VIOLATION = "23505";

/** 42P01 is undefined_table, 42703 is undefined_column. */
const UNDEFINED_TABLE = "42P01";
const UNDEFINED_COLUMN = "42703";

function friendlyDbError(message: string): { message: string; needsMigrations: boolean } {
  const missing =
    /relation "public\.\w+" does not exist/i.test(message) ||
    /column .* does not exist/i.test(message);

  if (missing) {
    return {
      needsMigrations: true,
      message:
        "The database tables do not exist yet. Run the migrations first: npm run db:seed",
    };
  }
  if (/row-level security|permission denied/i.test(message)) {
    return {
      needsMigrations: false,
      message:
        "You do not have permission to create a business. Sign in again and retry.",
    };
  }
  return { needsMigrations: false, message };
}

/** A slug that is very likely unique. */
function slugWithSuffix(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 7);
  const stem = base.length > 70 ? base.slice(0, 70) : base;
  return `${stem}-${suffix}`;
}

export async function createBusinessAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message: "Supabase is not configured. See /setup for the steps.",
    };
  }

  const parsed = createBusinessSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    industry: String(formData.get("industry") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    currency: String(formData.get("currency") ?? "UGX").trim() || "UGX",
    stage: String(formData.get("stage") ?? "idea").trim() || "idea",
    target_customer: String(formData.get("target_customer") ?? "").trim(),
    goals: String(formData.get("goals") ?? "").trim(),
    price_min: String(formData.get("price_min") ?? "").trim(),
    price_max: String(formData.get("price_max") ?? "").trim(),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields",
      fields: toFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const currency = data.currency as CurrencyCode;

  // Free-text price inputs become integer minor units here, and nowhere else.
  const priceMin = data.price_min ? parseMoneyInput(data.price_min, currency) : null;
  const priceMax = data.price_max ? parseMoneyInput(data.price_max, currency) : null;

  const fields: Record<string, string> = {};
  if (data.price_min && priceMin === null) {
    fields.price_min = "That is not a number we can read";
  }
  if (data.price_max && priceMax === null) {
    fields.price_max = "That is not a number we can read";
  }
  // Catch an inverted range early, with a message the user can act on. The
  // database CHECK constraint is still the real enforcement.
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    fields.price_min = "The low price must be less than the high price";
  }
  if (Object.keys(fields).length) {
    return { status: "error", message: "Check the highlighted fields", fields };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "Your session expired. Sign in again." };
  }

  const baseSlug = slugify(data.name);
  // A name made entirely of punctuation has no slug. Fall back rather than fail.
  const primarySlug = baseSlug.length >= 2 ? baseSlug : `business-${Date.now().toString(36)}`;

  const insert = async (slug: string) =>
    supabase.from("businesses").insert({
      owner_id: user.id,
      name: data.name,
      slug,
      industry: data.industry || null,
      location: data.location || null,
      stage: data.stage,
      currency,
      target_customer: data.target_customer || null,
      goals: data.goals || null,
      price_range_minor: priceMin,
      price_range_maxor: priceMax,
    });

  let lastError: string | null = null;

  for (const slug of [primarySlug, slugWithSuffix(primarySlug)]) {
    const { error } = await insert(slug);
    if (!error) {
      // redirect() throws; must be outside any try/catch.
      redirect("/dashboard?created=1");
    }
    lastError = error.message;
    if (!/duplicate key|unique/i.test(error.message)) break;
  }

  const friendly = friendlyDbError(lastError ?? "Unknown error");
  return { status: "error", message: friendly.message };
}

/**
 * Whether the database is ready.
 *
 * The dashboard calls this so a missing schema shows an instruction rather
 * than a stack trace. It is a cheap, single-row existence check.
 */
export async function isSchemaReady(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("businesses").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}
