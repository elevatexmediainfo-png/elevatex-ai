// Phase 9.2 — Image Retry Module.
// Extracts visual-specific context from a CommercialReview.
// Target: image-generator. Retry limit: 2.

import type { CommercialReview } from "../commercial-review/types";
import type { ImageRetryContext, RetryTargetModule } from "./types";

export const IMAGE_TARGET_MODULE: RetryTargetModule = "image-generator";
export const IMAGE_MAX_RETRIES   = 2;

export function buildImageRetryContext(review: CommercialReview): ImageRetryContext {
  const visualIssues = review.issues.filter(i => i.type === "visual");

  const allMessages = visualIssues.map(i => i.message);

  const aspectRatioMismatch = visualIssues.some(
    i => i.message.toLowerCase().includes("aspect ratio"),
  );

  const crowdingTooHigh = review.issues.some(
    i => i.message.toLowerCase().includes("crowding") && i.severity !== "low",
  );

  return {
    visualIssues: allMessages,
    aspectRatioMismatch,
    crowdingTooHigh,
  };
}
