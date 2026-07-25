import type { ProviderCapability } from "../types";
import { cap } from "../types";

// Runway Gen-4 video capability definition.

export const runwayCapability: ProviderCapability = {
  id: "runway",
  category: "video",

  providerName:    cap("Runway"),
  providerVersion: cap("gen-4"),
  supportedModels: cap(["gen-4", "gen-3-alpha"]),

  maximumPromptLength:         cap(500, "confirmed", "official_docs", "gen-4"),
  maximumNegativePromptLength: cap(0),
  negativePromptSupport:       cap(false, "confirmed"),
  seedSupport:                 cap(true, "confirmed", "official_docs", "gen-4"),
  stylePresets:                cap([]),

  maximumImages:         cap(0),
  supportedAspectRatios: cap(["16:9", "9:16", "1:1"], "confirmed", "official_docs"),
  supportedOutputSizes:  cap(["1280x720", "720x1280"], "confirmed"),
  outputFormats:         cap(["mp4"], "confirmed"),
  compressionSupport:    cap(false),
  transparentBackground: cap(false),

  qualityLevels:      cap(["standard"], "confirmed"),
  backgroundModes:    cap(["default"]),
  moderationControls: cap(["default"]),

  imageEditingSupport:     cap(false),
  referenceImageSupport:   cap(true, "confirmed", "official_docs", "gen-4"),  // image + text → video
  referenceImageFidelity:  cap(["auto"]),
  multipleReferenceImages: cap(false),
  maximumReferenceImages:  cap(1),
  maskSupport:             cap(false),
  imageVariationSupport:   cap(false),

  streamingSupport:     cap(false),
  partialImagesSupport: cap(false),

  typographyQuality:           cap(3, "estimated"),
  humanRenderingQuality:       cap(8, "estimated", "community"),
  productRenderingQuality:     cap(7, "estimated"),
  medicalRenderingQuality:     cap(5, "estimated"),
  architectureRenderingQuality:cap(7, "estimated"),
  foodRenderingQuality:        cap(7, "estimated"),
  luxuryAdvertisementQuality:  cap(7, "estimated"),

  estimatedSpeed:    cap("medium", "estimated"),
  estimatedCostTier: cap("high", "estimated", "official_docs"),

  recommendedUseCases: cap(["Short video ads", "Social media video", "Motion from still images", "Creative video generation"]),
  knownStrengths: cap(["Excellent motion consistency", "Image-to-video", "Creative control", "Short generation time vs Veo"]),
  knownWeaknesses: cap(["Short maximum duration", "Limited to 10s clips", "No text overlay", "Higher cost"]),
  unsupportedFeatures: cap(["Negative prompt", "Text overlay", "Still image output", "Multiple reference images"]),
};
