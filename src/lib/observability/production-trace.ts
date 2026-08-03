// TEMPORARY — PRODUCTION_TRACE diagnostic instrumentation (2026-08-03).
// Added at the founder's explicit request to trace the live /create/image
// failure step-by-step on the real production site, with the REAL
// provider/error detail at every hop — never a sanitized message. Every
// line this module (or its call sites) produces is prefixed
// "PRODUCTION_TRACE" so it greps cleanly out of the logs.
//
// DELETE THIS FILE, and every PRODUCTION_TRACE call site that imports it,
// once /create/image is confirmed working on the live site. Same
// temporary-logging convention this project already used successfully for
// the Marketing Templates admin investigation (grep "TEMP_DEBUG" in git
// history for the precedent) — this is the same idea, renamed per the
// founder's own naming for this investigation.
import { randomUUID } from "crypto";

export function newTraceId(): string {
  return `REQ_${randomUUID().slice(0, 8)}`;
}

// Logs one step of an 11-step request trace. `detail` is never sanitized —
// pass the real provider/error text verbatim, including a full
// AllProvidersFailedError message (every attempt's real vendor error), not
// describeAllProvidersFailure()'s user-facing summary.
export function traceStep(
  traceId: string,
  step: string,
  status: "PASS" | "FAIL",
  durationMs: number,
  detail?: unknown
): void {
  const detailStr =
    detail === undefined
      ? ""
      : ` DETAIL=${typeof detail === "string" ? detail : JSON.stringify(detail)}`;
  console.log(`PRODUCTION_TRACE [${traceId}] STEP=${step} STATUS=${status} DURATION_MS=${durationMs}${detailStr}`);
}
