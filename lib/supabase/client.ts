/**
 * Browser Supabase client.
 *
 * Uses the ANON key only. Row-level security in Postgres decides what this
 * client can read or write, so it is safe for the browser — provided the
 * service-role key never appears in a NEXT_PUBLIC_* variable.
 *
 * See docs/ARCHITECTURE.md section 2.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy .env.example to .env.local and fill in the values.",
    );
  }

  return createBrowserClient(url, anonKey);
}
