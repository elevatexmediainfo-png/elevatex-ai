// Phase 9.1 — Commercial Quality Review Engine.
// Orchestrates all sub-reviewers and produces a CommercialReview.
// NEVER edits. NEVER generates. ONLY evaluates.

import type { CommercialCompositionPlan } from "../commercial-composition/types";
import type { CommercialCopy }             from "../copy-intelligence/types";
import type { CommercialTypographyPlan }   from "../typography-intelligence/types";
import type { CommercialRenderPlan }       from "../commercial-renderer/types";
import type { CreativeStrategy }           from "../creative-brain/types";
import type { BrandIntelligence }          from "../blueprint/types";
import type { UniversalCampaignBlueprint } from "../blueprint/types";
import type { CommercialReview, ImageMetadata } from "./types";

import { reviewLayout }     from "./layout-review";
import { reviewTypography } from "./typography-review";
import { reviewMarketing }  from "./marketing-review";
import { reviewVisual }     from "./visual-review";
import { reviewBrand }      from "./brand-review";
import { classifyRetry }    from "./retry-classifier";
import {
  computeOverallScore,
  getGrade,
  getStatus,
} from "./score-engine";
import { buildRenderPlanFromBlueprint } from "../commercial-renderer/render-plan";
import { resolveCanvasSize }            from "../commercial-renderer/canvas-engine";

// ─────────────────────────────────────────────────────────────────────────────
// Primary API — works from individual components (no full Blueprint needed)
// ─────────────────────────────────────────────────────────────────────────────

export function buildCommercialReviewFromComponents(
  composition: CommercialCompositionPlan,
  copy:        CommercialCopy,
  typography:  CommercialTypographyPlan,
  renderPlan:  CommercialRenderPlan,
  strategy:    CreativeStrategy,
  brand:       BrandIntelligence,
  imageMeta?:  ImageMetadata,
): CommercialReview {
  // ── Run all sub-reviewers ────────────────────────────────────────────────────
  const layoutResult     = reviewLayout(renderPlan);
  const typographyResult = reviewTypography(typography, renderPlan);
  const marketingResult  = reviewMarketing(copy, strategy);
  const visualResult     = reviewVisual(renderPlan, composition, imageMeta);
  const brandResult      = reviewBrand(copy, brand, renderPlan, composition);

  const scores = {
    layout:     layoutResult.score,
    typography: typographyResult.score,
    marketing:  marketingResult.score,
    visual:     visualResult.score,
    branding:   brandResult.score,
  };

  const allIssues = [
    ...layoutResult.issues,
    ...typographyResult.issues,
    ...marketingResult.issues,
    ...visualResult.issues,
    ...brandResult.issues,
  ];

  const overallScore    = computeOverallScore(scores);
  const grade           = getGrade(overallScore);
  const status          = getStatus(overallScore);
  const recommendation  = classifyRetry(allIssues, scores, overallScore);

  return {
    overallScore,
    grade,
    status,
    scores,
    issues: allIssues,
    recommendation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Blueprint convenience wrapper
// ─────────────────────────────────────────────────────────────────────────────

export function buildCommercialReviewFromBlueprint(
  blueprint:   UniversalCampaignBlueprint,
  renderPlan?: CommercialRenderPlan,
  imageMeta?:  ImageMetadata,
): CommercialReview {
  const composition = blueprint.commercialComposition;
  const copy        = blueprint.commercialCopy;
  const typography  = blueprint.commercialTypography;
  const strategy    = blueprint.strategy;
  const brand       = blueprint.brand;

  if (!composition) throw new Error("buildCommercialReviewFromBlueprint: blueprint.commercialComposition is missing");
  if (!copy)        throw new Error("buildCommercialReviewFromBlueprint: blueprint.commercialCopy is missing");
  if (!typography)  throw new Error("buildCommercialReviewFromBlueprint: blueprint.commercialTypography is missing");

  const resolvedRenderPlan = renderPlan ??
    blueprint.renderPlan ??
    buildRenderPlanFromBlueprint(blueprint);

  return buildCommercialReviewFromComponents(
    composition, copy, typography,
    resolvedRenderPlan, strategy, brand,
    imageMeta,
  );
}
