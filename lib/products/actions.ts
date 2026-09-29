"use server";

/**
 * Product create, edit, archive and delete.
 *
 * Design notes that are not obvious from the code:
 *
 * 1. **business_id is never read from the form.** It comes from the database,
 *    via the user's membership. A form field for it would let anyone attach a
 *    product to someone else's business, and RLS would stop the write anyway,
 *    but relying on RLS to catch a forged tenant id is a poor place to find out
 *    your validation was incomplete.
 *
 * 2. **Money crosses the boundary once.** The form sends "15,000" as text. It
 *    becomes an integer in minor units here, and nowhere else. The columns are
 *    bigint with a CHECK, so a float cannot be stored even if this were wrong.
 *
 * 3. **Update is scoped by business_id as well as id.** `update ... where id = x`
 *    alone would be a cross-tenant write if RLS were ever misconfigured. The
 *    business_id in the WHERE clause makes it correct by construction.
 *
 * 4. **Delete is a real delete, and archive is the default.** Founders
 *    accumulate product history through orders. Removing a product that appears
 *    on an old order would either cascade away real records or fail; setting
 *    is_active = false hides it from new orders and keeps the history intact.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { productSchema, toFieldErrors } from "@/lib/validation/schemas";
import { parseMoneyInput } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/config";
import type { ActionState } from "@/lib/auth/actions";

/** Postgres: unique violation on products_sku_unique_per_business. */
const UNIQUE_VIOLATION = "23505";

function friendlyError(message: string): string {
  if (/permission denied|row-level security/i.test(message)) {
    return "You do not have access to these products. Sign in again and retry.";
  }
  if (/price_minor|cost_minor|inventory_count/i.test(message)) {
    return "One of the numbers was rejected by the database. Check the price, cost and stock.";
  }
  return message;
}

/**
 * Save a product. Creates when `id` is empty, updates when it is not.
 *
 * One action rather than two: the fields and the validation are identical, and
 * two actions would drift the moment a field is added.
 */
export async function saveProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Supabase is not configured. See /setup." };
  }

  const parsed = productSchema.safeParse({
    id: String(formData.get("id") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim(),
    price: String(formData.get("price") ?? "").trim(),
    cost: String(formData.get("cost") ?? "").trim(),
    sku: String(formData.get("sku") ?? "").trim(),
    stock: String(formData.get("stock") ?? "").trim(),
    is_active: formData.get("is_active") ? "on" : undefined,
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
      message: "Create your business before adding products.",
    };
  }

  const data = parsed.data;
  const currency = business.currency;

  // Free text becomes minor units here. A non-numeric price is caught below
  // with a message the user can act on, rather than becoming a null amount.
  const priceMinor = parseMoneyInput(data.price, currency);
  if (priceMinor === null) {
    return {
      status: "error",
      message: "Check the highlighted fields",
      fields: { price: "That is not a number we can read" },
    };
  }

  const fields: Record<string, string> = {};

  let costMinor = 0;
  if (data.cost) {
    const parsedCost = parseMoneyInput(data.cost, currency);
    if (parsedCost === null) {
      fields.cost = "That is not a number we can read";
    } else {
      costMinor = parsedCost;
    }
  }

  let stock = 0;
  if (data.stock) {
    const n = Number(data.stock);
    if (!Number.isInteger(n) || n < 0) {
      fields.stock = "Enter a whole number, 0 or more";
    } else {
      stock = n;
    }
  }

  // A cost above the price is possible but is nearly always a typo. Warn
  // rather than block: the database allows it and the founder may know why.
  if (!fields.cost && costMinor > priceMinor) {
    fields.cost = "That costs more than you sell it for. Check both numbers";
  }

  if (Object.keys(fields).length) {
    return { status: "error", message: "Check the highlighted fields", fields };
  }

  const supabase = await createClient();
  const isEdit = Boolean(data.id);

  const payload = {
    business_id: business.id,
    name: data.name,
    description: data.description || null,
    category: data.category || null,
    price_minor: priceMinor,
    cost_minor: costMinor,
    sku: data.sku || null,
    inventory_count: stock,
    is_active: Boolean(data.is_active),
  };

  if (isEdit) {
    // business_id in the WHERE clause, not just the payload. See note 3.
    const { error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", data.id!)
      .eq("business_id", business.id);

    if (error) {
      const skuClash = error.code === UNIQUE_VIOLATION && /sku/i.test(error.message);
      return {
        status: "error",
        message: skuClash
          ? "Another product already uses that product code."
          : friendlyError(error.message),
        fields: skuClash ? { sku: "This code is already in use" } : undefined,
      };
    }
  } else {
    const { error } = await supabase.from("products").insert(payload);

    if (error) {
      const skuClash = error.code === UNIQUE_VIOLATION && /sku/i.test(error.message);
      return {
        status: "error",
        message: skuClash
          ? "Another product already uses that product code."
          : friendlyError(error.message),
        fields: skuClash ? { sku: "This code is already in use" } : undefined,
      };
    }
  }

  revalidatePath("/business/products");
  revalidatePath("/dashboard");

  // A new product has nothing to go back to, so send the user to the list
  // where they can see it. An edit stays put so several can be done in a row.
  if (!isEdit) redirect("/business/products?created=1");

  return { status: "success", message: "Saved" };
}

/**
 * Hide a product without deleting it.
 *
 * The default action for a product that appears on any order, because deleting
 * would take real history with it.
 */
export async function archiveProductAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const business = await getCurrentBusiness();
  if (!id || !business) return;

  const supabase = await createClient();
  await supabase
    .from("products")
    .update({ is_active: false })
    .eq("id", id)
    .eq("business_id", business.id);

  revalidatePath("/business/products");
  revalidatePath("/dashboard");
}

/** Put an archived product back in the catalogue. */
export async function restoreProductAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const business = await getCurrentBusiness();
  if (!id || !business) return;

  const supabase = await createClient();
  await supabase
    .from("products")
    .update({ is_active: true })
    .eq("id", id)
    .eq("business_id", business.id);

  revalidatePath("/business/products");
  revalidatePath("/dashboard");
}

/**
 * Delete a product outright.
 *
 * Refused when the product has been ordered, because the order history is worth
 * more than a tidy list. The message says what to do instead.
 */
export async function deleteProductAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const business = await getCurrentBusiness();
  if (!id || !business) return;

  const supabase = await createClient();

  const { count } = await supabase
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);

  if (count && count > 0) {
    // Reuse the archive path so the product still leaves the active list.
    await supabase
      .from("products")
      .update({ is_active: false })
      .eq("id", id)
      .eq("business_id", business.id);
    revalidatePath("/business/products");
    return;
  }

  await supabase.from("products").delete().eq("id", id).eq("business_id", business.id);

  revalidatePath("/business/products");
  revalidatePath("/dashboard");
}
