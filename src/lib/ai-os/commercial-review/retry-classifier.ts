// Phase 9.1 — Retry Classifier.
// Determines which subsystem should be retried based on review issues and scores.
// Pure function — deterministic, no I/O.

import type { ReviewIssue, ReviewScores, RetryRecommendation, RetryAction, IssueType } from "./types";

// Priority order for issue escalation (highest severity first)
const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high:     3,
  medium:   2,
  low:      1,
};

// Maps issue type → retry action
const TYPE_TO_ACTION: Record<IssueType, RetryAction> = {
  layout:     "rerender_layout",
  typography: "rerender_typography",
  marketing:  "rewrite_copy",
  visual:     "regenerate_image",
  brand:      "brand_fix",
};

// Maps score category → issue type (for score-driven fallback)
const SCORE_KEY_TO_TYPE: Array<{ key: keyof ReviewScores; type: IssueType }> = [
  { key: "layout",     type: "layout" },
  { key: "typography", type: "typography" },
  { key: "marketing",  type: "marketing" },
  { key: "visual",     type: "visual" },
  { key: "branding",   type: "brand" },
];

export function classifyRetry(
  issues: ReviewIssue[],
  scores: ReviewScores,
  overallScore: number,
): RetryRecommendation {
  // ── 1. Approved: no retry needed ─────────────────────────────────────────────
  if (overallScore >= 95) {
    return { action: "none", reason: "All quality thresholds met. No retry required." };
  }

  // ── 2. Find the highest-severity issue ───────────────────────────────────────
  const sorted = [...issues].sort((a, b) =>
    (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0),
  );

  // ── 3. Any critical or high issue → act on the worst offender ────────────────
  const worst = sorted[0];
  if (worst && (worst.severity === "critical" || worst.severity === "high")) {
    const action = TYPE_TO_ACTION[worst.type];
    return {
      action,
      reason: buildReason(action, worst.message),
    };
  }

  // ── 4. No critical/high issues: find the lowest-scoring category ─────────────
  let lowestScore  = Infinity;
  let lowestType: IssueType = "layout";

  for (const { key, type } of SCORE_KEY_TO_TYPE) {
    if (scores[key] < lowestScore) {
      lowestScore = scores[key];
      lowestType  = type;
    }
  }

  if (lowestScore < 90) {
    const action = TYPE_TO_ACTION[lowestType];
    return {
      action,
      reason: buildReason(action, `${lowestType} score is ${lowestScore}`),
    };
  }

  // ── 5. All scores >= 90, only medium/low issues: approved with recommendation ─
  if (worst) {
    const action = TYPE_TO_ACTION[worst.type];
    return {
      action,
      reason: buildReason(action, worst.message),
    };
  }

  return { action: "none", reason: "All quality checks passed. No retry required." };
}

function buildReason(action: RetryAction, context: string): string {
  switch (action) {
    case "rerender_layout":
      return `Layout adjustment needed: ${context}. No image regeneration required.`;
    case "rerender_typography":
      return `Typography adjustment needed: ${context}. No image regeneration required.`;
    case "rewrite_copy":
      return `Copy revision needed: ${context}. No image regeneration required.`;
    case "regenerate_image":
      return `Image regeneration required: ${context}.`;
    case "brand_fix":
      return `Brand assets need updating: ${context}. No image regeneration required.`;
    case "none":
      return context;
  }
}
