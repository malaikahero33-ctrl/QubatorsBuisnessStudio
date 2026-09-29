"use client";

/**
 * Error boundary for the product area.
 *
 * Without this, an unexpected throw in a Server Component renders Next's
 * default error page: the URL, a stack trace, and no way back. For a founder
 * using this on a phone in Kampala with patchy signal, that is a dead end
 * with a scary-looking page and no idea what to do.
 *
 * This keeps the shell. The navigation stays, the message is plain, and there
 * are two ways out: try again, or go to the dashboard.
 *
 * The digest is shown because it is the only handle support has on a server
 * error. It is not an error code the user caused and it is not sensitive.
 */

import { useEffect } from "react";
import Link from "next/link";

export default function ProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side breadcrumb. In production this is where an error reporter
    // would go; logging to the browser console is the honest minimum until
    // one is configured.
    console.error("Product area error:", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <p className="text-sm font-semibold text-danger">Something went wrong</p>

      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        This page could not be loaded
      </h1>

      <p className="mt-3 text-muted">
        Your business data is safe — nothing has been deleted or changed. This is a
        problem with showing the page, not with your records.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/dashboard" className="btn">
          Go to dashboard
        </Link>
      </div>

      {error.digest && (
        <details className="mt-8">
          <summary className="cursor-pointer text-xs text-muted">
            Technical detail
          </summary>
          <p className="mt-2 font-mono text-xs text-muted">
            Reference: {error.digest}
          </p>
          <p className="mt-1 text-xs text-muted">
            Quote this if you report the problem. It lets the error be found without
            seeing your data.
          </p>
        </details>
      )}
    </main>
  );
}
