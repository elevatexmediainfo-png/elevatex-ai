import type { ProviderCapability } from "../types";
import { cap } from "../types";

// Ideogram V_2 capability definition. Specialises in text-in-image rendering.

export const ideogramCapability: ProviderCapability = {
  id: "ideogram",
  category: "image",

  providerName:    cap("Ideogram"),
  providerVersion: cap("V_2"),
  supportedModels: cap(["V_2", "V_2_TURBO", "V_1_5", "V_1"]),

  maximumPromptLength:         cap(2000, "confirmed", "official_docs", "V_2"),
  maximumNegativePromptLength: cap(0, "confirmed"),
  negativePromptSupport:       cap(false, "confirmed", "official_docs", "V_2"),
  seedSupport:                 cap(true, "confirmed", "official_docs", "V_2"),
  stylePresets:                cap(["REALISTIC", "DESIGN", "RENDER_3D", "ANIME"], "confirmed", "official_docs", "V_2"),

  maximumImages:         cap(8, "confirmed", "official_docs", "V_2"),
  supportedAspectRatios: cap(["ASPECT_1_1", "ASPECT_16_9", "ASPECT_9_16", "ASPECT_4_3", "ASPECT_3_4", "ASPECT_10_16", "ASPECT_16_10"], "confirmed", "official_docs", "V_2"),
  supportedOutputSizes:  cap(["1024x1024 and above via aspect ratios"], "confirmed", "official_docs", "V_2"),
  outputFormats:         cap(["png", "jpeg"], "confirmed", "official_docs", "V_2"),
  compressionSupport:    cap(false, "estimated"),
  transparentBackground: cap(false, "confirmed"),

  qualityLevels:      cap(["auto", "quality_turbo"], "estimated", "community", "V_2"),
  backgroundModes:    cap(["default"], "confirmed"),
  moderationControls: cap(["off", "on"], "confirmed", "official_docs", "V_2"),

  imageEditingSupport:     cap(false, "confirmed", "official_docs", "V_2"),
  referenceImageSupport:   cap(false, "confirmed"),
  referenceImageFidelity:  cap([]),
  multipleReferenceImages: cap(false),
  maximumReferenceImages:  cap(0),
  maskSupport:             cap(false, "confirmed"),
  imageVariationSupport:   cap(false, "confirmed"),

  streamingSupport:     cap(false, "confirmed"),
  partialImagesSupport: cap(false, "confirmed"),

  typographyQuality:           cap(10, "confirmed", "internal_testing", "V_2"),  // Ideogram's #1 strength
  humanRenderingQuality:       cap(8, "estimated", "community"),
  productRenderingQuality:     cap(7, "estimated"),
  medicalRenderingQuality:     cap(6, "estimated"),
  architectureRenderingQuality:cap(7, "estimated"),
  foodRenderingQuality:        cap(7, "estimated"),
  luxuryAdvertisementQuality:  cap(8, "estimated", "community"),

  estimatedSpeed:    cap("medium", "estimated"),
  estimatedCostTier: cap("medium", "confirmed", "official_docs"),

  recommendedUseCases: cap(["Ads with text overlay", "Posters with headlines", "Marketing materials with copy", "Branding with taglines"]),
  knownStrengths: cap(["Exceptional text rendering", "Legible typography in image", "Multiple style presets", "Good photorealism"]),
  knownWeaknesses: cap(["No reference image support", "No image editing", "No negative prompt", "No transparent background"]),
  unsupportedFeatures: cap(["Negative prompt", "Reference images", "Image editing", "Transparent background", "Streaming"]),
};
