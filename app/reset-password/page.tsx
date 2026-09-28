import Link from "next/link";
import { AuthCard, SetupNotice } from "@/components/auth/auth-form";
import { isSupabaseConfigured, missingSupabaseVars } from "@/lib/config";

export const metadata = { title: "Choose a new password" };

/**
 * Supabase sends the user here with a recovery token in the URL fragment.
 * The client-side verify step is deliberately not implemented yet — the
 * important part is that the page explains what to do rather than 404ing.
 */
export default function ResetPasswordPage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <AuthCard
        title="Choose a new password"
        subtitle="Open the link from your email on this device."
      >
        {!configured ? (
          <>
            <Link href="/setup" className="btn btn-primary w-full">
              Set up the app
            </Link>
            <SetupNotice missing={missingSupabaseVars()} />
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              The reset form is not wired up yet. Until it is, ask the studio to set a new
              password for you.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link href="/login" className="btn btn-primary w-full">
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </AuthCard>
    </main>
  );
}
