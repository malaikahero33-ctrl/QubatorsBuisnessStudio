import Link from "next/link";
import { AuthCard, AuthForm, Field, SetupNotice } from "@/components/auth/auth-form";
import { signInAction } from "@/lib/auth/actions";
import { isSupabaseConfigured, missingSupabaseVars } from "@/lib/config";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; registered?: string }>;
}) {
  const { next, registered } = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <AuthCard title="Welcome back" subtitle="Sign in to your workspace.">
        {registered && (
          <p className="mb-4 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
            Account created. Check your email, then sign in.
          </p>
        )}

        {!configured ? (
          <>
            <p className="text-sm text-muted">
              Accounts are switched off until Supabase is connected.
            </p>
            <div className="mt-4">
              <Link href="/setup" className="btn btn-primary w-full">
                Set up the app
              </Link>
            </div>
            <SetupNotice missing={missingSupabaseVars()} />
          </>
        ) : (
          <AuthForm
            action={signInAction}
            submitLabel="Sign in"
            footnote={
              <>
                No account?{" "}
                <Link href="/signup" className="text-brand underline">
                  Create one
                </Link>
                <span className="mt-1 block">
                  <Link href="/forgot-password" className="text-muted underline">
                    Forgot your password?
                  </Link>
                </span>
              </>
            }
          >
            {next && <input type="hidden" name="next" value={next} />}
            <Field label="Email" name="email" type="email" required autoComplete="email" />
            <Field label="Password" name="password" type="password" required autoComplete="current-password" />
          </AuthForm>
        )}
      </AuthCard>
    </main>
  );
}
