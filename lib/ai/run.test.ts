import { describe, expect, it } from "vitest";
import { z } from "zod";
import { aiEnvelopeSchema } from "@/lib/validation/schemas";

/**
 * The envelope contract, tested without a provider or a database.
 *
 * This is the single rule that decides whether the AI features can present
 * something as advice: a response without stated assumptions is rejected
 * (ADR-4). Every other test in the AI suite assumes this one holds.
 */

const ideaSchema = z.object({
  ideas: z
    .array(
      z.object({
        name: z.string().min(1),
        one_liner: z.string().min(1),
        startup_cost_ugx: z.number().nonnegative(),
        first_steps: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
});

const envelope = aiEnvelopeSchema(ideaSchema);

const base = {
  model: "test-model",
  usage: { inputTokens: 100, outputTokens: 200 },
};

const validContent = {
  ideas: [
    {
      name: "Granola bowls",
      one_liner: "Breakfast bowls sold near offices",
      startup_cost_ugx: 1_200_000,
      first_steps: ["Visit three offices", "Price a sample tray"],
    },
  ],
};

describe("aiEnvelopeSchema", () => {
  it("accepts a complete response", () => {
    const r = envelope.safeParse({
      ...base,
      content: validContent,
      assumptions: ["Assumed the founder can supply from a rented kitchen"],
      warnings: [],
    });
    expect(r.success).toBe(true);
  });

  it("rejects a response with no assumptions", () => {
    // The whole point. A model that did not say what it assumed has not
    // earned the right to be rendered as advice.
    const r = envelope.safeParse({
      ...base,
      content: validContent,
      assumptions: [],
      warnings: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a response with no assumptions field at all", () => {
    const r = envelope.safeParse({ ...base, content: validContent, warnings: [] });
    expect(r.success).toBe(false);
  });

  it("rejects an assumptions array containing an empty string", () => {
    const r = envelope.safeParse({
      ...base,
      content: validContent,
      assumptions: ["real assumption", "   "],
      warnings: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects content that does not match the feature schema", () => {
    const r = envelope.safeParse({
      ...base,
      content: { ideas: [] },
      assumptions: ["something"],
      warnings: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects an idea with no first steps", () => {
    // "Conduct market research" is not a first step. An empty list forces the
    // model to produce something.
    const r = envelope.safeParse({
      ...base,
      content: { ideas: [{ ...validContent.ideas[0], first_steps: [] }] },
      assumptions: ["something"],
      warnings: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative money in a generated figure", () => {
    const r = envelope.safeParse({
      ...base,
      content: {
        ideas: [{ ...validContent.ideas[0], startup_cost_ugx: -1 }],
      },
      assumptions: ["something"],
      warnings: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a missing model name", () => {
    const r = envelope.safeParse({
      content: validContent,
      assumptions: ["something"],
      warnings: [],
      usage: { inputTokens: 1, outputTokens: 1 },
      model: "",
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative token counts", () => {
    const r = envelope.safeParse({
      ...base,
      usage: { inputTokens: -1, outputTokens: 10 },
      content: validContent,
      assumptions: ["something"],
      warnings: [],
    });
    expect(r.success).toBe(false);
  });

  it("allows warnings to be empty", () => {
    const r = envelope.safeParse({
      ...base,
      content: validContent,
      assumptions: ["something"],
      warnings: [],
    });
    expect(r.success).toBe(true);
  });

  it("preserves the parsed content for the caller", () => {
    const r = envelope.safeParse({
      ...base,
      content: validContent,
      assumptions: ["something"],
      warnings: ["check this"],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.content.ideas[0].name).toBe("Granola bowls");
      expect(r.data.warnings).toEqual(["check this"]);
    }
  });
});
