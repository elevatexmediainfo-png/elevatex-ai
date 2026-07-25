import type { ProviderCapability } from "../types";
import { cap } from "../types";

// Google Veo 3 video generation capability definition.

export const veoCapability: ProviderCapability = {
  id: "veo",
  category: "video",

  providerName:    cap("Google Veo"),
  providerVersion: cap("veo-3"),
  supportedModels: cap(["veo-3", "veo-2"]),

  maximumPromptLength:         cap(1500, "confirmed", "official_docs", "veo-3"),
  maximumNegativePromptLength: cap(0),
  negativePromptSupport:       cap(false, "confirmed"),
  seedSupport:                 cap(false, "estimated"),
  stylePresets:                cap([]),

  maximumImages:         cap(0, "confirmed"),  // video, not images
  supportedAspectRatios: cap(["16:9", "9:16", "1:1"], "confirmed", "official_docs", "veo-3"),
  supportedOutputSizes:  cap(["1280x720", "1920x1080"], "estimated", "official_docs"),
  outputFormats:         cap(["mp4"], "confirmed", "official_docs"),
  compressionSupport:    cap(false),
  transparentBackground: cap(false),

  qualityLevels:      cap(["standard", "high"], "estimated"),
  backgroundModes:    cap(["default"]),
  moderationControls: cap(["default"], "confirmed"),

  imageEditingSupport:     cap(false),
  referenceImageSupport:   cap(true, "confirmed", "official_docs", "veo-3"),  // image-to-video
  referenceImageFidelity:  cap(["auto"]),
  multipleReferenceImages: cap(false),
  maximumReferenceImages:  cap(1),
  maskSupport:             cap(false),
  imageVariationSupport:   cap(false),

  streamingSupport:     cap(false),
  partialImagesSupport: cap(false),

  typographyQuality:           cap(4, "estimated"),  // video text is challenging
  humanRenderingQuality:       cap(9, "estimated", "community"),
  productRenderingQuality:     cap(8, "estimated"),
  medicalRenderingQuality:     cap(6, "estimated"),
  architectureRenderingQuality:cap(8, "estimated"),
  foodRenderingQuality:        cap(8, "estimated"),
  luxuryAdvertisementQuality:  cap(8, "estimated", "community"),

  estimatedSpeed:    cap("slow", "estimated"),
  estimatedCostTier: cap("very_high", "estimated"),

  recommendedUseCases: cap(["Brand video campaigns", "Product showcase videos", "Lifestyle video content", "Short commercial clips"]),
  knownStrengths: cap(["Cinematic quality", "Realistic motion", "Strong scene understanding", "Image-to-video generation"]),
  knownWeaknesses: cap(["No separate negative prompt", "High cost", "Slow generation", "Limited duration", "No text overlay"]),
  unsupportedFeatures: cap(["Negative prompt", "Text-in-video", "Still image output", "Transparent background"]),
};
