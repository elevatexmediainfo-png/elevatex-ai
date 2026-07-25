import type { ProviderCapability } from "../types";
import { cap } from "../types";

// Kling AI 2.0 video capability definition.

export const klingCapability: ProviderCapability = {
  id: "kling",
  category: "video",

  providerName:    cap("Kling AI"),
  providerVersion: cap("kling-2.0"),
  supportedModels: cap(["kling-2.0", "kling-1.6", "kling-1.5"]),

  maximumPromptLength:         cap(800, "confirmed", "official_docs", "kling-2.0"),
  maximumNegativePromptLength: cap(200, "confirmed", "official_docs", "kling-2.0"),
  negativePromptSupport:       cap(true, "confirmed", "official_docs", "kling-2.0"),
  seedSupport:                 cap(true, "confirmed"),
  stylePresets:                cap([]),

  maximumImages:         cap(0),
  supportedAspectRatios: cap(["16:9", "9:16", "1:1"], "confirmed"),
  supportedOutputSizes:  cap(["1920x1080", "1080x1920", "1080x1080"], "confirmed"),
  outputFormats:         cap(["mp4"], "confirmed"),
  compressionSupport:    cap(false),
  transparentBackground: cap(false),

  qualityLevels:      cap(["standard", "high"], "confirmed"),
  backgroundModes:    cap(["default"]),
  moderationControls: cap(["default"]),

  imageEditingSupport:     cap(false),
  referenceImageSupport:   cap(true, "confirmed"),
  referenceImageFidelity:  cap(["auto"]),
  multipleReferenceImages: cap(false),
  maximumReferenceImages:  cap(1),
  maskSupport:             cap(false),
  imageVariationSupport:   cap(false),

  streamingSupport:     cap(false),
  partialImagesSupport: cap(false),

  typographyQuality:           cap(3, "estimated"),
  humanRenderingQuality:       cap(9, "estimated", "community"),
  productRenderingQuality:     cap(8, "estimated"),
  medicalRenderingQuality:     cap(6, "estimated"),
  architectureRenderingQuality:cap(8, "estimated"),
  foodRenderingQuality:        cap(8, "estimated"),
  luxuryAdvertisementQuality:  cap(8, "estimated", "community"),

  estimatedSpeed:    cap("medium", "estimated"),
  estimatedCostTier: cap("medium", "estimated"),

  recommendedUseCases: cap(["Asian market video content", "Character-consistent video", "Lifestyle video", "Product showcase"]),
  knownStrengths: cap(["Strong character consistency", "Negative prompt support", "Good human rendering", "More affordable than Veo/Runway"]),
  knownWeaknesses: cap(["Western market usage patterns differ", "Text overlay not reliable", "Limited editing control"]),
  unsupportedFeatures: cap(["Text overlay", "Image editing", "Multiple reference images", "Transparent background"]),
};
