// Phase 9.2 — Typography Retry Module.
// Extracts typography-specific context from a CommercialReview.
// Target: typography-intelligence. Retry limit: unlimited.

import type { CommercialReview } from "../commercial-review/types";
import type { TypographyRetryContext, RetryTargetModule } from "./types";

export const TYPOGRAPHY_TARGET_MODULE: RetryTargetModule = "typography-intelligence";
export const TYPOGRAPHY_MAX_RETRIES   = -1; // unlimited

export function buildTypographyRetryContext(review: CommercialReview): TypographyRetryContext {
  const typoIssues = review.issues.filter(i => i.type === "typography");

  const contrastIssues = typoIssues
    .filter(i => i.message.toLowerCase().includes("contrast"))
    .map(i => i.field ?? "unknown")
    .filter((v, idx, arr) => arr.indexOf(v) === idx);

  const hierarchyViolations = typoIssues
    .filter(i =>
      i.message.toLowerCase().includes("hierarchy") ||
      i.message.toLowerCase().includes("importance"),
    )
    .map(i => i.field ?? "unknown")
    .filter((v, idx, arr) => arr.indexOf(v) === idx);

  const sizeIssues = typoIssues
    .filter(i => i.message.toLowerCase().includes("size"))
    .map(i => i.field ?? "unknown")
    .filter((v, idx, arr) => arr.indexOf(v) === idx);

  const ctaLegibilityIssue = typoIssues.some(
    i => i.field === "cta" && (
      i.message.toLowerCase().includes("contrast") ||
      i.message.toLowerCase().includes("size") ||
      i.message.toLowerCase().includes("multi-line")
    ),
  );

  return {
    contrastIssues,
    hierarchyViolations,
    sizeIssues,
    ctaLegibilityIssue,
  };
}
