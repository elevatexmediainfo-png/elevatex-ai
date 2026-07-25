// Phase 9.2 — Smart Retry Orchestrator.
// Determines the smallest possible correction for a failed commercial review.
// NEVER generates. NEVER renders. ONLY plans.

import type { CommercialReview, RetryAction }  from "../commercial-review/types";
import type { UniversalCampaignBlueprint }      from "../blueprint/types";
import type { RetryExecutionPlan, RetryContext, RetryHistoryEntry, RetryTargetModule } from "./types";

import { buildLayoutRetryContext,     LAYOUT_TARGET_MODULE,     LAYOUT_MAX_RETRIES     } from "./layout-retry";
import { buildTypographyRetryContext, TYPOGRAPHY_TARGET_MODULE, TYPOGRAPHY_MAX_RETRIES } from "./typography-retry";
import { buildCopyRetryContext,       COPY_TARGET_MODULE,       COPY_MAX_RETRIES       } from "./copy-retry";
import { buildImageRetryContext,      IMAGE_TARGET_MODULE,      IMAGE_MAX_RETRIES      } from "./image-retry";
import { buildBrandRetryContext,      BRAND_TARGET_MODULE,      BRAND_MAX_RETRIES      } from "./brand-retry";
import {
  countActionAttempts,
  resolveRetryStatus,
  buildPendingEntry,
  appendHistoryEntry,
} from "./retry-history";

// ─────────────────────────────────────────────────────────────────────────────
// Action → module mapping
// ─────────────────────────────────────────────────────────────────────────────

interface ModuleSpec {
  targetModule: RetryTargetModule;
  maxRetries:   number;
  requiresImage:      boolean;
  requiresCopy:       boolean;
  requiresTypography: boolean;
  requiresLayout:     boolean;
  requiresBrand:      boolean;
}

const MODULE_SPEC: Record<RetryAction, ModuleSpec> = {
  none: {
    targetModule:       "commercial-renderer",
    maxRetries:         0,
    requiresImage:      false,
    requiresCopy:       false,
    requiresTypography: false,
    requiresLayout:     false,
    requiresBrand:      false,
  },
  rerender_layout: {
    targetModule:       LAYOUT_TARGET_MODULE,
    maxRetries:         LAYOUT_MAX_RETRIES,
    requiresImage:      false,
    requiresCopy:       false,
    requiresTypography: false,
    requiresLayout:     true,
    requiresBrand:      false,
  },
  rerender_typography: {
    targetModule:       TYPOGRAPHY_TARGET_MODULE,
    maxRetries:         TYPOGRAPHY_MAX_RETRIES,
    requiresImage:      false,
    requiresCopy:       false,
    requiresTypography: true,
    requiresLayout:     true,  // layout must re-run after typography changes
    requiresBrand:      false,
  },
  rewrite_copy: {
    targetModule:       COPY_TARGET_MODULE,
    maxRetries:         COPY_MAX_RETRIES,
    requiresImage:      false,
    requiresCopy:       true,
    requiresTypography: true,  // copy changes affect typography sizing
    requiresLayout:     true,
    requiresBrand:      false,
  },
  regenerate_image: {
    targetModule:       IMAGE_TARGET_MODULE,
    maxRetries:         IMAGE_MAX_RETRIES,
    requiresImage:      true,
    requiresCopy:       false,
    requiresTypography: false,
    requiresLayout:     true,  // layout adjusts around the new image
    requiresBrand:      false,
  },
  brand_fix: {
    targetModule:       BRAND_TARGET_MODULE,
    maxRetries:         BRAND_MAX_RETRIES,
    requiresImage:      false,
    requiresCopy:       false,
    requiresTypography: false,
    requiresLayout:     true,  // logo position may shift
    requiresBrand:      true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Context builders
// ─────────────────────────────────────────────────────────────────────────────

function buildRetryContext(action: RetryAction, review: CommercialReview): RetryContext {
  switch (action) {
    case "rerender_layout":
      return { module: "layout",     details: buildLayoutRetryContext(review) };
    case "rerender_typography":
      return { module: "typography", details: buildTypographyRetryContext(review) };
    case "rewrite_copy":
      return { module: "copy",       details: buildCopyRetryContext(review) };
    case "regenerate_image":
      return { module: "image",      details: buildImageRetryContext(review) };
    case "brand_fix":
      return { module: "brand",      details: buildBrandRetryContext(review) };
    case "none":
      return { module: "layout",     details: { collidingElements: [], overflowingElements: [], hierarchyBroken: false, safeZoneViolations: [], benefitsCrowded: false } };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Primary orchestrator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a RetryExecutionPlan from a CommercialReview and optional prior history.
 * Pass an empty array on first run; pass the previous plan's history on subsequent runs.
 */
export function buildRetryExecutionPlan(
  review:  CommercialReview,
  history: RetryHistoryEntry[] = [],
): RetryExecutionPlan {
  const { action, reason } = review.recommendation;
  const spec               = MODULE_SPEC[action];
  const retryCount         = countActionAttempts(history, action);
  const retryContext       = buildRetryContext(action, review);

  const { status, escalationReason } = resolveRetryStatus(
    action, retryCount, spec.maxRetries, history,
  );

  // Build a pending history entry for this plan (executor stamps the real timestamp)
  const pendingEntry = buildPendingEntry(
    action,
    spec.targetModule,
    reason,
    review.overallScore,
    review.issues.length,
    history,
  );
  const updatedHistory = appendHistoryEntry(history, pendingEntry);

  const plan: RetryExecutionPlan = {
    action,
    reason,
    targetModule:        spec.targetModule,
    retryCount,
    maxRetries:          spec.maxRetries,
    requiresImage:       spec.requiresImage,
    requiresCopy:        spec.requiresCopy,
    requiresTypography:  spec.requiresTypography,
    requiresLayout:      spec.requiresLayout,
    requiresBrand:       spec.requiresBrand,
    status,
    retryContext,
    history:             updatedHistory,
    ...(escalationReason ? { escalationReason } : {}),
  };

  // Escalate: any non-ready status upgrades to manual_review_required
  if (status === "max_retries_reached" || status === "loop_detected") {
    return { ...plan, status: "manual_review_required", escalationReason };
  }

  return plan;
}

// ─────────────────────────────────────────────────────────────────────────────
// Blueprint convenience wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a RetryExecutionPlan from a full blueprint.
 * Reads blueprint.commercialReview and (if present) blueprint.retryPlan.history
 * to carry forward retry history across blueprint rebuilds.
 */
export function buildRetryPlanFromBlueprint(
  blueprint: UniversalCampaignBlueprint,
): RetryExecutionPlan {
  const review = blueprint.commercialReview;
  if (!review) {
    throw new Error("buildRetryPlanFromBlueprint: blueprint.commercialReview is missing");
  }
  // Carry over prior history if a previous retry plan exists
  const priorHistory = blueprint.retryPlan?.history ?? [];
  return buildRetryExecutionPlan(review, priorHistory);
}
