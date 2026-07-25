import type { ImageCriticInput, RealismEvaluation, EvaluationField, EvaluationScore } from "../types";
import { ef } from "../types";
import {
  HUMAN_PRESENCE_KEYWORDS,
  FOOD_PRESENCE_KEYWORDS,
  ARCHITECTURE_PRESENCE_KEYWORDS,
  MEDICAL_PRESENCE_KEYWORDS,
  PROVIDER_QUALITY_BASELINES,
} from "../knowledge";

// Domain 6 — Realism Evaluation.
// Evaluates whether realism-dependent content was rendered convincingly.
// Source: spec_inference + generation_metadata

function containsAny(text: string, keywords: ReadonlyArray<string>): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

function getHeroText(input: ImageCriticInput): string {
  return [
    input.promptSpec?.hero?.heroSubject?.value,
    input.scenePlan?.heroSubject?.exactHeroSubject?.value,
    input.blueprint?.userIntelligence?.rawIdea,
  ].filter(Boolean).join(" ");
}

function buildHumanRealism(input: ImageCriticInput): EvaluationField<"photorealistic" | "almost_realistic" | "obviously_ai" | "not_applicable"> {
  const heroText = getHeroText(input);
  if (!containsAny(heroText, HUMAN_PRESENCE_KEYWORDS)) {
    return ef("not_applicable", "high", "No human subjects detected in spec — human realism evaluation not applicable", "spec_inference");
  }

  const provider = input.generationResult?.provider ?? "";
  const baseQuality = PROVIDER_QUALITY_BASELINES[provider] ?? 72;

  if (baseQuality >= 80) {
    return ef("photorealistic", "medium",
      `Provider "${provider}" (baseline ${baseQuality}/100) is expected to produce photorealistic humans`,
      "generation_metadata");
  }
  if (baseQuality >= 70) {
    return ef("almost_realistic", "medium",
      `Provider "${provider}" (baseline ${baseQuality}/100) — human rendering is almost realistic`,
      "generation_metadata");
  }
  return ef("obviously_ai", "medium",
    `Provider "${provider}" (baseline ${baseQuality}/100) — human rendering quality may be visibly AI-generated`,
    "generation_metadata");
}

function buildObjectRealism(input: ImageCriticInput): EvaluationField<"accurate" | "slightly_off" | "inaccurate" | "not_applicable"> {
  const heroText = getHeroText(input);
  const provider = input.generationResult?.provider ?? "";
  const baseQuality = PROVIDER_QUALITY_BASELINES[provider] ?? 72;

  if (!heroText || heroText.length < 5) {
    return ef("not_applicable", "low", "No object description available — object realism not applicable", "spec_inference");
  }

  if (baseQuality >= 78) {
    return ef("accurate", "medium",
      `Provider "${provider}" (baseline ${baseQuality}/100) — object rendering expected to be accurate`,
      "generation_metadata");
  }
  if (baseQuality >= 68) {
    return ef("slightly_off", "low",
      `Provider "${provider}" (baseline ${baseQuality}/100) — minor object inaccuracies possible`,
      "generation_metadata");
  }
  return ef("inaccurate", "low",
    `Provider "${provider}" (baseline ${baseQuality}/100) — object accuracy may be poor`,
    "generation_metadata");
}

function buildMedicalRealism(input: ImageCriticInput): EvaluationField<"clinical_accurate" | "acceptable" | "inaccurate" | "not_applicable"> {
  const heroText = getHeroText(input);
  if (!containsAny(heroText, MEDICAL_PRESENCE_KEYWORDS)) {
    return ef("not_applicable", "high", "No medical content detected in spec — medical realism not applicable", "spec_inference");
  }

  return ef("acceptable", "low",
    "Medical content detected — clinical accuracy requires expert vision analysis to verify",
    "spec_inference");
}

function buildArchitectureRealism(input: ImageCriticInput): EvaluationField<"structurally_correct" | "acceptable" | "impossible" | "not_applicable"> {
  const heroText = getHeroText(input);
  const envType  = input.scenePlan?.environment?.environmentType?.value ?? "";

  if (!containsAny(heroText, ARCHITECTURE_PRESENCE_KEYWORDS) && !envType.includes("architect") && !envType.includes("interior")) {
    return ef("not_applicable", "high",
      "No architectural content detected in spec — architecture realism not applicable",
      "spec_inference");
  }

  const provider = input.generationResult?.provider ?? "";
  const baseQuality = PROVIDER_QUALITY_BASELINES[provider] ?? 72;

  if (baseQuality >= 80) {
    return ef("structurally_correct", "medium",
      `Provider "${provider}" (baseline ${baseQuality}/100) — architectural rendering expected to be structurally correct`,
      "generation_metadata");
  }
  return ef("acceptable", "low",
    `Provider "${provider}" (baseline ${baseQuality}/100) — architecture acceptable but may have minor issues`,
    "generation_metadata");
}

