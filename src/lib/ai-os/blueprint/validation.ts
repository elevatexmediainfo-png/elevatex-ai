import type { CreativeStrategy } from "../creative-brain/types";
import type { CampaignPlan } from "../creative-director/types";
import type { VisualLayoutPlan } from "../visual-layout/types";
import type { TypographyPlan } from "../typography/types";
import type { AssetIntelligence, UserUnderstanding } from "../types";
import type { QualityMetadata, ModuleConfidences } from "./types";

// Phase 9 — Blueprint validation and quality scoring.
// Pure functions — no I/O, no LLM, no side effects.

// ─────────────────────────────────────────────────────────────────────────────
// Warning generation
// ─────────────────────────────────────────────────────────────────────────────

export function generateWarnings(
  uu: UserUnderstanding,
  ai: AssetIntelligence,
  strategy: CreativeStrategy,
  campaign: CampaignPlan,
  layout: VisualLayoutPlan,
  typography: TypographyPlan
): string[] {
  const warnings: string[] = [];

  // User Understanding warnings
  if (uu.industry.value === "unknown") {
    warnings.push("user_understanding.industry is unknown — industry-specific intelligence could not be applied");
  }
  if (uu.intent.value === "unknown") {
    warnings.push("user_understanding.intent is unknown — campaign goal defaulted to awareness");
  }
  if (uu.confidenceScore < 30) {
    warnings.push(`user_understanding.confidenceScore is ${uu.confidenceScore}/100 — the raw idea was too vague for precise understanding`);
  }

  // Asset warnings
  if (!ai.referenceAnalysis && !ai.reference) {
    warnings.push("asset_intelligence.referenceAnalysis is absent — no reference image Creative DNA available");
  }
  if (!ai.brandContext && !ai.brandKit) {
    warnings.push("asset_intelligence.brandContext is absent — creative will use default brand positioning");
  }

  // Strategy warnings
  if (strategy.marketing.campaignGoal.value === "unknown") {
    warnings.push("strategy.marketing.campaignGoal is unknown — conversion strategy could not be determined");
  }
  if (strategy.creative.heroSubject.value === "unknown") {
    warnings.push("strategy.creative.heroSubject is unknown — hero subject will be inferred generically by the Prompt Composer");
  }

  // Campaign warnings
  if (campaign.concept.campaignTheme.value === "unknown") {
    warnings.push("campaign.concept.campaignTheme is unknown — no campaign theme could be determined from available signals");
  }

  // Layout warnings
  if (layout.canvas.aspectRatio.value === "custom") {
    warnings.push("layout.canvas.aspectRatio is 'custom' — verify final pixel dimensions before generation");
  }

  // Typography warnings
  if (typography.fontIntelligence.fontPersonality.value === "unknown") {
    warnings.push("typography.fontPersonality is unknown — typography defaults will be applied");
  }
  if (typography.fontIntelligence.distinctiveTypefaceNeeded.value === "essential" && !ai.brandKit?.primaryFont) {
    warnings.push("typography.distinctiveTypefaceNeeded=essential but no brand font is configured — a system font will be used as fallback");
  }

  // Compliance warnings
  const industry = strategy.business.industry.value;
  if (["finance", "healthcare"].includes(industry ?? "")) {
    if (typography.hierarchy.disclaimer.value === "absent") {
      warnings.push(`compliance: industry="${industry}" typically requires a legal disclaimer — ensure regulatory requirements are met before publishing`);
    }
  }

  return warnings;
}

// ─────────────────────────────────────────────────────────────────────────────
// Readiness score
// ─────────────────────────────────────────────────────────────────────────────

/** Computes a 0–100 operational readiness score.
 *  100 = all critical fields are known and high-confidence.
 *  Below 40 = generation will likely produce generic output. */
