"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Field, fieldA11y } from "@/components/ui/field";

/**
 * Set a new password, after following a recovery link.
 *
 * Runs on the client because the recovery tokens arrive in the URL fragment,
 * which never reaches a server.
 *
 * The important detail is that this does not sign anyone in. Supabase's
 * recovery flow establishes a session scoped to the reset, and calling
 * `updateUser` sets the password without granting a normal login. Anyone who
 * later guesses or inherits the old password cannot use this page.
 */

type Status = "checking" | "ready" | "saving" | "done" | "error";

const MIN_LENGTH = 8;

function ResetInner() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<Record<string, string>>({});

  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : "";
    const params = new URLSearchParams(hash);

    // `type=recovery` in the link is what marks this as a password reset
    // rather than an email confirmation.
    const isRecovery = params.get("type") === "recovery";
    const hasToken = Boolean(params.get("access_token") || params.get("token_hash"));

    if (!hasToken || !isRecovery) {
      setStatus("error");
      setMessage(
        "This page needs to be opened from the link in your password reset email. " +
          "Request a new link if you cannot find it.",
      );
      return;
    }

    // The session from the recovery link is already established by
    // Supabase's client, so no explicit exchange is needed here.
    setStatus("ready");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError({});

    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    const problems: Record<string, string> = {};
    if (password.length < MIN_LENGTH) {
      problems.password = `Use at least ${MIN_LENGTH} characters`;
    }
    if (password !== confirm) {
      problems.confirm = "The two passwords do not match";
    }
    if (Object.keys(problems).length) {
      setError(problems);
      return;
    }

    setStatus("saving");

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setStatus("ready");
      setError({ password: updateError.message });
      return;
    }

    setStatus("done");
    // Sign out the recovery session so the next person on this device does not
    // inherit it, then land on sign-in.
    await supabase.auth.signOut();
    router.replace("/login?reset=1");
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8">
        {status === "checking" && (
          <p className="text-sm text-muted">Checking your reset link…</p>
        )}

        {status === "error" && (
          <>
            <h1 className="text-xl font-bold text-danger">This link is not usable</h1>
            <p className="mt-2 text-sm text-muted">{message}</p>
            <Link href="/forgot-password" className="btn btn-primary mt-6 w-full">
              Request a new link
            </Link>
          </>
        )}

        {status === "done" && (
          <>
            <h1 className="text-xl font-bold text-success">Password changed</h1>
            <p className="mt-2 text-sm text-muted">
              You can sign in with your new password now.
            </p>
          </>
        )}

        {(status === "ready" || status === "saving") && (
          <>
            <h1 className="text-xl font-bold">Choose a new password</h1>
            <p className="mt-1 text-sm text-muted">
              Pick something you have not used before.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <Field
                label="New password"
                name="password"
                hint={`At least ${MIN_LENGTH} characters.`}
                error={error.password}
              >
                <input
                  className="input"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_LENGTH}
                  {...fieldA11y("password", error.password, `At least ${MIN_LENGTH} characters.`)}
                />
              </Field>

              <Field label="Type it again" name="confirm" error={error.confirm}>
                <input
                  className="input"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  {...fieldA11y("confirm", error.confirm)}
                />
              </Field>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={status === "saving"}
              >
                {status === "saving" ? "Saving…" : "Save new password"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordRoute() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center px-6 py-12">
          <p className="text-sm text-muted">Checking your reset link…</p>
        </main>
      }
    >
      <ResetInner />
    </Suspense>
  );
}

