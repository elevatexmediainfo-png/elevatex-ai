// Phase 13 — Multi-Provider Translation Layer types.
// ProviderPrompt is the FINAL output of the AI OS pipeline — the actual
// prompt string that gets sent to an image/video generation provider.
//
// This is the ONLY module in the AI OS that knows about provider-specific
// formatting. Every upstream module is provider-agnostic.

export type SupportedProvider =
  | "openai"
  | "gemini"
  | "flux"
  | "ideogram"
  | "stable_diffusion"
  | "veo"
  | "runway"
  | "kling";

export const SUPPORTED_PROVIDERS: SupportedProvider[] = [
  "openai", "gemini", "flux", "ideogram", "stable_diffusion", "veo", "runway", "kling",
];

export interface ProviderPromptMeta {
  /** Which AI provider this prompt targets. */
  provider:           SupportedProvider;
  /** The specific model version this translator was built for. */
  providerVersion:    string;
  /** Version of the translator module that produced this prompt. */
  translatorVersion:  string;
  createdAt:          string;
  /** Links back to the OptimizedPromptSpecification that was translated. */
  sourceOptimizationId: string;
  /** Links back to the original PromptSpecification. */
  sourceSpecId:       string;
}

export interface ProviderPromptBody {
  /** The actual prompt string to send to the provider API. */
  finalPrompt:           string;
  /** For providers that support a separate negative prompt (Flux, SDXL). */
  negativePrompt?:       string;
  /** Which specification sections were included, in the order they appear. */
  orderedSections:       string[];
  /** Character count of finalPrompt. */
  estimatedPromptLength: number;
  /** Approximate token count (1 token ≈ 4 chars for English). */
  estimatedTokenCount:   number;
  /** The formatting style used: "prose" | "tags" | "temporal" */
  formatStyle:           "prose" | "tags" | "temporal";
}

export interface ProviderPromptQuality {
  /** 0-100: how confident the translator is in the prompt quality. */
  translationConfidence: number;
  /** 0-100: are all critical sections (hero, composition, negatives) present? */
  promptCompleteness:    number;
  /** 0-100: is the prompt well-formed for this provider? */
  promptHealth:          number;
  /** 0-100: predicted output quality based on prompt richness. */
  estimatedQuality:      number;
  /** Non-fatal issues detected during translation. */
  warnings:              string[];
}

/** The complete output of the Provider Translator — ready to send to the provider API. */
export interface ProviderPrompt {
  meta:    ProviderPromptMeta;
  body:    ProviderPromptBody;
  quality: ProviderPromptQuality;
}

/** Interface every provider translator must implement. */
export interface ProviderTranslatorImpl {
  readonly provider:    SupportedProvider;
  readonly version:     string;
  translate(optimizedSpec: import("../prompt-optimizer/types").OptimizedPromptSpecification): ProviderPrompt;
}
