import type { ImageCriticInput, LightingEvaluation, EvaluationField, EvaluationScore } from "../types";
import { ef } from "../types";
import { LIGHTING_TYPE_SCORES } from "../knowledge";

// Domain 3 — Lighting Evaluation.
// Evaluates whether the lighting was rendered as specified.
// Source: spec_inference + rule_based

function buildLightingConsistency(input: ImageCriticInput): EvaluationField<"consistent" | "inconsistent" | "unknown"> {
  const lighting = input.promptSpec?.lighting;
  if (!lighting) {
    return ef("unknown", "low", "No lighting specification in PromptSpec", "spec_inference");
  }

  const type = lighting.primaryLighting?.value ?? "";
  const quality = input.generationResult?.quality;

  if (quality?.allFeaturesSupported && type) {
    return ef("consistent", "medium",
      `Primary lighting "${type}" specified and all features were supported — consistent lighting expected`,
      "generation_metadata");
  }
  if (!quality?.allFeaturesSupported && type) {
    return ef("unknown", "low",
      `Lighting "${type}" specified but not all features were supported — consistency uncertain`,
      "generation_metadata");
  }

  return ef("consistent", "low", "Lighting consistency assumed — no contradicting metadata", "spec_inference");
}

function buildShadowRealism(input: ImageCriticInput): EvaluationField<"realistic" | "unrealistic" | "absent" | "unknown"> {
  const lighting = input.promptSpec?.lighting;
  const scene    = input.scenePlan?.lighting;

  const shadowStyle = lighting?.shadowStyle?.value
    ?? scene?.shadowStyle?.value
    ?? "";

  if (shadowStyle.includes("no_shadow") || shadowStyle.includes("minimal") || shadowStyle.includes("shadowless")) {
    return ef("absent", "medium",
      `Shadow style "${shadowStyle}" — shadows are intentionally absent`,
      "spec_inference");
  }
  if (shadowStyle.includes("soft") || shadowStyle.includes("diffused") || shadowStyle.includes("directional")) {
    return ef("realistic", "medium",
      `Shadow style "${shadowStyle}" — realistic shadows expected`,
      "spec_inference");
  }
  if (shadowStyle.includes("hard") || shadowStyle.includes("dramatic")) {
    return ef("realistic", "medium",
      `Shadow style "${shadowStyle}" — dramatic realistic shadows expected`,
      "spec_inference");
  }

  return ef("unknown", "low", "Shadow realism requires vision analysis to confirm", "spec_inference");
}

function buildReflectionQuality(input: ImageCriticInput): EvaluationField<"correct" | "incorrect" | "absent" | "unknown"> {
  const spec = input.promptSpec;
  const heroSubject = spec?.hero?.heroSubject?.value ?? "";
  const reflectionStyle = spec?.lighting?.reflectionStyle?.value ?? "";

  if (reflectionStyle.includes("minimal") || reflectionStyle === "minimal_matte_finish") {
    return ef("absent", "medium",
      `Reflection style "${reflectionStyle}" — reflections intentionally minimal`,
      "spec_inference");
  }

  const likelyHasReflections =
    heroSubject.toLowerCase().includes("glass") ||
    heroSubject.toLowerCase().includes("metal") ||
    heroSubject.toLowerCase().includes("chrome") ||
    heroSubject.toLowerCase().includes("product") ||
    reflectionStyle.includes("specular") ||
    reflectionStyle.includes("catchlight") ||
    reflectionStyle.includes("surface");

  if (!likelyHasReflections) {
    return ef("absent", "low",
      "No obvious reflective surfaces in spec — reflections likely absent or minimal",
      "spec_inference");
  }

  return ef("unknown", "low",
    "Reflective surfaces in spec — reflection quality requires vision analysis to verify",
    "spec_inference");
}

function buildPremiumFeel(input: ImageCriticInput): EvaluationField<"premium" | "standard" | "poor" | "unknown"> {
  const rendering   = input.promptSpec?.rendering;
  const luxuryLevel = rendering?.luxuryLevel?.value ?? "";

  const providerQuality = input.generationResult?.quality?.estimatedOutputQuality ?? 70;

  if (luxuryLevel.includes("ultra_prestige") || luxuryLevel.includes("luxury_refined")) {
    if (providerQuality >= 80) {
      return ef("premium", "medium",
        `Luxury level "${luxuryLevel}" with provider quality ${providerQuality}/100 — premium feel expected`,
        "generation_metadata");
    }
    return ef("standard", "low",
      `Luxury level "${luxuryLevel}" but provider quality ${providerQuality}/100 is below premium threshold`,
      "generation_metadata");
  }

  if (luxuryLevel.includes("premium_polished") || luxuryLevel.includes("professional_quality")) {
    if (providerQuality >= 75) {
      return ef("standard", "medium",
        `Luxury level "${luxuryLevel}" with provider quality ${providerQuality}/100 — professional quality expected`,
        "generation_metadata");
    }
  }

  if (providerQuality >= 75) {
    return ef("standard", "medium",
      `Provider quality ${providerQuality}/100 — standard professional quality`,
      "generation_metadata");
  }

  return ef("unknown", "low", "Premium feel cannot be determined without vision analysis", "spec_inference");
}

function buildLightingScore(
  consistency:    EvaluationField<string>,
  shadowRealism:  EvaluationField<string>,
  premiumFeel:    EvaluationField<string>,
  input:          ImageCriticInput
): EvaluationScore {
  const lighting  = input.promptSpec?.lighting;
  const moodType  = lighting?.moodLighting?.value ?? "default";
  const baseScore = LIGHTING_TYPE_SCORES[moodType] ?? LIGHTING_TYPE_SCORES["default"];

  const premiumAdj = premiumFeel.value === "premium" ? 8
    : premiumFeel.value === "poor" ? -12 : 0;

  const shadowAdj = shadowRealism.value === "unrealistic" ? -8 : 0;

  const score = Math.min(100, Math.max(0, Math.round(baseScore + premiumAdj + shadowAdj)));

  return ef(
    score,
    "low",
    `Lighting score ${score}/100 — mood "${moodType}" (base ${baseScore}), premium ${premiumAdj}, shadow ${shadowAdj}`,
    "rule_based"
  );
}

export function buildLightingEvaluation(input: ImageCriticInput): LightingEvaluation {
  const lightingConsistency = buildLightingConsistency(input);
  const shadowRealism       = buildShadowRealism(input);
  const reflectionQuality   = buildReflectionQuality(input);
  const premiumFeel         = buildPremiumFeel(input);
  const lightingScore       = buildLightingScore(lightingConsistency, shadowRealism, premiumFeel, input);

  return { lightingConsistency, shadowRealism, reflectionQuality, premiumFeel, lightingScore };
}
