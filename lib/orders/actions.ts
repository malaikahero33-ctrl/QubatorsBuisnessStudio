"use server";

/**
 * Orders.
 *
 * The most important thing in this file is what is *absent*: there is no
 * `total` parameter anywhere.
 *
 * An order total is a GENERATED column (`line_total_minor`) recomputed by a
 * database trigger from its items. A client that posts its own total is
 * simply overwritten, so the usual price-tampering hole does not exist here —
 * it cannot be opened, because there is no field to tamper with.
 *
 * The order number is also server-generated. Accepting one from the client
 * would let two orders collide on the per-business unique constraint.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business/current";
import {
  createOrderSchema,
  toFieldErrors,
  ORDER_STATUSES,
} from "@/lib/validation/schemas";
import { isSupabaseConfigured } from "@/lib/config";
import type { ActionState } from "@/lib/auth/actions";

/** Next order number for a business: QB-1004, QB-1005, … */
async function nextOrderNumber(businessId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("order_number")
    .eq("business_id", businessId)
    .order("order_number", { ascending: false })
    .limit(1);

  const last = data?.[0]?.order_number ?? "";
  const n = parseInt(last.split("-")[1] ?? "", 10);
  const next = Number.isFinite(n) && n > 0 ? n + 1 : 1001;
  return `QB-${next}`;
}

function friendlyError(message: string): string {
  if (/order_items_one_catalogue_reference/i.test(message)) {
    return "A line can point at a product, a service, or neither — not more than one.";
  }
  if (/order_items_check|quantity/i.test(message)) {
    return "Check the quantities: they must be whole numbers of at least 1.";
  }
  if (/line_total_minor|generated/i.test(message)) {
    return "The order total is calculated by the database and cannot be set by hand.";
  }
  if (/orders_number_unique|duplicate key/i.test(message)) {
    return "Two orders tried to take the same number. Try again.";
  }
  if (/permission denied|row-level security/i.test(message)) {
    return "You do not have access to these orders. Sign in again and retry.";
  }
  return message;
}

export async function createOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Supabase is not configured. See /setup." };
  }

  const business = await getCurrentBusiness();
  if (!business) {
    return { status: "error", message: "Create a business before adding orders." };
  }

  // The form posts items as JSON so the array survives one multipart body.
  let items: unknown = [];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { status: "error", message: "The order lines could not be read. Try again." };
  }

  const parsed = createOrderSchema.safeParse({
    customer_id: String(formData.get("customer_id") ?? "").trim(),
    status: String(formData.get("status") ?? "pending").trim() || "pending",
    due_at: String(formData.get("due_at") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    items,
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

  const orderNumber = await nextOrderNumber(business.id);
  const dueAt = data.due_at ? new Date(data.due_at).toISOString() : null;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      business_id: business.id,
      customer_id: data.customer_id,
      order_number: orderNumber,
      status: data.status,
      currency: business.currency,
      due_at: dueAt,
      notes: data.notes || null,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return { status: "error", message: friendlyError(orderError?.message ?? "Could not create the order") };
  }

  const lines = data.items.map((item) => ({
    order_id: order.id,
    business_id: business.id,
    product_id: item.product_id || null,
    service_id: item.service_id || null,
    description: item.description,
    quantity: item.quantity,
    unit_price_minor: item.unit_price_minor,
  }));

  const { error: itemError } = await supabase.from("order_items").insert(lines);

  if (itemError) {
    // Do not leave a headless order behind. Removing it also removes the
    // items that did insert, and the trigger has already recalculated.
    await supabase.from("orders").delete().eq("id", order.id);
    return { status: "error", message: friendlyError(itemError.message) };
  }

  revalidatePath("/orders");
  revalidatePath("/dashboard");

  return {
    status: "success",
    message: `Order ${orderNumber} created. The total was calculated by the database.`,
  };
}

export async function setOrderStatusAction(formData: FormData): Promise<void> {
  const business = await getCurrentBusiness();
  if (!business) return;

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !ORDER_STATUSES.some((s) => s.value === status)) return;

  const supabase = await createClient();
  await supabase
    .from("orders")
    .update({ status })
    .eq("id", id)
    .eq("business_id", business.id);

  // Changing status fires the trigger that updates customer lifetime value,
  // so the dashboard is stale until this runs.
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
}

export async function deleteOrderAction(formData: FormData): Promise<void> {
  const business = await getCurrentBusiness();
  if (!business) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // order_items cascade. The customer lifetime value is recalculated by the
  // same trigger, so deleting a completed order correctly reduces it.
  await supabase.from("orders").delete().eq("id", id).eq("business_id", business.id);

  revalidatePath("/orders");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
}
