/**
 * Prompt library.
 *
 * One function per AI feature, all sharing `AI_GROUND_RULES`. Two rules shape
 * the whole file:
 *
 * 1. Every prompt names the currency and locale, because a model defaults to
 *    dollars and commas. Telling it "UGX, no decimals" is the difference
 *    between advice a Ugandan founder can act on and advice they have to
 *    mentally convert before using.
 *
 * 2. Every prompt asks for assumptions. A model asked for a clean answer will
 *    invent market sizes and present them as findings. `aiEnvelopeSchema`
 *    rejects a response without them, so the prompt has to produce them or the
 *    route fails closed (ADR-4).
 *
 * The business context is injected as compact JSON rather than prose, so the
 * model can tell "Sunrise Granola at 1,200,000" from a sentence about it.
 */

import { AI_GROUND_RULES, type AiFeature, type BusinessContext } from "@/lib/ai/provider";
import { formatMoney, type CurrencyCode } from "@/lib/money";

/**
 * Money as a plain string, in the business's own currency.
 *
 * Uses `formatMoney` from lib/money rather than hand-rolling it, so the
 * prompt and the UI can never disagree about what an amount means. The
 * Intl-formatted symbol is stripped off the front and replaced with the ISO
 * code, because a prompt that says "$" for a Ugandan business is a prompt
 * that will produce dollar figures in the answer.
 */
function money(minor: number, currency: string): string {
  const code = currency as CurrencyCode;
  const formatted = formatMoney(minor, code, "en-GB"); // e.g. "USh1,200,000"
  // Drop the currency symbol the locale inserts, keep the digits and any
  // decimal point, then append the code explicitly.
  const digits = formatted.replace(/[^\d.,]/g, "");
  return `${digits} ${currency}`;
}

function describeBusiness(ctx: BusinessContext): string {
  const lines = [
    `Business: ${ctx.name}`,
    ctx.industry ? `Industry: ${ctx.industry}` : null,
    ctx.location ? `Location: ${ctx.location}` : null,
    `Stage: ${ctx.stage}`,
    `Currency: ${ctx.currency} (${ctx.currency === "UGX" || ctx.currency === "TZS" ? "whole units, no decimals" : "minor units"})`,
    ctx.targetCustomer ? `Target customer: ${ctx.targetCustomer}` : null,
    ctx.brandPersonality ? `Brand personality: ${ctx.brandPersonality}` : null,
    ctx.goals ? `Goals: ${ctx.goals}` : null,
  ].filter(Boolean);

  if (ctx.products.length) {
    lines.push("Products and prices:");
    for (const p of ctx.products) {
      lines.push(`  - ${p.name}: ${money(p.priceMinor, ctx.currency)}`);
    }
  }

  if (ctx.priceRangeMinor) {
    lines.push(
      `Target price range: ${money(ctx.priceRangeMinor.min, ctx.currency)} to ` +
        `${money(ctx.priceRangeMinor.max, ctx.currency)}`,
    );
  }

  return lines.join("\n");
}

export type Prompt = {
  system: string;
  user: string;
};

/**
 * Shared preamble: the rules, then the business facts.
 *
 * The facts come before the task on purpose. A model that has read the price
 * list produces advice consistent with it; one that has not tends to invent
 * prices that sound plausible for the region.
 */
