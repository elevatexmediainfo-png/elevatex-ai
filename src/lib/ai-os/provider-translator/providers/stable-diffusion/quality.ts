// Stable Diffusion XL quality configuration.

export const SDXL_QUALITY_BOOSTERS = [
  "masterpiece", "best quality", "ultra detailed", "8k uhd",
  "professional photography", "sharp focus", "realistic",
];

export const SDXL_QUALITY_ANTI_PATTERNS = [
  "worst quality", "low quality", "normal quality", "lowres",
  "bad anatomy", "bad hands", "text", "error", "missing fingers",
  "extra digit", "fewer digits", "cropped", "blurry", "jpeg artifacts",
  "signature", "watermark", "username", "out of focus",
];

export const SDXL_LIMITS = {
  maxLength:          300,   // SDXL uses token-limited prompts (~75 tokens)
  maxNegativeLength:  150,
  supportsNegative:   true,
  supportsTypography: false,
  isVideoProvider:    false,
  providerVersion:    "sdxl-1.0",
};