function buildFoodRealism(input: ImageCriticInput): EvaluationField<"appetising" | "acceptable" | "unappetising" | "not_applicable"> {
  const heroText = getHeroText(input);
  if (!containsAny(heroText, FOOD_PRESENCE_KEYWORDS)) {
    return ef("not_applicable", "high", "No food content detected in spec — food realism not applicable", "spec_inference");
  }

  const provider = input.generationResult?.provider ?? "";
  const baseQuality = PROVIDER_QUALITY_BASELINES[provider] ?? 72;

  if (baseQuality >= 78) {
    return ef("appetising", "medium",
      `Provider "${provider}" (baseline ${baseQuality}/100) — food rendering expected to be appetising`,
      "generation_metadata");
  }
  return ef("acceptable", "low",
    `Provider "${provider}" (baseline ${baseQuality}/100) — food rendering acceptable`,
    "generation_metadata");
}

function buildProductRealism(input: ImageCriticInput): EvaluationField<"accurate" | "slightly_off" | "inaccurate" | "not_applicable"> {
  const heroText = getHeroText(input);
  const hasProduct =
    heroText.toLowerCase().includes("product") ||
    heroText.toLowerCase().includes("bottle") ||
    heroText.toLowerCase().includes("package") ||
    heroText.toLowerCase().includes("device") ||
    heroText.toLowerCase().includes("gadget") ||
    heroText.toLowerCase().includes("item");

  if (!hasProduct) {
    return ef("not_applicable", "medium",
      "No product detected in spec — product realism not applicable",
      "spec_inference");
  }

  const quality = input.generationResult?.quality;
  if (quality?.fullPromptUsed && quality?.allFeaturesSupported) {
    return ef("accurate", "medium",
      "Full prompt used with all features supported — product details likely rendered accurately",
      "generation_metadata");
  }
  if (!quality?.fullPromptUsed) {
    return ef("slightly_off", "medium",
      "Prompt truncated — product details may have been partially lost",
      "generation_metadata");
  }

  return ef("accurate", "low", "Product realism assumed accurate from successful generation", "spec_inference");
}

function buildRealismScore(
  humanRealism:        EvaluationField<string>,
  objectRealism:       EvaluationField<string>,
  medicalRealism:      EvaluationField<string>,
  architectureRealism: EvaluationField<string>,
  foodRealism:         EvaluationField<string>,
  productRealism:      EvaluationField<string>
): EvaluationScore {
  const scoreOf = (v: string, notApplicableScore: number): number => {
    if (v === "not_applicable") return notApplicableScore;
    if (v === "photorealistic" || v === "accurate" || v === "structurally_correct" || v === "appetising" || v === "clinical_accurate") return 90;
    if (v === "almost_realistic" || v === "slightly_off" || v === "acceptable") return 72;
    return 40; // obviously_ai, inaccurate, impossible, unappetising
  };

  const applicable = [humanRealism, objectRealism, medicalRealism, architectureRealism, foodRealism, productRealism]
    .filter(f => f.value !== "not_applicable");

  if (applicable.length === 0) {
    return ef(85, "high", "No realism-specific content detected — default high score (not applicable)", "rule_based");
  }

  const total = applicable.reduce((sum, f) => sum + scoreOf(f.value, 85), 0);
  const score = Math.round(total / applicable.length);

  return ef(
    score,
    "low",
    `Realism score ${score}/100 across ${applicable.length} applicable realism dimensions`,
    "rule_based"
  );
}

export function buildRealismEvaluation(input: ImageCriticInput): RealismEvaluation {
  const humanRealism        = buildHumanRealism(input);
  const objectRealism       = buildObjectRealism(input);
  const medicalRealism      = buildMedicalRealism(input);
  const architectureRealism = buildArchitectureRealism(input);
  const foodRealism         = buildFoodRealism(input);
  const productRealism      = buildProductRealism(input);
  const realismScore        = buildRealismScore(
    humanRealism, objectRealism, medicalRealism, architectureRealism, foodRealism, productRealism
  );

  return { humanRealism, objectRealism, medicalRealism, architectureRealism, foodRealism, productRealism, realismScore };
}
