import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";

/**
 * The OAuth / email-link landing route.
 *
 * Supabase's PKCE flow sends the user here with a `?code=` query parameter.
 * This exchanges it for a session cookie and redirects onward. Without this
 * route, every confirmation email and every password reset link dead-ends on
 * a 404 — the user clicks the link and nothing happens.
 *
 * The `next` parameter is honoured but constrained to a path on this origin.
 * Taking it unvalidated would make this an open redirect: an attacker sends
 * a victim a link to this app that, after sign-in, bounces them to a phishing
 * page. This is the one place in the app where that matters most, because the
 * URL arrives in an email the user trusts.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";

  // Must start with a single "/" and must not start with "//" (protocol-
  // relative, which resolves to another host) or "/\" (browsers treat it as
  // "//" too).
  const safeNext =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\")
      ? rawNext
      : "/dashboard";

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/setup", origin));
  }

  if (!code) {
    // No code means the link was opened without its parameter, or it was
    // stripped by a mail client that rewrites URLs on open.
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Most often the link was already used once, or expired. Both are the
    // user's fault in no way, so the message says so rather than showing an
    // auth error code.
    console.error("[auth/callback] code exchange failed:", error.message);
    return NextResponse.redirect(new URL("/login?error=expired_link", origin));
  }

  return NextResponse.redirect(new URL(safeNext, origin));
}