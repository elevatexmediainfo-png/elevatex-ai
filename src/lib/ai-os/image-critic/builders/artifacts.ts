import type { ImageCriticInput, ArtifactEvaluation, EvaluationField, EvaluationScore } from "../types";
import { ef } from "../types";
import { PROVIDER_ARTIFACT_RISK, HUMAN_PRESENCE_KEYWORDS } from "../knowledge";

// Domain 7 — Artifact Detection.
// Evaluates the likelihood of AI artifacts in the generated image.
// Source: generation_metadata + rule_based
// NOTE: Without vision analysis, artifact detection is probabilistic based on provider risk.

function containsAny(text: string, keywords: ReadonlyArray<string>): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

function buildAiArtifactsDetected(input: ImageCriticInput): EvaluationField<"none" | "minor" | "moderate" | "severe" | "unknown"> {
  const provider = input.generationResult?.provider ?? "";
  const risk     = PROVIDER_ARTIFACT_RISK[provider] ?? "medium";
  const quality  = input.generationResult?.quality?.estimatedOutputQuality ?? 70;

  if (risk === "low" && quality >= 80) {
    return ef("none", "low",
      `Provider "${provider}" has low artifact risk with quality ${quality}/100 — artifacts likely absent. Spec-inference only.`,
      "generation_metadata");
  }
  if (risk === "low" || quality >= 75) {
    return ef("minor", "low",
      `Provider "${provider}" (risk: ${risk}, quality: ${quality}/100) — minor artifacts are possible`,
      "generation_metadata");
  }
  if (risk === "high" || quality < 65) {
    return ef("moderate", "low",
      `Provider "${provider}" (risk: ${risk}, quality: ${quality}/100) — moderate artifacts are likely`,
      "generation_metadata");
  }

  return ef("unknown", "low",
    "Artifact detection requires vision analysis — cannot determine from metadata alone",
    "spec_inference");
}

function buildAnatomyCorrectness(input: ImageCriticInput): EvaluationField<"correct" | "minor_issues" | "major_issues" | "not_applicable"> {
  const heroText = [
    input.promptSpec?.hero?.heroSubject?.value,
    input.scenePlan?.heroSubject?.exactHeroSubject?.value,
    input.blueprint?.userIntelligence?.rawIdea,
  ].filter(Boolean).join(" ");

  if (!containsAny(heroText, HUMAN_PRESENCE_KEYWORDS)) {
    return ef("not_applicable", "high",
      "No human subjects detected — anatomy evaluation not applicable",
      "spec_inference");
  }

  const provider = input.generationResult?.provider ?? "";
  const risk     = PROVIDER_ARTIFACT_RISK[provider] ?? "medium";

  if (risk === "low") {
    return ef("correct", "low",
      `Provider "${provider}" has low artifact risk — anatomy likely correct. Vision analysis required to confirm.`,
      "generation_metadata");
  }
  if (risk === "high") {
    return ef("minor_issues", "low",
      `Provider "${provider}" has high artifact risk — anatomy issues possible. Vision analysis required.`,
      "generation_metadata");
  }

  return ef("minor_issues", "low",
    "Anatomy correctness requires vision analysis — flagged as potential area for review",
    "spec_inference");
}

function buildHandRendering(input: ImageCriticInput): EvaluationField<"correct" | "minor_issues" | "major_issues" | "not_applicable"> {
  const heroText = [
    input.promptSpec?.hero?.heroSubject?.value,
    input.scenePlan?.heroSubject?.exactHeroSubject?.value,
  ].filter(Boolean).join(" ").toLowerCase();

  const hasHands = containsAny(heroText, HUMAN_PRESENCE_KEYWORDS) &&
    (heroText.includes("hand") || heroText.includes("finger") || heroText.includes("holding") || heroText.includes("gesture"));

  if (!containsAny(heroText, HUMAN_PRESENCE_KEYWORDS)) {
    return ef("not_applicable", "high",
      "No human subjects detected — hand rendering evaluation not applicable",
      "spec_inference");
  }

  const provider  = input.generationResult?.provider ?? "";
  const risk      = PROVIDER_ARTIFACT_RISK[provider] ?? "medium";

  if (hasHands) {
    // Hands are the most common AI artifact — always flag for vision review
    if (risk === "low") {
      return ef("minor_issues", "low",
        `Hands visible in spec — hand rendering is a common AI artifact area even for low-risk providers. Vision analysis recommended.`,
        "generation_metadata");
    }
    return ef("major_issues", "low",
      `Hands visible in spec with medium/high artifact risk provider "${provider}" — hand rendering issues are likely. Vision analysis required.`,
      "generation_metadata");
  }

  if (risk === "low") {
    return ef("correct", "low",
      `No explicit hands in spec and low-risk provider "${provider}" — hand rendering likely correct`,
      "generation_metadata");
  }

  return ef("minor_issues", "low",
    "Hand rendering requires vision analysis — flagged as potential area for review",
    "spec_inference");
}

