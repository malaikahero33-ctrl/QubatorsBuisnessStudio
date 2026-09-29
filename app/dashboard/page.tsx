import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { isAiConfigured } from "@/lib/config";

export const metadata = { title: "Dashboard" };

/**
 * The first screen with real data in it.
 *
 * Every number here comes from Postgres through RLS. There are no placeholder
 * figures: if a business has no orders, the card says zero, because a
 * dashboard that invents data is worse than an empty one.
 */
export default async function DashboardPage() {
  const supabase = await createClient();

  // Membership is the tenant boundary. See lib/supabase/server.ts.
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, stage, currency, industry, location")
    .order("created_at", { ascending: true });

  const business = businesses?.[0] ?? null;

  if (!business) {
    return <EmptyState />;
  }

  // Run the reads together rather than in sequence: the dashboard is the most
  // visited page and these are independent.
  const [products, services, customers, orders, transactions, tasks] = await Promise.all([
    supabase
      .from("products")
      .select("id, price_minor, inventory_count")
      .eq("business_id", business.id),
    supabase
      .from("services")
      .select("id, price_minor")
      .eq("business_id", business.id),
    supabase
      .from("customers")
      .select("id, stage")
      .eq("business_id", business.id),
    supabase
      .from("orders")
      .select("id, order_number, status, total_minor, placed_at")
      .eq("business_id", business.id)
      .order("placed_at", { ascending: false })
      .limit(6),
    supabase
      .from("transactions")
      .select("type, amount_minor")
      .eq("business_id", business.id),
    supabase
      .from("tasks")
      .select("id, status")
      .eq("business_id", business.id)
      .in("status", ["todo", "in_progress", "blocked"]),
  ]);

  const currency = (business.currency ?? "UGX") as "UGX";

  const revenue = (transactions.data ?? [])
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount_minor, 0);

  const spend = (transactions.data ?? [])
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount_minor, 0);

  const openOrders = (orders.data ?? []).filter((o) => o.status !== "completed" && o.status !== "cancelled");

  const customersList = customers.data ?? [];
  const payingCustomers = customersList.filter((c) => c.stage === "customer" || c.stage === "returning" || c.stage === "vip");

  const stats = [
    { label: "Revenue in", value: formatMoney(revenue, currency), tone: "text-success" },
    { label: "Spent", value: formatMoney(spend, currency), tone: "text-foreground" },
    { label: "Profit", value: formatMoney(revenue - spend, currency), tone: revenue - spend >= 0 ? "text-success" : "text-danger" },
    { label: "Open orders", value: String(openOrders.length), tone: "text-foreground" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{business.industry ?? "Your business"}</p>
          <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
          {business.location && <p className="text-sm text-muted">{business.location}</p>}
        </div>
        <span className="pill pill-brand capitalize">{business.stage}</span>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold text-muted">{s.label}</p>
            <p className={`mt-1.5 text-2xl font-extrabold tracking-tight ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <CountCard label="Products" count={products.data?.length ?? 0} soon />
        <CountCard label="Services" count={services.data?.length ?? 0} soon />
        <CountCard
          label="Customers"
          count={customersList.length}
          sub={`${payingCustomers.length} paying`}
          soon
        />
      </section>

      <section className="mt-8 rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-bold">Recent orders</h2>
          <span className="text-xs text-muted">{(orders.data ?? []).length} shown</span>
        </div>

        {orders.data?.length ? (
          <ul>
            {orders.data.map((order) => (
              <li
                key={order.id}
                className="flex items-center gap-4 border-b border-border px-5 py-3 last:border-0"
              >
                <span className="font-mono text-xs font-semibold">{order.order_number}</span>
                <span className="pill pill-info capitalize">{order.status.replace("_", " ")}</span>
                <span className="ml-auto font-mono text-sm font-semibold">
                  {formatMoney(order.total_minor, currency)}
                </span>
                <span className="hidden w-24 text-right text-xs text-muted sm:inline">
                  {new Date(order.placed_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-muted">
            No orders yet. Add a customer and a product, then create your first order.
          </p>
        )}
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-bold">Next step</h2>
          <p className="mt-1.5 text-sm text-muted">
            {isAiConfigured()
              ? "The AI Copilot is ready. Describe your idea and it will analyse it."
              : "Describe your business idea to get a structured analysis."}
          </p>
          <span className="btn btn-sm mt-3 cursor-not-allowed opacity-60">Open Copilot</span>
          <p className="mt-2 text-xs text-muted">Available once the AI engine is built.</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-bold">Open tasks</h2>
          <p className="mt-1.5 text-sm text-muted">
            {tasks.data?.length
              ? `${tasks.data.length} task${tasks.data.length === 1 ? "" : "s"} need attention.`
              : "Nothing outstanding. Add tasks to keep the plan moving."}
          </p>
          <span className="btn btn-sm mt-3 cursor-not-allowed opacity-60">View tasks</span>
          <p className="mt-2 text-xs text-muted">Available once the task module is built.</p>
        </div>
      </section>
    </main>
  );
}

function CountCard({
  label,
  count,
  sub,
  soon,
}: {
  label: string;
  count: number;
  sub?: string;
  soon?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold tracking-tight">{count}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
      {soon && <p className="mt-1 text-[11px] uppercase tracking-wide text-muted/70">coming soon</p>}
    </div>
  );
}

function EmptyState() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">No business yet</h1>
      <p className="mt-2 text-muted">
        You are signed in. The first thing to do is say what you are building.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6">
        <h2 className="text-sm font-bold">What happens next</h2>
        <ol className="mt-3 space-y-2 text-sm text-muted">
          <li>
            <b className="text-foreground">1.</b> Create your business — name, what you do, where
            you are
          </li>
          <li>
            <b className="text-foreground">2.</b> Describe your idea and get a structured analysis
          </li>
          <li>
            <b className="text-foreground">3.</b> Build a brand you can print
          </li>
          <li>
            <b className="text-foreground">4.</b> Add products, then customers, then orders
          </li>
        </ol>
        <Link href="/business/new" className="btn btn-primary mt-5">
          Create your business
        </Link>
      </div>

      <Link href="/" className="mt-6 inline-block text-sm text-brand underline">
        Back to the home page
      </Link>
    </main>
  );
}
