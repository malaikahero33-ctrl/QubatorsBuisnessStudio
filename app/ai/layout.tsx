import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/business/current";
import { getAiAllowanceAction } from "@/lib/ai/actions";
import { isSchemaReady } from "@/lib/business/actions";
import type { Allowance } from "@/components/ai/ai-panel";

/**
 * Shared shell for the four AI screens.
 *
 * The allowance is fetched once here rather than in each feature. It is the
 * same number for all of them, and reading it per-page would let two screens
 * disagree after a generation.
 */
export default async function AiLayout({ children }: { children: React.ReactNode }) {
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

  const business = await getCurrentBusiness();
  if (!business) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">No business yet</h1>
        <p className="mt-2 text-muted">
          The AI studio works from your products, prices and customers. Create a
          business first.
        </p>
        <Link href="/business/new" className="btn btn-primary mt-6">
          Create your business
        </Link>
      </main>
    );
  }

  const allowance: Allowance = await getAiAllowanceAction();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm text-muted">{business.name}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">AI studio</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Everything here is generated from your actual business details — your
          products, your prices, your currency. It is advice to think with, not
          research, and every answer lists what it had to assume.
        </p>
      </header>

      {children}
    </main>
  );
}