function buildTextRendering(input: ImageCriticInput): EvaluationField<"legible" | "illegible" | "absent" | "not_applicable"> {
  const spec = input.promptSpec;
  const typographyZones   = spec?.typography;
  const hasTextInScene    = !!(typographyZones?.reservedHeadlineArea?.value &&
    typographyZones.reservedHeadlineArea.value !== "not_required" &&
    typographyZones.reservedHeadlineArea.value !== "none");
  const typographyNote = (spec as { typographyNote?: string } | undefined)?.typographyNote;

  if (!hasTextInScene && !typographyNote) {
    return ef("absent", "medium",
      "No text/typography specified in PromptSpec — text rendering evaluation not applicable",
      "spec_inference");
  }

  const provider = input.generationResult?.provider ?? "";
  if (provider === "ideogram") {
    return ef("legible", "medium",
      "Ideogram specialises in text rendering — text is expected to be legible",
      "rule_based");
  }
  if (provider === "openai") {
    return ef("legible", "medium",
      "OpenAI has improved text rendering — text is expected to be legible",
      "rule_based");
  }

  return ef("illegible", "low",
    `Provider "${provider}" does not specialise in text rendering — in-image text is likely illegible. Use Ideogram for text-heavy designs.`,
    "rule_based");
}

function buildGeometricConsistency(input: ImageCriticInput): EvaluationField<"consistent" | "inconsistent" | "unknown"> {
  const provider = input.generationResult?.provider ?? "";
  const risk     = PROVIDER_ARTIFACT_RISK[provider] ?? "medium";

  if (risk === "low") {
    return ef("consistent", "low",
      `Provider "${provider}" has low artifact risk — geometric consistency likely maintained. Vision analysis required to confirm.`,
      "generation_metadata");
  }
  if (risk === "high") {
    return ef("inconsistent", "low",
      `Provider "${provider}" has high artifact risk — geometric inconsistencies are possible. Vision analysis required.`,
      "generation_metadata");
  }

  return ef("unknown", "low",
    "Geometric consistency requires vision analysis — cannot determine from metadata",
    "spec_inference");
}

function buildArtifactScore(
  aiArtifacts: EvaluationField<string>,
  anatomy:     EvaluationField<string>,
  hands:       EvaluationField<string>,
  text:        EvaluationField<string>
): EvaluationScore {
  // Artifact score is inverted: 100 = no artifacts, 0 = severe artifacts
  const artifactScore = aiArtifacts.value === "none" ? 95
    : aiArtifacts.value === "minor" ? 78
    : aiArtifacts.value === "moderate" ? 55
    : aiArtifacts.value === "severe" ? 20 : 65;

  const anatomyAdj = anatomy.value === "correct" ? 0
    : anatomy.value === "minor_issues" ? -5
    : anatomy.value === "major_issues" ? -15
    : 0; // not_applicable

  const handsAdj = hands.value === "correct" ? 0
    : hands.value === "minor_issues" ? -5
    : hands.value === "major_issues" ? -15
    : 0;

  const textAdj = text.value === "legible" ? 0
    : text.value === "illegible" ? -8
    : 0; // absent or not_applicable

  const score = Math.min(100, Math.max(0, Math.round(artifactScore + anatomyAdj + handsAdj + textAdj)));

  return ef(
    score,
    "low",
    `Artifact score ${score}/100 — base ${artifactScore} + anatomy ${anatomyAdj} + hands ${handsAdj} + text ${textAdj}. Vision analysis required for accuracy.`,
    "rule_based"
  );
}

export function buildArtifactEvaluation(input: ImageCriticInput): ArtifactEvaluation {
  const aiArtifactsDetected  = buildAiArtifactsDetected(input);
  const anatomyCorrectness   = buildAnatomyCorrectness(input);
  const handRendering        = buildHandRendering(input);
  const textRendering        = buildTextRendering(input);
  const geometricConsistency = buildGeometricConsistency(input);
  const overallArtifactScore = buildArtifactScore(
    aiArtifactsDetected, anatomyCorrectness, handRendering, textRendering
  );

  return {
    aiArtifactsDetected,
    anatomyCorrectness,
    handRendering,
    textRendering,
    geometricConsistency,
    overallArtifactScore,
  };
}
