import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NotificationsList, type NotificationRow } from "@/components/notifications/notifications-list";
import { isSchemaReady } from "@/lib/business/actions";
import { isEmailConfigured, isSupabaseConfigured } from "@/lib/config";

export const metadata = { title: "Notifications" };

/**
 * The notification list.
 *
 * In-app only. Email delivery needs a provider that is not chosen yet (open
 * question 6 in docs/DECISIONS.md), and the page says so rather than showing
 * an email toggle that does nothing.
 */
export default async function NotificationsPage() {
  if (!isSupabaseConfigured()) redirect("/setup");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await isSchemaReady())) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">Database tables are missing</h1>
        <p className="mt-2 text-muted">
          Run <code className="font-mono">npm run db:push</code>, then reload.
        </p>
        <Link href="/dashboard" className="btn btn-primary mt-6">Back to dashboard</Link>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, data, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">Could not load notifications</h1>
        <p className="mt-2 text-muted">{error.message}</p>
        <Link href="/dashboard" className="btn mt-6">Back to dashboard</Link>
      </main>
    );
  }

  // `href` lives inside the jsonb `data` column. There is no href column.
  const rows: NotificationRow[] = (data ?? []).map((n) => {
    const d = (n.data ?? {}) as Record<string, unknown>;
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      href: typeof d.href === "string" ? d.href : null,
      read_at: n.read_at,
      created_at: n.created_at,
    };
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="mt-2 max-w-xl text-muted">
          New orders and consultation requests. Choose what you hear about in{" "}
          <Link href="/settings" className="underline">Settings</Link>.
        </p>
        {!isEmailConfigured() && (
          <p className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
            These appear in the app only. No email is being sent — that needs a
            provider, which is not chosen yet.
          </p>
        )}
      </header>

      <NotificationsList rows={rows} />
    </main>
  );
}
