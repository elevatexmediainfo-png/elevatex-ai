import type { ImageCriticInput, BrandingEvaluation, EvaluationField, EvaluationScore } from "../types";
import { ef } from "../types";

// Domain 5 — Brand Evaluation.
// Evaluates whether the image meets brand safety and professional quality standards.
// Source: spec_inference + rule_based

const SENSITIVE_INDUSTRIES = ["medical", "dental", "legal", "finance", "healthcare", "pharmacy"];
const LUXURY_INDUSTRIES    = ["luxury", "jewellery", "jewelry", "fashion", "premium", "high_end"];

function buildBrandSafety(input: ImageCriticInput): EvaluationField<"safe" | "minor_concern" | "unsafe" | "unknown"> {
  const understanding = input.blueprint?.userIntelligence?.understanding;
  const industry = (understanding as { industry?: { value?: string } } | undefined)?.industry?.value?.toLowerCase() ?? "";

  const brandSafetyValue = input.promptSpec?.brandRules?.brandSafety?.value?.toLowerCase() ?? "";
  const forbiddenElements = input.promptSpec?.brandRules?.forbiddenElements?.value?.toLowerCase() ?? "";
  const forbiddenScene    = input.promptSpec?.negativeConstraints?.forbiddenSceneElements?.value?.toLowerCase() ?? "";

  const hasGuardrails = brandSafetyValue.length > 0 || forbiddenElements.length > 0 || forbiddenScene.length > 0;

  if (SENSITIVE_INDUSTRIES.some(s => industry.includes(s)) && hasGuardrails) {
    return ef("safe", "medium",
      `Sensitive industry "${industry}" with brand safety rules defined — brand safety expected`,
      "spec_inference");
  }
  if (SENSITIVE_INDUSTRIES.some(s => industry.includes(s)) && !hasGuardrails) {
    return ef("minor_concern", "medium",
      `Sensitive industry "${industry}" without explicit brand safety rules in spec`,
      "spec_inference");
  }
  if (hasGuardrails) {
    return ef("safe", "high",
      "Brand safety rules defined in spec — brand-safe output expected",
      "spec_inference");
  }

  return ef("safe", "low",
    "No specific brand safety issues detected in spec — assuming safe",
    "spec_inference");
}

function buildIndustrySafety(input: ImageCriticInput): EvaluationField<"compliant" | "potential_issue" | "non_compliant" | "unknown"> {
  const understanding = input.blueprint?.userIntelligence?.understanding;
  const industry = (understanding as { industry?: { value?: string } } | undefined)?.industry?.value?.toLowerCase() ?? "";

  if (!industry) {
    return ef("unknown", "low", "No industry information available for compliance evaluation", "spec_inference");
  }

  if (SENSITIVE_INDUSTRIES.some(s => industry.includes(s))) {
    const quality = input.generationResult?.quality;
    if (quality?.allFeaturesSupported) {
      return ef("compliant", "medium",
        `Sensitive industry "${industry}" — all features supported, compliant output expected`,
        "generation_metadata");
    }
    return ef("potential_issue", "low",
      `Sensitive industry "${industry}" with unsupported features — compliance requires verification`,
      "generation_metadata");
  }

  return ef("compliant", "medium",
    `Industry "${industry}" has no specific compliance requirements detected`,
    "spec_inference");
}

function buildProfessionalQuality(input: ImageCriticInput): EvaluationField<"professional" | "standard" | "unprofessional" | "unknown"> {
  const quality = input.generationResult?.quality?.estimatedOutputQuality ?? 70;
  const provider = input.generationResult?.provider ?? "";

  if (quality >= 80) {
    return ef("professional", "medium",
      `Provider "${provider}" with quality score ${quality}/100 — professional output expected`,
      "generation_metadata");
  }
  if (quality >= 65) {
    return ef("standard", "medium",
      `Provider quality ${quality}/100 — standard professional quality`,
      "generation_metadata");
  }

  return ef("unprofessional", "medium",
    `Provider quality ${quality}/100 is below professional threshold — output quality may be insufficient`,
    "generation_metadata");
}

function buildLuxuryLevelMatch(input: ImageCriticInput): EvaluationField<"matches_requirement" | "lower_than_required" | "higher_than_required" | "unknown"> {
  const understanding = input.blueprint?.userIntelligence?.understanding;
  const industry = (understanding as { industry?: { value?: string } } | undefined)?.industry?.value?.toLowerCase() ?? "";
  const strategy  = input.blueprint as { visualDirection?: { luxuryLevel?: { value?: string } } } | undefined;
  const luxuryLevel = strategy?.visualDirection?.luxuryLevel?.value?.toLowerCase() ?? "";

  const requiresLuxury = LUXURY_INDUSTRIES.some(l => industry.includes(l)) || luxuryLevel.includes("luxury") || luxuryLevel.includes("premium");
  const quality = input.generationResult?.quality?.estimatedOutputQuality ?? 70;

  if (requiresLuxury && quality >= 80) {
    return ef("matches_requirement", "medium",
      `Luxury requirement with provider quality ${quality}/100 — luxury level likely matched`,
      "generation_metadata");
  }
  if (requiresLuxury && quality < 75) {
    return ef("lower_than_required", "medium",
      `Luxury requirement but provider quality ${quality}/100 is below luxury threshold (75+)`,
      "generation_metadata");
  }
  if (!requiresLuxury && quality >= 85) {
    return ef("higher_than_required", "low",
      `No luxury requirement but provider quality ${quality}/100 is very high — acceptable`,
      "generation_metadata");
  }

  return ef("matches_requirement", "low",
    "Luxury level assumed appropriate for campaign requirements",
    "spec_inference");
}

function buildBrandScore(
  brandSafety:        EvaluationField<string>,
  industrySafety:     EvaluationField<string>,
  professionalQuality:EvaluationField<string>,
  luxuryLevelMatch:   EvaluationField<string>
): EvaluationScore {
  const safetyScore = brandSafety.value === "safe" ? 90
    : brandSafety.value === "minor_concern" ? 70 : 20;

  const industryScore = industrySafety.value === "compliant" ? 90
    : industrySafety.value === "potential_issue" ? 65
    : industrySafety.value === "non_compliant" ? 20 : 72;

  const profScore = professionalQuality.value === "professional" ? 90
    : professionalQuality.value === "standard" ? 72
    : professionalQuality.value === "unprofessional" ? 40 : 65;

  const luxuryScore = luxuryLevelMatch.value === "matches_requirement" ? 90
    : luxuryLevelMatch.value === "lower_than_required" ? 55
    : 85; // higher_than_required is fine

  const score = Math.round(
    (safetyScore * 0.35) + (industryScore * 0.25) + (profScore * 0.25) + (luxuryScore * 0.15)
  );

  return ef(
    score,
    "medium",
    `Brand score ${score}/100 — safety ${safetyScore}, industry ${industryScore}, professional ${profScore}, luxury ${luxuryScore}`,
    "rule_based"
  );
}

export function buildBrandingEvaluation(input: ImageCriticInput): BrandingEvaluation {
  const brandSafety         = buildBrandSafety(input);
  const industrySafety      = buildIndustrySafety(input);
  const professionalQuality = buildProfessionalQuality(input);
  const luxuryLevelMatch    = buildLuxuryLevelMatch(input);
  const brandScore          = buildBrandScore(brandSafety, industrySafety, professionalQuality, luxuryLevelMatch);

  return { brandSafety, industrySafety, professionalQuality, luxuryLevelMatch, brandScore };
}
