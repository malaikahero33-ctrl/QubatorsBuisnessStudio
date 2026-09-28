/**
 * Money formatting — the ONLY place in this codebase that turns an amount
 * into a display string.
 *
 * The rules, from docs/DATABASE.md:
 *
 *  1. Amounts are integers in MINOR UNITS. `10000` means ten thousand, not
 *     ten. There are no decimal amounts anywhere.
 *  2. The currency is an ISO 4217 code stored alongside the amount. The
 *     symbol is never stored and never hardcoded.
 *  3. Formatting happens here, at the display edge, and nowhere else.
 *
 * Zero-decimal currencies (UGX, TZS) have no minor unit in circulation, so
 * 10000 UGX renders as "UGX 10,000" and not "UGX 100.00". Handling that
 * correctly is the whole reason for the *_minor convention.
 */

export const SUPPORTED_CURRENCIES = [
  "UGX", // Uganda, launch market. Zero-decimal.
  "KES", // Kenya
  "TZS", // Tanzania. Zero-decimal.
  "RWF", // Rwanda
  "USD",
  "GBP",
  "EUR",
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "UGX";
export const DEFAULT_LOCALE = "en-UG";

/**
 * ISO 4217 exponent: how many decimal places the currency actually has.
 * 0 means the minor unit is the whole unit.
 */
const EXPONENT: Partial<Record<CurrencyCode, number>> = {
  UGX: 0,
  TZS: 0,
};

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function assertCurrencyCode(value: string): CurrencyCode {
  if (!isCurrencyCode(value)) {
    throw new Error(
      `Unsupported currency "${value}". Supported: ${SUPPORTED_CURRENCIES.join(", ")}`,
    );
  }
  return value;
}

/** How many decimal places this currency has. */
export function currencyExponent(currency: CurrencyCode): number {
  return EXPONENT[currency] ?? 2;
}

/**
 * Convert minor units to the major-unit number Intl expects.
 * UGX: 10000 -> 10000.   USD: 150050 -> 1500.5
 */
export function toMajorUnits(
  minor: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): number {
  return minor / 10 ** currencyExponent(currency);
}

/**
 * Convert a major-unit number (e.g. from an AI response or a form) into
 * integer minor units. Rounds rather than truncating, because dropping
 * a cent is worse than being a cent off.
 */
export function toMinorUnits(
  major: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): number {
  return Math.round(major * 10 ** currencyExponent(currency));
}

/** The machine value. What goes in the database. */
export type Money = {
  /** Integer amount in minor units. */
  amountMinor: number;
  /** ISO 4217 code. */
  currency: CurrencyCode;
};

export function money(
  amountMinor: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): Money {
  return { amountMinor, currency };
}

/**
 * Format for display. The only function in the app allowed to do this.
 *
 * Guards against the two mistakes that silently corrupt money:
 *  - a float arriving where an integer was expected
 *  - an unparseable currency code
 */
export function formatMoney(
  amountMinor: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  if (!Number.isFinite(amountMinor)) {
    throw new TypeError(
      `formatMoney received a non-finite amount: ${String(amountMinor)}. ` +
        "Amounts must be integers in minor units.",
    );
  }
  if (!Number.isInteger(amountMinor)) {
    throw new TypeError(
      `formatMoney received a non-integer amount: ${amountMinor}. ` +
        "Amounts must be integers in minor units. Use toMinorUnits() to convert.",
    );
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: assertCurrencyCode(currency),
    minimumFractionDigits: currencyExponent(currency),
    maximumFractionDigits: currencyExponent(currency),
  }).format(toMajorUnits(amountMinor, currency));
}

/**
 * Parse user input into minor units. Returns null for anything unparseable,
 * so a bad value can never become a NaN amount in the database.
 */
export function parseMoneyInput(
  input: string,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): number | null {
  // Strip everything except digits, separators and a leading minus.
  const cleaned = input.replace(/[^\d.,\-]/g, "").replace(/,(?=\d{3}\b)/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") {
    return null;
  }

  // Ambiguous separators: whichever appears last is the decimal point.
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalised: string;

  if (lastComma > -1 && lastDot > -1) {
    normalised =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = cleaned.length - lastComma - 1;
    normalised =
      decimals === 3 && currencyExponent(currency) > 0
        ? cleaned.replace(/,/g, "")
        : cleaned.replace(",", ".");
  } else {
    normalised = cleaned;
  }

  const value = Number(normalised);
  if (!Number.isFinite(value)) return null;

  return toMinorUnits(value, currency);
}

/** Add amounts. Same currency only — never mix silently. */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(
      `Cannot add ${a.currency} to ${b.currency}. Convert first, explicitly.`,
    );
  }
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

/** Multiply by a quantity. Keeps the amount an integer. */
export function multiplyMoney(value: Money, quantity: number): Money {
  if (!Number.isInteger(quantity)) {
    throw new TypeError(`Quantity must be an integer, received ${quantity}`);
  }
  return { amountMinor: value.amountMinor * quantity, currency: value.currency };
}

/** Sum a list of amounts. Empty list is zero. */
export function sumMoney(values: Money[], currency: CurrencyCode = DEFAULT_CURRENCY): Money {
  return values.reduce((acc, v) => addMoney(acc, v), money(0, currency));
}
