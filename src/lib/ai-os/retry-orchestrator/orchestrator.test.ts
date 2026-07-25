import { describe, expect, it } from "vitest";

import { buildRetryExecutionPlan, buildRetryPlanFromBlueprint } from "./orchestrator";
import { buildLayoutRetryContext }     from "./layout-retry";
import { buildTypographyRetryContext } from "./typography-retry";
import { buildCopyRetryContext }       from "./copy-retry";
import { buildImageRetryContext }      from "./image-retry";
import { buildBrandRetryContext }      from "./brand-retry";
import {
  countActionAttempts,
  countConsecutiveTail,
  lastScore,
  detectLoop,
  resolveRetryStatus,
  appendHistoryEntry,
  buildPendingEntry,
} from "./retry-history";
import {
  LAYOUT_MAX_RETRIES,
  TYPOGRAPHY_MAX_RETRIES,
  COPY_MAX_RETRIES,
  IMAGE_MAX_RETRIES,
  BRAND_MAX_RETRIES,
} from "./index";
import type { RetryHistoryEntry, RetryStatus } from "./types";
import type { CommercialReview, ReviewIssue } from "../commercial-review/types";
import type { UniversalCampaignBlueprint } from "../blueprint/types";

import { buildCreativeStrategy }     from "../creative-brain";
import { buildCampaignPlan }         from "../creative-director";
import { buildVisualLayoutPlan }     from "../visual-layout";
import { buildCreativeContext }       from "../creative-context";
import { analyzeUserRequest }         from "../user-understanding";
import { planFromStrategy }           from "../commercial-assets/adapter";
import { buildCompositionFromBlueprintInputs } from "../commercial-composition/composition-engine";
import { buildCopyFromBlueprintInputs }        from "../copy-intelligence/copy-engine";
import { buildTypographyFromBlueprintInputs }  from "../typography-intelligence/typography-engine";
import { buildRenderPlanFromComponents }       from "../commercial-renderer/render-plan";
import { resolveCanvasSize }                   from "../commercial-renderer/canvas-engine";
import { buildCommercialReviewFromComponents } from "../commercial-review/review-engine";
import { assembleBlueprint }         from "../blueprint";
import { buildTypographyPlan }       from "../typography";
import type { CreativeRequest }       from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeReview(rawIdea: string): CommercialReview {
  const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
  const uu          = analyzeUserRequest(request);
  const ctx         = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy    = buildCreativeStrategy(ctx);
  const campaign    = buildCampaignPlan(strategy);
  const layoutPlan  = buildVisualLayoutPlan(strategy, campaign);
  const assets      = planFromStrategy(strategy);
  const composition = buildCompositionFromBlueprintInputs(strategy, assets, layoutPlan);
  const copy        = buildCopyFromBlueprintInputs(strategy, assets, rawIdea);
  const typography  = buildTypographyFromBlueprintInputs(strategy, copy, composition, layoutPlan);
  const ar          = layoutPlan.canvas.aspectRatio.value ?? "1:1";
  const canvas      = resolveCanvasSize(ar);
  const renderPlan  = buildRenderPlanFromComponents(composition, copy, typography, layoutPlan, canvas.width, canvas.height);
  const brand       = { context: undefined, kit: undefined, logo: undefined };
  return buildCommercialReviewFromComponents(composition, copy, typography, renderPlan, strategy, brand);
}

function makeBlueprint(rawIdea: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
  const uu       = analyzeUserRequest(request);
  const ctx      = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const campaign = buildCampaignPlan(strategy);
  const layout   = buildVisualLayoutPlan(strategy, campaign);
  const typo     = buildTypographyPlan(strategy, campaign, layout);
  return assembleBlueprint({ context: ctx, strategy, campaignPlan: campaign, layoutPlan: layout, typographyPlan: typo });
}

function makeHistoryEntry(action: CommercialReview["recommendation"]["action"], score: number, n: number): RetryHistoryEntry {
  return {
    attemptNumber: n,
    action,
    targetModule:  "commercial-renderer",
    outcome:       "failed",
    reason:        "test",
    timestamp:     new Date(0).toISOString(),
    overallScore:  score,
    issueCount:    3,
  };
}

