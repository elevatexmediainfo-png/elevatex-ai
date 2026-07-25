import type {
  ImageCriticInput, QualityScores,
  HeroEvaluation, CompositionEvaluation, LightingEvaluation,
  MarketingEvaluation, BrandingEvaluation, RealismEvaluation,
  ArtifactEvaluation, TypographySafeAreaEvaluation,
} from "../types";
import {
  QUALITY_WEIGHTS,
  DEFAULT_QUALITY_THRESHOLD,
  CAMPAIGN_QUALITY_THRESHOLDS,
  FULL_PROMPT_BONUS,
  TRUNCATED_PROMPT_PENALTY,
  ALL_FEATURES_SUPPORTED_BONUS,
  MISSING_FEATURES_PENALTY,
} from "../knowledge";

// Domain 9 — Overall Quality Score.
// Combines all 8 domain scores into a single weighted overall score.
// Source: rule_based

function getQualityThreshold(input: ImageCriticInput): number {
  const understanding = input.blueprint?.userIntelligence?.understanding;
  const industry = (understanding as { industry?: { value?: string } } | undefined)?.industry?.value?.toLowerCase() ?? "";

  for (const [key, threshold] of Object.entries(CAMPAIGN_QUALITY_THRESHOLDS)) {
    if (industry.includes(key)) return threshold;
  }
  return DEFAULT_QUALITY_THRESHOLD;
}

function applyGenerationQualityAdjustment(baseScore: number, input: ImageCriticInput): number {
  const quality = input.generationResult?.quality;
  if (!quality) return baseScore;

  let adjusted = baseScore;
  if (quality.fullPromptUsed)        adjusted += FULL_PROMPT_BONUS;
  else                               adjusted += TRUNCATED_PROMPT_PENALTY;
  if (quality.allFeaturesSupported)  adjusted += ALL_FEATURES_SUPPORTED_BONUS;
  else                               adjusted += MISSING_FEATURES_PENALTY;

  return Math.min(100, Math.max(0, adjusted));
}

export function buildQualityScores(
  hero:             HeroEvaluation,
  composition:      CompositionEvaluation,
  lighting:         LightingEvaluation,
  marketing:        MarketingEvaluation,
  branding:         BrandingEvaluation,
  realism:          RealismEvaluation,
  artifacts:        ArtifactEvaluation,
  typographySafety: TypographySafeAreaEvaluation,
  input:            ImageCriticInput
): QualityScores {
  const heroScore            = hero.heroScore.value;
  const compositionScore     = composition.compositionScore.value;
  const lightingScore        = lighting.lightingScore.value;
  const marketingScore       = marketing.marketingScore.value;
  const brandScore           = branding.brandScore.value;
  const realismScore         = realism.realismScore.value;
  const artifactScore        = artifacts.overallArtifactScore.value;
  const typographySafetyScore= typographySafety.typographySafetyScore.value;

  const rawOverall = Math.round(
    (heroScore            * QUALITY_WEIGHTS.hero)            +
    (compositionScore     * QUALITY_WEIGHTS.composition)     +
    (lightingScore        * QUALITY_WEIGHTS.lighting)        +
    (marketingScore       * QUALITY_WEIGHTS.marketing)       +
    (brandScore           * QUALITY_WEIGHTS.brand)           +
    (realismScore         * QUALITY_WEIGHTS.realism)         +
    (artifactScore        * QUALITY_WEIGHTS.artifacts)       +
    (typographySafetyScore* QUALITY_WEIGHTS.typographySafety)
  );

  const overallScore = applyGenerationQualityAdjustment(rawOverall, input);
  const qualityThreshold = getQualityThreshold(input);

  return {
    heroScore,
    compositionScore,
    lightingScore,
    marketingScore,
    brandScore,
    realismScore,
    artifactScore,
    typographySafetyScore,
    overallScore,
    passesQualityThreshold: overallScore >= qualityThreshold,
    qualityThreshold,
  };
}
