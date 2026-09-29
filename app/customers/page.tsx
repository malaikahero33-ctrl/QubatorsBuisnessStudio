import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { CustomersManager } from "@/components/customers/customers-manager";
import { isSchemaReady } from "@/lib/business/actions";
import { isSupabaseConfigured } from "@/lib/config";
import type { CurrencyCode } from "@/lib/money";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
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
        <Link href="/dashboard" className="btn btn-primary mt-6">
          Back to dashboard
        </Link>
      </main>
    );
  }

  const business = await getCurrentBusiness();
  if (!business) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">No business yet</h1>
        <p className="mt-2 text-muted">Create a business before adding customers to it.</p>
        <Link href="/business/new" className="btn btn-primary mt-6">
          Create your business
        </Link>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone, location, stage, notes, lifetime_value_minor, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">Could not load customers</h1>
        <p className="mt-2 text-muted">{error.message}</p>
        <Link href="/dashboard" className="btn mt-6">
          Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm text-muted">{business.name}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Customers</h1>
        <p className="mt-2 max-w-xl text-muted">
          Everyone who buys from you, from first contact to repeat customer. Lifetime value is
          calculated from completed orders — you cannot type it in.
        </p>
      </header>

      <CustomersManager
        customers={data ?? []}
        currency={business.currency as CurrencyCode}
      />
    </main>
  );
}
