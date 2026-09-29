import { describe, expect, it } from "vitest";
import {
  createBusinessSchema,
  slugify,
  toFieldErrors,
} from "./schemas";
import { parseMoneyInput } from "@/lib/money";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Sunrise Foods")).toBe("sunrise-foods");
  });

  it("strips accents", () => {
    expect(slugify("Café Alémana")).toBe("cafe-alemana");
  });

  it("collapses punctuation and trims edges", () => {
    expect(slugify("  Hello,   World!!  ")).toBe("hello-world");
    expect(slugify("---abc---")).toBe("abc");
  });

  it("keeps digits", () => {
    expect(slugify("Studio 24 Seven")).toBe("studio-24-seven");
  });

  it("returns empty for punctuation-only input", () => {
    // The action handles this case explicitly, so the behaviour must be
    // known rather than accidental.
    expect(slugify("!!!")).toBe("");
    expect(slugify("")).toBe("");
  });

  it("respects the database length limit", () => {
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe("createBusinessSchema", () => {
  const valid = { name: "Sunrise Foods" };

  it("accepts a name alone and defaults the rest", () => {
    const result = createBusinessSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("UGX");
      expect(result.data.stage).toBe("idea");
    }
  });

  it("trims the name", () => {
    const result = createBusinessSchema.safeParse({ name: "  Sunrise  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Sunrise");
  });

  it("rejects a too-short name", () => {
    expect(createBusinessSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(createBusinessSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects an unsupported currency", () => {
    expect(createBusinessSchema.safeParse({ ...valid, currency: "XYZ" }).success).toBe(false);
  });

  it("accepts every supported currency", () => {
    for (const currency of ["UGX", "KES", "TZS", "RWF", "USD", "GBP", "EUR"]) {
      expect(createBusinessSchema.safeParse({ ...valid, currency }).success).toBe(true);
    }
  });

  it("rejects an unknown stage", () => {
    expect(createBusinessSchema.safeParse({ ...valid, stage: "launching" }).success).toBe(false);
  });

  it("treats blank optional fields as absent, not invalid", () => {
    const result = createBusinessSchema.safeParse({
      ...valid,
      industry: "",
      location: "",
      target_customer: "",
      goals: "",
      price_min: "",
      price_max: "",
    });
    expect(result.success).toBe(true);
  });

  it("allows a half-filled price range", () => {
    expect(
      createBusinessSchema.safeParse({ ...valid, price_min: "2000", price_max: "" }).success,
    ).toBe(true);
    expect(
      createBusinessSchema.safeParse({ ...valid, price_min: "", price_max: "15000" }).success,
    ).toBe(true);
  });
});

describe("toFieldErrors", () => {
  it("flattens issues to field messages", () => {
    const result = createBusinessSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = toFieldErrors(result.error);
      expect(fields.name).toBeTruthy();
    }
  });
});

describe("price input becomes integer minor units", () => {
  it("converts typed text to integers, never floats", () => {
    // UGX is zero-decimal, so there is no fractional part at all.
    expect(parseMoneyInput("2000", "UGX")).toBe(2000);
    expect(parseMoneyInput("2,000", "UGX")).toBe(2000);
    // USD is two-decimal, so the same text means something different.
    expect(parseMoneyInput("1500.50", "USD")).toBe(150050);
  });

  it("rejects junk rather than producing NaN", () => {
    expect(parseMoneyInput("abc", "UGX")).toBeNull();
    expect(parseMoneyInput("", "UGX")).toBeNull();
  });

  it("always yields an integer", () => {
    for (const input of ["1.99", "1000", "12,500.75"]) {
      const v = parseMoneyInput(input, "USD");
      if (v !== null) expect(Number.isInteger(v)).toBe(true);
    }
  });
});
