import type {
  ImageCriticInput, Recommendation, RecommendationPriority, RecommendationCategory,
  HeroEvaluation, CompositionEvaluation, LightingEvaluation,
  MarketingEvaluation, BrandingEvaluation, RealismEvaluation,
  ArtifactEvaluation, TypographySafeAreaEvaluation, QualityScores,
} from "../types";

// Domain 10 — Improvement Recommendations.
// Structured recommendations for improving image quality.
// STRICT RULE: Never generates a new prompt. Only identifies issues and suggests improvements.

function makePriority(score: number, threshold: number): RecommendationPriority {
  const gap = threshold - score;
  if (gap >= 20) return "critical";
  if (gap >= 10) return "high";
  if (gap >= 5)  return "medium";
  return "low";
}

function buildHeroRecommendations(
  hero:     HeroEvaluation,
  input:    ImageCriticInput,
  quality:  QualityScores
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (hero.heroVisibility.value === "likely_absent" || hero.heroVisibility.value === "unclear") {
    recs.push({
      priority:        makePriority(quality.heroScore, quality.qualityThreshold),
      category:        "hero_subject" as RecommendationCategory,
      issue:           `Hero subject visibility is "${hero.heroVisibility.value}" — the hero may not be prominently rendered`,
      improvement:     "Increase hero specificity in the PromptSpecification and consider using a provider with higher visual fidelity",
      estimatedImpact: 15,
    });
  }

  if (hero.heroDominance.value === "weak") {
    recs.push({
      priority:        "medium",
      category:        "hero_subject" as RecommendationCategory,
      issue:           "Hero subject dominance is weak — the hero may not stand out sufficiently",
      improvement:     "Review heroScale in HeroSpecification — consider upgrading to 'two_thirds_dominant' or 'full_frame_dominant'",
      estimatedImpact: 10,
    });
  }

  if (hero.heroAccuracy.value === "likely_inaccurate" || hero.heroAccuracy.value === "uncertain") {
    const heroSubject = input.promptSpec?.hero?.heroSubject?.value ?? "hero subject";
    recs.push({
      priority:        "high",
      category:        "hero_subject" as RecommendationCategory,
      issue:           `Hero accuracy is "${hero.heroAccuracy.value}" for "${heroSubject}"`,
      improvement:     "Verify that the hero description in HeroSpecification is specific and unambiguous; consider adding more distinctive visual details",
      estimatedImpact: 12,
    });
  }

  return recs;
}

function buildCompositionRecommendations(
  composition: CompositionEvaluation,
  quality:     QualityScores
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (composition.visualHierarchy.value === "unclear_hierarchy") {
    recs.push({
      priority:        makePriority(quality.compositionScore, quality.qualityThreshold),
      category:        "composition" as RecommendationCategory,
      issue:           "Visual hierarchy is unclear — the image may lack a clear primary focus",
      improvement:     "Ensure the hero element has 'primary_anchor' or 'absolute_mandatory' importance in HeroSpecification",
      estimatedImpact: 10,
    });
  }

  if (composition.negativeSpace.value === "insufficient") {
    recs.push({
      priority:        "low",
      category:        "composition" as RecommendationCategory,
      issue:           "Negative space may be insufficient — the image may feel cluttered",
      improvement:     "Consider reducing visual density in the Blueprint layout settings or reducing supporting elements",
      estimatedImpact: 7,
    });
  }

  if (composition.depth.value === "flat") {
    recs.push({
      priority:        "low",
      category:        "composition" as RecommendationCategory,
      issue:           "Image appears flat with limited depth",
      improvement:     "Add foreground and background elements to the PromptSpecification to create dimensional depth",
      estimatedImpact: 6,
    });
  }

  return recs;
}

function buildLightingRecommendations(
  lighting: LightingEvaluation,
  quality:  QualityScores
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (lighting.premiumFeel.value === "poor") {
    recs.push({
      priority:        makePriority(quality.lightingScore, quality.qualityThreshold),
      category:        "lighting" as RecommendationCategory,
      issue:           "Lighting does not convey a premium feel",
      improvement:     "Upgrade to a higher-quality provider (OpenAI or Gemini) or specify premium lighting in LightingSpecification",
      estimatedImpact: 12,
    });
  }

  if (lighting.shadowRealism.value === "unrealistic") {
    recs.push({
      priority:        "medium",
      category:        "lighting" as RecommendationCategory,
      issue:           "Shadow rendering appears unrealistic",
      improvement:     "Specify consistent lighting direction in the scene plan and use a provider with strong realism capabilities",
      estimatedImpact: 8,
    });
  }

  return recs;
}

function buildMarketingRecommendations(
  marketing: MarketingEvaluation,
  quality:   QualityScores
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (marketing.campaignGoalSupport.value === "weak" || marketing.campaignGoalSupport.value === "missing") {
    recs.push({
      priority:        makePriority(quality.marketingScore, quality.qualityThreshold),
      category:        "marketing" as RecommendationCategory,
      issue:           `Campaign goal support is "${marketing.campaignGoalSupport.value}" — the image may not effectively support the intended marketing objective`,
      improvement:     "Review PromptSpecification GenerationMission — ensure whyItMatters is translated into strong visual cues",
      estimatedImpact: 18,
    });
  }

  if (marketing.audienceResonance.value === "low") {
    recs.push({
      priority:        "high",
      category:        "marketing" as RecommendationCategory,
      issue:           "Target audience resonance is low — the image may not connect with the intended audience",
      improvement:     "Verify that the visual style and hero subject align with the audience profile in the Blueprint user intelligence",
      estimatedImpact: 14,
    });
  }

  if (marketing.conversionSupport.value === "missing") {
    recs.push({
      priority:        "medium",
      category:        "marketing" as RecommendationCategory,
      issue:           "No conversion-driving elements detected",
      improvement:     "Ensure the composition includes clear visual focus areas that draw attention to conversion elements",
      estimatedImpact: 10,
    });
  }

  return recs;
}

