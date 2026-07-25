import type { ImageCriticInput, TypographySafeAreaEvaluation, EvaluationField, EvaluationScore } from "../types";
import { ef } from "../types";

// Domain 8 — Typography Safe Area Evaluation.
// Evaluates whether the image preserves safe zones for post-production text overlay.
// Reads zone definitions from PromptSpecification.typography (TypographyZones).
// Source: spec_inference + rule_based

type SafeAreaStatus = "preserved" | "partially_obstructed" | "obstructed" | "not_required";

function getTypographyZones(input: ImageCriticInput): {
  headline?: string;
  cta?: string;
  logo?: string;
  body?: string;
} {
  const typo = input.promptSpec?.typography;
  if (!typo) return {};

  return {
    headline: typo.reservedHeadlineArea?.value,
    cta:      typo.reservedCtaArea?.value,
    logo:     typo.reservedLogoArea?.value,
    body:     typo.reservedBodyArea?.value,
  };
}

function isZoneRequired(zone: string | undefined): boolean {
  if (!zone) return false;
  const lower = zone.toLowerCase();
  return lower !== "not_required" && lower !== "none" && lower !== "unknown" && lower.length > 3;
}

function buildAreaPreservation(
  areaName: string,
  areaSpec: string | undefined,
  input: ImageCriticInput
): EvaluationField<SafeAreaStatus> {
  if (!isZoneRequired(areaSpec)) {
    return ef("not_required", "high",
      `${areaName} safe area not required for this design (spec: "${areaSpec ?? "unset"}")`,
      "spec_inference");
  }

  // Check if hero scale or position could conflict with this zone
  const heroScale    = input.promptSpec?.hero?.heroScale?.value ?? "";
  const heroPosition = input.promptSpec?.hero?.heroPosition?.value ?? "";

  const areaLower     = (areaSpec ?? "").toLowerCase();
  const heroLower     = heroScale.toLowerCase();
  const positionLower = heroPosition.toLowerCase();

  // Full-frame hero could obstruct any safe area
  if (heroLower === "full_frame_dominant") {
    return ef("partially_obstructed", "medium",
      `${areaName} safe area may be partially obstructed — full-frame hero conflicts with any overlay zone`,
      "rule_based");
  }

  // Check for positional conflicts between zone position and hero position
  const hasConflict =
    (areaLower.includes("top") && positionLower.includes("upper")) ||
    (areaLower.includes("bottom") && positionLower.includes("lower")) ||
    (areaLower.includes("left") && positionLower.includes("left_third")) ||
    (areaLower.includes("right") && positionLower.includes("right_third"));

  if (hasConflict) {
    return ef("partially_obstructed", "low",
      `${areaName} safe area "${areaSpec}" may overlap with hero position "${heroPosition}" — potential conflict`,
      "rule_based");
  }

  // Center hero with edge-based zones is safe
  if (positionLower.includes("center") || positionLower.includes("center_frame")) {
    return ef("preserved", "medium",
      `${areaName} safe area preserved — center-framed hero leaves edge zones clear for "${areaSpec}"`,
      "rule_based");
  }

  return ef("preserved", "low",
    `${areaName} safe area "${areaSpec}" expected to be preserved — no positional conflict detected`,
    "spec_inference");
}

function buildTypographySafetyScore(
  headline: EvaluationField<SafeAreaStatus>,
  cta:      EvaluationField<SafeAreaStatus>,
  logo:     EvaluationField<SafeAreaStatus>,
  body:     EvaluationField<SafeAreaStatus>
): EvaluationScore {
  const scoreOf = (v: SafeAreaStatus): number => {
    if (v === "not_required") return 100;  // not a defect
    if (v === "preserved")    return 95;
    if (v === "partially_obstructed") return 60;
    return 20; // obstructed
  };

  const allFields = [headline, cta, logo, body];
  const required  = allFields.filter(f => f.value !== "not_required");

  if (required.length === 0) {
    return ef(100, "high",
      "No typography safe zones required for this design — perfect score",
      "rule_based");
  }

  const scores   = allFields.map(f => scoreOf(f.value as SafeAreaStatus));
  const reqTotal = required.reduce((sum, f) => {
    const idx = allFields.indexOf(f);
    return sum + scores[idx];
  }, 0);
  const avgScore = Math.round(reqTotal / required.length);

  return ef(
    avgScore,
    "low",
    `Typography safety score ${avgScore}/100 — ${required.length} zone(s) required, based on spec inference`,
    "rule_based"
  );
}

export function buildTypographySafeAreaEvaluation(input: ImageCriticInput): TypographySafeAreaEvaluation {
  const zones = getTypographyZones(input);

  const headlineAreaPreserved = buildAreaPreservation("Headline", zones.headline, input);
  const ctaAreaPreserved      = buildAreaPreservation("CTA",      zones.cta,      input);
  const logoAreaPreserved     = buildAreaPreservation("Logo",     zones.logo,     input);
  const bodyAreaPreserved     = buildAreaPreservation("Body",     zones.body,     input);
  const typographySafetyScore = buildTypographySafetyScore(
    headlineAreaPreserved, ctaAreaPreserved, logoAreaPreserved, bodyAreaPreserved
  );

  return {
    headlineAreaPreserved,
    ctaAreaPreserved,
    logoAreaPreserved,
    bodyAreaPreserved,
    typographySafetyScore,
  };
}
