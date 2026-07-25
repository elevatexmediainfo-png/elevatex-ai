// Phase 9.2 — Brand Retry Module.
// Extracts brand-specific context from a CommercialReview.
// Target: brand-layer. Retry limit: 3.

import type { CommercialReview } from "../commercial-review/types";
import type { BrandRetryContext, RetryTargetModule } from "./types";

export const BRAND_TARGET_MODULE: RetryTargetModule = "brand-layer";
export const BRAND_MAX_RETRIES   = 3;

export function buildBrandRetryContext(review: CommercialReview): BrandRetryContext {
  const brandIssues = review.issues.filter(i => i.type === "brand");

  const missingLogoPlacement = brandIssues.some(
    i => i.field === "logo" && (
      i.message.toLowerCase().includes("absent") ||
      i.message.toLowerCase().includes("missing") ||
      i.message.toLowerCase().includes("no logo")
    ),
  );

  const missingDisclaimer = brandIssues.some(
    i => i.field === "disclaimer",
  );

  const incompleteBrandKit = brandIssues.some(
    i =>
      i.message.toLowerCase().includes("color") ||
      i.message.toLowerCase().includes("font"),
  );

  const conflictCount = brandIssues.filter(
    i => i.message.toLowerCase().includes("conflict"),
  ).length;

  return {
    missingLogoPlacement,
    missingDisclaimer,
    incompleteBrandKit,
    conflictCount,
  };
}
