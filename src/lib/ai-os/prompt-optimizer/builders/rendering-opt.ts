import type { PromptSpecification } from "../../prompt-spec/types";
import type { OptimizedRendering } from "../types";
import { clamp100 } from "./shared";

// Builder 10 — Rendering Optimization
// Converts qualitative rendering levels into weighted priority scores and
// produces a combined rendering directive that is provider-agnostic.

export function buildOptimizedRendering(spec: PromptSpecification): OptimizedRendering {
  const r = spec.rendering;

  // Photorealism priority weights
  const photorealismWeightMap: Record<string, number> = {
    hyperrealistic: 100, photorealistic: 90, photo_quality: 80,
    stylized_realism: 60, editorial_realism: 75,
  };
  const commercialWeightMap: Record<string, number> = {
    award_winning_creative: 100, global_campaign: 90,
    national_commercial: 75, regional_commercial: 60,
  };
  const editorialWeightMap: Record<string, number> = {
    art_direction: 100, luxury_editorial: 90, consumer_magazine: 75, trade_editorial: 60,
  };
  const realismWeightMap: Record<string, number> = {
    commercial_campaign_shoot: 100, editorial_magazine_shoot: 90,
    architectural_photography: 85, product_studio_shoot: 80, premium_stock_photo: 70,
  };
  const luxuryWeightMap: Record<string, number> = {
    ultra_prestige_perfect: 100, luxury_refined: 90, premium_polished: 75,
    professional_quality: 60, utility_functional: 40,
  };

  const photorealismPriority  = clamp100(photorealismWeightMap[r.photorealismLevel.value  ?? ""] ?? 80);
  const commercialQualityPriority = clamp100(commercialWeightMap[r.commercialQuality.value ?? ""] ?? 70);
  const editorialQualityPriority  = clamp100(editorialWeightMap[r.editorialQuality.value   ?? ""] ?? 70);
  const realismPriority       = clamp100(realismWeightMap[r.realismTarget.value          ?? ""] ?? 75);
  const luxuryPriority        = clamp100(luxuryWeightMap[r.luxuryLevel.value             ?? ""] ?? 70);

  // Combined directive: the highest standard sets the bar
  const dominantQuality = Math.max(photorealismPriority, commercialQualityPriority, luxuryPriority);
  const qualityTier = dominantQuality >= 90 ? "world-class commercial" : dominantQuality >= 75 ? "premium professional" : "commercial standard";
  const combinedDirective = [
    `${qualityTier} image quality`,
    r.realismTarget.value !== "unknown" ? r.realismTarget.value.replace(/_/g, " ") : null,
    r.photorealismLevel.value !== "unknown" ? r.photorealismLevel.value.replace(/_/g, " ") : null,
  ].filter(Boolean).join(", ");

  const reasoning = `Dominant rendering priority: ${dominantQuality}/100. ` +
    `Photorealism=${photorealismPriority}, Commercial=${commercialQualityPriority}, ` +
    `Luxury=${luxuryPriority}. Combined: "${combinedDirective}"`;

  return {
    photorealismPriority,
    commercialQualityPriority,
    editorialQualityPriority,
    realismPriority,
    luxuryPriority,
    combinedDirective,
    reasoning,
  };
}
