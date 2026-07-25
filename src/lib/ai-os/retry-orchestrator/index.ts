// Phase 9.2 — Smart Retry Orchestrator — public exports.

export type {
  RetryExecutionPlan,
  RetryTargetModule,
  RetryStatus,
  RetryOutcome,
  RetryHistoryEntry,
  RetryContext,
  LayoutRetryContext,
  TypographyRetryContext,
  CopyRetryContext,
  ImageRetryContext,
  BrandRetryContext,
} from "./types";

export { buildRetryExecutionPlan, buildRetryPlanFromBlueprint } from "./orchestrator";
export { buildLayoutRetryContext,     LAYOUT_TARGET_MODULE,     LAYOUT_MAX_RETRIES     } from "./layout-retry";
export { buildTypographyRetryContext, TYPOGRAPHY_TARGET_MODULE, TYPOGRAPHY_MAX_RETRIES } from "./typography-retry";
export { buildCopyRetryContext,       COPY_TARGET_MODULE,       COPY_MAX_RETRIES       } from "./copy-retry";
export { buildImageRetryContext,      IMAGE_TARGET_MODULE,      IMAGE_MAX_RETRIES      } from "./image-retry";
export { buildBrandRetryContext,      BRAND_TARGET_MODULE,      BRAND_MAX_RETRIES      } from "./brand-retry";
export {
  countActionAttempts,
  countConsecutiveTail,
  lastScore,
  detectLoop,
  resolveRetryStatus,
  appendHistoryEntry,
  buildPendingEntry,
} from "./retry-history";
