import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";

/**
 * Where Supabase sends a new user after they confirm their email address.
 *
 * Sign-up sets `emailRedirectTo: /auth/verify`. Supabase appends the
 * verification tokens; some configurations hand them over as a URL *fragment*
 * rather than a query parameter, and a fragment is never sent to a server.
 *
 * So this route cannot verify anything by itself when the tokens are in the
 * hash. It sends the browser onward with the hash intact, where the client
 * component calls `verifyOtp`. The query-parameter branch exists for
 * configurations that do use one, and handles those server-side.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/setup", origin));
  }

  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL("/dashboard", origin));
    }
    console.error("[auth/verify] code exchange failed:", error.message);
  }

  // No code, or the exchange failed. Preserve the fragment by handing the
  // whole original URL to the client, which strips nothing.
  return NextResponse.redirect(
    new URL(`/auth/verify-check${request.nextUrl.search}`, origin),
  );
}