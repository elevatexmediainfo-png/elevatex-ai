// Phase 9.1 — Typography Review.
// Evaluates: hierarchy invariants, contrast, readability, CTA legibility.
// Input: CommercialTypographyPlan + CommercialRenderPlan. Output: score + issues.

import type { CommercialTypographyPlan, TypographySize } from "../typography-intelligence/types";
import type { CommercialRenderPlan } from "../commercial-renderer/types";
import type { CategoryResult, ReviewIssue } from "./types";
import { clampScore } from "./score-engine";

// Ordered from smallest to largest (used for size comparison)
const SIZE_ORDER: TypographySize[] = ["xs", "sm", "base", "lg", "xl", "xxl", "display"];

function sizeRank(s: TypographySize): number {
  return SIZE_ORDER.indexOf(s);
}

export function reviewTypography(
  typo:      CommercialTypographyPlan,
  renderPlan: CommercialRenderPlan,
): CategoryResult {
  const issues: ReviewIssue[] = [];
  let score = 100;

  // ── 1. Hierarchy invariant: headline.importance must be 10 ───────────────────
  if (typo.headline.importance !== 10) {
    score -= 15;
    issues.push({
      type: "typography", severity: "critical",
      message: "Headline importance is not 10 — hierarchy invariant broken",
      field: "headline",
    });
  }

  // ── 2. CTA importance must be < headline importance ───────────────────────────
  if (typo.cta.importance >= typo.headline.importance) {
    score -= 10;
    issues.push({
      type: "typography", severity: "high",
      message: "CTA importance equals or exceeds headline — hierarchy violated",
      field: "cta",
    });
  }

  // ── 3. Headline contrast ─────────────────────────────────────────────────────
  if (typo.headline.contrast === "low" || typo.headline.contrast === "medium") {
    score -= 12;
    issues.push({
      type: "typography", severity: "high",
      message: "Headline contrast is insufficient for primary element",
      field: "headline",
    });
  }

  // ── 4. CTA contrast ──────────────────────────────────────────────────────────
  if (typo.cta.contrast !== "high" && typo.cta.contrast !== "ultra_high") {
    score -= 10;
    issues.push({
      type: "typography", severity: "medium",
      message: "CTA contrast is below recommended level — may reduce click visibility",
      field: "cta",
    });
  }

  // ── 5. Size hierarchy: headline must be larger than body elements ─────────────
  const headlineRank = sizeRank(typo.headline.size);
  const benefitRank  = sizeRank(typo.benefits.size);
  const footerRank   = sizeRank(typo.footer.size);

  if (headlineRank <= benefitRank) {
    score -= 8;
    issues.push({
      type: "typography", severity: "high",
      message: "Headline size is not larger than benefits — readability hierarchy broken",
      field: "headline",
    });
  }

  if (footerRank >= headlineRank) {
    score -= 5;
    issues.push({
      type: "typography", severity: "medium",
      message: "Footer size is equal to or larger than headline",
      field: "footer",
    });
  }

  // ── 6. Benefits overflow in render plan ───────────────────────────────────────
  if (renderPlan.benefits.overflow) {
    score -= 5;
    issues.push({
      type: "typography", severity: "medium",
      message: "Benefits text overflows the allocated region",
      field: "benefits",
    });
  }

  // ── 7. CTA max lines: should be 1 (button label) ────────────────────────────
  if (typo.cta.maxLines !== undefined && typo.cta.maxLines > 1) {
    score -= 3;
    issues.push({
      type: "typography", severity: "low",
      message: "CTA is configured for multi-line — button labels should be single line",
      field: "cta",
    });
  }

  // ── 8. Subheadline contrast (should not exceed headline contrast) ─────────────
  if (typo.subheadline) {
    const subContrast = typo.subheadline.contrast;
    const headContrast = typo.headline.contrast;
    const contrastOrder = ["low", "medium", "high", "ultra_high"];
    if (contrastOrder.indexOf(subContrast) >= contrastOrder.indexOf(headContrast)) {
      score -= 4;
      issues.push({
        type: "typography", severity: "low",
        message: "Subheadline contrast equals or exceeds headline contrast",
        field: "subheadline",
      });
    }
  }

  // ── 9. Disclaimer: must NOT be high contrast (should stay subtle) ─────────────
  if (typo.disclaimer) {
    if (typo.disclaimer.contrast === "ultra_high") {
      score -= 3;
      issues.push({
        type: "typography", severity: "low",
        message: "Disclaimer has ultra-high contrast — it should be subtle",
        field: "disclaimer",
      });
    }
  }

  // ── 10. CTA size must be readable (at least "sm") ────────────────────────────
  if (sizeRank(typo.cta.size) < sizeRank("sm")) {
    score -= 6;
    issues.push({
      type: "typography", severity: "medium",
      message: "CTA font size is too small for a button label",
      field: "cta",
    });
  }

  // ── 11. Headline line height: should not be "loose" for display sizes ─────────
  if (
    (typo.headline.size === "display" || typo.headline.size === "xxl") &&
    typo.headline.lineHeight === "loose"
  ) {
    score -= 3;
    issues.push({
      type: "typography", severity: "low",
      message: "Display-size headline with loose line height wastes vertical space",
      field: "headline",
    });
  }

  return { score: clampScore(score), issues };
}
