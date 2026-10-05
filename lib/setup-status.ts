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
  /**
   * Do the core tables exist?
   *
   * True whenever PostgREST resolved the relation, even if the row count could
   * not be read. Existence and readability are separate questions.
   */
  tablesExist: boolean;
  /**
   * How many businesses are visible. `null` means "cannot tell", which is
   * different from 0. A signed-out visitor can normally see zero rows because
   * RLS hides them, so 0 would be misleading here.
   */
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

  // If there is a session, count through it: RLS then returns exactly the rows
  // this user may see, which is a real number. Without a session, all we can
  // establish is whether the table exists - `anon` is granted nothing on
  // purpose, and reading zero rows would look like "no data" rather than
  // "not permitted to look".
  if (await hasSession()) {
    try {
      const supabase = await createClient();
      const { count, error } = await supabase
        .from("businesses")
        .select("id", { count: "exact", head: true });

      if (!error) {
        return { tablesExist: true, businessCount: count ?? 0, error: null };
      }
    } catch {
      // Fall through to the anonymous probe below.
    }
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

    // PGRST205 means PostgREST cannot find the relation at all: the table
    // genuinely does not exist. That is the only answer that proves the
    // migrations have not been run.
    if (response.status === 404) {
      return {
        tablesExist: false,
        businessCount: null,
        error:
          "The database tables do not exist yet. Run `npm run db:push` to create them.",
      };
    }

    /*
     * 42501 is NOT a sign the database is broken.
     *
     * PostgREST resolves the relation first, then checks permissions. So a 42501
     * - "permission denied for table businesses" - means the table WAS found.
     * It is what this check always gets, because `anon` is deliberately granted
     * nothing: ADR-14 refuses unsigned-out requests in the database rather
     * than in the application layer.
     *
     * An earlier version of this file reported 42501 as "the database refused
     * the request, check that 0004_grants.sql was applied", which told a
     * correctly configured app that it was broken. Reading the Postgres error
     * code rather than the HTTP status is the whole difference between the
     * two cases:
     *
     *   404 + PGRST205  -> the table is missing
     *   401 + 42501     -> the table exists, and anon is correctly denied
     */
    if (response.status === 401 || response.status === 403) {
      const body = await response.text();

      if (/PGRST205|Could not find the table/i.test(body)) {
        return {
          tablesExist: false,
          businessCount: null,
          error:
            "The database tables do not exist yet. Run `npm run db:push` to create them.",
        };
      }

      // The table resolved. Everything is fine; we simply cannot count rows
      // without a session, and we should not claim otherwise.
      return {
        tablesExist: true,
        businessCount: null,
        error: null,
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