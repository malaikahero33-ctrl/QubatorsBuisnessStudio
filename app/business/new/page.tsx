import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createBusinessAction, isSchemaReady } from "@/lib/business/actions";
import { BusinessForm } from "@/components/business/business-form";
import { isSupabaseConfigured, missingSupabaseVars } from "@/lib/config";

export const metadata = { title: "Create your business" };

export default async function NewBusinessPage() {
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // If the schema is missing, say so plainly. A stack trace is not an
  // explanation, and this is the most likely first-run state.
  if (!(await isSchemaReady())) {
    return <SchemaMissing />;
  }

  // Do not send someone to a form they have already filled in.
  const { count } = await supabase
    .from("businesses")
    .select("id", { count: "exact", head: true });

  if ((count ?? 0) > 0) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm text-muted">Step 1 of 4</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Tell us about your business</h1>
        <p className="mt-2 max-w-xl text-muted">
          Nothing here is permanent. The AI reads these answers, so the more honest you are,
          the more useful it will be.
        </p>
      </header>

      <ol className="mb-8 flex flex-wrap gap-2 text-xs" aria-label="Setup progress">
        {["Your business", "Your idea", "Your brand", "Your first sale"].map((step, i) => (
          <li
            key={step}
            aria-current={i === 0 ? "step" : undefined}
            className={`rounded-full px-3 py-1 font-semibold ${
              i === 0
                ? "bg-brand text-white"
                : "border border-border text-muted"
            }`}
          >
            {i + 1}. {step}
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <BusinessForm
          action={createBusinessAction}
          defaultCurrency="UGX"
          defaultStage="idea"
        />
      </div>

      <p className="mt-6 text-center text-sm">
        <Link href="/dashboard" className="text-muted underline">
          Skip for now
        </Link>
      </p>
    </main>
  );
}

function SchemaMissing() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight">The database tables are missing</h1>
      <p className="mt-2 text-muted">
        This step needs the <code className="font-mono">businesses</code> table, and it does not
        exist yet in your Supabase project.
      </p>

      <div className="mt-6 rounded-xl border border-dashed border-brand bg-brand-soft p-5 text-sm">
        <p className="font-bold text-brand-ink">One command creates it</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-brand-ink/90">
          <li>
            In Supabase, set a short database password:{" "}
            <b>Settings → Database</b>
          </li>
          <li>
            Then run <code className="font-mono">npm.cmd run db:seed</code>
          </li>
          <li>
            It asks for the password you just set
          </li>
        </ol>
      </div>

      <div className="mt-6 flex gap-3">
        <Link href="/setup" className="btn">
          Setup guide
        </Link>
        <Link href="/dashboard" className="btn btn-primary">
          Back to dashboard
        </Link>
      </div>

      {!isSupabaseConfigured() && (
        <p className="mt-4 text-xs text-danger">
          Missing environment variables: {missingSupabaseVars().join(", ")}
        </p>
      )}
    </main>
  );
}
