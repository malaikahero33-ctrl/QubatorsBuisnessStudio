import { describe, expect, it } from "vitest";
import {
  normalisePhone,
  updateBusinessSchema,
  updateProfileSchema,
  updateSettingsSchema,
  createTransactionSchema,
} from "./schemas";

const UUID = "3b83b158-8316-43aa-8eca-2adc841d821d";

describe("normalisePhone", () => {
  it("converts a Ugandan local number to E.164", () => {
    // The form says "0772 123 456". The database constraint says +256772123456.
    expect(normalisePhone("0772 123 456")).toBe("+256772123456");
  });

  it("converts a number with no trunk zero", () => {
    expect(normalisePhone("772123456")).toBe("+256772123456");
  });

  it("strips cosmetic separators", () => {
    const variants = ["0772-123-456", "0772.123.456", "(0772) 123 456", " 0772  123  456 "];
    for (const v of variants) {
      expect(normalisePhone(v)).toBe("+256772123456");
    }
  });

  it("passes an already-international number straight through", () => {
    expect(normalisePhone("+256772123456")).toBe("+256772123456");
    expect(normalisePhone("+254712345678")).toBe("+254712345678");
  });

  it("returns null for an empty string", () => {
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone("   ")).toBeNull();
  });

  it("returns null for something that is not a number", () => {
    expect(normalisePhone("call me")).toBeNull();
    expect(normalisePhone("0772abc456")).toBeNull();
  });

  it("returns null for a number too short to be real", () => {
    // +25677 is 8 characters, below the database's minimum of 7 digits after
    // the plus... it passes. But a bare "0" cannot be a phone number.
    expect(normalisePhone("0")).toBeNull();
  });

  it("respects a different country code", () => {
    expect(normalisePhone("0722 123 456", "254")).toBe("+254722123456");
  });

  it("rejects a country code starting with zero", () => {
    // E.164 forbids a zero immediately after the plus. A zero later in the
    // number is legitimate and must be allowed through.
    expect(normalisePhone("+025672123456")).toBeNull();
    expect(normalisePhone("+2560772123456")).toBe("+2560772123456");
  });

  it("produces output the database CHECK would accept", () => {
    for (const input of ["0772123456", "+256772123456", "772 123 456", "+254712345678"]) {
      const result = normalisePhone(input);
      expect(result).not.toBeNull();
      expect(result).toMatch(/^\+[1-9]\d{6,14}$/);
    }
  });
});

describe("updateBusinessSchema", () => {
  const valid = {
    id: UUID,
    name: "Sunrise Foods",
    stage: "launched",
  };

  it("accepts a minimal business", () => {
    expect(updateBusinessSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a one-character name", () => {
    expect(updateBusinessSchema.safeParse({ ...valid, name: "A" }).success).toBe(false);
  });

  it("rejects a blank name", () => {
    expect(updateBusinessSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
  });

  it("accepts every stage the database allows", () => {
    for (const stage of ["idea", "planning", "branding", "launched", "growing"]) {
      expect(updateBusinessSchema.safeParse({ ...valid, stage }).success).toBe(true);
    }
  });

  it("rejects an unknown stage", () => {
    expect(updateBusinessSchema.safeParse({ ...valid, stage: "huge" }).success).toBe(false);
  });

  it("has no currency field to change", () => {
    // Every stored amount is denominated in the business's currency. Letting it
    // be edited here would relabel prices without converting them.
    const shape = Object.keys(updateBusinessSchema.shape);
    expect(shape).not.toContain("currency");
    expect(shape).not.toContain("locale");
    expect(shape).not.toContain("timezone");
    expect(shape).not.toContain("slug");
  });

  it("treats empty optional fields as empty rather than invalid", () => {
    const r = updateBusinessSchema.safeParse({
      ...valid,
      industry: "",
      location: "",
      target_customer: "",
      goals: "",
    });
    expect(r.success).toBe(true);
  });
});

describe("updateProfileSchema", () => {
  it("accepts a name with no phone", () => {
    expect(updateProfileSchema.safeParse({ full_name: "Asha", phone: "" }).success).toBe(true);
  });

  it("requires a name", () => {
    expect(updateProfileSchema.safeParse({ full_name: "", phone: "" }).success).toBe(false);
  });

  it("rejects a lowercase country code", () => {
    // The database constraint is ^[A-Z]{2}$, and the form uppercases before
    // validating. This asserts the schema itself would catch a lowercase one.
    expect(updateProfileSchema.safeParse({ full_name: "Asha", country_code: "ug" }).success).toBe(
      false,
    );
  });

  it("accepts an uppercase country code", () => {
    expect(updateProfileSchema.safeParse({ full_name: "Asha", country_code: "UG" }).success).toBe(
      true,
    );
  });
});

describe("updateSettingsSchema", () => {
  const valid = {
    business_id: UUID,
    notify_new_order: true,
    notify_consultation: false,
    weekly_digest: false,
    onboarding_step: "add_product",
  };

  it("accepts settings", () => {
    expect(updateSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts all-off notifications", () => {
    // Unchecked boxes send nothing at all, which is a legitimate choice.
    expect(
      updateSettingsSchema.safeParse({
        ...valid,
        notify_new_order: false,
        notify_consultation: false,
        weekly_digest: false,
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown onboarding step", () => {
    expect(updateSettingsSchema.safeParse({ ...valid, onboarding_step: "launch_rocket" }).success).toBe(
      false,
    );
  });

  it("coerces the string a form actually posts", () => {
    // The action converts "on" to a boolean before this, but a stray string
    // must not be accepted as a truthy value.
    expect(updateSettingsSchema.safeParse({ ...valid, weekly_digest: "yes" }).success).toBe(false);
  });
});

describe("createTransactionSchema", () => {
  it("rejects a negative amount", () => {
    expect(
      createTransactionSchema.safeParse({
        type: "expense",
        amount_minor: -100,
        occurred_on: "2026-09-15T12:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("rejects a zero amount", () => {
    expect(
      createTransactionSchema.safeParse({
        type: "expense",
        amount_minor: 0,
        occurred_on: "2026-09-15T12:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});
