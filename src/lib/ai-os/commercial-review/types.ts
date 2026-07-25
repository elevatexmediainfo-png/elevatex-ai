// Phase 9.1 — Commercial Quality Review Engine types.
// Evaluates the generated advertisement and render plan.
// NEVER edits. NEVER generates. ONLY evaluates and recommends.

// ─────────────────────────────────────────────────────────────────────────────
// Review status + grade
// ─────────────────────────────────────────────────────────────────────────────

export type ReviewStatus =
  | "approved"                      // 95+
  | "approved_with_recommendations" // 90–94
  | "retry_required"                // 80–89
  | "rejected";                     // < 80

export type ReviewGrade = "A+" | "A" | "B" | "C" | "F";

// ─────────────────────────────────────────────────────────────────────────────
// Issues
// ─────────────────────────────────────────────────────────────────────────────

export type IssueSeverity = "critical" | "high" | "medium" | "low";

export type IssueType =
  | "layout"
  | "typography"
  | "marketing"
  | "visual"
  | "brand";

export interface ReviewIssue {
  type:      IssueType;
  severity:  IssueSeverity;
  message:   string;
  /** Optional field reference for tooling (e.g. "headline", "cta", "benefits"). */
  field?:    string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scores
// ─────────────────────────────────────────────────────────────────────────────

export interface ReviewScores {
  layout:     number; // 0–100
  typography: number; // 0–100
  marketing:  number; // 0–100
  visual:     number; // 0–100
  branding:   number; // 0–100
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry recommendation
// ─────────────────────────────────────────────────────────────────────────────

export type RetryAction =
  | "none"
  | "rerender_layout"
  | "rerender_typography"
  | "rewrite_copy"
  | "regenerate_image"
  | "brand_fix";

export interface RetryRecommendation {
  action: RetryAction;
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CommercialReview — the complete output
// ─────────────────────────────────────────────────────────────────────────────

export interface CommercialReview {
  overallScore:   number;                // 0–100 weighted average
  grade:          ReviewGrade;
  status:         ReviewStatus;
  scores:         ReviewScores;
  issues:         ReviewIssue[];
  recommendation: RetryRecommendation;
}

// ─────────────────────────────────────────────────────────────────────────────
// Optional: image metadata passed from the generation step
// ─────────────────────────────────────────────────────────────────────────────

export interface ImageMetadata {
  width?:         number;
  height?:        number;
  aspectRatio?:   string;
  url?:           string;
  hasBackground?: boolean;
  dominantColor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: per-category result from each sub-reviewer
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryResult {
  score:  number;
  issues: ReviewIssue[];
}
