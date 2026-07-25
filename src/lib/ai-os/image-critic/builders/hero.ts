import type { ImageCriticInput, HeroEvaluation, EvaluationField, EvaluationScore } from "../types";
import { ef } from "../types";
import { HERO_IMPORTANCE_VISIBILITY } from "../knowledge";

// Domain 1 — Hero Subject Evaluation.
// Evaluates whether the hero subject was generated as specified.
// Source: spec_inference (we know what was asked; can't verify without vision)

function buildHeroVisibility(input: ImageCriticInput): EvaluationField<"clearly_visible" | "likely_visible" | "unclear" | "likely_absent"> {
  const heroSpec = input.promptSpec?.hero;
  if (!heroSpec) {
    return ef("unclear", "low", "No hero specification found in PromptSpec", "spec_inference");
  }

  const importance = heroSpec.heroImportance?.value ?? "strong_supporting";
  const visibility = HERO_IMPORTANCE_VISIBILITY[importance] ?? "unclear";
  const generatedOk = input.generationResult?.status === "success";

  if (!generatedOk) {
    return ef("likely_absent", "medium",
      `Generation did not complete successfully (status: ${input.generationResult?.status}) — hero may not be present`,
      "generation_metadata");
  }

  return ef(
    visibility,
    visibility === "clearly_visible" ? "medium" : "low",
    `Hero importance is "${importance}" → expected visibility "${visibility}". Spec-inference only — vision analysis required for confirmation.`,
    "spec_inference"
  );
}

function buildHeroDominance(input: ImageCriticInput): EvaluationField<"dominant" | "appropriate" | "weak" | "unknown"> {
  const heroSpec   = input.promptSpec?.hero;
  const scenePlan  = input.scenePlan?.heroSubject;

  if (!heroSpec && !scenePlan) {
    return ef("unknown", "low", "No hero specification or scene plan available", "spec_inference");
  }

  const scale = heroSpec?.heroScale?.value ?? scenePlan?.heroScale?.value ?? "";
  const importance = (heroSpec?.heroImportance?.value ?? scenePlan?.heroImportance?.value ?? "") as string;

  if (scale.includes("full_frame") || importance === "absolute_mandatory" || importance === "the_entire_message") {
    return ef("dominant", "medium",
      `Hero scale "${scale}" with importance "${importance}" — hero is designed to dominate the frame`,
      "spec_inference");
  }
  if (scale.includes("two_thirds") || scale.includes("half_frame") || importance === "primary_anchor") {
    return ef("appropriate", "medium",
      `Hero scale "${scale}" — appropriate dominance for its role in the composition`,
      "spec_inference");
  }
  if (scale.includes("one_third") || scale.includes("small") || importance === "contextual_element") {
    return ef("weak", "low",
      `Hero scale "${scale}" — hero is intentionally small; may not dominate the frame`,
      "spec_inference");
  }

  return ef("appropriate", "low", "Hero scale not specifically determined; assuming appropriate", "spec_inference");
}

function buildHeroAccuracy(input: ImageCriticInput): EvaluationField<"accurate" | "likely_accurate" | "uncertain" | "likely_inaccurate"> {
  const heroSpec = input.promptSpec?.hero;
  if (!heroSpec?.heroSubject?.value) {
    return ef("uncertain", "low", "No hero subject description in PromptSpec — accuracy cannot be inferred", "spec_inference");
  }

  const quality = input.generationResult?.quality;
  if (!quality) {
    return ef("likely_accurate", "low",
      `Hero described as "${heroSpec.heroSubject.value}" but no quality metadata available for accuracy assessment`,
      "spec_inference");
  }

  if (quality.fullPromptUsed && quality.allFeaturesSupported) {
    return ef("likely_accurate", "medium",
      `Full prompt used and all features supported — hero subject "${heroSpec.heroSubject.value}" likely rendered accurately`,
      "generation_metadata");
  }

  if (!quality.fullPromptUsed) {
    return ef("uncertain", "medium",
      `Prompt was truncated — hero details for "${heroSpec.heroSubject.value}" may have been lost`,
      "generation_metadata");
  }

  return ef("likely_accurate", "low",
    `Hero subject "${heroSpec.heroSubject.value}" — likely accurate based on successful generation`,
    "spec_inference");
}

function buildHeroScore(
  visibility: EvaluationField<string>,
  dominance:  EvaluationField<string>,
  accuracy:   EvaluationField<string>
): EvaluationScore {
  const vScore = visibility.value === "clearly_visible" ? 90
    : visibility.value === "likely_visible" ? 75
    : visibility.value === "unclear" ? 55
    : 30; // likely_absent

  const dScore = dominance.value === "dominant" ? 90
    : dominance.value === "appropriate" ? 80
    : dominance.value === "weak" ? 55
    : 50; // unknown

  const aScore = accuracy.value === "accurate" ? 95
    : accuracy.value === "likely_accurate" ? 78
    : accuracy.value === "uncertain" ? 60
    : 40; // likely_inaccurate

  const score = Math.round((vScore * 0.40) + (dScore * 0.30) + (aScore * 0.30));
  const avgConfidence = [visibility.confidence, dominance.confidence, accuracy.confidence]
    .filter(c => c !== "unknown").length;

  return ef(
    score,
    avgConfidence >= 2 ? "medium" : "low",
    `Hero score ${score}/100 — visibility ${vScore}, dominance ${dScore}, accuracy ${aScore}`,
    "rule_based"
  );
}

export function buildHeroEvaluation(input: ImageCriticInput): HeroEvaluation {
  const heroVisibility = buildHeroVisibility(input);
  const heroDominance  = buildHeroDominance(input);
  const heroAccuracy   = buildHeroAccuracy(input);
  const heroScore      = buildHeroScore(heroVisibility, heroDominance, heroAccuracy);

  return { heroVisibility, heroDominance, heroAccuracy, heroScore };
}
