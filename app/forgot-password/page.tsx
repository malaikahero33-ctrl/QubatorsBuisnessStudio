import Link from "next/link";
import { AuthCard, AuthForm, Field, SetupNotice } from "@/components/auth/auth-form";
import { forgotPasswordAction } from "@/lib/auth/actions";
import { isSupabaseConfigured, missingSupabaseVars } from "@/lib/config";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <AuthCard
        title="Reset your password"
        subtitle="We will email you a link to set a new one."
      >
        {!configured ? (
          <>
            <Link href="/setup" className="btn btn-primary w-full">
              Set up the app
            </Link>
            <SetupNotice missing={missingSupabaseVars()} />
          </>
        ) : (
          <AuthForm
            action={forgotPasswordAction}
            submitLabel="Send reset link"
            footnote={
              <Link href="/login" className="text-brand underline">
                Back to sign in
              </Link>
            }
          >
            <Field label="Email" name="email" type="email" required autoComplete="email" />
            <p className="text-xs text-muted">
              If that address has an account, we will send a link. We will not say whether it
              exists.
            </p>
          </AuthForm>
        )}
      </AuthCard>
    </main>
  );
}
