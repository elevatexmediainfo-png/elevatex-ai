// Phase 9.2 — Smart Retry Orchestrator types.
// Defines what to retry, in which module, how many times, and why.
// NEVER generates. NEVER renders. ONLY plans the smallest possible correction.

import type { RetryAction } from "../commercial-review/types";

// ─────────────────────────────────────────────────────────────────────────────
// Target module identifiers
// ─────────────────────────────────────────────────────────────────────────────

export type RetryTargetModule =
  | "commercial-renderer"      // layout issues
  | "typography-intelligence"  // typography issues
  | "copy-intelligence"        // copy / marketing issues
  | "brand-layer"              // brand identity issues
  | "image-generator";         // visual / image issues

// ─────────────────────────────────────────────────────────────────────────────
// Retry status
// ─────────────────────────────────────────────────────────────────────────────

export type RetryStatus =
  | "no_retry_required"        // review approved — nothing to fix
  | "ready"                    // retry is valid and should proceed
  | "max_retries_reached"      // retry limit hit for this action
  | "loop_detected"            // unlimited action repeated with no improvement
  | "manual_review_required";  // escalated — human intervention needed

// ─────────────────────────────────────────────────────────────────────────────
// Module-specific retry context
// ─────────────────────────────────────────────────────────────────────────────

export interface LayoutRetryContext {
  collidingElements:    string[];
  overflowingElements:  string[];
  hierarchyBroken:      boolean;
  safeZoneViolations:   string[];
  benefitsCrowded:      boolean;
}

export interface TypographyRetryContext {
  contrastIssues:       string[];
  hierarchyViolations:  string[];
  sizeIssues:           string[];
  ctaLegibilityIssue:   boolean;
}

export interface CopyRetryContext {
  missingElements:      string[];
  weakCta:              boolean;
  benefitCountIssue:    boolean;
  missingOffer:         boolean;
}

export interface ImageRetryContext {
  visualIssues:         string[];
  aspectRatioMismatch:  boolean;
  crowdingTooHigh:      boolean;
}

export interface BrandRetryContext {
  missingLogoPlacement: boolean;
  missingDisclaimer:    boolean;
  incompleteBrandKit:   boolean;
  conflictCount:        number;
}

/** Tagged-union — each module carries its own strongly typed context. */
export type RetryContext =
  | { module: "layout";     details: LayoutRetryContext }
  | { module: "typography"; details: TypographyRetryContext }
  | { module: "copy";       details: CopyRetryContext }
  | { module: "image";      details: ImageRetryContext }
  | { module: "brand";      details: BrandRetryContext };

// ─────────────────────────────────────────────────────────────────────────────
// Retry history
// ─────────────────────────────────────────────────────────────────────────────

export type RetryOutcome = "pending" | "succeeded" | "failed" | "skipped";

export interface RetryHistoryEntry {
  attemptNumber:  number;
  action:         RetryAction;
  targetModule:   RetryTargetModule;
  outcome:        RetryOutcome;
  reason:         string;
  timestamp:      string;   // ISO-8601 UTC
  overallScore:   number;   // review score at time of this attempt (for loop detection)
  issueCount:     number;   // total issues at time of attempt
}

// ─────────────────────────────────────────────────────────────────────────────
// RetryExecutionPlan — the complete output
// ─────────────────────────────────────────────────────────────────────────────

export interface RetryExecutionPlan {
  /** The retry action to execute. */
  action:             RetryAction;
  /** Human-readable reason for this retry. */
  reason:             string;
  /** Which AI-OS module owns this retry. */
  targetModule:       RetryTargetModule;
  /** Number of retries already attempted for this action. */
  retryCount:         number;
  /** Maximum allowed retries. -1 means unlimited (layout/typography). */
  maxRetries:         number;
  /** If true, the image generation step must re-run. */
  requiresImage:      boolean;
  /** If true, the copy intelligence step must re-run. */
  requiresCopy:       boolean;
  /** If true, the typography engine must re-run. */
  requiresTypography: boolean;
  /** If true, the commercial renderer must re-run. */
  requiresLayout:     boolean;
  /** If true, brand assets must be re-evaluated. */
  requiresBrand:      boolean;
  /** Current plan status. */
  status:             RetryStatus;
  /** Module-specific diagnostic context extracted from the review. */
  retryContext:       RetryContext;
  /** Full retry history for this campaign (enables loop detection and audit). */
  history:            RetryHistoryEntry[];
  /** Populated when status is max_retries_reached | loop_detected | manual_review_required. */
  escalationReason?:  string;
}
