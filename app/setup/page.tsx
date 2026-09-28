import Link from "next/link";
import { isSupabaseConfigured, missingSupabaseVars } from "@/lib/config";

export default function SetupPage() {
  const configured = isSupabaseConfigured();
  const missing = missingSupabaseVars();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-content-center rounded-xl bg-brand text-xl font-extrabold text-white">
          Q
        </span>
        <div>
          <p className="font-bold">Qubators Business Studio</p>
          <p className="text-xs text-muted">Business creation and growth platform</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <h1 className="text-lg font-bold">Before you start</h1>
        <p className="mt-1.5 text-sm text-muted">
          The app is running. It needs a Supabase project before accounts and businesses
          will work.
        </p>

        {!configured && (
          <div className="mt-4 rounded-lg border border-dashed border-brand bg-brand-soft p-4 text-sm">
            <p className="font-bold text-brand-ink">Supabase is not configured</p>
            <p className="mt-1 text-brand-ink/90">Missing: {missing.join(", ")}</p>
          </div>
        )}

        <ol className="mt-6 space-y-4 text-sm">
          <li className="flex gap-3">
            <span className="grid h-6 w-6 flex-none place-content-center rounded-full bg-surface-2 text-xs font-bold">
              1
            </span>
            <div>
              <p className="font-semibold">Create a free Supabase project</p>
              <p className="text-muted">
                No credit card needed.{" "}
                <a className="text-brand underline" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
                  supabase.com/dashboard
                </a>
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 flex-none place-content-center rounded-full bg-surface-2 text-xs font-bold">
              2
            </span>
            <div>
              <p className="font-semibold">Copy the environment file</p>
              <p className="text-muted">
                <code className="font-mono">cp .env.example .env.local</code> then paste in the project
                URL and anon key from Settings → API.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 flex-none place-content-center rounded-full bg-surface-2 text-xs font-bold">
              3
            </span>
            <div>
              <p className="font-semibold">Create the tables</p>
              <p className="text-muted">
                <code className="font-mono">npx supabase link --project-ref YOUR_REF</code> then{" "}
                <code className="font-mono">npm run db:push</code>
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 flex-none place-content-center rounded-full bg-surface-2 text-xs font-bold">
              4
            </span>
            <div>
              <p className="font-semibold">Load the demo data</p>
              <p className="text-muted">
                <code className="font-mono">npm run db:reset</code> seeds a sample business so the
                dashboard has something to show.
              </p>
            </div>
          </li>
        </ol>

        <div className="mt-8 flex gap-3">
          <Link href="/login" className="btn btn-primary">
            Go to sign in
          </Link>
          <Link href="/" className="btn">
            Back
          </Link>
        </div>
      </div>
    </main>
  );
}
