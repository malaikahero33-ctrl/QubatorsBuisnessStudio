import { describe, expect, it } from "vitest";
import {
  copilotPrompt,
  ideaPrompt,
  businessPlanPrompt,
  brandPrompt,
  marketingPrompt,
  wantsJson,
} from "./prompts";
import { AI_GROUND_RULES } from "./provider";
import type { BusinessContext } from "./provider";

const ctx: BusinessContext = {
  name: "Sunrise Foods",
  industry: "Food processing",
  location: "Kampala, Uganda",
  stage: "launched",
  targetCustomer: "Health-conscious urban workers",
  currency: "UGX",
  products: [
    { name: "Sunrise Granola 250g", priceMinor: 1_200_000 },
    { name: "Sunrise Trail Mix 150g", priceMinor: 950_000 },
  ],
  brandPersonality: "warm, practical",
  goals: "Reach 500 monthly customers",
  priceRangeMinor: { min: 900_000, max: 1_500_000 },
};

describe("AI ground rules", () => {
  const everyPrompt = [
    copilotPrompt(ctx, "How should I price?"),
    ideaPrompt(ctx, {}),
    businessPlanPrompt(ctx, {}),
    brandPrompt(ctx, {}),
    marketingPrompt(ctx, { channel: "social_post", subject: "New granola" }),
  ];

  it("are present in every prompt's system message", () => {
    // A feature that drops the rules is how unverified output starts being
    // presented as fact. This is the test that catches it.
    for (const p of everyPrompt) {
      expect(p.system).toContain("State your assumptions");
      expect(p.system).toContain("Never guarantee revenue");
    }
  });

  it("include the business facts", () => {
    for (const p of everyPrompt) {
      expect(p.system).toContain("Sunrise Foods");
      expect(p.system).toContain("Kampala");
    }
  });

  it("include the currency", () => {
    // A model that does not know the currency will answer in dollars.
    for (const p of everyPrompt) {
      expect(p.system).toContain("UGX");
    }
  });
});

describe("copilotPrompt", () => {
  it("puts the question in the user message", () => {
    expect(copilotPrompt(ctx, "  Why is my margin thin?  ").user).toBe(
      "Why is my margin thin?",
    );
  });

  it("names the products and their real prices", () => {
    const p = copilotPrompt(ctx, "Is my pricing right?");
    expect(p.system).toContain("Sunrise Granola 250g");
    // 1_200_000 UGX is zero-decimal, so 1,200,000 not 12,000.00.
    expect(p.system).toContain("1,200,000 UGX");
    expect(p.system).toContain("950,000 UGX");
  });

  it("states the decimal rule for a zero-decimal currency", () => {
    expect(copilotPrompt(ctx, "x").system).toContain("no decimals");
  });

  it("does not claim zero decimals for USD", () => {
    const usd: BusinessContext = { ...ctx, currency: "USD" };
    const p = copilotPrompt(usd, "x");
    expect(p.system).toContain("USD");
    expect(p.system).not.toContain("no decimals");
    // 1_200_000 minor units of USD is 12,000.00.
    expect(p.system).toContain("12,000.00 USD");
  });

  it("includes the price range when one exists", () => {
    expect(copilotPrompt(ctx, "x").system).toContain("Target price range");
  });

  it("omits the price range when there is none", () => {
    const { priceRangeMinor, ...noRange } = ctx;
    expect(copilotPrompt(noRange, "x").system).not.toContain("Target price range");
  });

  it("survives a business with nothing filled in", () => {
    const bare: BusinessContext = {
      name: "New Thing",
      industry: "Not specified",
      location: "Not specified",
      stage: "idea",
      targetCustomer: "",
      currency: "UGX",
      products: [],
    };
    const p = copilotPrompt(bare, "Where do I start?");
    expect(p.system).toContain("New Thing");
    expect(p.system).toContain("Not specified");
  });

  it("keeps the message under a sensible size", () => {
    // Prompt bloat is billed per token and dilutes attention. 8k is generous
    // for what this sends.
    expect(copilotPrompt(ctx, "x").system.length).toBeLessThan(8000);
  });
});

