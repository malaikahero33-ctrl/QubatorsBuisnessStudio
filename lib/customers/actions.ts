"use server";

/**
 * Customer create, edit and delete.
 *
 * Mirrors lib/products/actions.ts. The two differences worth naming:
 *
 * 1. **The phone is normalised here, not stored raw.** A founder types
 *    0772123456. The column requires E.164. lib/phone.ts bridges the two and
 *    owns the rule, so the conversion is testable without a database.
 *
 * 2. **`lifetime_value_minor` and `first_order_at` are never written.** They are
 *    derived from completed orders and maintained by a database trigger. If
 *    the client could set them, a crafted request would invent a customer worth
 *    a billion shillings, and the analytics would believe it.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { customerSchema, toFieldErrors } from "@/lib/validation/schemas";
import { normalisePhone, phoneErrorMessage } from "@/lib/phone";
import { isSupabaseConfigured } from "@/lib/config";
import type { ActionState } from "@/lib/auth/actions";

function friendlyError(message: string): string {
  if (/permission denied|row-level security/i.test(message)) {
    return "You do not have access to these customers. Sign in again and retry.";
  }
  if (/customers_has_contact/i.test(message)) {
    return "Add a phone number or an email, so you can reach this customer.";
  }
  return message;
}

export async function saveCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Supabase is not configured. See /setup." };
  }

  const parsed = customerSchema.safeParse({
    id: String(formData.get("id") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    stage: String(formData.get("stage") ?? "lead").trim() || "lead",
    notes: String(formData.get("notes") ?? "").trim(),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields",
      fields: toFieldErrors(parsed.error),
    };
  }

  const business = await getCurrentBusiness();
  if (!business) {
    return {
      status: "error",
      message: "Create your business before adding customers.",
    };
  }

  const data = parsed.data;
  const fields: Record<string, string> = {};

  // Email: lowercase for matching, and validate the shape only when present.
  // An empty string means "no email", not "invalid email".
  let email: string | null = null;
  if (data.email) {
    const normalised = data.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
      fields.email = "That does not look like an email address";
    } else {
      email = normalised;
    }
  }

  // Phone: 0772123456 -> +256772123456. See lib/phone.ts.
  let phone: string | null = null;
  if (data.phone) {
    const result = normalisePhone(data.phone);
    if (!result.ok) {
      const message = phoneErrorMessage(result.reason);
      if (message) fields.phone = message;
    } else {
      phone = result.e164;
    }
  }

  // The schema's refine covers the "neither given" case, but only when the
  // values are non-empty strings. Re-check after trimming so whitespace-only
  // input cannot slip past it.
  if (!email && !phone) {
    fields.phone = "Add a phone number or an email, so you can reach them";
  }

  if (Object.keys(fields).length) {
    return { status: "error", message: "Check the highlighted fields", fields };
  }

  const supabase = await createClient();
  const isEdit = Boolean(data.id);

  // Note the absence of lifetime_value_minor and first_order_at. See note 2.
  const payload = {
    business_id: business.id,
    name: data.name,
    email,
    phone,
    location: data.location || null,
    stage: data.stage,
    notes: data.notes || null,
  };

  if (isEdit) {
    const { error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", data.id!)
      .eq("business_id", business.id);

    if (error) {
      return { status: "error", message: friendlyError(error.message) };
    }
  } else {
    const { error } = await supabase.from("customers").insert(payload);

    if (error) {
      return { status: "error", message: friendlyError(error.message) };
    }
  }

  revalidatePath("/customers");
  revalidatePath("/dashboard");

  if (!isEdit) redirect("/customers?created=1");

  return { status: "success", message: "Saved" };
}

export async function deleteCustomerAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const business = await getCurrentBusiness();
  if (!id || !business) return;

  const supabase = await createClient();

  // Orders reference customers with ON DELETE SET NULL, so deleting a customer
  // keeps the order and its total and only blanks the customer link. That is
  // the right trade: the revenue was real. The list below removes the
  // "2 paying" figure, which is itself derived from this table.
  await supabase.from("customers").delete().eq("id", id).eq("business_id", business.id);

  revalidatePath("/customers");
  revalidatePath("/dashboard");
}
