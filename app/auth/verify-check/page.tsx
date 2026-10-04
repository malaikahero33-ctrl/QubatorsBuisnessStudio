"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Completes email confirmation in the browser.
 *
 * The verification tokens arrive in the URL *fragment* (`#access_token=...`),
 * which by design never reaches a server. So this has to run on the client:
 * it reads the hash, calls `verifyOtp`, and redirects.
 *
 * Rendered inside Suspense because `useSearchParams` would otherwise force the
 * whole page to be client-side and break static prerendering for every route
 * that shares this layout.
 */
function VerifyInner() {
  const router = useRouter();
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      // The hash is where Supabase puts access_token / refresh_token /
      // type=recovery. window.location.hash, not useSearchParams, because the
      // tokens are never in the query string.
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : "";
      const params = new URLSearchParams(hash);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      // Only the token_hash flow is supported here. The alternative
      // `verifyOtp({ email, token })` shape needs the user's email address,
      // which is not in the URL, and the six-digit OTP flow is legacy.
      if (!tokenHash) {
        if (!cancelled) {
          setState("error");
          setDetail(
            "This link is missing its verification token, which usually means it " +
              "was already opened once — confirmation links only work one time. " +
              "Sign in instead; if your address is unconfirmed, request a new link.",
          );
        }
        return;
      }

      // EmailTokenType is narrower than the `type` string in the URL, and it
      // has to be one of three literal values. Anything else — a tampered
      // link, or a flow we do not handle — must not reach verifyOtp, because
      // passing an unexpected type there is how a confirmation gets accepted
      // as something more privileged than it is.
      const flow =
        type === "email" || type === "signup" || type === "invite"
          ? "email"
          : type === "recovery"
            ? "recovery"
            : null;

      if (!tokenHash || !flow) {
        if (!cancelled) {
          setState("error");
          setDetail(
            "This link is missing its verification token. Open the newest email " +
              "from us and click the link in it.",
          );
        }
        return;
      }

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: flow,
      });

      if (cancelled) return;

      if (error) {
        // The single most common cause by far: the link was already opened
        // once. Confirmation links are one-shot.
        setState("error");
        setDetail(
          error.message.toLowerCase().includes("expired") || error.message.includes("Token")
            ? "This link has already been used or has expired. Confirmation links " +
              "only work once — request a new one by signing in."
            : error.message,
        );
        return;
      }

      setState("ok");
      // Clear the tokens from the address bar before navigating, so they are
      // not left in history or in a screenshot of the address bar.
      window.history.replaceState(null, "", window.location.pathname);
      router.replace("/dashboard");
    }

    void verify();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center">
        {state === "working" && (
          <>
            <h1 className="text-xl font-bold">Confirming your email</h1>
            <p className="mt-2 text-sm text-muted">One moment…</p>
          </>
        )}

        {state === "ok" && (
          <>
            <h1 className="text-xl font-bold text-success">Email confirmed</h1>
            <p className="mt-2 text-sm text-muted">Taking you to your dashboard…</p>
          </>
        )}

        {state === "error" && (
          <>
            <h1 className="text-xl font-bold text-danger">
              Could not confirm that link
            </h1>
            <p className="mt-2 text-sm text-muted">{detail}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Link href="/login" className="btn btn-primary w-full">
                Go to sign in
              </Link>
              <Link href="/signup" className="btn w-full">
                Create an account
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function VerifyCheckPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center px-6 py-12">
          <p className="text-sm text-muted">Confirming your email…</p>
        </main>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}