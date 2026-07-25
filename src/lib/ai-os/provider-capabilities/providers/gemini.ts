import type { ProviderCapability } from "../types";
import { cap } from "../types";

// Google Gemini Imagen-4 capability definition.

export const geminiCapability: ProviderCapability = {
  id: "gemini",
  category: "image",

  providerName:    cap("Google Gemini Imagen"),
  providerVersion: cap("imagen-4"),
  supportedModels: cap(["imagen-4", "imagen-4-ultra", "imagen-3"]),

  maximumPromptLength:         cap(4000, "estimated", "official_docs", "imagen-4"),
  maximumNegativePromptLength: cap(0),
  negativePromptSupport:       cap(false, "confirmed", "official_docs", "imagen-4"),
  seedSupport:                 cap(true, "confirmed", "official_docs", "imagen-4"),
  stylePresets:                cap([], "confirmed"),

  maximumImages:         cap(4, "confirmed", "official_docs", "imagen-4"),
  supportedAspectRatios: cap(["1:1", "3:4", "4:3", "9:16", "16:9"], "confirmed", "official_docs", "imagen-4"),
  supportedOutputSizes:  cap(["flexible", "up_to_8192x8192"], "estimated", "community", "imagen-4"),
  outputFormats:         cap(["png", "jpeg"], "confirmed", "official_docs", "imagen-4"),
  compressionSupport:    cap(false, "estimated"),
  transparentBackground: cap(false, "estimated", "community", "imagen-4"),

  qualityLevels:    cap(["standard", "hd"], "estimated", "community", "imagen-4"),
  backgroundModes:  cap(["default"], "confirmed"),
  moderationControls: cap(["block_some", "block_few", "block_none"], "estimated", "community", "imagen-4"),

  imageEditingSupport:     cap(true, "confirmed", "official_docs", "imagen-4"),
  referenceImageSupport:   cap(true, "confirmed", "official_docs", "imagen-4"),
  referenceImageFidelity:  cap(["auto"], "estimated"),
  multipleReferenceImages: cap(false, "estimated", "community"),
  maximumReferenceImages:  cap(1, "estimated"),
  maskSupport:             cap(true, "estimated", "community", "imagen-4"),
  imageVariationSupport:   cap(false, "estimated"),

  streamingSupport:     cap(false, "estimated"),
  partialImagesSupport: cap(false, "estimated"),

  typographyQuality:           cap(8, "estimated", "community", "imagen-4"),
  humanRenderingQuality:       cap(9, "estimated", "internal_testing", "imagen-4"),
  productRenderingQuality:     cap(9, "estimated", "internal_testing", "imagen-4"),
  medicalRenderingQuality:     cap(8, "estimated"),
  architectureRenderingQuality:cap(9, "estimated"),
  foodRenderingQuality:        cap(9, "estimated"),
  luxuryAdvertisementQuality:  cap(9, "estimated", "community", "imagen-4"),

  estimatedSpeed:    cap("medium", "estimated"),
  estimatedCostTier: cap("high", "estimated", "official_docs"),

  recommendedUseCases: cap(["High-resolution advertising", "Brand imagery", "Editorial photography", "Multi-format campaigns"]),
  knownStrengths: cap(["Excellent photorealism", "Multiple aspect ratios", "High resolution output", "Strong scene understanding"]),
  knownWeaknesses: cap(["No separate negative prompt", "Text rendering below OpenAI", "Limited streaming support"]),
  unsupportedFeatures: cap(["Negative prompt", "Partial images streaming", "Transparent background", "Multiple reference images"]),
};
