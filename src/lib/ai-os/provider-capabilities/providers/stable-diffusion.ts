import type { ProviderCapability } from "../types";
import { cap } from "../types";

// Stable Diffusion XL 1.0 capability definition.

export const sdxlCapability: ProviderCapability = {
  id: "stable_diffusion",
  category: "image",

  providerName:    cap("Stable Diffusion XL"),
  providerVersion: cap("sdxl-1.0"),
  supportedModels: cap(["sdxl-1.0", "sdxl-turbo", "sdxl-lightning"]),

  maximumPromptLength:         cap(300, "confirmed", "official_docs", "sdxl-1.0"),   // ~77 tokens
  maximumNegativePromptLength: cap(150, "confirmed", "official_docs", "sdxl-1.0"),
  negativePromptSupport:       cap(true, "confirmed", "official_docs", "sdxl-1.0"),
  seedSupport:                 cap(true, "confirmed", "official_docs", "sdxl-1.0"),
  stylePresets:                cap([], "confirmed"),

  maximumImages:         cap(4, "confirmed"),
  supportedAspectRatios: cap(["custom_via_width_height", "1024x1024_recommended"], "confirmed", "official_docs"),
  supportedOutputSizes:  cap(["512x512", "768x768", "1024x1024", "custom"], "confirmed", "official_docs"),
  outputFormats:         cap(["png"], "confirmed", "official_docs"),
  compressionSupport:    cap(false, "confirmed"),
  transparentBackground: cap(false, "confirmed"),

  qualityLevels:      cap(["cfg_scale_1_to_20", "steps_1_to_150"], "confirmed"),
  backgroundModes:    cap(["default"], "confirmed"),
  moderationControls: cap(["none"], "confirmed"),

  imageEditingSupport:     cap(true, "confirmed", "official_docs"),  // inpainting
  referenceImageSupport:   cap(true, "confirmed", "official_docs"),  // img2img
  referenceImageFidelity:  cap(["denoising_strength_0_to_1"], "confirmed"),
  multipleReferenceImages: cap(false),
  maximumReferenceImages:  cap(1),
  maskSupport:             cap(true, "confirmed"),
  imageVariationSupport:   cap(true, "confirmed"),

  streamingSupport:     cap(false, "confirmed"),
  partialImagesSupport: cap(false, "confirmed"),

  typographyQuality:           cap(2, "confirmed", "internal_testing", "sdxl-1.0"),  // poor text
  humanRenderingQuality:       cap(7, "estimated", "community"),
  productRenderingQuality:     cap(7, "estimated"),
  medicalRenderingQuality:     cap(5, "estimated"),
  architectureRenderingQuality:cap(7, "estimated"),
  foodRenderingQuality:        cap(7, "estimated"),
  luxuryAdvertisementQuality:  cap(6, "estimated"),

  estimatedSpeed:    cap("fast", "confirmed"),
  estimatedCostTier: cap("low", "confirmed"),

  recommendedUseCases: cap(["High volume generation", "Stylised art", "img2img workflows", "Inpainting and editing"]),
  knownStrengths: cap(["Very fast with SDXL-turbo", "Negative prompt support", "Excellent for stylised content", "img2img/inpainting", "Low cost"]),
  knownWeaknesses: cap(["Poor text rendering", "Very short prompt limit", "Older architecture", "Lower photorealism than newer models"]),
  unsupportedFeatures: cap(["Text rendering in image", "Transparent background", "Streaming", "Multiple reference images"]),
};
