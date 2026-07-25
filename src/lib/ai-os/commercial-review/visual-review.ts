// Phase 9.1 — Visual Review.
// Evaluates: logo visibility, element bounds, QR placement, image metadata alignment.
// Input: CommercialRenderPlan + optional ImageMetadata. Output: score + issues.

import type { CommercialRenderPlan } from "../commercial-renderer/types";
import type { CommercialCompositionPlan } from "../commercial-composition/types";
import type { CategoryResult, ReviewIssue, ImageMetadata } from "./types";
import { clampScore } from "./score-engine";

export function reviewVisual(
  renderPlan:  CommercialRenderPlan,
  composition: CommercialCompositionPlan,
  imageMeta?:  ImageMetadata,
): CategoryResult {
  const issues: ReviewIssue[] = [];
  let score = 100;

  const { canvas, safeZones, logo, qr, badge, headline, cta, footer } = renderPlan;

  // ── 1. Logo visibility ───────────────────────────────────────────────────────
  if (!logo) {
    score -= 8;
    issues.push({
      type: "visual", severity: "medium",
      message: "No logo region in render plan — brand identity is absent",
      field: "logo",
    });
  } else {
    if (logo.width < 40 || logo.height < 40) {
      score -= 5;
      issues.push({
        type: "visual", severity: "medium",
        message: "Logo region is too small to be recognisable",
        field: "logo",
      });
    }
  }

  // ── 2. All critical elements within canvas ────────────────────────────────────
  const criticalRegions = [
    { name: "headline", r: headline },
    { name: "cta",      r: cta },
    { name: "footer",   r: footer },
  ] as const;

  for (const { name, r } of criticalRegions) {
    if (r.x < 0 || r.y < 0) {
      score -= 8;
      issues.push({
        type: "visual", severity: "high",
        message: `${name} region has negative coordinates`,
        field: name,
      });
    }
    if (r.x + r.width > canvas.width || r.y + r.height > canvas.height) {
      score -= 8;
      issues.push({
        type: "visual", severity: "high",
        message: `${name} region extends beyond canvas boundaries`,
        field: name,
      });
    }
  }

  // ── 3. QR code placement ─────────────────────────────────────────────────────
  if (qr) {
    const outsideCanvas =
      qr.x < 0 || qr.y < 0 ||
      qr.x + qr.width > canvas.width ||
      qr.y + qr.height > canvas.height;
    if (outsideCanvas) {
      score -= 5;
      issues.push({
        type: "visual", severity: "medium",
        message: "QR code extends outside canvas — it will be clipped",
        field: "qr",
      });
    }
    if (qr.width < 60 || qr.height < 60) {
      score -= 4;
      issues.push({
        type: "visual", severity: "medium",
        message: "QR code region is too small to be scannable",
        field: "qr",
      });
    }
  }

  // ── 4. Badge placement ───────────────────────────────────────────────────────
  if (badge) {
    const outsideCanvas =
      badge.x < 0 || badge.y < 0 ||
      badge.x + badge.width > canvas.width ||
      badge.y + badge.height > canvas.height;
    if (outsideCanvas) {
      score -= 4;
      issues.push({
        type: "visual", severity: "low",
        message: "Badge extends outside canvas",
        field: "badge",
      });
    }
  }

  // ── 5. CTA region size (visible button area) ──────────────────────────────────
  if (cta.width < 100) {
    score -= 5;
    issues.push({
      type: "visual", severity: "medium",
      message: "CTA button width is too narrow for comfortable tap/click",
      field: "cta",
    });
  }
  if (cta.height < 36) {
    score -= 5;
    issues.push({
      type: "visual", severity: "medium",
      message: "CTA button height is below minimum tap target (36px)",
      field: "cta",
    });
  }

  // ── 6. Image metadata consistency ────────────────────────────────────────────
  if (!imageMeta) {
    score -= 3;
    issues.push({
      type: "visual", severity: "low",
      message: "No image metadata provided — visual quality cannot be fully verified",
    });
  } else {
    if (imageMeta.width && imageMeta.height) {
      const imgRatio = imageMeta.width / imageMeta.height;
      const canvasRatio = canvas.width / canvas.height;
      const ratioDiff = Math.abs(imgRatio - canvasRatio);
      if (ratioDiff > 0.15) {
        score -= 7;
        issues.push({
          type: "visual", severity: "medium",
          message: "Image aspect ratio does not match canvas — distortion or cropping likely",
        });
      }
    }
  }

  // ── 7. Safe zone: headline must start inside content area ─────────────────────
  const contentLeft  = safeZones.left;
  const contentRight = canvas.width - safeZones.right;
  if (headline.x < contentLeft || headline.x + headline.width > contentRight) {
    score -= 4;
    issues.push({
      type: "visual", severity: "low",
      message: "Headline exceeds horizontal safe zone margins",
      field: "headline",
    });
  }

  // ── 8. Composition grade D signal ────────────────────────────────────────────
  if (composition.compositionGrade === "D") {
    score -= 6;
    issues.push({
      type: "visual", severity: "medium",
      message: "Composition grade D — canvas is overcrowded, visual quality will suffer",
    });
  }

  // ── 9. Crowding score ────────────────────────────────────────────────────────
  if (composition.whitespace.crowdingScore > 70) {
    score -= 5;
    issues.push({
      type: "visual", severity: "medium",
      message: `High crowding score (${composition.whitespace.crowdingScore}) — whitespace is insufficient`,
    });
  } else if (composition.whitespace.crowdingScore > 50) {
    score -= 2;
    issues.push({
      type: "visual", severity: "low",
      message: `Moderate crowding score (${composition.whitespace.crowdingScore}) — consider reducing element count`,
    });
  }

  return { score: clampScore(score), issues };
}
