/**
 * The OpenAI-compatible provider.
 *
 * Only vendor-specific file in the codebase. Everything else goes through the
 * `AiProvider` interface in provider.ts, so pointing this at a different
 * vendor is a change to this file and one line in the factory — not a refactor
 * of five features.
 *
 * "OpenAI-compatible" is deliberate: the chat-completions shape is now the
 * de facto standard, so Gemini, Mistral, Groq, Together and a self-hosted
 * llama.cpp server all speak it. Open question 1 in docs/DECISIONS.md is
 * unresolved, and this file is what makes that decision cheap.
 *
 * Two things are not negotiable here:
 *
 * 1. The key is read from a server-only environment variable and never
 *    returned, logged or sent to the client.
 * 2. Every failure is translated into a message a founder can act on. A raw
 *    "401 Incorrect API key" tells someone in Kampala nothing about which of
 *    their four configured variables is wrong.
 */

import "server-only";

import {
  AiProviderError,
  AiRateLimitError,
  type AiProvider,
  type CompletionRequest,
  type CompletionResult,
  type ModelTier,
} from "@/lib/ai/provider";
import { AI_GROUND_RULES } from "@/lib/ai/provider";

/** Base URLs per provider. Defaults to OpenAI. */
const BASES: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  together: "https://api.together.xyz/v1",
  mistral: "https://api.mistral.ai/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  openai_compatible: "",
};

function baseUrl(): string {
  const provider = (process.env.AI_PROVIDER ?? "openai").toLowerCase();

  if (provider === "openai_compatible") {
    const custom = process.env.AI_BASE_URL;
    if (!custom) {
      throw new AiProviderError(
        "AI_PROVIDER is set to openai_compatible but AI_BASE_URL is empty. " +
          "Set it to the provider's /v1 endpoint.",
      );
    }
    return custom.replace(/\/$/, "");
  }

  const base = BASES[provider];
  if (!base) {
    throw new AiProviderError(
      `Unknown AI_PROVIDER "${provider}". Supported: ${Object.keys(BASES).join(", ")}.`,
    );
  }
  return base;
}

/**
 * Turn a provider error into something actionable.
 *
 * The distinction that matters most here is 401 versus 429: a 401 means the
 * key is wrong and nothing will work, while a 429 means the key is fine and
 * the user just has to wait. Conflating them sends someone to re-key a
 * working configuration.
 */
function explain(status: number, body: string): Error {
  const snippet = body.slice(0, 300);

  if (status === 401 || status === 403) {
    return new AiProviderError(
      "The AI provider rejected the API key. Check AI_API_KEY in .env.local — " +
        "it is not the Supabase key.",
    );
  }
  if (status === 429) {
    const wait = /try again in (\d+)/i.exec(snippet)?.[1];
    return new AiRateLimitError(wait ? Number(wait) : 60);
  }
  if (status === 404) {
    return new AiProviderError(
      "The configured model name was not found. Check AI_MODEL_FAST and " +
        "AI_MODEL_QUALITY against your provider's model list.",
    );
  }
  if (status === 400 && /context length|too long|maximum context/i.test(snippet)) {
    return new AiProviderError(
      "The request was too large for this model. Shorten the question, or " +
        "remove products from the catalogue.",
    );
  }
  if (status >= 500) {
    return new AiProviderError(
      "The AI provider is having problems. This is not something you caused — " +
        "try again in a few minutes.",
    );
  }
  return new AiProviderError(`The AI request failed (${status}). ${snippet}`);
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name: string;

  constructor(private readonly providerName = process.env.AI_PROVIDER ?? "openai") {
    this.name = providerName;
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      throw new AiProviderError(
        "No AI key is configured. Add AI_API_KEY to .env.local and restart the server.",
      );
    }

    const model = this.modelFor(request.tier);
    const base = baseUrl();

    const body = {
      model,
      messages: [
        // AI_GROUND_RULES is appended here as well as in the prompt library.
        // A provider is the trust boundary; a caller that forgets to include
        // the rules should not be able to quietly bypass them.
        { role: "system", content: `${request.system}\n\n${AI_GROUND_RULES}` },
        { role: "user", content: request.prompt },
      ],
      temperature: request.feature === "copilot" ? 0.7 : 0.4,
      ...(request.json
        ? { response_format: { type: "json_object" } }
        : {}),
      max_tokens: request.maxOutputTokens,
    };

    const timeout = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 60_000);

    // AbortController, not a hung request. A provider that never answers must
    // not hold a server action open until the platform kills it.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let response: Response;
    try {
      response = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AiProviderError(
          `The AI provider did not respond within ${Math.round(timeout / 1000)} seconds.`,
        );
      }
      throw new AiProviderError(
        "Could not reach the AI provider. Check the network and the base URL.",
        err,
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();

    if (!response.ok) {
      throw explain(response.status, text);
    }

    let parsed: {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };

    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AiProviderError(
        `The provider returned something that is not JSON (${text.slice(0, 120)}). ` +
          "Check that AI_BASE_URL points at the API root, not a documentation page.",
      );
    }

    const content = parsed.choices?.[0]?.message?.content;
    if (!content) {
      throw new AiProviderError(
        "The provider returned an empty response. Try rephrasing the request.",
      );
    }

    return {
      content,
      assumptions: [],
      warnings: [],
      model: parsed.model ?? model,
      usage: {
        inputTokens: parsed.usage?.prompt_tokens ?? 0,
        outputTokens: parsed.usage?.completion_tokens ?? 0,
      },
    };
  }

  private modelFor(tier: ModelTier): string {
    const env = tier === "fast" ? process.env.AI_MODEL_FAST : process.env.AI_MODEL_QUALITY;
    if (env) return env;

    /**
     * Defaults per provider.
     *
     * Groq is first-class rather than a copy of OpenAI's list, because its
     * model names are different and a wrong name is a 404 that reads as a
     * config error. `fast` uses the 8B model and `quality` the 70B: Groq
     * serves both so cheaply that tiering is about answer quality for the
     * long generations (business plan, brand) rather than cost.
     *
     * llama-3.1-8b-instant is the fast default because it is the cheapest
     * model on Groq and handles the short chat-style calls fine.
     */
    const defaults: Record<string, Record<ModelTier, string>> = {
      openai: { fast: "gpt-4o-mini", quality: "gpt-4o" },
      groq: { fast: "llama-3.1-8b-instant", quality: "llama-3.3-70b-versatile" },
      together: { fast: "meta-llama/Llama-3.3-70B-Instruct-Turbo", quality: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
      mistral: { fast: "mistral-small-latest", quality: "mistral-large-latest" },
      gemini: { fast: "gemini-2.0-flash", quality: "gemini-2.0-pro" },
    };

    return (
      defaults[this.providerName.toLowerCase()]?.[tier] ?? "gpt-4o-mini"
    );
  }
}
