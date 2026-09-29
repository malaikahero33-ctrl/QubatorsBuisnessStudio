"use server";

/**
 * Finance.
 *
 * Income and expenses are both rows in `transactions`, with the direction in
 * `type`. The separate `expenses` table exists in the schema but is not used:
 * two tables for the same facts is two chances to disagree, and the dashboard
 * already reads `transactions`.
 *
 * A transaction is NOT auto-created when an order completes. A paid order and
 * a recorded payment are genuinely different things, and conflating them means
 * revenue is counted twice. Link with `order_id` instead, and the order can be
 * recognised without the money being assumed.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { createTransactionSchema, toFieldErrors } from "@/lib/validation/schemas";
import { isSupabaseConfigured } from "@/lib/config";
import type { ActionState } from "@/lib/auth/actions";

function friendlyError(message: string): string {
  if (/transactions_amount_minor_positive|amount_minor/i.test(message)) {
    return "The amount must be a whole number greater than zero.";
  }
  if (/transactions_type_check|type/i.test(message)) {
    return "Money in or money out — one of the two, not something else.";
  }
  if (/permission denied|row-level security/i.test(message)) {
    return "You do not have access to these records. Sign in again and retry.";
  }
  if (/foreign key|violates/i.test(message)) {
    return "That customer or order no longer exists.";
  }
  return message;
}

export async function createTransactionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Supabase is not configured. See /setup." };
  }

  const business = await getCurrentBusiness();
  if (!business) {
    return { status: "error", message: "Create a business before recording money." };
  }

  // The date input gives "2026-09-29"; the column is a timestamptz, so it is
  // anchored to midday UTC. Midnight would put a 23:00 EAT entry on the
  // previous day, which would make a monthly total quietly wrong.
  const rawDate = String(formData.get("occurred_on") ?? "").trim();
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? `${rawDate}T12:00:00.000Z`
    : "";

  const parsed = createTransactionSchema.safeParse({
    type: String(formData.get("type") ?? "").trim(),
    amount_minor: Number(formData.get("amount_minor") ?? ""),
    category: String(formData.get("category") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    occurred_on: parsedDate,
    customer_id: String(formData.get("customer_id") ?? "").trim(),
    order_id: String(formData.get("order_id") ?? "").trim(),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields",
      fields: toFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("transactions").insert({
    business_id: business.id,
    type: data.type,
    amount_minor: data.amount_minor,
    // The business's currency, not the form's. A ledger cannot mix currencies
    // without a conversion rate, and there is nowhere in this schema to store
    // one, so a business's ledger is denominated in the business's currency.
    currency: business.currency,
    category: data.category || null,
    description: data.description || null,
    occurred_at: data.occurred_on,
    customer_id: data.customer_id || null,
    order_id: data.order_id || null,
  });

  if (error) {
    return { status: "error", message: friendlyError(error.message) };
  }

  revalidatePath("/finance");
  revalidatePath("/dashboard");

  return {
    status: "success",
    message: data.type === "income" ? "Money in recorded." : "Spending recorded.",
  };
}

export async function deleteTransactionAction(formData: FormData): Promise<void> {
  const business = await getCurrentBusiness();
  if (!business) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    // business_id is in the WHERE clause as well as RLS. Belt and braces: if a
    // policy is ever misconfigured, this still cannot delete another
    // business's row.
    .eq("business_id", business.id);

  revalidatePath("/finance");
  revalidatePath("/dashboard");
}