function frame(ctx: BusinessContext, task: string, extraRules: string[] = []): string {
  return [
    AI_GROUND_RULES,
    "",
    "--- THE BUSINESS ---",
    describeBusiness(ctx),
    "",
    "--- WHAT TO PRODUCE ---",
    task,
    ...extraRules.map((r) => `- ${r}`),
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/* 5. Copilot                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Free-form business questions.
 *
 * The context is rebuilt on every question rather than cached in the
 * conversation, so an answer given after the owner adds a product reflects
 * that product. A chat history that goes stale is worse than no history.
 */
export function copilotPrompt(ctx: BusinessContext, question: string): Prompt {
  return {
    system: frame(
      ctx,
      "Answer the founder's question. Be concrete and specific to THIS business.",
      [
        "If the question needs data you were not given, say which data and how to get it.",
        "Prefer one clear recommendation over a list of options, unless the trade-off is real.",
        "Keep it under 400 words. This is read on a phone.",
      ],
    ),
    user: question.trim(),
  };
}

/* -------------------------------------------------------------------------- */
/* 6. Idea generator                                                           */
/* -------------------------------------------------------------------------- */

/**
 * JSON output. The schema lives in the caller; this only describes the shape
 * so the model produces something parseable.
 */
export function ideaPrompt(
  ctx: BusinessContext,
  params: { sector?: string; budget?: string; skills?: string },
): Prompt {
  const specifics = [
    params.sector ? `Sector: ${params.sector}` : null,
    params.budget ? `Available budget: ${params.budget}` : null,
    params.skills ? `Founder's skills and experience: ${params.skills}` : null,
  ].filter(Boolean);

  const ccy = ctx.currency.toLowerCase();

  return {
    system: frame(
      ctx,
      [
        "Generate 3 business ideas the founder could realistically run in this market.",
        "",
        "Reply with JSON only, no prose outside it:",
        "{",
        '  "ideas": [',
        "    {",
        '      "name": "short name",',
        '      "one_liner": "one sentence on what it is",',
        '      "problem_it_solves": "the specific pain, not a generic market need",',
        '      "who_pays": "the exact customer, not a segment label",',
        `      "startup_cost_${ccy}": number,`,
        `      "monthly_operating_cost_${ccy}": number,`,
        `      "realistic_monthly_revenue_${ccy}": number,`,
        '      "first_steps": ["concrete", "actions", "for week one"],',
        '      "main_risk": "the thing most likely to kill this",',
        '      "why_now": "what makes this possible now in this market"',
        "    }",
        "  ]",
        "}",
      ].join("\n"),
      [
        `Every figure must be in whole ${ctx.currency} units with no decimal point.`,
        "Revenue figures must be conservative. State in assumptions that these are estimates, not research.",
        "first_steps must be things this week, not 'conduct market research'.",
      ],
    ),
    user:
      specifics.length > 0
        ? `Generate ideas with these constraints:\n${specifics.join("\n")}`
        : "Generate ideas suited to this business owner's situation.",
  };
}

/* -------------------------------------------------------------------------- */
/* 7. Business plan generator                                                  */
/* -------------------------------------------------------------------------- */

export function businessPlanPrompt(
  ctx: BusinessContext,
  params: { summary?: string },
): Prompt {
  return {
    system: frame(
      ctx,
      [
        "Produce a business plan. Write it to be usable, not impressive.",
        "",
        "Reply with JSON only:",
        "{",
        '  "executive_summary": "3-4 sentences a bank could read",',
        '  "sections": [',
        "    {",
        '      "heading": "Market opportunity",',
        '      "body": "2-3 paragraphs. State what is known and what is assumed.",',
        '      "key_numbers": ["only numbers you were given or that follow from them"]',
        "    }",
        "  ]",
        '  "financial_summary": {',
        `    "currency": "${ctx.currency}",`,
        '    "startup_costs": number,',
        '    "monthly_costs": number,',
        '    "monthly_revenue_target": number,',
        '    "break_even_months": number',
        "  }",
        '  "milestones": [{"when": "month 1", "what": "what must be true"}],',
        '  "risks": [{"risk": "what could go wrong", "mitigation": "what to do about it"}]',
        "}",
        "",
        "Required sections, in this order: Market opportunity, Products or services,",
        "Marketing and sales, Operations, Financial plan, Risks.",
      ].join("\n"),
      [
        "No decimal points anywhere. " +
          (ctx.currency === "UGX" || ctx.currency === "TZS"
            ? `${ctx.currency} has no minor unit in circulation.`
            : `Use 2 decimal places for ${ctx.currency}.`),
        "break_even_months must be a whole number. If you cannot estimate it, say 0 and explain in assumptions.",
        "If a required section has no real information available, write that plainly. Do not pad.",
      ],
    ),
    user: params.summary?.trim()
      ? `The founder describes their plan like this:\n${params.summary.trim()}`
      : "Write the plan for the business described above.",
  };
}

/* -------------------------------------------------------------------------- */
/* 8. Brand generator                                                          */
/* -------------------------------------------------------------------------- */

export function brandPrompt(
  ctx: BusinessContext,
  params: { keywords?: string; style?: string },
): Prompt {
  const specifics = [
    params.keywords ? `Words the founder wants to convey: ${params.keywords}` : null,
    params.style ? `Visual style: ${params.style}` : null,
  ].filter(Boolean);

  return {
    system: frame(
      ctx,
      [
        "Produce a brand kit. Practical, not aspirational.",
        "",
        "Reply with JSON only:",
        "{",
        '  "name_options": [{"name": "...", "why": "one sentence"}],',
        '  "tagline_options": ["at most 7 words each"],',
        '  "tone_of_voice": ["five adjectives"],',
        '  "colors": [{"name": "plain name", "hex": "#RRGGBB", "use": "what it is for"}],',
        '  "fonts": {"heading": "...", "body": "...", "note": "free and widely available"},',
        '  "brand_personality": ["five words"],',
        '  "logo_direction": "what to draw, for someone who will hire a designer",',
        '  "what_to_avoid": ["three things that would undercut this brand here"]',
        "}",
      ].join("\n"),
      [
        "Colours must be hex codes, not names alone. Name them in plain language too.",
        "Fonts must be free and available in Africa without a paid licence.",
        "Check the name against the existing products list — do not reuse a name already in use.",
      ],
    ),
    user: specifics.length
      ? `Build the brand with these constraints:\n${specifics.join("\n")}`
      : "Build a brand for the business described above.",
  };
}

/* -------------------------------------------------------------------------- */
/* 10. Marketing content                                                       */
/* -------------------------------------------------------------------------- */

export type MarketingChannel =
  | "social_post"
  | "whatsapp"
  | "product_description"
  | "sms"
  | "poster_caption"
  | "email";

export function marketingPrompt(
  ctx: BusinessContext,
  params: {
    channel: MarketingChannel;
    subject: string;
    details?: string;
    tone?: string;
  },
): Prompt {
  const formats: Record<MarketingChannel, { label: string; rules: string[] }> = {
    social_post: {
      label: "A social media post",
      rules: [
        "Under 200 characters before any hashtags.",
        "Open with something concrete, not 'Hello everyone'.",
        "At most 5 hashtags. No generic ones like #love or #business.",
      ],
    },
    whatsapp: {
      label: "A WhatsApp message to a customer",
      rules: [
        "Under 500 characters.",
        "Sound like one person to another, not a company.",
        "Ask for a reply. A message that needs no response achieves nothing.",
      ],
    },
    product_description: {
      label: "A product description for a listing or menu",
      rules: [
        "Say what it is, what it does for the customer, and what it costs.",
        "Include the price. Give the amount in " + ctx.currency + ".",
        "Two to four sentences. No hype adjectives without a fact behind them.",
      ],
    },
    sms: {
      label: "An SMS",
      rules: ["Under 160 characters, single segment.", "One message, one ask."],
    },
    poster_caption: {
      label: "A caption for a printed poster or flyer",
      rules: ["Under 150 characters.", "Include the price and how to order."],
    },
    email: {
      label: "An email",
      rules: [
        "Subject line under 50 characters.",
        "One topic. One ask.",
      ],
    },
  };

  const format = formats[params.channel];

  return {
    system: frame(
      ctx,
      `Write ${format.label}.`,
      format.rules.map((r) => r),
    ),
    user: [
      `Subject: ${params.subject.trim()}`,
      params.details?.trim() ? `Details: ${params.details.trim()}` : null,
      params.tone?.trim() ? `Tone: ${params.tone.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/* -------------------------------------------------------------------------- */

/** JSON instructions for a feature, or undefined when free text is fine. */
export function wantsJson(feature: AiFeature): boolean {
  return (
    feature === "idea" || feature === "business_plan" || feature === "brand"
  );
}
