// OpenAI GPT Image quality configuration.
// These are the quality boosters injected into every OpenAI prompt.
// DO NOT add provider API parameters here — those belong in the generation engine.

// Natural-sentence quality statement — injected as prose, not a keyword list.
// gpt-image-1 responds to coherent briefs, not Midjourney-style comma tags.
//
// [Indian-default / realism fix] This is the one channel unconditionally
// included in every OpenAI prompt regardless of GPT_CREATIVE_DIRECTOR_ENABLED
// (confirmed by tracing both branches in providers/openai/translator.ts).
// The GPT Creative Director system prompt (creative-director/gpt-prompt.ts)
// already has a strong "ALL human subjects are Indian" directive, but only
// reaches the model when that flag is on (default off). Extended here, not
// in a new constant, because translator.ts references this exact constant
// unconditionally in both its modern and legacy branches — adding a second
// constant would require also editing translator.ts, out of scope for this
// change. Two additions: (1) an overridable Indian-by-default instruction —
// "unless the brief explicitly specifies otherwise" keeps it deferential to
// any campaign that names a specific ethnicity; (2) a real-photograph
// instruction targeting the glossy/plastic/AI-generated look, independent of
// the ethnicity fix.
//
// [Poster-mode mixed-ethnicity fix] "every human subject" was being read as
// covering only the main subject, leaving secondary/background people
// Western in multi-person images (most visible in poster mode, whose prompt
// has no PRIMARY HERO/SECONDARY SUBJECTS structure to anchor against — see
// poster-prompt.ts). Made explicit rather than relying on "every" alone.
export const OPENAI_QUALITY_SENTENCE =
  "Shot with the photorealistic fidelity and editorial craft of a premium advertising agency production — ultra-detailed, with natural material textures and magazine-quality styling throughout. Unless the brief explicitly specifies otherwise, every human subject in the image is Indian — including any secondary, background, or incidental people, not only the main subject — with Indian faces, Indian skin tones, and natural features and styling appropriate to the setting. The result must look like a real photograph of real people — natural skin texture with visible pores and subtle imperfections, realistic facial asymmetry, and authentic candid expression — never glossy, airbrushed, plastic, or AI-generated.";

export const OPENAI_QUALITY_ANTI_PATTERNS = [
  "cartoon look",
  "plastic faces",
  "low detail",
  "distorted text",
  "bad anatomy",
  "cheap layout",
  "generic AI look",
  "artifacts",
  "watermarks",
  "blurry output",
  "stock photo appearance",
  // [Indian-default / realism fix] additive only — nothing above was removed
  // or weakened.
  "airbrushed plastic skin",
  "waxy AI faces",
  "over-smoothed skin",
  "uncanny symmetrical faces",
  "western faces when Indian is intended",
];

export const OPENAI_LIMITS = {
  maxLength:          32000,  // Phase 10.4G: quality first — no artificial truncation
  supportsNegative:   false,  // OpenAI folds negatives into the prompt text
  supportsTypography: true,   // gpt-image-1.5 attempts text rendering
  isVideoProvider:    false,
  providerVersion:    "gpt-image-1.5",
};
