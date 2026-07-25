// Flux (Black Forest Labs) quality configuration.
// Flux responds to tag-style prompts with short descriptors.

export const FLUX_QUALITY_BOOSTERS = [
  "professional photography",
  "premium commercial quality",
  "ultra detailed",
  "8k",
  "realistic textures",
  "perfect composition",
  "award winning",
];

export const FLUX_QUALITY_ANTI_PATTERNS = [
  "low quality",
  "blurry",
  "distorted",
  "bad anatomy",
  "cartoon",
  "watermark",
  "text overlay",
  "artifacts",
  "oversaturated",
];

export const FLUX_LIMITS = {
  maxLength:           512,    // Flux prefers shorter, denser prompts
  maxNegativeLength:   200,
  supportsNegative:    true,   // separate negative prompt supported
  supportsTypography:  false,  // Flux does not render text reliably
  isVideoProvider:     false,
  providerVersion:     "flux-1.1-pro",
};
