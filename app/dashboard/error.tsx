"use client";

/**
 * Dashboard-specific error boundary.
 *
 * The dashboard is where a database problem shows up first, so it gets a
 * boundary of its own rather than inheriting the generic one. The likely
 * cause — migrations not applied — is called out by name, because "something
 * went wrong" sends the user looking in the wrong place.
 */

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  const looksLikeMissingTables =
    /does not exist|schema cache|PGRST2|42P01|42703/i.test(error.message);

  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <p className="text-sm font-semibold text-danger">
        {looksLikeMissingTables ? "The database is not ready" : "Something went wrong"}
      </p>

      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        {looksLikeMissingTables
          ? "Some tables are missing"
          : "The dashboard could not be loaded"}
      </h1>

      <p className="mt-3 text-muted">
        {looksLikeMissingTables
          ? "The app is running but the database tables have not been created. This takes about a minute and fixes everything below in one go."
          : "Your data is untouched. This is a problem showing the page, not with your records."}
      </p>

      {looksLikeMissingTables && (
        <div className="mt-5 rounded-lg border border-border bg-surface-2 p-4">
          <p className="text-xs font-semibold text-muted">Run this, then try again</p>
          <p className="mt-2 font-mono text-sm">npm run db:push</p>
          <p className="mt-2 text-xs text-muted">
            Then reload. If it asks for a password, that is your Supabase database
            password, not your login.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/login" className="btn">
          Back to sign in
        </Link>
      </div>

      {error.digest && (
        <p className="mt-8 font-mono text-xs text-muted">Reference: {error.digest}</p>
      )}
    </main>
  );
}
