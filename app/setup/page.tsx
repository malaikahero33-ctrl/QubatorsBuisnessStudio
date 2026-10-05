import Link from "next/link";
import { isSupabaseConfigured, missingSupabaseVars, isAiConfigured } from "@/lib/config";
import { checkDatabaseStatus } from "@/lib/setup-status";

export const metadata = { title: "Setup" };
export const dynamic = "force-dynamic";

/**
 * Setup and diagnostics.
 *
 * This page used to be static: it said "The app is running. It needs a
 * Supabase project" unconditionally, so a correctly configured app showed the
 * same screen as a broken one. That is worse than having no setup page,
 * because it makes a working app look broken.
 *
 * It now checks what is actually true — variables present, tables created,
 * demo data loaded — and reports that. Each check says what it found and, if
 * something is missing, the one command that fixes it.
 */
export default async function SetupPage() {
  const configured = isSupabaseConfigured();
  const missing = missingSupabaseVars();

  const status = configured
    ? await checkDatabaseStatus()
    : { tablesExist: false, businessCount: null, error: "Supabase is not configured" };

  const everythingReady = configured && status.tablesExist && (status.businessCount ?? 0) > 0;

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

      {everythingReady ? (
        <div className="rounded-2xl border border-success/40 bg-surface p-6">
          <h1 className="flex items-center gap-2 text-lg font-bold text-success">
            <span aria-hidden>✓</span> Everything is connected
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Supabase is reachable, the tables exist, and there is data to sign in to.
          </p>

          <dl className="mt-6 space-y-2.5 text-sm">
            <StatusRow ok label="Supabase project" detail="Environment variables found" />
            <StatusRow
              ok={status.tablesExist}
              label="Database tables"
              detail={status.tablesExist ? "Schema created and reachable" : "Not created yet"}
            />
            <StatusRow
              ok={(status.businessCount ?? 0) > 0}
              label="Demo data"
              detail={
                status.businessCount
                  ? `${status.businessCount} business${status.businessCount === 1 ? "" : "es"} present`
                  : "No businesses yet"
              }
            />
            <StatusRow
              ok={isAiConfigured()}
              label="AI provider"
              detail={
                isAiConfigured()
                  ? "Key configured"
                  : "No key yet — the AI screens will say so, everything else works"
              }
            />
          </dl>

          <div className="mt-8 flex gap-3">
            <Link href="/login" className="btn btn-primary">
              Go to sign in
            </Link>
            <Link href="/dashboard" className="btn">
              Go to dashboard
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h1 className="text-lg font-bold">
            {configured ? "Almost there" : "Before you start"}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {configured
              ? "Supabase is connected. These are the remaining steps."
              : "The app is running. It needs a Supabase project before accounts and businesses will work."}
          </p>

          <div className="mt-5 space-y-2">
            <StatusRow
              ok={configured}
              label="Supabase project"
              detail={configured ? "Environment variables found" : `Missing: ${missing.join(", ")}`}
            />
            {configured && (
              <>
                <StatusRow
                  ok={status.tablesExist}
                  label="Database tables"
                  detail={status.tablesExist ? "Schema created" : "Not created"}
                />
                <StatusRow
                  ok={(status.businessCount ?? 0) > 0}
                  label="Demo data"
                  detail={
                    status.businessCount
                      ? `${status.businessCount} business${status.businessCount === 1 ? "" : "es"} present`
                      : "None loaded"
                  }
                />
              </>
            )}
          </div>

          {status.error && (
            <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {status.error}
            </p>
          )}

          <ol className="mt-6 space-y-4 text-sm">
            <li className="flex gap-3">
              <Step n={1} done={configured} />
              <div>
                <p className="font-semibold">Create a free Supabase project</p>
                <p className="text-muted">
                  No credit card needed.{" "}
                  <a
                    className="text-brand underline"
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                  >
                    supabase.com/dashboard
                  </a>
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <Step n={2} done={configured} />
              <div>
                <p className="font-semibold">Copy the environment file</p>
                <p className="text-muted">
                  <code className="font-mono">cp .env.example .env.local</code> then paste in
                  the project URL and anon key from Settings → API.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <Step n={3} done={status.tablesExist} />
              <div>
                <p className="font-semibold">Create the tables</p>
                <p className="text-muted">
                  Run <code className="font-mono">npm run db:push</code> and type your
                  database password. That password is in Supabase under Settings → Database,
                  and it is not your login password.
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <Step n={4} done={(status.businessCount ?? 0) > 0} />
              <div>
                <p className="font-semibold">Load the demo data</p>
                <p className="text-muted">
                  <code className="font-mono">npm run db:seed</code> seeds a sample business
                  so the dashboard has something to show.
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
      )}
    </main>
  );
}

function StatusRow({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className={`mt-0.5 grid h-5 w-5 flex-none place-content-center rounded-full text-[11px] font-bold ${
          ok ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
        }`}
      >
        {ok ? "✓" : "!"}
      </span>
      <div className="min-w-0">
        <p className="font-semibold">
          {label}{" "}
          <span className="sr-only">{ok ? "is ready" : "is not ready"}</span>
        </p>
        <p className="truncate text-muted">{detail}</p>
      </div>
    </div>
  );
}

function Step({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={`grid h-6 w-6 flex-none place-content-center rounded-full text-xs font-bold ${
        done ? "bg-success/15 text-success" : "bg-surface-2"
      }`}
    >
      {done ? "✓" : n}
    </span>
  );
}