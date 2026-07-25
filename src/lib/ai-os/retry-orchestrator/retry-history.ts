// Phase 9.2 — Retry History utilities.
// Tracks past retry attempts. Prevents infinite loops.
// Pure functions — deterministic, no I/O.

import type { RetryHistoryEntry, RetryStatus } from "./types";
import type { RetryAction } from "../commercial-review/types";

// After this many consecutive same-action attempts with no score improvement → loop
const LOOP_DETECTION_WINDOW = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Count helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Total number of times a given action has been attempted in the history. */
export function countActionAttempts(
  history: RetryHistoryEntry[],
  action:  RetryAction,
): number {
  return history.filter(h => h.action === action).length;
}

/** Number of consecutive identical actions at the tail of the history. */
export function countConsecutiveTail(
  history: RetryHistoryEntry[],
  action:  RetryAction,
): number {
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.action === action) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/** Score of the last recorded attempt, or null if no history. */
export function lastScore(history: RetryHistoryEntry[]): number | null {
  return history.length > 0 ? (history[history.length - 1]!.overallScore) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Loop detection (for unlimited retries)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the same action has been retried LOOP_DETECTION_WINDOW times
 * in a row with no improvement in the overall score.
 * Only meaningful for unlimited-retry actions (layout / typography).
 */
export function detectLoop(
  history: RetryHistoryEntry[],
  action:  RetryAction,
): boolean {
  if (history.length < LOOP_DETECTION_WINDOW) return false;

  const tail = history.slice(-LOOP_DETECTION_WINDOW);
  const allSameAction = tail.every(h => h.action === action);
  if (!allSameAction) return false;

  const firstScore  = tail[0]!.overallScore;
  const latestScore = tail[tail.length - 1]!.overallScore;
  // Loop if score has not improved (equal or worse) across the window
  return latestScore <= firstScore;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the retry status given the action, retry count, max retries, and history.
 * maxRetries === -1 means unlimited (only loop detection can escalate).
 */
export function resolveRetryStatus(
  action:     RetryAction,
  retryCount: number,
  maxRetries: number,
  history:    RetryHistoryEntry[],
): { status: RetryStatus; escalationReason?: string } {
  if (action === "none") {
    return { status: "no_retry_required" };
  }

  // Unlimited retry types: only loop detection can escalate
  if (maxRetries === -1) {
    if (detectLoop(history, action)) {
      return {
        status: "loop_detected",
        escalationReason:
          `${action} has been retried ${LOOP_DETECTION_WINDOW} consecutive times with no score improvement. Manual review required.`,
      };
    }
    return { status: "ready" };
  }

  // Limited retry types: check count vs limit
  if (retryCount >= maxRetries) {
    return {
      status: "max_retries_reached",
      escalationReason:
        `${action} has reached the maximum of ${maxRetries} retries. Manual review required.`,
    };
  }

  return { status: "ready" };
}

// ─────────────────────────────────────────────────────────────────────────────
// History append (immutable — returns a new array)
// ─────────────────────────────────────────────────────────────────────────────

export function appendHistoryEntry(
  history: RetryHistoryEntry[],
  entry:   RetryHistoryEntry,
): RetryHistoryEntry[] {
  return [...history, entry];
}

/** Build a new pending history entry for the current plan. */
export function buildPendingEntry(
  action:       RetryAction,
  targetModule: import("./types").RetryTargetModule,
  reason:       string,
  overallScore: number,
  issueCount:   number,
  history:      RetryHistoryEntry[],
): RetryHistoryEntry {
  return {
    attemptNumber: history.length + 1,
    action,
    targetModule,
    outcome:      "pending",
    reason,
    timestamp:    new Date(0).toISOString(), // deterministic: epoch (real timestamp set by executor)
    overallScore,
    issueCount,
  };
}
