// Google Gemini Image quality configuration.

// [Indian-default / realism fix] Mirrors OPENAI_QUALITY_SENTENCE
// (providers/openai/quality.ts) — this exact wording is the proven fix that
// already produces reliably Indian primary AND secondary/background
// subjects on the OpenAI path. Gemini's translator previously had NO
// ethnicity instruction anywhere — real gemini-3-pro-image generations
// (routed through this provider-translator pipeline, not
// clean-background-prompt.ts's separate poster-mode fix) had nothing
// steering the model away from its Western-default output. Same wording,
// same unconditional inclusion (not gated behind any flag), so it can't be
// silently dropped by brief/spec variation the way a structured field could.
export const GEMINI_QUALITY_SENTENCE =
  "Unless the brief explicitly specifies otherwise, every human subject in this image is Indian — including any secondary, background, or incidental people, not only the main subject — with Indian faces, Indian skin tones, and natural features and styling appropriate to the setting.";

export const GEMINI_QUALITY_BOOSTERS = [
  "professional commercial photography",
  "premium advertising quality",
  "ultra high resolution",
  "photorealistic",
  "rich details",
  "perfect composition",
];

export const GEMINI_QUALITY_ANTI_PATTERNS = [
  "cartoon", "illustration", "low quality", "blurry",
  "distorted", "unrealistic", "bad anatomy", "watermark",
  // [Indian-default / realism fix] additive only — nothing above removed.
  "western faces when Indian is intended",
];

export const GEMINI_LIMITS = {
  maxLength:          8000,   // Gemini supports longer prompts
  supportsNegative:   false,  // fold negatives into prompt
  supportsTypography: true,
  isVideoProvider:    false,
  providerVersion:    "imagen-4",
};
