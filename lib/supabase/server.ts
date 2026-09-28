/**
 * Server Supabase clients.
 *
 * createClient()      — session-scoped, honours RLS. Use this by default.
 * createAdminClient() — service-role key, BYPASSES RLS. Use sparingly and only
 *                       where a user genuinely cannot be trusted to filter
 *                       their own rows, e.g. a system cron. Never use it for
 *                       ordinary reads.
 *
 * See docs/ARCHITECTURE.md section 8.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill in the values.`,
    );
  }
  return value;
}

/**
 * Session-scoped client. Cookies are read and written so the session
 * refreshes on Server Component renders.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, which cannot set cookies.
            // Safe to ignore: middleware refreshes the session.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. BYPASSES row-level security.
 *
 * Every call site needs a comment justifying why RLS cannot be relied on.
 */
export async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");

  return createSupabaseClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
