import type { ImageCriticInput, ImageEvaluationReport } from "./types";
import { validateImageCriticInput } from "./validation";
import { buildHeroEvaluation }              from "./builders/hero";
import { buildCompositionEvaluation }       from "./builders/composition";
import { buildLightingEvaluation }          from "./builders/lighting";
import { buildMarketingEvaluation }         from "./builders/marketing";
import { buildBrandingEvaluation }          from "./builders/branding";
import { buildRealismEvaluation }           from "./builders/realism";
import { buildArtifactEvaluation }          from "./builders/artifacts";
import { buildTypographySafeAreaEvaluation }from "./builders/typography-safe-area";
import { buildQualityScores }               from "./builders/quality-score";
import { buildRecommendations }             from "./builders/recommendations";

// Phase 16 — AI Image Critic & Quality Evaluation Engine.
// Evaluates a generated image against its intended creative goals.
//
// STRICT RULES:
//   ✗ Never generates prompts or images
//   ✗ Never calls image generation providers
//   ✗ Never modifies prompts, plans, or the Blueprint
//   ✓ Only evaluates and scores the generated image
//   ✓ Returns a structured ImageEvaluationReport
//
// STOP CONDITION: This engine stops here. Do NOT build Auto Improvement Engine.

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation ID generation
// ─────────────────────────────────────────────────────────────────────────────

function generateEvaluationId(): string {
  return `eval_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation confidence — average of all domain confidence levels
// ─────────────────────────────────────────────────────────────────────────────

function computeOverallConfidence(report: Omit<ImageEvaluationReport, "evaluationConfidence" | "evaluationId" | "evaluatedAt" | "approved" | "evaluationMethod" | "pendingVisionAnalysis">): number {
  const confidenceValues = {
    high:    90,
    medium:  65,
    low:     40,
    unknown: 20,
  };

  const allConfidences = [
    report.heroSubject.heroScore.confidence,
    report.composition.compositionScore.confidence,
    report.lighting.lightingScore.confidence,
    report.marketing.marketingScore.confidence,
    report.branding.brandScore.confidence,
    report.realism.realismScore.confidence,
    report.artifacts.overallArtifactScore.confidence,
    report.typographySafeAreas.typographySafetyScore.confidence,
  ];

  const sum = allConfidences.reduce((acc, c) => acc + (confidenceValues[c] ?? 40), 0);
  return Math.round(sum / allConfidences.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending vision fields — fields that used spec_inference where vision would help
// ─────────────────────────────────────────────────────────────────────────────

function identifyPendingVisionFields(report: Omit<ImageEvaluationReport, "pendingVisionAnalysis" | "evaluationConfidence" | "evaluationId" | "evaluatedAt" | "approved" | "evaluationMethod">): string[] {
  const pending: string[] = [];

  if (report.heroSubject.heroVisibility.source === "spec_inference" && report.heroSubject.heroVisibility.value === "unclear") {
    pending.push("heroSubject.heroVisibility");
  }
  if (report.heroSubject.heroAccuracy.value === "uncertain") {
    pending.push("heroSubject.heroAccuracy");
  }
  if (report.composition.ruleOfThirds.value === "unknown") {
    pending.push("composition.ruleOfThirds");
  }
  if (report.composition.depth.value === "unknown") {
    pending.push("composition.depth");
  }
  if (report.lighting.reflectionQuality.value === "unknown") {
    pending.push("lighting.reflectionQuality");
  }
  if (report.artifacts.aiArtifactsDetected.value === "unknown") {
    pending.push("artifacts.aiArtifactsDetected");
  }
  if (report.artifacts.geometricConsistency.value === "unknown") {
    pending.push("artifacts.geometricConsistency");
  }
  if (report.artifacts.anatomyCorrectness.value !== "not_applicable") {
    pending.push("artifacts.anatomyCorrectness");
  }

  return pending;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main evaluation function
// ─────────────────────────────────────────────────────────────────────────────

/** Evaluates a generated image against its creative intent. Returns an ImageEvaluationReport. */
export function evaluateImage(input: ImageCriticInput): ImageEvaluationReport {
  // Validate input
  const validation = validateImageCriticInput(input);
  if (!validation.isValid) {
    throw new Error(`ImageCritic: invalid input — ${validation.errors.join("; ")}`);
  }

  // 10 evaluation domains — all builders are pure, synchronous, isolated
  const heroSubject       = buildHeroEvaluation(input);
  const composition       = buildCompositionEvaluation(input);
  const lighting          = buildLightingEvaluation(input);
  const marketing         = buildMarketingEvaluation(input);
  const branding          = buildBrandingEvaluation(input);
  const realism           = buildRealismEvaluation(input);
  const artifacts         = buildArtifactEvaluation(input);
  const typographySafeAreas = buildTypographySafeAreaEvaluation(input);

  const quality = buildQualityScores(
    heroSubject, composition, lighting, marketing,
    branding, realism, artifacts, typographySafeAreas, input
  );

  const recommendations = buildRecommendations(
    heroSubject, composition, lighting, marketing,
    branding, realism, artifacts, typographySafeAreas, quality, input
  );

  const partialReport = {
    generationId:  input.generationResult?.generationId ?? "",
    imageUrl:      input.imageUrl,
    heroSubject,
    composition,
    lighting,
    marketing,
    branding,
    realism,
    artifacts,
    typographySafeAreas,
    quality,
    recommendations,
  };

  const evaluationConfidence = computeOverallConfidence(partialReport);
  const pendingVisionAnalysis = identifyPendingVisionFields(partialReport);

  return {
    evaluationId:        generateEvaluationId(),
    generationId:        input.generationResult?.generationId ?? "",
    imageUrl:            input.imageUrl,
    evaluatedAt:         new Date().toISOString(),
    heroSubject,
    composition,
    lighting,
    marketing,
    branding,
    realism,
    artifacts,
    typographySafeAreas,
    quality,
    recommendations,
    approved:            quality.passesQualityThreshold,
    evaluationMethod:    "spec_only",
    evaluationConfidence,
    pendingVisionAnalysis,
  };
}