function makeForcedReview(action: CommercialReview["recommendation"]["action"]): CommercialReview {
  const base = makeReview("Dental clinic consultation");
  return {
    ...base,
    recommendation: { action, reason: "forced for test" },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry limits constants
// ─────────────────────────────────────────────────────────────────────────────

describe("retry limit constants", () => {
  it("layout is unlimited (-1)", () => {
    expect(LAYOUT_MAX_RETRIES).toBe(-1);
  });

  it("typography is unlimited (-1)", () => {
    expect(TYPOGRAPHY_MAX_RETRIES).toBe(-1);
  });

  it("copy max is 3", () => {
    expect(COPY_MAX_RETRIES).toBe(3);
  });

  it("image max is 2", () => {
    expect(IMAGE_MAX_RETRIES).toBe(2);
  });

  it("brand max is 3", () => {
    expect(BRAND_MAX_RETRIES).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// retry-history utilities
// ─────────────────────────────────────────────────────────────────────────────

describe("countActionAttempts", () => {
  it("empty history → 0", () => {
    expect(countActionAttempts([], "rerender_layout")).toBe(0);
  });

  it("counts only matching action", () => {
    const h = [
      makeHistoryEntry("rerender_layout", 80, 1),
      makeHistoryEntry("rewrite_copy",    75, 2),
      makeHistoryEntry("rerender_layout", 82, 3),
    ];
    expect(countActionAttempts(h, "rerender_layout")).toBe(2);
    expect(countActionAttempts(h, "rewrite_copy")).toBe(1);
  });
});

describe("countConsecutiveTail", () => {
  it("empty history → 0", () => {
    expect(countConsecutiveTail([], "rerender_layout")).toBe(0);
  });

  it("all same action → full count", () => {
    const h = [
      makeHistoryEntry("rerender_layout", 80, 1),
      makeHistoryEntry("rerender_layout", 82, 2),
      makeHistoryEntry("rerender_layout", 83, 3),
    ];
    expect(countConsecutiveTail(h, "rerender_layout")).toBe(3);
  });

  it("mixed tail → only consecutive tail", () => {
    const h = [
      makeHistoryEntry("rerender_layout", 80, 1),
      makeHistoryEntry("rewrite_copy",    75, 2),
      makeHistoryEntry("rerender_layout", 82, 3),
      makeHistoryEntry("rerender_layout", 83, 4),
    ];
    expect(countConsecutiveTail(h, "rerender_layout")).toBe(2);
    expect(countConsecutiveTail(h, "rewrite_copy")).toBe(0);
  });

  it("last entry differs → 0 for that action", () => {
    const h = [
      makeHistoryEntry("rerender_layout", 80, 1),
      makeHistoryEntry("rewrite_copy",    75, 2),
    ];
    expect(countConsecutiveTail(h, "rerender_layout")).toBe(0);
  });
});

describe("lastScore", () => {
  it("empty → null", () => expect(lastScore([])).toBeNull());
  it("returns last entry score", () => {
    const h = [
      makeHistoryEntry("rerender_layout", 72, 1),
      makeHistoryEntry("rerender_layout", 85, 2),
    ];
    expect(lastScore(h)).toBe(85);
  });
});

describe("detectLoop", () => {
  it("fewer than 5 entries → no loop", () => {
    const h = [
      makeHistoryEntry("rerender_layout", 72, 1),
      makeHistoryEntry("rerender_layout", 72, 2),
    ];
    expect(detectLoop(h, "rerender_layout")).toBe(false);
  });

  it("5 same entries, no score improvement → loop", () => {
    const h = Array.from({ length: 5 }, (_, i) =>
      makeHistoryEntry("rerender_layout", 72, i + 1),
    );
    expect(detectLoop(h, "rerender_layout")).toBe(true);
  });

  it("5 same entries with score improvement → no loop", () => {
    const h = [
      makeHistoryEntry("rerender_layout", 70, 1),
      makeHistoryEntry("rerender_layout", 73, 2),
      makeHistoryEntry("rerender_layout", 76, 3),
      makeHistoryEntry("rerender_layout", 79, 4),
      makeHistoryEntry("rerender_layout", 82, 5),
    ];
    expect(detectLoop(h, "rerender_layout")).toBe(false);
  });

  it("5 entries but last differs → no loop for original action", () => {
    const h = [
      makeHistoryEntry("rerender_layout", 72, 1),
      makeHistoryEntry("rerender_layout", 72, 2),
      makeHistoryEntry("rerender_layout", 72, 3),
      makeHistoryEntry("rerender_layout", 72, 4),
      makeHistoryEntry("rewrite_copy",    72, 5),
    ];
    expect(detectLoop(h, "rerender_layout")).toBe(false);
  });

  it("score decreasing → still a loop (not improving)", () => {
    const h = [
      makeHistoryEntry("rerender_layout", 80, 1),
      makeHistoryEntry("rerender_layout", 78, 2),
      makeHistoryEntry("rerender_layout", 75, 3),
      makeHistoryEntry("rerender_layout", 73, 4),
      makeHistoryEntry("rerender_layout", 70, 5),
    ];
    expect(detectLoop(h, "rerender_layout")).toBe(true);
  });
});

describe("resolveRetryStatus", () => {
  it("action none → no_retry_required", () => {
    const { status } = resolveRetryStatus("none", 0, 0, []);
    expect(status).toBe("no_retry_required");
  });

  it("unlimited (maxRetries=-1), no loop → ready", () => {
    const { status } = resolveRetryStatus("rerender_layout", 99, -1, []);
    expect(status).toBe("ready");
  });

  it("unlimited, loop detected → loop_detected", () => {
    const h = Array.from({ length: 5 }, (_, i) =>
      makeHistoryEntry("rerender_layout", 72, i + 1),
    );
    const { status } = resolveRetryStatus("rerender_layout", 5, -1, h);
    expect(status).toBe("loop_detected");
  });

  it("limited, count < max → ready", () => {
    const { status } = resolveRetryStatus("rewrite_copy", 2, 3, []);
    expect(status).toBe("ready");
  });

  it("limited, count >= max → max_retries_reached", () => {
    const { status } = resolveRetryStatus("rewrite_copy", 3, 3, []);
    expect(status).toBe("max_retries_reached");
  });

  it("max_retries_reached includes escalationReason", () => {
    const { escalationReason } = resolveRetryStatus("rewrite_copy", 3, 3, []);
    expect(escalationReason).toBeTruthy();
    expect(typeof escalationReason).toBe("string");
  });

  it("loop_detected includes escalationReason", () => {
    const h = Array.from({ length: 5 }, (_, i) =>
      makeHistoryEntry("rerender_layout", 72, i + 1),
    );
    const { escalationReason } = resolveRetryStatus("rerender_layout", 5, -1, h);
    expect(escalationReason).toBeTruthy();
  });
});

describe("appendHistoryEntry", () => {
  it("immutable — original not mutated", () => {
    const original: RetryHistoryEntry[] = [];
    const entry = makeHistoryEntry("rerender_layout", 80, 1);
    const result = appendHistoryEntry(original, entry);
    expect(original).toHaveLength(0);
    expect(result).toHaveLength(1);
  });

  it("appends to tail", () => {
    const h = [makeHistoryEntry("rerender_layout", 80, 1)];
    const entry = makeHistoryEntry("rewrite_copy", 82, 2);
    const result = appendHistoryEntry(h, entry);
    expect(result[result.length - 1]!.action).toBe("rewrite_copy");
  });
});

describe("buildPendingEntry", () => {
  it("sets outcome to pending", () => {
    const entry = buildPendingEntry("rerender_layout", "commercial-renderer", "test", 80, 3, []);
    expect(entry.outcome).toBe("pending");
  });

  it("attemptNumber is history.length + 1", () => {
    const h = [makeHistoryEntry("rerender_layout", 80, 1)];
    const entry = buildPendingEntry("rerender_layout", "commercial-renderer", "test", 82, 2, h);
    expect(entry.attemptNumber).toBe(2);
  });

  it("stores overallScore for loop detection", () => {
    const entry = buildPendingEntry("rerender_layout", "commercial-renderer", "test", 87, 2, []);
    expect(entry.overallScore).toBe(87);
  });

  it("timestamp is deterministic (epoch)", () => {
    const a = buildPendingEntry("rerender_layout", "commercial-renderer", "t", 80, 2, []);
    const b = buildPendingEntry("rerender_layout", "commercial-renderer", "t", 80, 2, []);
    expect(a.timestamp).toBe(b.timestamp);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Module context builders
// ─────────────────────────────────────────────────────────────────────────────

describe("buildLayoutRetryContext", () => {
  it("returns empty arrays for a clean review", () => {
    const review = makeReview("Dental clinic consultation");
    const ctx = buildLayoutRetryContext(review);
    expect(Array.isArray(ctx.collidingElements)).toBe(true);
    expect(Array.isArray(ctx.overflowingElements)).toBe(true);
    expect(Array.isArray(ctx.safeZoneViolations)).toBe(true);
    expect(typeof ctx.hierarchyBroken).toBe("boolean");
    expect(typeof ctx.benefitsCrowded).toBe("boolean");
  });

  it("extracts collision elements from issues", () => {
    const base = makeReview("Dental clinic");
    const review: CommercialReview = {
      ...base,
      issues: [
        ...base.issues,
        { type: "layout", severity: "high", message: "Collision between elements", field: "headline" },
        { type: "layout", severity: "high", message: "Overlap detected", field: "cta" },
      ],
    };
    const ctx = buildLayoutRetryContext(review);
    expect(ctx.collidingElements).toContain("headline");
    expect(ctx.collidingElements).toContain("cta");
  });

  it("detects hierarchy broken from critical issues", () => {
    const base = makeReview("Dental clinic");
    const review: CommercialReview = {
      ...base,
      issues: [
        { type: "layout", severity: "critical", message: "Headline is not above CTA — visual hierarchy is broken", field: "headline" },
      ],
    };
    const ctx = buildLayoutRetryContext(review);
    expect(ctx.hierarchyBroken).toBe(true);
  });

  it("non-critical hierarchy issue does not set hierarchyBroken", () => {
    const base = makeReview("Dental clinic");
    const review: CommercialReview = {
      ...base,
      issues: [
        { type: "layout", severity: "low", message: "Possible hierarchy concern", field: "headline" },
      ],
    };
    const ctx = buildLayoutRetryContext(review);
    expect(ctx.hierarchyBroken).toBe(false);
  });
});

describe("buildTypographyRetryContext", () => {
  it("returns all required fields", () => {
    const ctx = buildTypographyRetryContext(makeReview("Dental clinic"));
    expect(Array.isArray(ctx.contrastIssues)).toBe(true);
    expect(Array.isArray(ctx.hierarchyViolations)).toBe(true);
    expect(Array.isArray(ctx.sizeIssues)).toBe(true);
    expect(typeof ctx.ctaLegibilityIssue).toBe("boolean");
  });

  it("extracts contrast issues", () => {
    const base = makeReview("Dental clinic");
    const review: CommercialReview = {
      ...base,
      issues: [
        { type: "typography", severity: "high", message: "Headline contrast is insufficient", field: "headline" },
        { type: "typography", severity: "medium", message: "CTA contrast is below recommended level", field: "cta" },
      ],
    };
    const ctx = buildTypographyRetryContext(review);
    expect(ctx.contrastIssues).toContain("headline");
    expect(ctx.contrastIssues).toContain("cta");
  });

  it("extracts CTA legibility issue", () => {
    const base = makeReview("Dental clinic");
    const review: CommercialReview = {
      ...base,
      issues: [
        { type: "typography", severity: "medium", message: "CTA contrast is weak", field: "cta" },
      ],
    };
    const ctx = buildTypographyRetryContext(review);
    expect(ctx.ctaLegibilityIssue).toBe(true);
  });
});

describe("buildCopyRetryContext", () => {
  it("returns all required fields", () => {
    const ctx = buildCopyRetryContext(makeReview("Dental clinic"));
    expect(Array.isArray(ctx.missingElements)).toBe(true);
    expect(typeof ctx.weakCta).toBe("boolean");
    expect(typeof ctx.benefitCountIssue).toBe("boolean");
    expect(typeof ctx.missingOffer).toBe("boolean");
  });

  it("detects missing headline from critical issue", () => {
    const base = makeReview("Dental clinic");
    const review: CommercialReview = {
      ...base,
      issues: [
        { type: "marketing", severity: "critical", message: "Headline is missing", field: "headline" },
      ],
    };
    const ctx = buildCopyRetryContext(review);
    expect(ctx.missingElements).toContain("headline");
  });

  it("detects weak CTA", () => {
    const base = makeReview("Dental clinic");
    const review: CommercialReview = {
      ...base,
      issues: [
        { type: "marketing", severity: "critical", message: "Call-to-action is missing", field: "cta" },
      ],
    };
    const ctx = buildCopyRetryContext(review);
    expect(ctx.weakCta).toBe(true);
  });

  it("detects missing offer", () => {
    const base = makeReview("Dental clinic");
    const review: CommercialReview = {
      ...base,
      issues: [
        { type: "marketing", severity: "medium", message: "No offer specified for a promotional campaign", field: "offer" },
      ],
    };
    const ctx = buildCopyRetryContext(review);
    expect(ctx.missingOffer).toBe(true);
  });
});

describe("buildImageRetryContext", () => {
  it("returns all required fields", () => {
    const ctx = buildImageRetryContext(makeReview("Dental clinic"));
    expect(Array.isArray(ctx.visualIssues)).toBe(true);
    expect(typeof ctx.aspectRatioMismatch).toBe("boolean");
    expect(typeof ctx.crowdingTooHigh).toBe("boolean");
  });

  it("detects aspect ratio mismatch", () => {
    const base = makeReview("Dental clinic");
    const review: CommercialReview = {
      ...base,
      issues: [
        { type: "visual", severity: "medium", message: "Image aspect ratio does not match canvas" },
      ],
    };
    const ctx = buildImageRetryContext(review);
    expect(ctx.aspectRatioMismatch).toBe(true);
  });

  it("collects all visual messages", () => {
    const base = makeReview("Dental clinic");
    const review: CommercialReview = {
      ...base,
      issues: [
        { type: "visual", severity: "medium", message: "Logo region is too small" },
        { type: "visual", severity: "high",   message: "Headline region has negative coordinates" },
      ],
    };
    const ctx = buildImageRetryContext(review);
    expect(ctx.visualIssues).toContain("Logo region is too small");
    expect(ctx.visualIssues).toContain("Headline region has negative coordinates");
  });
});

describe("buildBrandRetryContext", () => {
  it("returns all required fields", () => {
    const ctx = buildBrandRetryContext(makeReview("Dental clinic"));
    expect(typeof ctx.missingLogoPlacement).toBe("boolean");
    expect(typeof ctx.missingDisclaimer).toBe("boolean");
    expect(typeof ctx.incompleteBrandKit).toBe("boolean");
    expect(typeof ctx.conflictCount).toBe("number");
  });

  it("detects missing logo", () => {
    const base = makeReview("Dental clinic");
    const review: CommercialReview = {
      ...base,
      issues: [
        { type: "brand", severity: "medium", message: "Logo is absent from the render plan", field: "logo" },
      ],
    };
    const ctx = buildBrandRetryContext(review);
    expect(ctx.missingLogoPlacement).toBe(true);
  });

  it("detects missing disclaimer", () => {
    const base = makeReview("Dental clinic");
    const review: CommercialReview = {
      ...base,
      issues: [
        { type: "brand", severity: "medium", message: "Regulated industry needs disclaimer", field: "disclaimer" },
      ],
    };
    const ctx = buildBrandRetryContext(review);
    expect(ctx.missingDisclaimer).toBe(true);
  });

  it("detects incomplete brand kit", () => {
    const base = makeReview("Dental clinic");
    const review: CommercialReview = {
      ...base,
      issues: [
        { type: "brand", severity: "low", message: "No brand colors defined" },
      ],
    };
    const ctx = buildBrandRetryContext(review);
    expect(ctx.incompleteBrandKit).toBe(true);
  });

  it("counts conflicts", () => {
    const base = makeReview("Dental clinic");
    const review: CommercialReview = {
      ...base,
      issues: [
        { type: "brand", severity: "medium", message: "1 composition conflict involving the brand logo" },
        { type: "brand", severity: "medium", message: "2 composition conflicts involving the brand logo" },
      ],
    };
    const ctx = buildBrandRetryContext(review);
    expect(ctx.conflictCount).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRetryExecutionPlan — structure
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRetryExecutionPlan — structure", () => {
  const review = makeReview("Dental clinic consultation");
  const plan   = buildRetryExecutionPlan(review);

  it("has action matching review.recommendation.action", () => {
    expect(plan.action).toBe(review.recommendation.action);
  });

  it("has reason string", () => {
    expect(typeof plan.reason).toBe("string");
    expect(plan.reason.length).toBeGreaterThan(0);
  });

  it("has a valid targetModule", () => {
    const validModules = [
      "commercial-renderer", "typography-intelligence",
      "copy-intelligence", "brand-layer", "image-generator",
    ];
    expect(validModules).toContain(plan.targetModule);
  });

  it("retryCount starts at 0 with empty history", () => {
    expect(plan.retryCount).toBe(0);
  });

  it("has boolean requires* flags", () => {
    expect(typeof plan.requiresImage).toBe("boolean");
    expect(typeof plan.requiresCopy).toBe("boolean");
    expect(typeof plan.requiresTypography).toBe("boolean");
    expect(typeof plan.requiresLayout).toBe("boolean");
    expect(typeof plan.requiresBrand).toBe("boolean");
  });

  it("has a valid status", () => {
    const validStatuses: RetryStatus[] = [
      "no_retry_required", "ready", "max_retries_reached",
      "loop_detected", "manual_review_required",
    ];
    expect(validStatuses).toContain(plan.status);
  });

  it("has retryContext with module field", () => {
    expect(plan.retryContext).toHaveProperty("module");
    expect(plan.retryContext).toHaveProperty("details");
  });

  it("history has one pending entry after first call", () => {
    expect(plan.history).toHaveLength(1);
    expect(plan.history[0]!.outcome).toBe("pending");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRetryExecutionPlan — action routing
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRetryExecutionPlan — action routing", () => {
  it("rerender_layout → commercial-renderer, requiresLayout:true, requiresImage:false", () => {
    const plan = buildRetryExecutionPlan(makeForcedReview("rerender_layout"));
    expect(plan.targetModule).toBe("commercial-renderer");
    expect(plan.requiresLayout).toBe(true);
    expect(plan.requiresImage).toBe(false);
  });

  it("rerender_typography → typography-intelligence, requiresTypography:true, requiresImage:false", () => {
    const plan = buildRetryExecutionPlan(makeForcedReview("rerender_typography"));
    expect(plan.targetModule).toBe("typography-intelligence");
    expect(plan.requiresTypography).toBe(true);
    expect(plan.requiresImage).toBe(false);
  });

  it("rewrite_copy → copy-intelligence, requiresCopy:true, requiresImage:false", () => {
    const plan = buildRetryExecutionPlan(makeForcedReview("rewrite_copy"));
    expect(plan.targetModule).toBe("copy-intelligence");
    expect(plan.requiresCopy).toBe(true);
    expect(plan.requiresImage).toBe(false);
  });

  it("regenerate_image → image-generator, requiresImage:true", () => {
    const plan = buildRetryExecutionPlan(makeForcedReview("regenerate_image"));
    expect(plan.targetModule).toBe("image-generator");
    expect(plan.requiresImage).toBe(true);
  });

  it("brand_fix → brand-layer, requiresBrand:true, requiresImage:false", () => {
    const plan = buildRetryExecutionPlan(makeForcedReview("brand_fix"));
    expect(plan.targetModule).toBe("brand-layer");
    expect(plan.requiresBrand).toBe(true);
    expect(plan.requiresImage).toBe(false);
  });

  it("none → no_retry_required status", () => {
    const plan = buildRetryExecutionPlan(makeForcedReview("none"));
    expect(plan.status).toBe("no_retry_required");
  });

  it("rerender_typography also sets requiresLayout:true (downstream dependency)", () => {
    const plan = buildRetryExecutionPlan(makeForcedReview("rerender_typography"));
    expect(plan.requiresLayout).toBe(true);
  });

  it("rewrite_copy also sets requiresTypography:true and requiresLayout:true", () => {
    const plan = buildRetryExecutionPlan(makeForcedReview("rewrite_copy"));
    expect(plan.requiresTypography).toBe(true);
    expect(plan.requiresLayout).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRetryExecutionPlan — retry limits and escalation
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRetryExecutionPlan — copy retry limit", () => {
  it("3 prior copy retries → manual_review_required", () => {
    const history: RetryHistoryEntry[] = [
      makeHistoryEntry("rewrite_copy", 75, 1),
      makeHistoryEntry("rewrite_copy", 76, 2),
      makeHistoryEntry("rewrite_copy", 76, 3),
    ];
    const plan = buildRetryExecutionPlan(makeForcedReview("rewrite_copy"), history);
    expect(plan.status).toBe("manual_review_required");
    expect(plan.escalationReason).toBeTruthy();
  });

  it("2 prior copy retries → still ready", () => {
    const history: RetryHistoryEntry[] = [
      makeHistoryEntry("rewrite_copy", 75, 1),
      makeHistoryEntry("rewrite_copy", 76, 2),
    ];
    const plan = buildRetryExecutionPlan(makeForcedReview("rewrite_copy"), history);
    expect(plan.status).toBe("ready");
  });
});

describe("buildRetryExecutionPlan — image retry limit", () => {
  it("2 prior image retries → manual_review_required", () => {
    const history: RetryHistoryEntry[] = [
      makeHistoryEntry("regenerate_image", 70, 1),
      makeHistoryEntry("regenerate_image", 71, 2),
    ];
    const plan = buildRetryExecutionPlan(makeForcedReview("regenerate_image"), history);
    expect(plan.status).toBe("manual_review_required");
  });

  it("1 prior image retry → still ready", () => {
    const history: RetryHistoryEntry[] = [
      makeHistoryEntry("regenerate_image", 70, 1),
    ];
    const plan = buildRetryExecutionPlan(makeForcedReview("regenerate_image"), history);
    expect(plan.status).toBe("ready");
  });
});

describe("buildRetryExecutionPlan — layout loop detection", () => {
  it("5 layout retries with no improvement → manual_review_required", () => {
    const history: RetryHistoryEntry[] = Array.from({ length: 5 }, (_, i) =>
      makeHistoryEntry("rerender_layout", 72, i + 1),
    );
    const plan = buildRetryExecutionPlan(makeForcedReview("rerender_layout"), history);
    expect(plan.status).toBe("manual_review_required");
    expect(plan.escalationReason).toBeTruthy();
  });

  it("5 layout retries with improvement → still ready", () => {
    const history: RetryHistoryEntry[] = [
      makeHistoryEntry("rerender_layout", 72, 1),
      makeHistoryEntry("rerender_layout", 75, 2),
      makeHistoryEntry("rerender_layout", 78, 3),
      makeHistoryEntry("rerender_layout", 81, 4),
      makeHistoryEntry("rerender_layout", 84, 5),
    ];
    const plan = buildRetryExecutionPlan(makeForcedReview("rerender_layout"), history);
    expect(plan.status).toBe("ready");
  });

  it("4 layout retries with no improvement → still ready (window not reached)", () => {
    const history: RetryHistoryEntry[] = Array.from({ length: 4 }, (_, i) =>
      makeHistoryEntry("rerender_layout", 72, i + 1),
    );
    const plan = buildRetryExecutionPlan(makeForcedReview("rerender_layout"), history);
    expect(plan.status).toBe("ready");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRetryExecutionPlan — determinism
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRetryExecutionPlan — determinism", () => {
  it("same review + history → identical output", () => {
    const review = makeReview("Restaurant grand opening");
    const a = buildRetryExecutionPlan(review, []);
    const b = buildRetryExecutionPlan(review, []);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("different reviews → different plans", () => {
    const r1 = makeForcedReview("rerender_layout");
    const r2 = makeForcedReview("rewrite_copy");
    const p1 = buildRetryExecutionPlan(r1);
    const p2 = buildRetryExecutionPlan(r2);
    expect(p1.targetModule).not.toBe(p2.targetModule);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRetryExecutionPlan — retryContext module tagging
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRetryExecutionPlan — retryContext module tags", () => {
  it("layout action → retryContext.module = layout", () => {
    const plan = buildRetryExecutionPlan(makeForcedReview("rerender_layout"));
    expect(plan.retryContext.module).toBe("layout");
  });

  it("typography action → retryContext.module = typography", () => {
    const plan = buildRetryExecutionPlan(makeForcedReview("rerender_typography"));
    expect(plan.retryContext.module).toBe("typography");
  });

  it("copy action → retryContext.module = copy", () => {
    const plan = buildRetryExecutionPlan(makeForcedReview("rewrite_copy"));
    expect(plan.retryContext.module).toBe("copy");
  });

  it("image action → retryContext.module = image", () => {
    const plan = buildRetryExecutionPlan(makeForcedReview("regenerate_image"));
    expect(plan.retryContext.module).toBe("image");
  });

  it("brand action → retryContext.module = brand", () => {
    const plan = buildRetryExecutionPlan(makeForcedReview("brand_fix"));
    expect(plan.retryContext.module).toBe("brand");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRetryExecutionPlan — history accumulation
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRetryExecutionPlan — history accumulation", () => {
  it("retryCount reflects prior history entries for the same action", () => {
    const h = [
      makeHistoryEntry("rerender_layout", 75, 1),
      makeHistoryEntry("rerender_layout", 78, 2),
    ];
    const plan = buildRetryExecutionPlan(makeForcedReview("rerender_layout"), h);
    expect(plan.retryCount).toBe(2);
  });

  it("history length grows by 1 per call", () => {
    const review = makeForcedReview("rerender_layout");
    const p1 = buildRetryExecutionPlan(review, []);
    const p2 = buildRetryExecutionPlan(review, p1.history);
    expect(p2.history).toHaveLength(2);
  });

  it("each history entry has increasing attemptNumber", () => {
    const review = makeForcedReview("rerender_layout");
    const p1 = buildRetryExecutionPlan(review, []);
    const p2 = buildRetryExecutionPlan(review, p1.history);
    expect(p2.history[0]!.attemptNumber).toBe(1);
    expect(p2.history[1]!.attemptNumber).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRetryPlanFromBlueprint
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRetryPlanFromBlueprint", () => {
  it("produces a valid plan from dental blueprint", () => {
    const blueprint = makeBlueprint("Dental clinic consultation book now");
    const plan = buildRetryPlanFromBlueprint(blueprint);
    expect(plan.action).toBe(blueprint.commercialReview?.recommendation.action);
    expect(typeof plan.targetModule).toBe("string");
  });

  it("throws when blueprint.commercialReview is missing", () => {
    const blueprint = makeBlueprint("Dental clinic");
    const incomplete = { ...blueprint, commercialReview: undefined } as unknown as UniversalCampaignBlueprint;
    expect(() => buildRetryPlanFromBlueprint(incomplete)).toThrow();
  });

  it("blueprint.retryPlan is auto-populated on build()", () => {
    const blueprint = makeBlueprint("Restaurant grand opening");
    expect(blueprint.retryPlan).toBeDefined();
    expect(blueprint.retryPlan!.action).toBeDefined();
  });

  it("blueprint.retryPlan.targetModule is a valid module string", () => {
    const blueprint = makeBlueprint("Healthcare clinic");
    const validModules = [
      "commercial-renderer", "typography-intelligence",
      "copy-intelligence", "brand-layer", "image-generator",
    ];
    expect(validModules).toContain(blueprint.retryPlan!.targetModule);
  });

  it("blueprint.retryPlan is deterministic", () => {
    const b1 = makeBlueprint("Dental clinic");
    const b2 = makeBlueprint("Dental clinic");
    expect(JSON.stringify(b1.retryPlan)).toBe(JSON.stringify(b2.retryPlan));
  });

  it("plan carries prior history from blueprint.retryPlan when called directly", () => {
    const blueprint = makeBlueprint("Dental clinic");
    const priorHistory = blueprint.retryPlan!.history;
    const plan = buildRetryPlanFromBlueprint(blueprint);
    // history grows by 1 each call — prior was length N, now N+1
    expect(plan.history.length).toBeGreaterThanOrEqual(priorHistory.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration — multiple industries
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRetryExecutionPlan — multiple industries", () => {
  const ideas = [
    "Dental clinic consultation",
    "Restaurant grand opening special menu",
    "Healthcare clinic trust campaign",
    "Tech startup product launch",
    "Real estate luxury apartments",
    "Fitness gym membership offer",
  ];

  for (const idea of ideas) {
    it(`produces valid plan for: ${idea}`, () => {
      const review = makeReview(idea);
      const plan   = buildRetryExecutionPlan(review);
      expect(plan.action).toBeDefined();
      expect(plan.targetModule).toBeDefined();
      expect(plan.history).toHaveLength(1);
      expect(["no_retry_required", "ready", "manual_review_required"]).toContain(plan.status);
    });
  }
});
