import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { OrdersManager } from "@/components/orders/orders-manager";
import { isSchemaReady } from "@/lib/business/actions";
import { isSupabaseConfigured } from "@/lib/config";
import type { CurrencyCode } from "@/lib/money";

export const metadata = { title: "Orders" };

export default async function OrdersPage() {
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
          Run <code className="font-mono">npm run db:seed</code>, then reload this page.
        </p>
        <Link href="/dashboard" className="btn btn-primary mt-6">Back to dashboard</Link>
      </main>
    );
  }

  const business = await getCurrentBusiness();
  if (!business) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">No business yet</h1>
        <p className="mt-2 text-muted">Create a business before adding orders to it.</p>
        <Link href="/business/new" className="btn btn-primary mt-6">Create your business</Link>
      </main>
    );
  }

  // Customers and products are needed for the order form's pickers.
  const [ordersRes, customersRes, productsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, status, total_minor, placed_at, due_at, customers(name), order_items(id, description, quantity, line_total_minor)")
      .eq("business_id", business.id)
      .order("placed_at", { ascending: false }),
    supabase.from("customers").select("id, name").eq("business_id", business.id).order("name"),
    supabase
      .from("products")
      .select("id, name, price_minor, is_active")
      .eq("business_id", business.id)
      .order("name"),
  ]);

  if (ordersRes.error) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">Could not load orders</h1>
        <p className="mt-2 text-muted">{ordersRes.error.message}</p>
        <Link href="/dashboard" className="btn mt-6">Back to dashboard</Link>
      </main>
    );
  }

  const orders = (ordersRes.data ?? []).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    total_minor: o.total_minor,
    placed_at: o.placed_at,
    due_at: o.due_at,
    customer: Array.isArray(o.customers) ? (o.customers[0] ?? null) : (o.customers ?? null),
    items: (o.order_items ?? []) as OrderRow["items"],
  }));

  const customers = (customersRes.data ?? []).map((c) => ({ id: c.id, name: c.name }));
  const products = (productsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price_minor: p.price_minor,
    is_active: p.is_active,
  }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm text-muted">{business.name}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Orders</h1>
        <p className="mt-2 max-w-xl text-muted">
          What customers have ordered. Totals are calculated by the database from the
          lines, so a number typed in by mistake cannot stick.
        </p>
      </header>

      {customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
          <h2 className="text-sm font-bold">Add a customer first</h2>
          <p className="mt-1.5 text-sm text-muted">An order belongs to someone.</p>
          <Link href="/customers" className="btn btn-primary btn-sm mt-4">Go to customers</Link>
        </div>
      ) : (
        <OrdersManager
          orders={orders}
          products={products}
          customers={customers}
          currency={business.currency as CurrencyCode}
        />
      )}
    </main>
  );
}

type OrderRow = import("@/components/orders/orders-manager").OrderRow;
