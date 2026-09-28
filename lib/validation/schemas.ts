/**
 * Shared Zod schemas.
 *
 * Every API route validates its input with these before touching the
 * database. See docs/API.md section 1 — malformed input is a 400, never a
 * 500 and never a partial write.
 */

import { z } from "zod";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/money";

/** ISO 4217 code from the supported set. */
export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

/**
 * An amount in minor units.
 *
 * `z.int()` rejects 10.5. This is the boundary where a float from a form, an
 * AI response or a JSON client becomes a hard 400 instead of a silently
 * corrupted balance.
 */
export const amountMinorSchema = z
  .number()
  .int("Amount must be an integer in minor units")
  .safe();

/** A monetary value. Currency defaults to the launch currency. */
export const moneySchema = z.object({
  amountMinor: amountMinorSchema,
  currency: currencySchema.default(DEFAULT_CURRENCY),
});

/** A monetary value that must be positive. For prices, transaction amounts. */
export const positiveMoneySchema = moneySchema.refine(
  (m) => m.amountMinor > 0,
  { message: "Amount must be greater than zero", path: ["amountMinor"] },
);

/** ISO 3166-1 alpha-2 country code. */
export const countryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, "Must be an uppercase ISO 3166-1 alpha-2 code");

/** E.164 phone number, optional. */
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, "Must be E.164 format, e.g. +256700000000")
  .optional()
  .or(z.literal(""));

/** Email, normalised to lowercase. */
export const emailSchema = z
  .string()
  .email("Enter a valid email address")
  .max(320, "Email is too long")
  .transform((v) => v.trim().toLowerCase());

/**
 * Sign-up form.
 *
 * Validated as one object rather than a list of independent checks, so a
 * successful parse narrows the type of every field. Checking each field
 * separately and collecting errors into a bag loses that narrowing, and the
 * compiler cannot then tell a validated string from an unvalidated one.
 */
export const signUpSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(120),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(200, "Password is too long"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

/** Sign-in form. Supabase verifies the password; we only check the shape. */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(200),
});

export type SignInInput = z.infer<typeof signInSchema>;

/** A cuid-style identifier, e.g. from a shared link. */
export const shareTokenSchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid share token");

/** Human-facing order number, e.g. QB-1001. */
export const orderNumberSchema = z
  .string()
  .regex(/^[A-Z]{2,4}-\d{4,10}$/, "Order number must look like QB-1001");

/**
 * The response envelope every generative AI route must produce.
 *
 * `assumptions` is required with no default. A model response that omits it
 * fails validation and the route returns 422 rather than showing unverified
 * output as fact. This is ADR-4 made executable.
 */
export function aiEnvelopeSchema<TContent extends z.ZodType>(content: TContent) {
  return z.object({
    content,
    assumptions: z
      .array(z.string().min(1))
      .min(1, "The model must state at least one assumption"),
    warnings: z.array(z.string()),
    model: z.string().min(1),
    usage: z.object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    }),
  });
}

/** Flatten a ZodError into the API error envelope from docs/API.md. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}
