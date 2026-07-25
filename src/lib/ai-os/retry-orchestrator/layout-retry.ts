// Phase 9.2 — Layout Retry Module.
// Extracts layout-specific context from a CommercialReview.
// Target: commercial-renderer. Retry limit: unlimited.

import type { CommercialReview } from "../commercial-review/types";
import type { LayoutRetryContext, RetryTargetModule } from "./types";

export const LAYOUT_TARGET_MODULE: RetryTargetModule = "commercial-renderer";
export const LAYOUT_MAX_RETRIES   = -1; // unlimited

export function buildLayoutRetryContext(review: CommercialReview): LayoutRetryContext {
  const layoutIssues = review.issues.filter(i => i.type === "layout");

  const collidingElements = layoutIssues
    .filter(i => i.message.toLowerCase().includes("collision") || i.message.toLowerCase().includes("overlap"))
    .map(i => i.field ?? "unknown")
    .filter((v, idx, arr) => arr.indexOf(v) === idx);

  const overflowingElements = layoutIssues
    .filter(i => i.message.toLowerCase().includes("overflow") || i.message.toLowerCase().includes("extends beyond"))
    .map(i => i.field ?? "unknown")
    .filter((v, idx, arr) => arr.indexOf(v) === idx);

  const hierarchyBroken = layoutIssues.some(
    i => i.message.toLowerCase().includes("hierarchy") && i.severity === "critical",
  );

  const safeZoneViolations = layoutIssues
    .filter(i => i.message.toLowerCase().includes("safe zone") || i.message.toLowerCase().includes("margin"))
    .map(i => i.field ?? "unknown")
    .filter((v, idx, arr) => arr.indexOf(v) === idx);

  const benefitsCrowded = layoutIssues.some(
    i => i.field === "benefits" && i.message.toLowerCase().includes("small"),
  );

  return {
    collidingElements,
    overflowingElements,
    hierarchyBroken,
    safeZoneViolations,
    benefitsCrowded,
  };
}
