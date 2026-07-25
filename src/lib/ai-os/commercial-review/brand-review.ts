// Phase 9.1 — Brand Review.
// Evaluates: brand presence, logo, trust signals, regulated-industry disclaimer.
// Input: CommercialCopy + BrandIntelligence + CommercialRenderPlan. Output: score + issues.

import type { BrandIntelligence } from "../blueprint/types";
import type { CommercialCopy } from "../copy-intelligence/types";
import type { CommercialRenderPlan } from "../commercial-renderer/types";
import type { CommercialCompositionPlan } from "../commercial-composition/types";
import type { CategoryResult, ReviewIssue } from "./types";
import { clampScore } from "./score-engine";

// Industries that require a legal disclaimer for compliance
const REGULATED_INDUSTRIES = new Set([
  "healthcare", "dental", "pharmacy", "legal", "financial_services", "insurance",
]);

export function reviewBrand(
  copy:        CommercialCopy,
  brand:       BrandIntelligence,
  renderPlan:  CommercialRenderPlan,
  composition: CommercialCompositionPlan,
): CategoryResult {
  const issues: ReviewIssue[] = [];
  let score = 100;

  // ── 1. Logo in render plan ───────────────────────────────────────────────────
  if (!renderPlan.logo) {
    score -= 10;
    issues.push({
      type: "brand", severity: "medium",
      message: "Logo is absent from the render plan — brand identity is unrecognised",
      field: "logo",
    });
  }

  // ── 2. Logo in composition placements ────────────────────────────────────────
  const hasLogoPlacement = composition.placements.some(p =>
    p.assetId === "logo" || p.assetId === "clinic_logo" || p.assetId === "builder_logo",
  );
  if (!hasLogoPlacement) {
    score -= 6;
    issues.push({
      type: "brand", severity: "medium",
      message: "No logo placement defined in composition plan",
      field: "logo",
    });
  }

  // ── 3. Brand kit completeness ─────────────────────────────────────────────────
  const primaryColor = brand.context?.primaryColor ?? brand.kit?.brandColors?.value ?? null;
  if (!primaryColor) {
    score -= 3;
    issues.push({
      type: "brand", severity: "low",
      message: "No brand colors defined — AI will use generic defaults",
    });
  }

  const hasBrandFont = brand.context?.fontFamily ?? brand.kit?.primaryFont?.value ?? null;
  if (!hasBrandFont) {
    score -= 2;
    issues.push({
      type: "brand", severity: "low",
      message: "No brand font defined — typography defaults to system fallback",
    });
  }

  // ── 4. Regulated industry: disclaimer required ────────────────────────────────
  const industry = copy.metadata.industry;
  if (REGULATED_INDUSTRIES.has(industry) && copy.disclaimer === null) {
    score -= 8;
    issues.push({
      type: "brand", severity: "medium",
      message: `${industry} is a regulated industry — a legal disclaimer is strongly recommended`,
      field: "disclaimer",
    });
  }

  // ── 5. Regulated industry: disclaimer in render plan ────────────────────────
  if (REGULATED_INDUSTRIES.has(industry) && copy.disclaimer !== null && !renderPlan.disclaimer) {
    score -= 5;
    issues.push({
      type: "brand", severity: "medium",
      message: "Disclaimer text exists in copy but has no placement in the render plan",
      field: "disclaimer",
    });
  }

  // ── 6. Brand logo intelligence: logo uploaded ─────────────────────────────────
  if (!brand.logo) {
    score -= 3;
    issues.push({
      type: "brand", severity: "low",
      message: "No logo asset was uploaded — brand visibility is reduced",
      field: "logo",
    });
  }

  // ── 7. Composition conflicts affecting brand elements ────────────────────────
  const brandConflicts = composition.conflicts.filter(c =>
    c.affectedAssets.some(a => a === "logo" || a === "clinic_logo" || a === "builder_logo"),
  );
  if (brandConflicts.length > 0) {
    score -= 4;
    issues.push({
      type: "brand", severity: "medium",
      message: `${brandConflicts.length} composition conflict(s) involving the brand logo`,
      field: "logo",
    });
  }

  return { score: clampScore(score), issues };
}
