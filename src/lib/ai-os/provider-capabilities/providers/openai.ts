import type { ProviderCapability } from "../types";
import { cap } from "../types";

// OpenAI GPT Image capability definition.
// Source: https://platform.openai.com/docs/api-reference/images
// Version: gpt-image-1.5 (as of 2026-07)

export const openaiCapability: ProviderCapability = {
  id: "openai",
  category: "image",

  providerName:    cap("OpenAI GPT Image"),
  providerVersion: cap("gpt-image-1.5"),
  supportedModels: cap(["gpt-image-1", "gpt-image-1.5", "gpt-image-1-mini"]),

  // Prompt
  maximumPromptLength:         cap(32000, "confirmed", "official_docs", "gpt-image-1.5"), // chars (not tokens)
  maximumNegativePromptLength: cap(0, "confirmed", "official_docs", "gpt-image-1.5"),    // no separate negative
  negativePromptSupport:       cap(false, "confirmed", "official_docs", "gpt-image-1.5"),
  seedSupport:                 cap(false, "confirmed", "official_docs", "gpt-image-1.5"),
  stylePresets:                cap([], "confirmed", "official_docs", "gpt-image-1.5"),    // no style presets

  // Output
  maximumImages:         cap(1, "confirmed", "official_docs", "gpt-image-1.5"),
  supportedAspectRatios: cap(["1:1", "4:5", "16:9"], "confirmed", "official_docs", "gpt-image-1.5"),
  supportedOutputSizes:  cap(["1024x1024", "1024x1536", "1536x1024"], "confirmed", "official_docs", "gpt-image-1.5"),
  outputFormats:         cap(["png", "jpeg", "webp"], "confirmed", "official_docs", "gpt-image-1.5"),
  compressionSupport:    cap(true, "confirmed", "official_docs", "gpt-image-1.5"),   // output_compression 0-100
  transparentBackground: cap(true, "confirmed", "official_docs", "gpt-image-1.5"),  // background: transparent

  // Quality
  qualityLevels:    cap(["low", "medium", "high", "auto"], "confirmed", "official_docs", "gpt-image-1.5"),
  backgroundModes:  cap(["transparent", "opaque", "auto"], "confirmed", "official_docs", "gpt-image-1.5"),
  moderationControls: cap(["auto", "low"], "confirmed", "official_docs", "gpt-image-1.5"),

  // Reference / Editing
  imageEditingSupport:     cap(true, "confirmed", "official_docs", "gpt-image-1.5"),  // /images/edits endpoint
  referenceImageSupport:   cap(true, "confirmed", "official_docs", "gpt-image-1.5"),
  referenceImageFidelity:  cap(["high", "low"], "confirmed", "official_docs", "gpt-image-1.5"),  // input_fidelity
  multipleReferenceImages: cap(true, "confirmed", "official_docs", "gpt-image-1.5"),
  maximumReferenceImages:  cap(16, "confirmed", "official_docs", "gpt-image-1.5"),
  maskSupport:             cap(true, "confirmed", "official_docs", "gpt-image-1.5"),   // via edits endpoint
  imageVariationSupport:   cap(false, "confirmed", "official_docs", "gpt-image-1.5"),  // variations endpoint for dall-e-2 only

  // Streaming
  streamingSupport:     cap(true, "confirmed", "official_docs", "gpt-image-1.5"),
  partialImagesSupport: cap(true, "confirmed", "official_docs", "gpt-image-1.5"),  // partial_images 0-3

  // Rendering quality (1-10)
  typographyQuality:           cap(9, "confirmed", "internal_testing", "gpt-image-1.5"),  // excellent text rendering
  humanRenderingQuality:       cap(9, "confirmed", "internal_testing", "gpt-image-1.5"),
  productRenderingQuality:     cap(9, "confirmed", "internal_testing", "gpt-image-1.5"),
  medicalRenderingQuality:     cap(8, "estimated", "internal_testing", "gpt-image-1.5"),
  architectureRenderingQuality:cap(9, "confirmed", "internal_testing", "gpt-image-1.5"),
  foodRenderingQuality:        cap(9, "confirmed", "internal_testing", "gpt-image-1.5"),
  luxuryAdvertisementQuality:  cap(9, "confirmed", "internal_testing", "gpt-image-1.5"),

  // Performance
  estimatedSpeed:    cap("medium", "estimated", "community", "gpt-image-1.5"),   // ~3-8s per image
  estimatedCostTier: cap("high", "confirmed", "official_docs", "gpt-image-1.5"), // quality=high is most expensive

  // Use case guidance
  recommendedUseCases: cap([
    "Commercial advertising images",
    "Product photography",
    "Marketing creatives with text",
    "Brand campaigns",
    "Editorial images",
    "Medical illustration (safe)",
    "Real estate photography",
  ]),
  knownStrengths: cap([
    "Best-in-class text rendering in images",
    "Excellent instruction following",
    "Natural photorealistic output",
    "Multi-image reference editing",
    "Transparent background support",
    "Partial image streaming",
  ]),
  knownWeaknesses: cap([
    "No separate negative prompt",
    "Limited to 3 aspect ratios",
    "Relatively slow generation speed",
    "Higher cost than Flux for volume",
    "No style presets",
  ]),
  unsupportedFeatures: cap([
    "Negative prompt (folds into positive)",
    "Seed control",
    "Style presets",
    "Image variations (dall-e-2 only)",
  ]),
};
