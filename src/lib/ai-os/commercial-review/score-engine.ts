// Phase 9.1 — Score Engine.
// Computes overall score, grade, and approval status from per-category scores.
// Pure functions — deterministic, no I/O.

import type { ReviewScores, ReviewGrade, ReviewStatus } from "./types";

// Weights must sum to 1.0
const SCORE_WEIGHTS = {
  layout:     0.25,
  typography: 0.20,
  marketing:  0.25,
  visual:     0.15,
  branding:   0.15,
} as const satisfies Record<keyof ReviewScores, number>;

export function computeOverallScore(scores: ReviewScores): number {
  const raw =
    scores.layout     * SCORE_WEIGHTS.layout     +
    scores.typography * SCORE_WEIGHTS.typography +
    scores.marketing  * SCORE_WEIGHTS.marketing  +
    scores.visual     * SCORE_WEIGHTS.visual     +
    scores.branding   * SCORE_WEIGHTS.branding;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function getGrade(score: number): ReviewGrade {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  return "F";
}

export function getStatus(score: number): ReviewStatus {
  if (score >= 95) return "approved";
  if (score >= 90) return "approved_with_recommendations";
  if (score >= 80) return "retry_required";
  return "rejected";
}

export function clampScore(score: number): number {
  return Math.round(Math.min(100, Math.max(0, score)));
}