function buildBrandingRecommendations(
  branding: BrandingEvaluation,
  quality:  QualityScores
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (branding.brandSafety.value === "minor_concern" || branding.brandSafety.value === "unsafe") {
    recs.push({
      priority:        branding.brandSafety.value === "unsafe" ? "critical" : "high",
      category:        "branding" as RecommendationCategory,
      issue:           `Brand safety concern: "${branding.brandSafety.value}"`,
      improvement:     "Add explicit content safety guardrails to the PromptSpecification negative prompt section",
      estimatedImpact: 20,
    });
  }

  if (branding.luxuryLevelMatch.value === "lower_than_required") {
    recs.push({
      priority:        makePriority(quality.brandScore, quality.qualityThreshold),
      category:        "branding" as RecommendationCategory,
      issue:           "Luxury level is below campaign requirements",
      improvement:     "Upgrade to a premium provider (OpenAI gpt-image-1 or Ideogram) and ensure luxury-level keywords are present in the scene specification",
      estimatedImpact: 15,
    });
  }

  return recs;
}

function buildArtifactRecommendations(
  artifacts: ArtifactEvaluation
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (artifacts.aiArtifactsDetected.value === "moderate" || artifacts.aiArtifactsDetected.value === "severe") {
    recs.push({
      priority:        artifacts.aiArtifactsDetected.value === "severe" ? "critical" : "high",
      category:        "artifacts" as RecommendationCategory,
      issue:           `AI artifacts likely at "${artifacts.aiArtifactsDetected.value}" severity`,
      improvement:     "Switch to a lower-artifact-risk provider (OpenAI, Gemini, or Ideogram) and add quality improvement parameters to the generation request",
      estimatedImpact: 16,
    });
  }

  if (artifacts.handRendering.value === "major_issues") {
    recs.push({
      priority:        "high",
      category:        "artifacts" as RecommendationCategory,
      issue:           "Hand rendering is likely to have major issues — hands are a common AI artifact",
      improvement:     "Avoid exposing hands in the hero pose if possible, or use OpenAI/Ideogram for best hand rendering",
      estimatedImpact: 12,
    });
  }

  if (artifacts.textRendering.value === "illegible") {
    recs.push({
      priority:        "high",
      category:        "artifacts" as RecommendationCategory,
      issue:           "In-image text is expected to be illegible for this provider",
      improvement:     "Use Ideogram for text-heavy designs — it specialises in legible text rendering",
      estimatedImpact: 14,
    });
  }

  return recs;
}

function buildTypographyRecommendations(
  typography: TypographySafeAreaEvaluation
): Recommendation[] {
  const recs: Recommendation[] = [];

  const obstructed = [
    { field: typography.headlineAreaPreserved, name: "Headline" },
    { field: typography.ctaAreaPreserved,      name: "CTA" },
    { field: typography.logoAreaPreserved,     name: "Logo" },
    { field: typography.bodyAreaPreserved,     name: "Body" },
  ].filter(f => f.field.value === "partially_obstructed" || f.field.value === "obstructed");

  for (const area of obstructed) {
    recs.push({
      priority:        area.field.value === "obstructed" ? "high" : "medium",
      category:        "typography_safety" as RecommendationCategory,
      issue:           `${area.name} safe area may be "${area.field.value}" by the hero subject or composition elements`,
      improvement:     `Review hero position and scale in HeroSpecification to ensure ${area.name.toLowerCase()} text overlay areas remain clear`,
      estimatedImpact: area.field.value === "obstructed" ? 12 : 7,
    });
  }

  return recs;
}

function sortByPriority(recs: Recommendation[]): Recommendation[] {
  const order: Record<RecommendationPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...recs].sort((a, b) => order[a.priority] - order[b.priority]);
}

export function buildRecommendations(
  hero:        HeroEvaluation,
  composition: CompositionEvaluation,
  lighting:    LightingEvaluation,
  marketing:   MarketingEvaluation,
  branding:    BrandingEvaluation,
  _realism:    RealismEvaluation,    // Realism rarely produces actionable recommendations
  artifacts:   ArtifactEvaluation,
  typography:  TypographySafeAreaEvaluation,
  quality:     QualityScores,
  input:       ImageCriticInput
): Recommendation[] {
  const allRecs: Recommendation[] = [
    ...buildHeroRecommendations(hero, input, quality),
    ...buildCompositionRecommendations(composition, quality),
    ...buildLightingRecommendations(lighting, quality),
    ...buildMarketingRecommendations(marketing, quality),
    ...buildBrandingRecommendations(branding, quality),
    ...buildArtifactRecommendations(artifacts),
    ...buildTypographyRecommendations(typography),
  ];

  return sortByPriority(allRecs);
}
