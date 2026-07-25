import type { ProviderRuntimeConfig } from "../credentials";
import type { LLMGenerateRequest, LLMGenerateResult, LLMProvider } from "./types";

const LANGUAGE_INSTRUCTION: Record<string, string> = {
  EN: "Respond entirely in English.",
  HI: "Respond entirely in Hindi (Devanagari script).",
  HINGLISH: "Respond in conversational Hinglish (Hindi-English code-mixed, Latin script).",
};

const DEFAULT_MODEL = "gpt-4o-mini";

// Real adapter — plain REST call (no SDK dependency) against OpenAI's chat
// completions API. Credentials/model are resolved once by
// lib/providers/credentials.ts (Admin AI Providers panel, falling back to
// OPENAI_API_KEY) and injected here — this class never reads process.env.
// This is the only file in the codebase allowed to know OpenAI's
// request/response shape — everything else talks to LLMProvider.
export class OpenAILLMProvider implements LLMProvider {
  readonly id = "openai";
  readonly category = "LLM" as const;
  readonly model: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async generate(req: LLMGenerateRequest): Promise<LLMGenerateResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error(
        "openai is enabled but no API key is configured (Admin → AI Providers, or OPENAI_API_KEY)."
      );
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              req.systemPrompt ??
              `You are a short-form video script writer for Indian small businesses. ${
                LANGUAGE_INSTRUCTION[req.contentLanguage] ?? LANGUAGE_INSTRUCTION.EN
              }`,
          },
          {
            role: "user",
            content: req.imageUrl
              ? [
                  { type: "text", text: req.prompt },
                  { type: "image_url", image_url: { url: req.imageUrl } },
                ]
              : req.prompt,
          },
        ],
        temperature: 0.8,
        ...(req.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      throw new Error("OpenAI response did not contain a message.");
    }

    return { text, providerRef: json.id, usage: { tokens: json.usage?.total_tokens } };
  }
}
