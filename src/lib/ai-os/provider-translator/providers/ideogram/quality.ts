// Ideogram quality configuration.
// Ideogram excels at text rendering in images — Typography zones are critical.

export const IDEOGRAM_QUALITY_BOOSTERS = [
  "professional commercial photography",
  "premium advertising",
  "ultra detailed",
  "photorealistic",
  "magazine quality",
];

export const IDEOGRAM_QUALITY_ANTI_PATTERNS = [
  "low quality", "blurry", "cartoon", "bad anatomy",
  "distorted text", "illegible text", "watermarks", "artifacts",
];

export const IDEOGRAM_LIMITS = {
  maxLength:           2000,
  supportsNegative:    false,
  supportsTypography:  true,   // Ideogram specialises in text rendering
  isVideoProvider:     false,
  providerVersion:     "V_2",
};
