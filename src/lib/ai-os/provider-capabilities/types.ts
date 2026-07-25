// Phase 14 — Provider Capability Engine types.
// ProviderCapability is the single source of truth for every provider's
// supported features, limitations, and quality ratings.
//
// STRICT RULES:
//   ✗ No prompt generation
//   ✗ No image/video generation
//   ✗ No provider API calls
//   ✓ Only structured capability knowledge

// ─────────────────────────────────────────────────────────────────────────────
// Core field type — every capability value is self-describing
// ─────────────────────────────────────────────────────────────────────────────

export type CapabilityConfidence = "confirmed" | "estimated" | "unknown";
export type CapabilitySource = "official_docs" | "community" | "internal_testing" | "estimated";

export interface CapabilityField<T = string> {
  /** The capability value. */
  value:      T;
  /** How confident we are in this value. */
  confidence: CapabilityConfidence;
  /** Where this information comes from. */
  source:     CapabilitySource;
  /** The provider version this data applies to. */
  version:    string;
}

// Helper shorthand for building capability fields
export function cap<T>(
  value: T,
  confidence: CapabilityConfidence = "confirmed",
  source: CapabilitySource = "official_docs",
  version = "latest"
): CapabilityField<T> {
  return { value, confidence, source, version };
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider type discriminator
// ─────────────────────────────────────────────────────────────────────────────

export type ProviderCapabilityId =
  | "openai"
  | "gemini"
  | "flux"
  | "ideogram"
  | "stable_diffusion"
  | "veo"
  | "runway"
  | "kling";

export type ProviderCategory = "image" | "video" | "image_video";

// ─────────────────────────────────────────────────────────────────────────────
// Full ProviderCapability — every field every provider must define
// ─────────────────────────────────────────────────────────────────────────────

export interface ProviderCapability {
  // ── Identity ────────────────────────────────────────────────────────────
  id:               ProviderCapabilityId;
  category:         ProviderCategory;
  providerName:     CapabilityField<string>;
  providerVersion:  CapabilityField<string>;
  supportedModels:  CapabilityField<string[]>;

  // ── Prompt limits ────────────────────────────────────────────────────────
  maximumPromptLength:          CapabilityField<number>;
  maximumNegativePromptLength:  CapabilityField<number>;
  negativePromptSupport:        CapabilityField<boolean>;
  seedSupport:                  CapabilityField<boolean>;
  stylePresets:                 CapabilityField<string[]>;

  // ── Output ───────────────────────────────────────────────────────────────
  maximumImages:          CapabilityField<number>;
  supportedAspectRatios:  CapabilityField<string[]>;
  supportedOutputSizes:   CapabilityField<string[]>;
  outputFormats:          CapabilityField<string[]>;
  compressionSupport:     CapabilityField<boolean>;
  transparentBackground:  CapabilityField<boolean>;

  // ── Quality modes ────────────────────────────────────────────────────────
  qualityLevels:    CapabilityField<string[]>;
  backgroundModes:  CapabilityField<string[]>;
  moderationControls: CapabilityField<string[]>;

  // ── Reference / Editing ─────────────────────────────────────────────────
  imageEditingSupport:      CapabilityField<boolean>;
  referenceImageSupport:    CapabilityField<boolean>;
  referenceImageFidelity:   CapabilityField<string[]>;
  multipleReferenceImages:  CapabilityField<boolean>;
  maximumReferenceImages:   CapabilityField<number>;
  maskSupport:              CapabilityField<boolean>;
  imageVariationSupport:    CapabilityField<boolean>;

  // ── Streaming ────────────────────────────────────────────────────────────
  streamingSupport:      CapabilityField<boolean>;
  partialImagesSupport:  CapabilityField<boolean>;

  // ── Rendering quality ratings (1–10) ─────────────────────────────────────
  typographyQuality:          CapabilityField<number>;  // text-in-image rendering
  humanRenderingQuality:      CapabilityField<number>;
  productRenderingQuality:    CapabilityField<number>;
  medicalRenderingQuality:    CapabilityField<number>;
  architectureRenderingQuality: CapabilityField<number>;
  foodRenderingQuality:       CapabilityField<number>;
  luxuryAdvertisementQuality: CapabilityField<number>;

  // ── Performance ──────────────────────────────────────────────────────────
  estimatedSpeed:     CapabilityField<"fast" | "medium" | "slow" | "very_slow">;
  estimatedCostTier:  CapabilityField<"free" | "low" | "medium" | "high" | "very_high">;

  // ── Use case guidance ────────────────────────────────────────────────────
  recommendedUseCases:  CapabilityField<string[]>;
  knownStrengths:       CapabilityField<string[]>;
  knownWeaknesses:      CapabilityField<string[]>;
  unsupportedFeatures:  CapabilityField<string[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation result types
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationSeverity = "error" | "warning" | "info";

export interface CapabilityValidationIssue {
  severity:    ValidationSeverity;
  code:        string;          // e.g. "PROMPT_TOO_LONG", "UNSUPPORTED_ASPECT_RATIO"
  field:       string;          // which capability field triggered this
  requested:   string;          // what was requested
  supported:   string;          // what IS supported
  message:     string;          // human-readable description
  resolution:  string;          // how to fix it
}

export interface CapabilityValidationResult {
  provider:       ProviderCapabilityId;
  isCompatible:   boolean;        // false if any error-severity issues
  issues:         CapabilityValidationIssue[];
  errorCount:     number;
  warningCount:   number;
  infoCount:      number;
}
