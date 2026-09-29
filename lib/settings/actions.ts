"use server";

/**
 * Settings.
 *
 * Business profile, account profile and preferences.
 *
 * The `business_id` in each update is checked against the caller's own
 * business rather than trusted. RLS already blocks cross-tenant writes, but
 * the check here means a mismatched id produces a clear message instead of
 * "new row violates row-level security policy", which tells the user nothing.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business/current";
import {
  updateBusinessSchema,
  updateProfileSchema,
  updateSettingsSchema,
  normalisePhone,
  toFieldErrors,
} from "@/lib/validation/schemas";
import { isSupabaseConfigured } from "@/lib/config";
import type { ActionState } from "@/lib/auth/actions";

function friendlyError(message: string): string {
  if (/row-level security|permission denied/i.test(message)) {
    return "You do not have permission to change that. Sign in again and retry.";
  }
  if (/profiles_phone_e164/i.test(message)) {
    return "That phone number is not in international format. Try +256772123456.";
  }
  if (/businesses_name_check|length/i.test(message)) {
    return "Check the length of that field.";
  }
  if (/businesses_stage_check/i.test(message)) {
    return "That is not a valid stage.";
  }
  return message;
}

/** Confirms the id belongs to a business this user can actually see. */
async function ownsBusiness(businessId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();
  return Boolean(data);
}

export async function updateBusinessAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Supabase is not configured. See /setup." };
  }

  const parsed = updateBusinessSchema.safeParse({
    id: String(formData.get("id") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    industry: String(formData.get("industry") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    stage: String(formData.get("stage") ?? "idea").trim() || "idea",
    target_customer: String(formData.get("target_customer") ?? "").trim(),
    brand_personality: String(formData.get("brand_personality") ?? "").trim(),
    goals: String(formData.get("goals") ?? "").trim(),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields",
      fields: toFieldErrors(parsed.error),
    };
  }

  if (!(await ownsBusiness(parsed.data.id))) {
    return { status: "error", message: "That business is not yours to edit." };
  }

  const { id, ...fields } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("businesses")
    .update({
      name: fields.name,
      industry: fields.industry || null,
      location: fields.location || null,
      stage: fields.stage,
      target_customer: fields.target_customer || null,
      brand_personality: fields.brand_personality || null,
      goals: fields.goals || null,
    })
    .eq("id", id);

  if (error) {
    return { status: "error", message: friendlyError(error.message) };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");

  return { status: "success", message: "Business details saved." };
}

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Supabase is not configured. See /setup." };
  }

  const parsed = updateProfileSchema.safeParse({
    full_name: String(formData.get("full_name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    country_code: String(formData.get("country_code") ?? "").trim().toUpperCase(),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields",
      fields: toFieldErrors(parsed.error),
    };
  }

  const fields: Record<string, string> = {};
  let phone: string | null = null;

  if (parsed.data.phone) {
    phone = normalisePhone(parsed.data.phone);
    if (!phone) {
      fields.phone = "That does not look like a phone number. Try 0772 123 456.";
    }
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

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone,
      country_code: parsed.data.country_code || null,
    })
    .eq("id", user.id);

  if (error) {
    return { status: "error", message: friendlyError(error.message) };
  }

  revalidatePath("/settings");
  return { status: "success", message: "Your details saved." };
}

export async function updateSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Supabase is not configured. See /setup." };
  }

  const parsed = updateSettingsSchema.safeParse({
    business_id: String(formData.get("business_id") ?? "").trim(),
    // Checkboxes are absent from the payload when unticked, so absence means
    // false. Reading `formData.get(...) === "on"` directly would work too, but
    // going through zod means the same validation covers every form.
    notify_new_order: formData.get("notify_new_order") === "on",
    notify_consultation: formData.get("notify_consultation") === "on",
    weekly_digest: formData.get("weekly_digest") === "on",
    onboarding_step:
      String(formData.get("onboarding_step") ?? "create_business").trim() || "create_business",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields",
      fields: toFieldErrors(parsed.error),
    };
  }

  if (!(await ownsBusiness(parsed.data.business_id))) {
    return { status: "error", message: "That business is not yours to change." };
  }

  const supabase = await createClient();

  // Upsert, because the row is created by a trigger on business creation but a
  // user who predates that trigger has none, and a plain update would silently
  // do nothing.
  const { error } = await supabase.from("business_settings").upsert({
    business_id: parsed.data.business_id,
    notify_new_order: parsed.data.notify_new_order,
    notify_consultation: parsed.data.notify_consultation,
    weekly_digest: parsed.data.weekly_digest,
    onboarding_step: parsed.data.onboarding_step,
  });

  if (error) {
    return { status: "error", message: friendlyError(error.message) };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");

  return { status: "success", message: "Preferences saved." };
}
