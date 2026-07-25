// Vendor-agnostic contract. Business logic (lib/prompt-engine.ts, the
// Generation Engine in lib/generation/llm.ts) imports only this — never an
// OpenAI/Gemini SDK directly. Provider selection and priority order are
// admin-configurable (PROVIDER_LLM_PRIORITY); swapping or reordering vendors
// is a SystemConfig write, not a code change. See lib/providers/llm/index.ts.

import type { GenerationProvider } from "@/lib/generation/types";

export interface LLMGenerateRequest {
  prompt: string;
  contentLanguage: "EN" | "HI" | "HINGLISH";
  /** Overrides the adapter's default persona (video-script-writer) for callers doing something other than script generation, e.g. image-prompt enhancement. Adapters fall back to their existing default when omitted. */
  systemPrompt?: string;
  /** Milestone 15 — a publicly-fetchable image URL to analyze alongside `prompt` (reference-image style analysis). Adapters that don't support vision input ignore this field; OpenAI/Gemini send it as image content alongside the text. */
  imageUrl?: string;
  /** Milestone 16 — when "json", the adapter requests structured JSON output from the vendor (OpenAI's `response_format: json_object`, Gemini's `responseMimeType: application/json`) instead of free text. The caller is still responsible for parsing/validating `result.text` against its own schema — this only changes how the vendor is asked to respond. Defaults to "text". */
  responseFormat?: "text" | "json";
}

// `usage` feeds the Generation Engine's cost tracking (lib/generation/cost.ts)
// — optional because not every adapter's API exposes token counts (the Mock
// adapter never does, and cost for it is always 0 regardless).
export interface LLMGenerateResult {
  text: string;
  providerRef?: string;
  usage?: { tokens?: number };
}

export interface LLMProvider extends GenerationProvider {
  generate(req: LLMGenerateRequest): Promise<LLMGenerateResult>;
}