export function computeReadinessScore(
  strategy: CreativeStrategy,
  campaign: CampaignPlan,
  layout: VisualLayoutPlan,
  typography: TypographyPlan
): number {
  let score = 100;

  // Critical strategy fields (high impact)
  if (strategy.business.industry.value === "unknown") score -= 15;
  if (strategy.marketing.campaignGoal.value === "unknown") score -= 12;
  if (strategy.creative.heroSubject.value === "unknown") score -= 10;
  if (strategy.visual.photographyStyle.value === "unknown") score -= 8;
  if (strategy.platform.primaryPlatform.value === "unknown") score -= 8;

  // Campaign plan fields (medium impact)
  if (campaign.concept.campaignTheme.value === "unknown") score -= 8;
  if (campaign.concept.emotionalHook.value === "unknown") score -= 6;
  if (campaign.visualDirection.heroSubject.value === "unknown") score -= 8;

  // Layout fields (medium impact)
  if (layout.blocks.heroBlock.value === "unknown") score -= 5;
  if (layout.hierarchy.eyeFlow.value === "unknown") score -= 5;

  // Typography fields (low impact)
  if (typography.fontIntelligence.fontPersonality.value === "unknown") score -= 4;
  if (typography.alignment.primaryAlignment.value === "unknown") score -= 3;

  // Apply a penalty for very low module confidence
  const avgModuleScore = (strategy.confidenceScore + campaign.confidenceScore + layout.confidenceScore + typography.confidenceScore) / 4;
  if (avgModuleScore < 50) score -= 8;
  if (avgModuleScore < 30) score -= 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation status
// ─────────────────────────────────────────────────────────────────────────────

export function determineValidationStatus(
  readinessScore: number,
  warnings: string[]
): QualityMetadata["validationStatus"] {
  if (readinessScore < 40) return "incomplete";
  if (warnings.length > 0) return "valid_with_warnings";
  return "valid";
}

// ─────────────────────────────────────────────────────────────────────────────
// Overall confidence + module confidences
// ─────────────────────────────────────────────────────────────────────────────

export function buildModuleConfidences(
  uu: UserUnderstanding,
  strategy: CreativeStrategy,
  campaign: CampaignPlan,
  layout: VisualLayoutPlan,
  typography: TypographyPlan,
  hasAssetIntelligence: boolean
): ModuleConfidences {
  return {
    userIntelligence: uu.confidenceScore,
    assetIntelligence: hasAssetIntelligence ? 80 : 20,
    strategy: strategy.confidenceScore,
    campaign: campaign.confidenceScore,
    layout: layout.confidenceScore,
    typography: typography.confidenceScore,
  };
}

export function computeOverallConfidence(modules: ModuleConfidences): number {
  // Weighted average: strategy + campaign are most important for output quality
  const weights = {
    userIntelligence: 1,
    assetIntelligence: 0.5,
    strategy: 2,
    campaign: 2,
    layout: 1.5,
    typography: 1,
  };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const weightedSum = (Object.keys(weights) as Array<keyof typeof weights>)
    .reduce((sum, key) => sum + modules[key] * weights[key], 0);
  return Math.round(weightedSum / totalWeight);
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate unknown fields
// ─────────────────────────────────────────────────────────────────────────────

export function aggregateUnknownFields(
  uu: UserUnderstanding,
  strategy: CreativeStrategy,
  campaign: CampaignPlan,
  layout: VisualLayoutPlan,
  typography: TypographyPlan
): string[] {
  return [
    ...uu.unknownFields.map(f => `userIntelligence.${f}`),
    ...strategy.unknownFields.map(f => `strategy.${f}`),
    ...campaign.unknownFields.map(f => `campaign.${f}`),
    ...layout.unknownFields.map(f => `layout.${f}`),
    ...typography.unknownFields.map(f => `typography.${f}`),
  ];
}

/** Assembles the complete QualityMetadata section. */
export function buildQualityMetadata(
  uu: UserUnderstanding,
  ai: AssetIntelligence,
  strategy: CreativeStrategy,
  campaign: CampaignPlan,
  layout: VisualLayoutPlan,
  typography: TypographyPlan
): QualityMetadata {
  const warnings = generateWarnings(uu, ai, strategy, campaign, layout, typography);
  const readinessScore = computeReadinessScore(strategy, campaign, layout, typography);
  const validationStatus = determineValidationStatus(readinessScore, warnings);
  const moduleConfidences = buildModuleConfidences(
    uu, strategy, campaign, layout, typography,
    !!(ai.referenceAnalysis || ai.reference || ai.brandKit)
  );
  const overallConfidence = computeOverallConfidence(moduleConfidences);
  const unknownFields = aggregateUnknownFields(uu, strategy, campaign, layout, typography);

  return { overallConfidence, moduleConfidences, unknownFields, warnings, validationStatus, readinessScore };
}
