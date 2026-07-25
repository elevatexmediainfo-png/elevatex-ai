import type { ProviderRuntimeConfig } from "../credentials";
import type { LLMGenerateRequest, LLMGenerateResult, LLMProvider } from "./types";

const LANGUAGE_INSTRUCTION: Record<string, string> = {
  EN: "Respond entirely in English.",
  HI: "Respond entirely in Hindi (Devanagari script).",
  HINGLISH: "Respond in conversational Hinglish (Hindi-English code-mixed, Latin script).",
};

// AI Video Phase 3a — gemini-1.5-flash is no longer in Google's live model
// list (confirmed via a real GET /v1beta/models call this session, same
// "stale model id" class of bug already found and fixed in veo.provider.ts
// and gemini-images.provider.ts) — updated to a model confirmed present in
// that real response.
const DEFAULT_MODEL = "gemini-2.5-flash";

// Real adapter — plain REST call (no SDK) against Google's Generative
// Language API. Credentials/model are resolved once by
// lib/providers/credentials.ts (Admin AI Providers panel, falling back to
// GEMINI_API_KEY/GEMINI_MODEL) and injected here.
export class GeminiLLMProvider implements LLMProvider {
  readonly id = "gemini";
  readonly category = "LLM" as const;
  readonly model: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async generate(req: LLMGenerateRequest): Promise<LLMGenerateResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error(
        "gemini is enabled but no API key is configured (Admin → AI Providers, or GEMINI_API_KEY)."
      );
    }
    const model = this.model;

    const systemText =
      req.systemPrompt ??
      `You are a short-form video script writer for Indian small businesses. ${
        LANGUAGE_INSTRUCTION[req.contentLanguage] ?? LANGUAGE_INSTRUCTION.EN
      }`;

    // Gemini's REST API takes inline image bytes (inlineData), not an
    // arbitrary URL — fetch and base64-encode it server-side before sending.
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: `${systemText}\n\n${req.prompt}` },
    ];
    if (req.imageUrl) {
      const imgRes = await fetch(req.imageUrl);
      if (!imgRes.ok) {
        throw new Error(`Failed to fetch reference image for Gemini analysis (${imgRes.status}).`);
      }
      const mimeType = imgRes.headers.get("content-type") ?? "image/jpeg";
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      parts.push({ inlineData: { mimeType, data: buffer.toString("base64") } });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.8,
            ...(req.responseFormat === "json" ? { responseMimeType: "application/json" } : {}),
          },
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") {
      throw new Error("Gemini response did not contain a message.");
    }

    return {
      text,
      providerRef: json.candidates?.[0]?.finishReason,
      usage: { tokens: json.usageMetadata?.totalTokenCount },
    };
  }
}
