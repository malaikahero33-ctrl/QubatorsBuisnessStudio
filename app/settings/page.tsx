import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { SettingsManager } from "@/components/settings/settings-manager";
import { isSchemaReady } from "@/lib/business/actions";
import { isSupabaseConfigured, isAiConfigured } from "@/lib/config";
import type { CurrencyCode } from "@/lib/money";

export const metadata = { title: "Settings" };

/**
 * Business profile and preferences.
 *
 * Two forms, deliberately separate. Changing a business's name or currency is
 * a different kind of decision from ticking a notification box, and putting
 * them on one form with one Save button means one careless click rewrites
 * something that should have been thought about.
 */
export default async function SettingsPage() {
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
          Run <code className="font-mono">npm run db:seed</code>, then reload.
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
        <p className="mt-2 text-muted">There is nothing to configure until a business exists.</p>
        <Link href="/business/new" className="btn btn-primary mt-6">Create your business</Link>
      </main>
    );
  }

  const [profileRes, settingsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, country_code, onboarding_complete")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("business_settings").select("*").eq("business_id", business.id).maybeSingle(),
  ]);

  const counts = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm text-muted">{business.name}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-xl text-muted">
          Your business details and what this studio tells you about.
        </p>
      </header>

      <SettingsManager
        business={{
          id: business.id,
          name: business.name,
          industry: business.industry,
          location: business.location,
          stage: business.stage,
          currency: business.currency as CurrencyCode,
          target_customer: business.target_customer,
          brand_personality: business.brand_personality,
          goals: business.goals,
        }}
        profile={{
          full_name: profileRes.data?.full_name ?? "",
          phone: profileRes.data?.phone ?? "",
          country_code: profileRes.data?.country_code ?? "",
        }}
        settings={{
          notify_new_order: settingsRes.data?.notify_new_order ?? true,
          notify_consultation: settingsRes.data?.notify_consultation ?? true,
          weekly_digest: settingsRes.data?.weekly_digest ?? false,
          onboarding_step: settingsRes.data?.onboarding_step ?? "create_business",
        }}
        aiConfigured={isAiConfigured()}
        productCount={counts.count ?? 0}
      />
    </main>
  );
}
