import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { FinanceManager, type FinanceRow } from "@/components/finance/finance-manager";
import { summariseLedger, type LedgerEntry } from "@/lib/finance/summarise";
import { isSchemaReady } from "@/lib/business/actions";
import type { CurrencyCode } from "@/lib/money";

export const metadata = { title: "Finance" };

/**
 * Money in, money out, and what is left.
 *
 * The page fetches every transaction for the business and summarises in
 * memory. That is the right call while a business has hundreds of rows and the
 * wrong one when it has millions — the aggregate belongs in a Postgres view or
 * a materialised view eventually. Flagged rather than hidden, because a
 * dashboard that quietly loads 200k rows will fall over.
 */
export default async function FinancePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const business = await getCurrentBusiness();

  if (!(await isSchemaReady())) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">Database tables are missing</h1>
        <p className="mt-2 text-muted">
          Run <code className="font-mono">npm run db:seed</code>, then reload.
        </p>
        <Link href="/dashboard" className="btn btn-primary mt-6">Back to dashboard</Link>
      </main>
    );
  }

  if (!business) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">No business yet</h1>
        <p className="mt-2 text-muted">Create a business before recording money for it.</p>
        <Link href="/business/new" className="btn btn-primary mt-6">Create your business</Link>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("id, type, amount_minor, category, description, occurred_at, customers(name), orders(order_number)")
    .eq("business_id", business.id)
    .order("occurred_at", { ascending: false })
    .limit(500);

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">Could not load your records</h1>
        <p className="mt-2 text-muted">{error.message}</p>
        <Link href="/dashboard" className="btn mt-6">Back to dashboard</Link>
      </main>
    );
  }

  const raw = data ?? [];

  const summary = summariseLedger(
    raw.map((t) => ({
      type: t.type as LedgerEntry["type"],
      amount_minor: t.amount_minor,
      category: t.category,
      occurred_at: t.occurred_at,
    })),
  );

  const rows: FinanceRow[] = raw.map((t) => ({
    id: t.id,
    type: t.type as FinanceRow["type"],
    amount_minor: t.amount_minor,
    category: t.category,
    description: t.description,
    occurred_at: t.occurred_at,
    customer: Array.isArray(t.customers) ? (t.customers[0] ?? null) : (t.customers ?? null),
    order: Array.isArray(t.orders) ? (t.orders[0] ?? null) : (t.orders ?? null),
  }));

  const truncated = raw.length === 500;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm text-muted">{business.name}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Finance</h1>
        <p className="mt-2 max-w-xl text-muted">
          Every shilling in and every shilling out. Amounts are whole numbers —
          {business.currency} has no minor unit in circulation, so nothing here
          is ever rounded.
        </p>
      </header>

      {truncated && (
        <p className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Showing the most recent 500 entries. Older ones are not included in these totals.
        </p>
      )}

      <FinanceManager rows={rows} summary={summary} currency={business.currency as CurrencyCode} />
    </main>
  );
}
