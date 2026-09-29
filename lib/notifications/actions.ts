"use server";

/**
 * Notifications.
 *
 * The PRD asks for notifications on new orders and consultations. What is
 * actually built here is the in-app list, the read state, and the preference
 * flags that decide what would be created.
 *
 * No email is sent. `isEmailConfigured()` is false until a provider is chosen,
 * and an un-sent email that reports itself as sent is worse than no email.
 * Open question 6 in docs/DECISIONS.md.
 *
 * Notifications are derived from state, not pushed. A notification row is
 * created by application code at the moment something happens; nothing is
 * queued, so a missed write means a missed notification rather than a
 * notification delivered three times.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { isEmailConfigured } from "@/lib/config";
import type { ActionState } from "@/lib/auth/actions";

/**
 * Create a notification for a business, honouring the owner's preferences.
 *
 * Called from wherever an event happens. Returns quietly when the user has
 * turned that kind of notification off — a preference is not an error.
 *
 * Never throws: a notification failing must not roll back the order that
 * caused it. The order matters more than the alert about the order.
 */
export async function notify(params: {
  /** Recipient. The table is keyed on the person, not the business. */
  userId: string;
  businessId: string;
  kind: "new_order" | "consultation" | "weekly_digest" | "info";
  title: string;
  body?: string | null;
  /** Where the notification points, stored in `data` — there is no href column. */
  href?: string | null;
}): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: settings } = await supabase
      .from("business_settings")
      .select("notify_new_order, notify_consultation, weekly_digest")
      .eq("business_id", params.businessId)
      .maybeSingle();

    const wanted =
      params.kind === "new_order"
        ? (settings?.notify_new_order ?? true)
        : params.kind === "consultation"
          ? (settings?.notify_consultation ?? true)
          : params.kind === "weekly_digest"
            ? (settings?.weekly_digest ?? false)
            : true;

    if (!wanted) return;

    await supabase.from("notifications").insert({
      user_id: params.userId,
      business_id: params.businessId,
      type: params.kind,
      title: params.title,
      body: params.body ?? null,
      data: params.href ? { href: params.href } : {},
      channel: "in_app",
    });
  } catch {
    // Swallowed deliberately. See the note above.
  }
}

export async function markNotificationsReadAction(formData: FormData): Promise<void> {
  const business = await getCurrentBusiness();
  if (!business) return;

  const supabase = await createClient();

  // An id is optional. Without one this marks everything read, which is what
  // the "Mark all read" button sends.
  const id = String(formData.get("id") ?? "").trim();

  const query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("business_id", business.id)
    .is("read_at", null);

  const { error } = id ? await query.eq("id", id) : await query;

  if (error) {
    // Not fatal. The user sees the badge unchanged and tries again.
    return;
  }

  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}

export async function deleteNotificationAction(formData: FormData): Promise<void> {
  const business = await getCurrentBusiness();
  if (!business) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("notifications").delete().eq("id", id).eq("business_id", business.id);

  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}
