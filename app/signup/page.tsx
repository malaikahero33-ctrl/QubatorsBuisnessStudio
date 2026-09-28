import Link from "next/link";
import { AuthCard, AuthForm, Field, SetupNotice } from "@/components/auth/auth-form";
import { signUpAction } from "@/lib/auth/actions";
import { isSupabaseConfigured, missingSupabaseVars } from "@/lib/config";

export const metadata = { title: "Create an account" };

export default function SignUpPage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <AuthCard title="Create your account" subtitle="Free. No card required.">
        {!configured ? (
          <>
            <p className="text-sm text-muted">Accounts are switched off until Supabase is connected.</p>
            <div className="mt-4">
              <Link href="/setup" className="btn btn-primary w-full">
                Set up the app
              </Link>
            </div>
            <SetupNotice missing={missingSupabaseVars()} />
          </>
        ) : (
          <AuthForm
            action={signUpAction}
            submitLabel="Create account"
            footnote={
              <>
                Already have one?{" "}
                <Link href="/login" className="text-brand underline">
                  Sign in
                </Link>
              </>
            }
          >
            <Field label="Full name" name="full_name" required autoComplete="name" />
            <Field label="Email" name="email" type="email" required autoComplete="email" />
            <Field
              label="Password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            <p className="text-xs text-muted">
              We will email you a link to confirm your address.
            </p>
          </AuthForm>
        )}
      </AuthCard>
    </main>
  );
}
