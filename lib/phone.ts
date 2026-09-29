/**
 * Phone number normalisation — the ONLY place a typed phone number becomes a
 * stored value.
 *
 * Why this exists: `customers.phone` has a database CHECK constraint of
 * `^\+[1-9][0-9]{6,14}$` (E.164). A Ugandan founder types 0772 123 456. Storing
 * that verbatim fails the constraint, and failing the constraint is a bad
 * experience for a user who did nothing wrong.
 *
 * So normalise here instead, at the edge, and keep the constraint as the real
 * enforcement. Same shape as lib/money.ts: one place converts, the database
 * still guarantees the value.
 *
 * The Uganda default is deliberate — it is the launch market (ADR-1). It is
 * isolated in DEFAULT_COUNTRY_CODE so another market is a one-line change plus
 * its own tests, not a search through the codebase.
 */

/** Uganda. Launch market. */
export const DEFAULT_COUNTRY_CODE = "256";

export type PhoneFailure = "empty" | "too_short" | "too_long" | "not_numeric";

export type NormaliseResult =
  | { ok: true; e164: string }
  | { ok: false; reason: PhoneFailure };

/** E.164: plus sign, then a country code starting 1-9, then up to 14 more. */
const E164 = /^\+[1-9][0-9]{6,14}$/;

/**
 * Turn typed input into E.164, or explain why it cannot.
 *
 * Accepts the shapes people actually type:
 *   0772123456     -> +256772123456   (leading 0 is the local trunk prefix)
 *   +256772123456  -> +256772123456   (already correct)
 *   00256 772 123 456 -> +256772123456
 *   (0772) 123-456 -> +256772123456
 *
 * A leading "0" is dropped and replaced with the country code, because in
 * Uganda the 0 is part of the local number, not part of the country code.
 */
export function normalisePhone(
  input: string,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): NormaliseResult {
  const cc = countryCode.replace(/\D/g, "");

  if (!/^[1-9][0-9]{0,2}$/.test(cc)) {
    // A bad country code is a programming error, not user input.
    throw new Error(`Invalid country code "${countryCode}"`);
  }

  // Keep digits and a leading +, drop every other character.
  const cleaned = input.replace(/[^\d+]/g, "");

  if (!cleaned) return { ok: false, reason: "empty" };
  if (/[^\d+]/.test(cleaned)) return { ok: false, reason: "not_numeric" };

  let digits: string;

  if (cleaned.startsWith("+")) {
    digits = cleaned.slice(1);
  } else if (cleaned.startsWith("00")) {
    // 00 is the international access prefix.
    digits = cleaned.slice(2);
  } else {
    // Local format. A leading 0 is the trunk prefix and is dropped.
    digits = cleaned.replace(/^0+/, "");
    if (digits) digits = cc + digits;
  }

  if (!/^\d+$/.test(digits)) return { ok: false, reason: "not_numeric" };
  if (digits.length < 7) return { ok: false, reason: "too_short" };
  if (digits.length > 15) return { ok: false, reason: "too_long" };

  const e164 = `+${digits}`;
  if (!E164.test(e164)) return { ok: false, reason: "not_numeric" };

  return { ok: true, e164 };
}

/**
 * A message the user can act on, in plain language.
 *
 * Kept beside the parser so the wording and the rule cannot drift apart.
 */
export function phoneErrorMessage(reason: PhoneFailure): string {
  switch (reason) {
    case "empty":
      return "";
    case "too_short":
      return "That phone number is too short";
    case "too_long":
      return "That phone number is too long";
    case "not_numeric":
      return "Use digits only, e.g. 0772123456 or +256772123456";
    default:
      return "That is not a phone number we can read";
  }
}

/** Group digits for display: 0772 123 456. Never used for storage. */
export function formatPhone(e164: string): string {
  const m = /^\+([1-9][0-9]{0,2})([0-9]{3})([0-9]{3})([0-9]{0,4})$/.exec(e164);
  if (!m) return e164;
  const [, cc, a, b, c] = m;
  return `+${cc} ${a} ${b}${c ? ` ${c}` : ""}`;
}
