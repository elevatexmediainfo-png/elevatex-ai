import type { UniversalCampaignBlueprint } from "../blueprint/types";
import type { VisualScenePlan } from "../scene-planner/types";
import type { PromptSpecification } from "../prompt-spec/types";
import type { GenerationResult } from "../generation/types";

// Phase 16 — AI Image Critic & Quality Evaluation Engine types.
// The Image Critic evaluates a generated image against its intended creative goals.
//
// STRICT RULES:
//   ✗ Never generates prompts or images
//   ✗ Never calls image generation providers
//   ✗ Never modifies prompts or plans
//   ✓ Only evaluates and scores the generated image

// ─────────────────────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────────────────────

export interface ImageCriticInput {
  /** URL or base64 data URL of the generated image/video. */
  imageUrl:         string;
  blueprint:        UniversalCampaignBlueprint;
  scenePlan:        VisualScenePlan;
  promptSpec:       PromptSpecification;
  generationResult: GenerationResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation field type — every evaluation decision is self-describing
// ─────────────────────────────────────────────────────────────────────────────

export type EvaluationConfidence = "high" | "medium" | "low" | "unknown";
export type EvaluationSource =
  | "spec_inference"       // inferred from plan/spec without seeing the image
  | "generation_metadata"  // inferred from GenerationResult quality metadata
  | "rule_based"           // deterministic rule from capability/spec data
  | "vision_analysis";     // from LLM vision analysis of the actual image

export interface EvaluationField<T = string> {
  value:      T;
  confidence: EvaluationConfidence;
  reasoning:  string;
  source:     EvaluationSource;
}

export type EvaluationScore = EvaluationField<number>; // 0-100

function ef<T>(
  value: T,
  confidence: EvaluationConfidence,
  reasoning: string,
  source: EvaluationSource = "spec_inference"
): EvaluationField<T> {
  return { value, confidence, reasoning, source };
}
export { ef };

// ─────────────────────────────────────────────────────────────────────────────
// Domain 1 — Hero Subject Evaluation
// ─────────────────────────────────────────────────────────────────────────────

export interface HeroEvaluation {
  /** Was the hero subject likely visible in the generated image? */
  heroVisibility:     EvaluationField<"clearly_visible" | "likely_visible" | "unclear" | "likely_absent">;
  /** Does the hero appear to dominate the frame as intended? */
  heroDominance:      EvaluationField<"dominant" | "appropriate" | "weak" | "unknown">;
  /** Does the hero match the intended description? */
  heroAccuracy:       EvaluationField<"accurate" | "likely_accurate" | "uncertain" | "likely_inaccurate">;
  heroScore:          EvaluationScore;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 2 — Composition Evaluation
// ─────────────────────────────────────────────────────────────────────────────

export interface CompositionEvaluation {
  ruleOfThirds:       EvaluationField<"applied" | "partially_applied" | "not_applied" | "unknown">;
  visualBalance:      EvaluationField<"balanced" | "slightly_unbalanced" | "unbalanced" | "unknown">;
  negativeSpace:      EvaluationField<"appropriate" | "insufficient" | "excessive" | "unknown">;
  depth:              EvaluationField<"good_depth" | "flat" | "unknown">;
  visualHierarchy:    EvaluationField<"clear_hierarchy" | "unclear_hierarchy" | "unknown">;
  compositionScore:   EvaluationScore;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 3 — Lighting Evaluation
// ─────────────────────────────────────────────────────────────────────────────

export interface LightingEvaluation {
  lightingConsistency:EvaluationField<"consistent" | "inconsistent" | "unknown">;
  shadowRealism:      EvaluationField<"realistic" | "unrealistic" | "absent" | "unknown">;
  reflectionQuality:  EvaluationField<"correct" | "incorrect" | "absent" | "unknown">;
  premiumFeel:        EvaluationField<"premium" | "standard" | "poor" | "unknown">;
  lightingScore:      EvaluationScore;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 4 — Marketing Evaluation
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketingEvaluation {
  /** Does the image support the campaign goal? */
  campaignGoalSupport:   EvaluationField<"strong" | "moderate" | "weak" | "missing" | "unknown">;
  /** Is the target audience likely to engage with this image? */
  audienceResonance:     EvaluationField<"high" | "moderate" | "low" | "unknown">;
  /** Does the image build trust (for trust-requirement campaigns)? */
  trustSignals:          EvaluationField<"strong" | "moderate" | "weak" | "missing" | "unknown">;
  /** Does the image support the conversion intent? */
  conversionSupport:     EvaluationField<"strong" | "moderate" | "weak" | "missing" | "unknown">;
  marketingScore:        EvaluationScore;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 5 — Brand Evaluation
// ─────────────────────────────────────────────────────────────────────────────

export interface BrandingEvaluation {
  brandSafety:           EvaluationField<"safe" | "minor_concern" | "unsafe" | "unknown">;
  industrySafety:        EvaluationField<"compliant" | "potential_issue" | "non_compliant" | "unknown">;
  professionalQuality:   EvaluationField<"professional" | "standard" | "unprofessional" | "unknown">;
  luxuryLevelMatch:      EvaluationField<"matches_requirement" | "lower_than_required" | "higher_than_required" | "unknown">;
  brandScore:            EvaluationScore;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 6 — Realism Evaluation
// ─────────────────────────────────────────────────────────────────────────────

export interface RealismEvaluation {
  humanRealism:        EvaluationField<"photorealistic" | "almost_realistic" | "obviously_ai" | "not_applicable">;
  objectRealism:       EvaluationField<"accurate" | "slightly_off" | "inaccurate" | "not_applicable">;
  medicalRealism:      EvaluationField<"clinical_accurate" | "acceptable" | "inaccurate" | "not_applicable">;
  architectureRealism: EvaluationField<"structurally_correct" | "acceptable" | "impossible" | "not_applicable">;
  foodRealism:         EvaluationField<"appetising" | "acceptable" | "unappetising" | "not_applicable">;
  productRealism:      EvaluationField<"accurate" | "slightly_off" | "inaccurate" | "not_applicable">;
  realismScore:        EvaluationScore;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 7 — Artifact Detection
// ─────────────────────────────────────────────────────────────────────────────

export interface ArtifactEvaluation {
  aiArtifactsDetected:     EvaluationField<"none" | "minor" | "moderate" | "severe" | "unknown">;
  anatomyCorrectness:      EvaluationField<"correct" | "minor_issues" | "major_issues" | "not_applicable">;
  handRendering:           EvaluationField<"correct" | "minor_issues" | "major_issues" | "not_applicable">;
  textRendering:           EvaluationField<"legible" | "illegible" | "absent" | "not_applicable">;
  geometricConsistency:    EvaluationField<"consistent" | "inconsistent" | "unknown">;
  overallArtifactScore:    EvaluationScore;  // 100 = no artifacts
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 8 — Typography Safe Area Evaluation
// ─────────────────────────────────────────────────────────────────────────────

export interface TypographySafeAreaEvaluation {
  headlineAreaPreserved: EvaluationField<"preserved" | "partially_obstructed" | "obstructed" | "not_required">;
  ctaAreaPreserved:      EvaluationField<"preserved" | "partially_obstructed" | "obstructed" | "not_required">;
  logoAreaPreserved:     EvaluationField<"preserved" | "partially_obstructed" | "obstructed" | "not_required">;
  bodyAreaPreserved:     EvaluationField<"preserved" | "partially_obstructed" | "obstructed" | "not_required">;
  typographySafetyScore: EvaluationScore;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 9 — Overall Quality Scores
// ─────────────────────────────────────────────────────────────────────────────

export interface QualityScores {
  heroScore:            number;  // 0-100
  compositionScore:     number;
  lightingScore:        number;
  marketingScore:       number;
  brandScore:           number;
  realismScore:         number;
  artifactScore:        number;  // 100 = no artifacts
  typographySafetyScore:number;
  /** Weighted average of all dimension scores. */
  overallScore:         number;
  /** Whether the image meets the minimum quality threshold for use. */
  passesQualityThreshold: boolean;
  /** The quality threshold used (0-100). */
  qualityThreshold:     number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 10 — Recommendations
// ─────────────────────────────────────────────────────────────────────────────

export type RecommendationPriority = "critical" | "high" | "medium" | "low";
export type RecommendationCategory =
  | "hero_subject" | "composition" | "lighting" | "marketing"
  | "branding" | "realism" | "artifacts" | "typography_safety";

export interface Recommendation {
  priority:    RecommendationPriority;
  category:    RecommendationCategory;
  /** The specific issue detected. */
  issue:       string;
  /** What to improve. Does NOT generate a new prompt. */
  improvement: string;
  /** Expected quality improvement if addressed (0-20 points). */
  estimatedImpact: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ImageEvaluationReport — complete output of the Image Critic
// ─────────────────────────────────────────────────────────────────────────────

export type EvaluationMethod = "spec_only" | "vision_assisted" | "full";

export interface ImageEvaluationReport {
  evaluationId:    string;
  generationId:    string;
  imageUrl:        string;
  evaluatedAt:     string;

  // 10 evaluation domains
  heroSubject:       HeroEvaluation;
  composition:       CompositionEvaluation;
  lighting:          LightingEvaluation;
  marketing:         MarketingEvaluation;
  branding:          BrandingEvaluation;
  realism:           RealismEvaluation;
  artifacts:         ArtifactEvaluation;
  typographySafeAreas: TypographySafeAreaEvaluation;
  quality:           QualityScores;
  recommendations:   Recommendation[];

  /** Whether the image passed quality threshold. */
  approved:          boolean;
  /** The evaluation method used. */
  evaluationMethod:  EvaluationMethod;
  /** 0-100 confidence in the evaluation results. */
  evaluationConfidence: number;
  /** Fields that required vision analysis but vision was not available. */
  pendingVisionAnalysis: string[];
}
