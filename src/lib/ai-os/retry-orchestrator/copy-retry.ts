// Phase 9.2 — Copy Retry Module.
// Extracts copy-specific context from a CommercialReview.
// Target: copy-intelligence. Retry limit: 3.

import type { CommercialReview } from "../commercial-review/types";
import type { CopyRetryContext, RetryTargetModule } from "./types";

export const COPY_TARGET_MODULE: RetryTargetModule = "copy-intelligence";
export const COPY_MAX_RETRIES   = 3;

export function buildCopyRetryContext(review: CommercialReview): CopyRetryContext {
  const mktIssues = review.issues.filter(i => i.type === "marketing");

  const missingElements = mktIssues
    .filter(i => i.severity === "critical")
    .map(i => i.field ?? "unknown")
    .filter((v, idx, arr) => arr.indexOf(v) === idx);

  const weakCta = mktIssues.some(
    i => i.field === "cta" && (
      i.severity === "critical" ||
      i.severity === "high" ||
      i.message.toLowerCase().includes("conversion") ||
      i.message.toLowerCase().includes("missing")
    ),
  );

  const benefitCountIssue = mktIssues.some(i => i.field === "benefits");

  const missingOffer = mktIssues.some(
    i => i.field === "offer" && i.message.toLowerCase().includes("offer"),
  );

  return {
    missingElements,
    weakCta,
    benefitCountIssue,
    missingOffer,
  };
}
