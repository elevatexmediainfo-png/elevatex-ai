import type { ProviderCapability } from "../types";
import { cap } from "../types";

// Flux (Black Forest Labs) flux-1.1-pro capability definition.

export const fluxCapability: ProviderCapability = {
  id: "flux",
  category: "image",

  providerName:    cap("Black Forest Labs Flux"),
  providerVersion: cap("flux-1.1-pro"),
  supportedModels: cap(["flux-1.1-pro", "flux-1.1-pro-ultra", "flux-1-schnell", "flux-pro"]),

  maximumPromptLength:         cap(512, "confirmed", "official_docs", "flux-1.1-pro"),
  maximumNegativePromptLength: cap(200, "confirmed", "official_docs", "flux-1.1-pro"),
  negativePromptSupport:       cap(true, "confirmed", "official_docs", "flux-1.1-pro"),
  seedSupport:                 cap(true, "confirmed", "official_docs", "flux-1.1-pro"),
  stylePresets:                cap([], "confirmed"),

  maximumImages:         cap(1, "confirmed"),
  supportedAspectRatios: cap(["custom_via_width_height"], "confirmed", "official_docs"),
  supportedOutputSizes:  cap(["flexible_up_to_2048x2048"], "confirmed", "official_docs", "flux-1.1-pro"),
  outputFormats:         cap(["png", "jpeg", "webp"], "confirmed", "official_docs"),
  compressionSupport:    cap(false, "estimated"),
  transparentBackground: cap(false, "confirmed", "official_docs", "flux-1.1-pro"),

  qualityLevels:      cap(["steps_1_to_50"], "confirmed", "official_docs"),
  backgroundModes:    cap(["default"], "confirmed"),
  moderationControls: cap(["none", "content_moderation"], "estimated", "community"),

  imageEditingSupport:     cap(false, "confirmed", "official_docs", "flux-1.1-pro"),
  referenceImageSupport:   cap(false, "confirmed", "official_docs", "flux-1.1-pro"),
  referenceImageFidelity:  cap([]),
  multipleReferenceImages: cap(false),
  maximumReferenceImages:  cap(0),
  maskSupport:             cap(false, "confirmed"),
  imageVariationSupport:   cap(false, "confirmed"),

  streamingSupport:     cap(false, "confirmed"),
  partialImagesSupport: cap(false, "confirmed"),

  typographyQuality:           cap(4, "confirmed", "internal_testing", "flux-1.1-pro"),  // poor text rendering
  humanRenderingQuality:       cap(8, "estimated", "community"),
  productRenderingQuality:     cap(8, "estimated", "community"),
  medicalRenderingQuality:     cap(6, "estimated"),
  architectureRenderingQuality:cap(8, "estimated"),
  foodRenderingQuality:        cap(8, "estimated"),
  luxuryAdvertisementQuality:  cap(7, "estimated", "community"),

  estimatedSpeed:    cap("fast", "confirmed", "official_docs"),    // flux-schnell is very fast
  estimatedCostTier: cap("medium", "confirmed", "official_docs"),

  recommendedUseCases: cap(["Fast iteration and prototyping", "Stylistically diverse content", "Social media images", "Batch generation"]),
  knownStrengths: cap(["Very fast generation", "Flexible dimensions", "Good photorealism", "Negative prompt support", "Style flexibility"]),
  knownWeaknesses: cap(["Poor text rendering", "Short prompt limit", "No image editing", "No reference images", "No transparent background"]),
  unsupportedFeatures: cap(["Text rendering in image", "Image editing", "Reference images", "Transparent background", "Streaming"]),
};
