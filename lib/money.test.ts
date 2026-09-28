import { describe, expect, it } from "vitest";
import {
  addMoney,
  currencyExponent,
  formatMoney,
  money,
  multiplyMoney,
  parseMoneyInput,
  sumMoney,
  toMajorUnits,
  toMinorUnits,
} from "./money";

describe("zero-decimal currencies", () => {
  it("treats UGX minor units as whole shillings", () => {
    expect(currencyExponent("UGX")).toBe(0);
    expect(toMajorUnits(10000, "UGX")).toBe(10000);
    expect(toMinorUnits(10000, "UGX")).toBe(10000);
  });

  it("formats UGX without inventing decimals", () => {
    const out = formatMoney(10000, "UGX", "en-UG");
    // en-UG renders UGX as "USh 10,000".
    expect(out).toContain("10,000");
    // The property actually under test: no decimal fraction is invented.
    // Asserting `not.toContain("00")` would be wrong - "10,000" contains "00".
    expect(out).not.toMatch(/[.,]\d{2}$/);
  });

  it("handles TZS as zero-decimal too", () => {
    expect(currencyExponent("TZS")).toBe(0);
  });
});

describe("two-decimal currencies", () => {
  it("converts minor units correctly", () => {
    expect(currencyExponent("USD")).toBe(2);
    expect(toMajorUnits(150050, "USD")).toBe(1500.5);
    expect(toMinorUnits(1500.5, "USD")).toBe(150050);
  });

  it("formats with two decimals", () => {
    expect(formatMoney(150050, "USD", "en-US")).toContain("1,500.50");
  });
});

describe("guards against corrupt amounts", () => {
  it("rejects a float", () => {
    // No @ts-expect-error: the parameter is typed `number`, so a float is a
    // legal *type* but an illegal *value*. The guard is a runtime throw,
    // which is the layer that matters for values arriving from a form or an
    // AI response.
    expect(() => formatMoney(10.5, "USD")).toThrow(/integer/);
  });

  it("rejects NaN and Infinity", () => {
    expect(() => formatMoney(Number.NaN, "USD")).toThrow();
    expect(() => formatMoney(Number.POSITIVE_INFINITY, "USD")).toThrow();
  });

  it("rejects an unsupported currency", () => {
    // Cast needed because the type system already forbids this. The test
    // proves the RUNTIME guard exists, not just the compile-time one.
    expect(() => formatMoney(100, "XYZ" as never)).toThrow(/Unsupported currency/);
  });
});

describe("parseMoneyInput", () => {
  it("parses grouped input", () => {
    expect(parseMoneyInput("10,000", "UGX")).toBe(10000);
    expect(parseMoneyInput("1,500.50", "USD")).toBe(150050);
  });

  it("treats a lone comma as a decimal separator when the currency has decimals", () => {
    expect(parseMoneyInput("12,5", "USD")).toBe(1250);
  });

  it("treats a lone comma as a thousands separator for a zero-decimal currency", () => {
    expect(parseMoneyInput("10,000", "UGX")).toBe(10000);
  });

  it("strips currency symbols and spaces", () => {
    expect(parseMoneyInput("UGX 10,000", "UGX")).toBe(10000);
    expect(parseMoneyInput("$ 1,500.50", "USD")).toBe(150050);
  });

  it("returns null rather than NaN for junk", () => {
    expect(parseMoneyInput("", "USD")).toBeNull();
    expect(parseMoneyInput("abc", "USD")).toBeNull();
    expect(parseMoneyInput("-", "USD")).toBeNull();
  });
});

describe("arithmetic", () => {
  it("adds same-currency amounts", () => {
    expect(addMoney(money(10000, "UGX"), money(5000, "UGX"))).toEqual(
      money(15000, "UGX"),
    );
  });

  it("refuses to mix currencies", () => {
    expect(() => addMoney(money(100, "USD"), money(100, "UGX"))).toThrow(
      /Cannot add/,
    );
  });

  it("multiplies by an integer quantity and stays an integer", () => {
    const result = multiplyMoney(money(2500, "USD"), 3);
    expect(result.amountMinor).toBe(7500);
    expect(Number.isInteger(result.amountMinor)).toBe(true);
  });

  it("rejects a fractional quantity", () => {
    expect(() => multiplyMoney(money(2500, "USD"), 1.5)).toThrow(/integer/);
  });

  it("sums an empty list to zero", () => {
    expect(sumMoney([], "UGX")).toEqual(money(0, "UGX"));
  });
});
