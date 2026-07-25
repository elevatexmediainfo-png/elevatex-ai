// Phase 9.1 — Layout Review.
// Evaluates: safe zone compliance, hierarchy, whitespace, collision, overflow.
// Input: CommercialRenderPlan. Output: score (0–100) + issues.

import type { CommercialRenderPlan } from "../commercial-renderer/types";
import type { CategoryResult, ReviewIssue } from "./types";
import { clampScore } from "./score-engine";

export function reviewLayout(plan: CommercialRenderPlan): CategoryResult {
  const issues: ReviewIssue[] = [];
  let score = 100;

  const { canvas, safeZones, headline, cta, footer, benefits, diagnostics } = plan;

  // ── 1. Base from render-plan diagnostics (already encodes collision + overflow) ──
  // diagnostics.layoutScore is 100 − (collisions×15) − (clippedOverflows×10)
  // We blend it: layout score starts from diagnostics as foundation
  const baseDeduction = 100 - diagnostics.layoutScore;
  score -= Math.round(baseDeduction * 0.6); // apply 60% of the diagnostic penalty

  // ── 2. Element hierarchy: headline must be above CTA ─────────────────────────
  if (headline.y >= cta.y) {
    score -= 20;
    issues.push({
      type: "layout", severity: "critical",
      message: "Headline is not above CTA — visual hierarchy is broken",
      field: "headline",
    });
  }

  // ── 3. Footer within canvas ───────────────────────────────────────────────────
  if (footer.y + footer.height > canvas.height) {
    score -= 15;
    issues.push({
      type: "layout", severity: "high",
      message: "Footer extends beyond canvas bottom edge",
      field: "footer",
    });
  }

  // ── 4. CTA within canvas ──────────────────────────────────────────────────────
  if (cta.y + cta.height > canvas.height) {
    score -= 10;
    issues.push({
      type: "layout", severity: "high",
      message: "CTA button extends beyond canvas bottom edge",
      field: "cta",
    });
  }

  // ── 5. Benefits region size (whitespace / crowding) ───────────────────────────
  const benefitsMinAcceptablePx = Math.round(canvas.height * 0.05);
  if (benefits.height < benefitsMinAcceptablePx) {
    score -= 8;
    issues.push({
      type: "layout", severity: "medium",
      message: "Benefits region is too small — layout is crowded",
      field: "benefits",
    });
  } else if (benefits.overflow) {
    score -= 5;
    issues.push({
      type: "layout", severity: "medium",
      message: "Benefits text overflows its region",
      field: "benefits",
    });
  }

  // ── 6. Collision count beyond what diagnostics already captured ───────────────
  const unresolvedCollisions = diagnostics.collisions.filter(c => !c.resolved);
  if (unresolvedCollisions.length > 1) {
    score -= 5;
    issues.push({
      type: "layout", severity: "high",
      message: `${unresolvedCollisions.length} unresolved element collisions detected`,
    });
  }

  // ── 7. Clipped overflow elements ─────────────────────────────────────────────
  const clipped = diagnostics.overflows.filter(o => o.clipped);
  if (clipped.length > 0) {
    score -= clipped.length * 5;
    issues.push({
      type: "layout", severity: "medium",
      message: `Text clipping on: ${clipped.map(o => o.elementId).join(", ")}`,
    });
  }

  // ── 8. Safe zone compliance ───────────────────────────────────────────────────
  if (headline.x < safeZones.left) {
    score -= 5;
    issues.push({
      type: "layout", severity: "low",
      message: "Headline starts inside the left safe zone margin",
      field: "headline",
    });
  }

  if (headline.x + headline.width > canvas.width - safeZones.right) {
    score -= 5;
    issues.push({
      type: "layout", severity: "low",
      message: "Headline extends past the right safe zone margin",
      field: "headline",
    });
  }

  // ── 9. Composition grade D warning ───────────────────────────────────────────
  if (diagnostics.warnings.some(w => w.toLowerCase().includes("crowded"))) {
    score -= 3;
    issues.push({
      type: "layout", severity: "low",
      message: "Composition warning: canvas may be too crowded for this asset count",
    });
  }

  // ── 10. Logo in canvas bounds ─────────────────────────────────────────────────
  if (plan.logo) {
    const logo = plan.logo;
    if (
      logo.x < 0 || logo.y < 0 ||
      logo.x + logo.width > canvas.width ||
      logo.y + logo.height > canvas.height
    ) {
      score -= 8;
      issues.push({
        type: "layout", severity: "high",
        message: "Logo placement extends outside canvas bounds",
        field: "logo",
      });
    }
  }

  return { score: clampScore(score), issues };
}
