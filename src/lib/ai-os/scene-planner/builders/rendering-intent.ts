import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { RenderingIntent } from "../types";
import { sp } from "./shared";
import { getAIArtifactPrevention } from "../knowledge";

// Builder 10 — Rendering Intent
// How should this scene be rendered? What quality standard must it meet?
// What AI artifacts must be actively prevented?

export function buildRenderingIntent(bp: UniversalCampaignBlueprint): RenderingIntent {
  const strategy = bp.strategy;
  const luxury = strategy.visual.luxuryLevel.value;
  const readinessScore = bp.quality.readinessScore;
  const heroSubjectDesc = strategy.creative.heroSubject.value;
  // Text is always planned in advertising layouts — it's added in post-production
  const hasTextInLayout = true;
  const hasLogoInLayout = bp.layout.blocks.logoBlock.value !== "unknown";

  const photorealismLevel = (() => {
    if (luxury === "ultra_luxury") return sp("hyperrealistic", "high",
      `Ultra-luxury → hyperrealistic rendering is non-negotiable — any visible artificiality destroys the premium positioning`);
    if (luxury === "high") return sp("photorealistic", "high",
      `High luxury → photorealistic quality at a commercial campaign standard`);
    if (strategy.visual.photographyStyle.value === "documentary") {
      return sp("photo_quality", "medium", `Documentary style → photo-quality rendering that reads as genuine photography`);
    }
    if (strategy.visual.illustrationPreference.value === "infographic_elements") {
      return sp("stylized_realism", "medium", `Infographic elements present → stylized realism blend serves informational content better`);
    }
    return sp("photorealistic", "medium", `Default: photorealistic rendering for commercial advertising standard`);
  })();

  const luxuryLevel = (() => {
    const luxMap: Record<string, RenderingIntent["luxuryLevel"]["value"]> = {
      none:        "utility_functional",
      low:         "professional_quality",
      medium:      "premium_polished",
      high:        "luxury_refined",
      ultra_luxury:"ultra_prestige_perfect",
    };
    const val = luxMap[luxury ?? ""] ?? "premium_polished";
    return sp(val, luxury !== "unknown" ? "high" : "medium",
      `Luxury level "${val}" required for visual luxury positioning "${luxury}"`);
  })();

  const commercialQuality = (() => {
    const campaignGoal = strategy.marketing.campaignGoal.value;
    if (readinessScore >= 80 && (luxury === "high" || luxury === "ultra_luxury")) {
      return sp("global_campaign", "high", `High readiness + luxury level → global campaign standard required`);
    }
    if (readinessScore >= 70) return sp("national_commercial", "medium", `Good readiness score → national commercial standard`);
    return sp("regional_commercial", "low", `Standard commercial quality — suitable for regional/digital campaigns`);
    void campaignGoal;
  })();

  const editorialQuality = (() => {
    if (luxury === "ultra_luxury" || luxury === "high") return sp("luxury_editorial", "high",
      `Luxury context → luxury editorial quality standard (Vogue, Wallpaper, AD quality)`);
    if (strategy.visual.photographyStyle.value === "editorial") {
      return sp("consumer_magazine", "high", `Editorial photography style → consumer magazine quality standard`);
    }
    return sp("trade_editorial", "medium", `Default: trade editorial quality — professional and credible`);
  })();

  const realismTarget = (() => {
    const photoStyle = strategy.visual.photographyStyle.value;
    if (photoStyle === "studio_product" || photoStyle === "macro_detail") {
      return sp("product_studio_shoot", "high", `Studio/macro photography → product studio shoot realism target`);
    }
    if (photoStyle === "editorial") return sp("commercial_campaign_shoot", "high", `Editorial photography → commercial campaign shoot realism target`);
    if (["real_estate", "luxury_property", "architectural_exterior"].includes(strategy.business.subIndustry.value ?? "")) {
      return sp("architectural_photography", "high", `Real estate → architectural photography realism target`);
    }
    if (luxury === "high" || luxury === "ultra_luxury") return sp("commercial_campaign_shoot", "high",
      `High luxury → commercial campaign shoot quality (not stock photo — something created, not selected)`);
    return sp("premium_stock_photo", "medium", `Default: premium stock photo quality — highly produced but accessible`);
  })();

  const aiArtifactPreventionStrategy = (() => {
    const heroDesc = heroSubjectDesc !== "unknown" ? heroSubjectDesc.toLowerCase() : "";
    const prevention = getAIArtifactPrevention(heroDesc, hasTextInLayout, hasLogoInLayout);
    return sp(prevention, "high",
      `AI artifact prevention based on hero subject type ("${heroDesc.slice(0, 40)}..."), text presence=${hasTextInLayout}, logo presence=${hasLogoInLayout}`);
  })();

  return { photorealismLevel, luxuryLevel, commercialQuality, editorialQuality, realismTarget, aiArtifactPreventionStrategy };
}
