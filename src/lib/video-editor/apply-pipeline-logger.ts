// AI Auto-Edit Apply pipeline — structured logging (2026-08, requirement 4).
//
// Apply runs entirely client-side (the browser translates an AITimelinePlan
// into EditorCommands and dispatches them via storeApi.getState().runCommand
// — see ai-timeline-translator.ts/ai-auto-edit-panel.tsx), so there's no
// access to the server's pino-backed lib/observability/logger.ts here. This
// is the client-side equivalent: pure functions that build a structured
// event object (so tests can assert on real return values, not scrape
// console output) AND emit it to the console, matching this file's own
// stage vocabulary to the founder's own requested diagram —
//   Timeline Generated -> Timeline Translated -> Command Created ->
//   Command Executed -> Command Applied -> Saved -> Rendered
// — plus a dedicated failure event carrying Module/Reason/Stack/Affected
// clips/Rollback result on every module failure, exactly as requested.

export const APPLY_STAGES = [
  "timeline_generated",
  "timeline_translated",
  "command_created",
  "command_executed",
  "command_applied",
  "saved",
  "rendered",
] as const;
export type ApplyStage = (typeof APPLY_STAGES)[number];

// One entry per independently-executed top-level unit in the apply
// pipeline (see translateAITimelinePlan's AITimelineModuleCommand) — this
// is the granularity requirement 3's module-independence fix operates at,
// and the granularity every failure/rollback log below is reported at.
export const AI_EDIT_MODULES = ["sceneRemoval", "captions", "overlay", "zoom", "sfx", "music", "transitions"] as const;
export type AIEditModule = (typeof AI_EDIT_MODULES)[number];

export type RollbackResult = "rolled_back" | "rollback_failed" | "not_applicable";

export interface ApplyStageEvent {
  stage: ApplyStage;
  jobId?: string;
  module?: AIEditModule;
  detail?: Record<string, unknown>;
  timestamp: string;
}

export interface ApplyFailureEvent {
  module: AIEditModule;
  reason: string;
  stack?: string;
  affectedClipIds: string[];
  rollbackResult: RollbackResult;
  jobId?: string;
  timestamp: string;
}

export function logApplyStage(input: Omit<ApplyStageEvent, "timestamp">): ApplyStageEvent {
  const event: ApplyStageEvent = { ...input, timestamp: new Date().toISOString() };
  console.info(`[AI Auto-Edit] stage=${event.stage}${event.module ? ` module=${event.module}` : ""}`, event);
  return event;
}

export function logApplyFailure(input: Omit<ApplyFailureEvent, "timestamp">): ApplyFailureEvent {
  const event: ApplyFailureEvent = { ...input, timestamp: new Date().toISOString() };
  console.error(`[AI Auto-Edit] MODULE FAILURE module=${event.module} reason="${event.reason}" affectedClips=${event.affectedClipIds.length} rollback=${event.rollbackResult}`, event);
  return event;
}

// Normalizes any thrown value into {reason, stack} — every module-failure
// call site needs this, so it's centralized rather than each one
// re-deriving its own `err instanceof Error` check.
export function describeThrown(err: unknown): { reason: string; stack?: string } {
  if (err instanceof Error) return { reason: err.message, stack: err.stack };
  return { reason: typeof err === "string" ? err : "Unknown error" };
}
