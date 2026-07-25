// AI OS LLM types — higher-level than the raw provider types in lib/providers/llm/types.ts.
// Modules within lib/ai-os/* import from here; they never import provider types directly.
// The underlying transport (OpenAI, Gemini, self-hosted) is admin-configured at
// /admin/ai-providers and resolved at runtime by the factory + engine below.

// ─────────────────────────────────────────────────────────────────────────────
// Task taxonomy — determines system prompt, response format, and cache policy
// ─────────────────────────────────────────────────────────────────────────────

export type LLMTaskType =
  | "analysis"       // marketing/design intelligence extraction — cached
  | "json_extraction" // structured JSON output — cached
  | "creative_text"   // copy, headlines, CTAs — cached
  | "image_analysis"  // vision: reference image or brand asset — NOT cached
  | "translation";    // language translation — cached

// ─────────────────────────────────────────────────────────────────────────────
// Request shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface AILLMRequest {
  prompt: string;
  language?: "EN" | "HI" | "HINGLISH";
  taskType?: LLMTaskType;
  /** Override the task-derived system prompt. Use sparingly — prefer taskType. */
  systemPrompt?: string;
  /** Analytics label for cost tracking (defaults to taskType). */
  operation?: string;
}

export interface AILLMVisionRequest extends AILLMRequest {
  /** Publicly-fetchable URL of the image to analyze. */
  imageUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Response shape
// ─────────────────────────────────────────────────────────────────────────────

export interface AILLMResponse {
  text: string;
  providerRef?: string;
  /** true when the response was served from the in-memory cache. */
  cached: boolean;
  taskType: LLMTaskType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────

export interface AILLMHealth {
  providerId: string;
  status: "healthy" | "degraded" | "down";
  latencyMs?: number;
  checkedAt: Date;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompts — one per task type; adapters fall back to these when
// the caller does not override systemPrompt explicitly.
// ─────────────────────────────────────────────────────────────────────────────

export const SYSTEM_PROMPTS: Record<LLMTaskType, string> = {
  analysis:
    "You are a marketing intelligence analyst specializing in Indian SMB advertising. " +
    "Analyze the provided content and return concise, factual insights. Be specific and evidence-based.",
  json_extraction:
    "You are a structured data extraction system. " +
    "Parse the provided content and return valid JSON only. No prose, no markdown, no explanation.",
  creative_text:
    "You are an expert advertising copywriter specializing in high-conversion marketing for Indian small and medium businesses. " +
    "Write punchy, direct copy that speaks to the audience's desires and pain points.",
  image_analysis:
    "You are a visual design analyst. Describe the image's design elements, color palette, composition, typography, " +
    "and inferred marketing intent. Be specific about what you observe.",
  translation:
    "You are a professional translator and localization expert. " +
    "Translate accurately while preserving tone, marketing intent, and cultural nuance.",
};
