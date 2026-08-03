import type { ProviderRuntimeConfig } from "../credentials";
import type { LLMGenerateRequest, LLMGenerateResult, LLMProvider } from "./types";
import { NonRetryableProviderError } from "@/lib/generation/types";

const LANGUAGE_INSTRUCTION: Record<string, string> = {
  EN: "Respond entirely in English.",
  HI: "Respond entirely in Hindi (Devanagari script).",
  HINGLISH: "Respond in conversational Hinglish (Hindi-English code-mixed, Latin script).",
};

// Real, confirmed-live incident (2026-08-03) — this was previously a
// version-pinned snapshot ("gemini-2.5-flash"), and Google returned a real
// 404 for it: "This model models/gemini-2.5-flash is no longer available to
// new users." This is the SECOND time a pinned Gemini snapshot has gone
// stale in this exact file (gemini-1.5-flash before it — see git history),
// so pinning a THIRD dated snapshot would just recreate the same bug on
// Google's next model retirement. "gemini-flash-latest" is Google's own
// documented alias for "whatever the current stable flash-tier model is" —
// it never needs a code change when Google retires a snapshot underneath
// it, which a version-pinned string structurally cannot offer.
const DEFAULT_MODEL = "gemini-flash-latest";

function isModelNotFoundError(status: number): boolean {
  // Google's Generative Language API 404s this exact endpoint only when the
  // model path segment itself doesn't resolve (wrong/retired/inaccessible
  // model id) — no other resource on this endpoint can 404. Matched on
  // status alone, not the message text (wording differs between "not
  // found" and "no longer available to new users", but both are the same
  // class of deterministic, retry-useless failure for a fixed model
  // string).
  return status === 404;
}

// Real adapter — plain REST call (no SDK) against Google's Generative
// Language API. Credentials/model are resolved once by
// lib/providers/credentials.ts (Admin AI Providers panel, falling back to
// GEMINI_API_KEY/GEMINI_MODEL) and injected here.
export class GeminiLLMProvider implements LLMProvider {
  readonly id = "gemini";
  readonly category = "LLM" as const;
  readonly model: string;

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    // Precedence unchanged: DB ProviderConfig.model -> GEMINI_MODEL env ->
    // DEFAULT_MODEL. Only the value DEFAULT_MODEL itself resolves to changed.
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async generate(req: LLMGenerateRequest): Promise<LLMGenerateResult> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error(
        "gemini is enabled but no API key is configured (Admin → AI Providers, or GEMINI_API_KEY)."
      );
    }

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

    // Real resilience fix (2026-08-03) — a single attempt against whatever
    // model resolved (DB/env/hardcoded default, precedence unchanged) is no
    // longer trusted blindly: if THAT specific model 404s as unavailable,
    // one automatic retry against the current stable alias
    // (DEFAULT_MODEL) runs before this adapter gives up — covers the case
    // where an admin-configured or env-configured model string has itself
    // gone stale, not just the hardcoded default. If the alias retry also
    // 404s, this throws NonRetryableProviderError so the Generation
        // Engine's failover (lib/generation/engine.ts) moves to the next
    // configured provider (e.g. openai) immediately, instead of burning
    // this provider's full retry budget on a deterministically-broken
    // model id.
    const attemptModels =
      this.model === DEFAULT_MODEL ? [this.model] : [this.model, DEFAULT_MODEL];

    let lastNotFoundDetail: string | null = null;
    for (let i = 0; i < attemptModels.length; i++) {
      const model = attemptModels[i];
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
        const detail = `Gemini request failed (${res.status}) for model "${model}": ${body.slice(0, 300)}`;
        if (isModelNotFoundError(res.status)) {
          lastNotFoundDetail = detail;
          const isLastAttempt = i === attemptModels.length - 1;
          if (isLastAttempt) {
            throw new NonRetryableProviderError(lastNotFoundDetail);
          }
          continue; // try the next model in attemptModels (the stable alias)
        }
        // Any other error class (429/500/timeout/etc.) — unchanged behavior,
        // a plain Error that the engine's existing retry/health logic handles.
        throw new Error(detail);
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

    // Unreachable — the loop above always either returns or throws — but
    // keeps TypeScript's control-flow analysis satisfied without a
    // non-null assertion.
    throw new NonRetryableProviderError(lastNotFoundDetail ?? "Gemini request failed for an unknown reason.");
  }
}
