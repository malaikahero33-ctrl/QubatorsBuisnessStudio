/**
 * Session refresh and route protection.
 *
 * Next.js 16 renamed the `middleware` file convention to `proxy`. This file
 * was migrated from `middleware.ts`; the build warns if the old convention
 * returns.
 *
 * Supabase auth cookies are short-lived. This runs on every request to refresh
 * them and keeps unauthenticated users out of the dashboard. It also redirects
 * signed-in users away from the auth pages.
 *
 * Docs: docs/ARCHITECTURE.md section 2, docs/API.md section 2.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";

/** Routes that require a session. */
const PROTECTED_PREFIXES = ["/dashboard", "/business", "/ai", "/admin"];

/** Routes only useful when signed out. */
const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  //
  // Without a configured Supabase project there is no session to refresh, and
  // createServerClient() throws on an empty URL. Because this runs on EVERY
  // request, that would 500 the whole app before any page could render its own
  // setup guidance.
  //
  // So: no Supabase, no auth check here. Protected pages guard themselves
  // (app/dashboard/layout.tsx redirects to /setup).
  if (!isSupabaseConfigured()) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not skip this. getUser() revalidates the JWT with the auth server;
  // getSession() only reads the cookie and can be forged.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
