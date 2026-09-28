"use server";

/**
 * Authentication server actions.
 *
 * All credential handling belongs to Supabase Auth - we never see, store or
 * compare a password (PRD section 15). These actions validate input, call
 * Supabase, and turn failures into form errors.
 *
 * Every action returns a discriminated result rather than throwing, so the
 * form can show a real message instead of a generic error boundary.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, signInSchema, signUpSchema, toFieldErrors } from "@/lib/validation/schemas";
import { isSupabaseConfigured, missingSupabaseVars } from "@/lib/config";

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: Record<string, string> }
  | { status: "success"; message: string; email?: string };

const NOT_CONFIGURED =
  "Supabase is not configured yet. See the setup steps on the sign-in page.";

/** Absolute URL for auth redirects, derived from the incoming request. */
async function currentOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  if (!host) return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${protocol}://${host}`;
}

function safeNextPath(raw: FormDataEntryValue | null): string {
  // Only allow same-site relative paths. Without this, `next` is an open
  // redirect: an attacker could send a victim to /login?next=https://evil.
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message: `${NOT_CONFIGURED} Missing: ${missingSupabaseVars().join(", ")}`,
    };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  const parsed = signInSchema.safeParse({ email, password });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields",
      fields: toFieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately vague: saying "no such user" would leak which emails exist.
    return { status: "error", message: "Email or password is incorrect" };
  }

  // redirect() throws, so it must be outside any try/catch.
  redirect(next);
}

export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message: `${NOT_CONFIGURED} Missing: ${missingSupabaseVars().join(", ")}`,
    };
  }

  const parsed = signUpSchema.safeParse({
    full_name: String(formData.get("full_name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields",
      fields: toFieldErrors(parsed.error),
    };
  }

  // parsed.data is now fully typed, so no field can be undefined below.
  const { full_name: fullName, email: parsedEmail, password } = parsed.data;

  const supabase = await createClient();
  const origin = await currentOrigin();

  const { error } = await supabase.auth.signUp({
    email: parsedEmail,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/verify`,
      data: { full_name: fullName },
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return {
    status: "success",
    message: "Check your inbox to confirm your email address.",
    email: parsedEmail,
  };
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: NOT_CONFIGURED };
  }

  const email = String(formData.get("email") ?? "").trim();
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address" };
  }

  const supabase = await createClient();
  const origin = await currentOrigin();

  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  // Always the same response, whether or not the address exists. Anything
  // else is an account-enumeration oracle.
  return {
    status: "success",
    message: "If that address has an account, a reset link is on its way.",
  };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
