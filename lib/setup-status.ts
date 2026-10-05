/**
 * What is actually true about the database right now.
 *
 * Exists because the setup page used to be static — it claimed Supabase was
 * missing regardless of the truth — which made a working app look broken.
 * Diagnosing by clicking through a static page is guesswork; this reports
 * what is found.
 *
 * Deliberately read-only and unauthenticated. It must work on a fresh install
 * with no session, because that is exactly when it is needed.
 */

import "server-only";

import { createClient } from "@/lib/supabase/server";

export type DatabaseStatus = {
  /** Do the core tables exist? */
  tablesExist: boolean;
  /** How many businesses are present. null when it could not be determined. */
  businessCount: number | null;
  /** A message to show the user, when something went wrong. */
  error: string | null;
};

/**
 * Count businesses without requiring a session.
 *
 * A fresh install has no signed-in user, so the normal session client would
 * return nothing regardless of whether the table exists. That conflates "no
 * data" with "no permission" and "no table". The anon key is used
 * explicitly, and RLS decides the answer honestly: zero rows means the
 * tables are there and empty.
 */
export async function checkDatabaseStatus(): Promise<DatabaseStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { tablesExist: false, businessCount: null, error: "Supabase is not configured" };
  }

  // A short timeout: this runs during page render, and a hanging check would
  // hang the page. Failing fast and saying "unknown" beats a slow page.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `${url}/rest/v1/businesses?select=id`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        cache: "no-store",
        signal: controller.signal,
      },
    );

    // PGRST205 means PostgREST cannot find the relation: the table genuinely
    // does not exist. That is the one answer that proves migrations have not
    // been run.
    if (response.status === 404) {
      return {
        tablesExist: false,
        businessCount: null,
        error:
          "The database tables do not exist yet. Run `npm run db:push` to create them.",
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        tablesExist: false,
        businessCount: null,
        error:
          "The database refused the request. If you have run the migrations, check that " +
          "migration 0004_grants.sql was applied — without it every read is denied.",
      };
    }

    if (!response.ok) {
      return {
        tablesExist: false,
        businessCount: null,
        error: `The database replied with ${response.status}. ${(await response.text()).slice(0, 120)}`,
      };
    }

    const rows: unknown = await response.json();

    if (!Array.isArray(rows)) {
      return {
        tablesExist: false,
        businessCount: null,
        error: "The database returned something unexpected.",
      };
    }

    // Reachable and an array: the tables exist. Zero rows is a legitimate
    // answer meaning "no businesses yet", not a failure.
    return { tablesExist: true, businessCount: rows.length, error: null };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "The database did not respond within 8 seconds."
        : `Could not reach the database: ${error instanceof Error ? error.message : "unknown error"}`;

    return { tablesExist: false, businessCount: null, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether a signed-in user exists.
 *
 * Only used by the setup page's own links. Kept separate so `createClient()`
 * is not imported here at all — an unused import of the session client is
 * exactly what made this page look unconfigured before.
 */
export async function hasSession(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return Boolean(user);
  } catch {
    return false;
  }
}