describe("ideaPrompt", () => {
  it("asks for JSON", () => {
    expect(ideaPrompt(ctx, {}).system).toContain("JSON only");
  });

  it("uses the business currency in field names", () => {
    expect(ideaPrompt(ctx, {}).system).toContain("startup_cost_ugx");
  });

  it("demands whole units with no decimals", () => {
    expect(ideaPrompt(ctx, {}).system).toMatch(/no decimal point/i);
  });

  it("passes constraints into the user message", () => {
    const p = ideaPrompt(ctx, {
      sector: "Agriculture",
      budget: "5,000,000 UGX",
      skills: "accounting",
    });
    expect(p.user).toContain("Agriculture");
    expect(p.user).toContain("5,000,000 UGX");
    expect(p.user).toContain("accounting");
  });

  it("does not mention absent constraints", () => {
    expect(ideaPrompt(ctx, {}).user).not.toContain("Sector:");
  });
});

describe("businessPlanPrompt", () => {
  it("asks for the required sections in order", () => {
    const p = businessPlanPrompt(ctx, {});
    expect(p.system).toContain("Market opportunity");
    expect(p.system).toContain("Financial plan");
    expect(p.system).toContain("Risks");
  });

  it("reminds the model that UGX has no minor unit", () => {
    expect(businessPlanPrompt(ctx, {}).system).toContain(
      "UGX has no minor unit in circulation",
    );
  });

  it("tells a USD business to use 2 decimal places instead", () => {
    const p = businessPlanPrompt({ ...ctx, currency: "USD" }, {});
    expect(p.system).toContain("2 decimal places");
    expect(p.system).not.toContain("has no minor unit in circulation");
  });

  it("asks for break-even to be a whole number", () => {
    expect(businessPlanPrompt(ctx, {}).system).toContain(
      "break_even_months must be a whole number",
    );
  });

  it("includes the founder's own summary when given", () => {
    const p = businessPlanPrompt(ctx, { summary: "I want to sell to offices" });
    expect(p.user).toContain("I want to sell to offices");
  });
});

describe("brandPrompt", () => {
  it("requires hex codes for colours", () => {
    expect(brandPrompt(ctx, {}).system).toContain("#RRGGBB");
  });

  it("asks for fonts available without a paid licence", () => {
    // A founder who cannot afford a licence cannot use the brand.
    expect(brandPrompt(ctx, {}).system).toContain("free and available in Africa");
  });

  it("warns against reusing an existing product name", () => {
    expect(brandPrompt(ctx, {}).system).toContain("do not reuse a name already in use");
  });
});

describe("marketingPrompt", () => {
  it("applies channel-specific length limits", () => {
    const sms = marketingPrompt(ctx, { channel: "sms", subject: "Sale" });
    expect(sms.system).toContain("160 characters");

    const whatsapp = marketingPrompt(ctx, { channel: "whatsapp", subject: "Hello" });
    expect(whatsapp.system).toContain("500 characters");

    const social = marketingPrompt(ctx, { channel: "social_post", subject: "New" });
    expect(social.system).toContain("200 characters");
  });

  it("includes the price in a product description", () => {
    // A listing without a price wastes the click.
    const p = marketingPrompt(ctx, {
      channel: "product_description",
      subject: "Granola 250g",
    });
    expect(p.system).toContain("price");
    expect(p.system).toContain("UGX");
  });

  it("requires an ask in a WhatsApp message", () => {
    expect(marketingPrompt(ctx, { channel: "whatsapp", subject: "Hi" }).system).toContain(
      "Ask for a reply",
    );
  });

  it("passes tone through when given", () => {
    const p = marketingPrompt(ctx, {
      channel: "sms",
      subject: "Sale",
      tone: "playful but respectful",
    });
    expect(p.user).toContain("playful but respectful");
  });

  it("omits an absent tone", () => {
    expect(marketingPrompt(ctx, { channel: "sms", subject: "Sale" }).user).not.toContain(
      "Tone:",
    );
  });
});

describe("wantsJson", () => {
  it("is true for the generators and false for the chat features", () => {
    expect(wantsJson("idea")).toBe(true);
    expect(wantsJson("business_plan")).toBe(true);
    expect(wantsJson("brand")).toBe(true);
    expect(wantsJson("copilot")).toBe(false);
    expect(wantsJson("marketing")).toBe(false);
  });
});
