import type { AddClipPatch, AddTransitionPatch, UpdateClipPatch, UpdateTrackPatch, UpdateTransitionPatch } from "./queries";
import type { ClipContent, ClipView, EditorAudioSubtype, EditorTrackKind, TrackView, TransitionView } from "../types";
import { DEFAULT_CLIP_TRANSFORM, DEFAULT_KEYFRAME_EASING, type ClipTransform } from "@/lib/video-editor/transform";
import type { TransitionType } from "@/lib/video-editor/transition-engine";

// Command-pattern plumbing for the Timeline's mutating operations (Module
// 2) — every operation below is performed by constructing one of these and
// calling `.execute()`, rather than calling its mutation hook directly.
// Module 5 pushes every constructed command onto ONE global undo/redo stack
// (store.tsx's `runCommand`/`pushCommand`) and is the first real caller of
// `.undo()` — see store.tsx for the stack itself; this file stays
// framework-agnostic (dependency-injected with the mutation hooks'
// `mutateAsync` functions, since hooks can't be called from a plain factory
// function).
//
// Honesty check on `.undo()` correctness: Move/Trim/Duplicate/
// ReplaceClipSource undo exactly (their prior state is trivial to capture
// and restore). Split/RippleDelete/Group/Ungroup involve server-generated
// ids or multi-row shifts and are best-effort — re-verified live in Module
// 5's verification pass (see PROJECT_STATUS.md) rather than changed, since
// each is already the best achievable outcome without a version-snapshot
// rollback (which Module 5 also adds, as a separate, exact mechanism — see
// createRestoreVersionCommand below — for when best-effort isn't enough).

export interface EditorCommand {
  label: string;
  execute: () => Promise<void>;
  undo: () => Promise<void>;
}

export interface ClipCommandDeps {
  // prunedTransitions (2026-07-16, Full Regression Pass follow-up fix) —
  // any transition the server auto-removed as a side effect of this PATCH
  // (see lib/video-editor/clips.ts's updateClip -> pruneInvalidTransitionsForTrack).
  // Move/Trim's own undo below reads this to restore a transition that was
  // only ever destroyed as a SIDE EFFECT of the position change they're
  // reversing — previously undo had no way to know one had even existed.
  updateClip: (input: { clipId: string; patch: UpdateClipPatch }) => Promise<{ clip: ClipView; prunedTransitions: TransitionView[] }>;
  deleteClip: (clipId: string) => Promise<unknown>;
  addClip: (patch: AddClipPatch) => Promise<{ clip: ClipView }>;
  splitClip: (input: { clipId: string; offsetMs: number }) => Promise<{ first: ClipView; second: ClipView }>;
  rippleDeleteClip: (clipId: string) => Promise<{ clips: ClipView[] }>;
  duplicateClip: (clipId: string) => Promise<{ clip: ClipView }>;
  replaceClipSource: (input: { clipId: string; assetId: string }) => Promise<{ clip: ClipView }>;
  groupClips: (clipIds: string[]) => Promise<{ clips: ClipView[] }>;
  ungroupClips: (clipIds: string[]) => Promise<{ clips: ClipView[] }>;
  // NOT the same as TransitionCommandDeps.addTransition below — that one
  // expects gap-free adjacent clips and performs its own ripple-shift to
  // open the overlap. This restores a transition whose clips are ALREADY
  // sitting at the exact OVERLAPPING position it needs (true here — undo
  // just repositioned them there), with no shift of its own. New server-
  // generated id (same caveat createRemoveTransitionCommand's own undo
  // already documents). Best-effort: if the clips no longer sit exactly
  // where the transition needs when this runs, it throws and the restore
  // is simply skipped, exactly as if it genuinely couldn't apply anymore.
  restoreTransition: (patch: AddTransitionPatch) => Promise<{ transition: TransitionView }>;
}

export interface ClipSpanPatch {
  startMs: number;
  durationMs: number;
  trimStartMs: number;
}

// Shared by Move/Trim's own undo below (2026-07-16, Full Regression Pass
// follow-up fix — see the two commands' own doc comments for the bug this
// closes). Re-creates each pruned transition via addTransition; best-
// effort per-transition (a transition that genuinely can't apply at the
// reverted position — e.g. something ELSE also changed in between — just
// silently fails to come back, same class of caveat every other best-
// effort undo in this file already documents), not all-or-nothing, so one
// unrestorable transition never blocks the others.
async function restorePrunedTransitions(deps: ClipCommandDeps, prunedTransitions: TransitionView[]): Promise<void> {
  for (const t of prunedTransitions) {
    try {
      await deps.restoreTransition({
        trackId: t.trackId,
        clipAId: t.clipAId,
        clipBId: t.clipBId,
        type: t.type,
        direction: t.direction ?? undefined,
        durationMs: t.durationMs,
        easing: t.easing,
      });
    } catch {
      // Best-effort — see this function's own doc comment.
    }
  }
}

// `track` (2026-07-15, cross-track drag) — optional so every existing
// same-track-move call site (horizontal drag, group-mate moves) is
// unaffected; when a clip crosses into a different track's row during a
// drag, the caller also passes the before/after trackId so execute()/
// undo() patch BOTH fields in the same server round trip, keeping "moved
// track + repositioned in time" one undo-able gesture rather than two.
// updateClip() (lib/video-editor/clips.ts) already validates the
// destination track belongs to the project and prunes any transition the
// move would invalidate on both the source and destination track — this
// command doesn't need to duplicate that, only carry the ids through.
//
// Real bug fix (2026-07-16, Full Regression Pass) — a move that broke an
// existing transition's adjacency correctly pruned it (updateClip's own
// documented side effect), but undo only ever repositioned the clip back;
// it had no idea a transition had even existed, let alone that reverting
// the move made it valid again. `execute()` now captures whatever
// updateClip's OWN response says it pruned (fresh each call — matters for
// a later redo, which re-executes and may prune again), and `undo()`
// replays them via restorePrunedTransitions AFTER repositioning the clip
// back, so a plain drag-away-and-undo restores the transition too, not
// just the clip's position.
export function createMoveClipCommand(
  deps: ClipCommandDeps,
  clipId: string,
  previousStartMs: number,
  newStartMs: number,
  track?: { previousTrackId: string; newTrackId: string }
): EditorCommand {
  let prunedByLastExecute: TransitionView[] = [];
  return {
    label: "Move Clip",
    execute: async () => {
      const { prunedTransitions } = await deps.updateClip({ clipId, patch: { startMs: newStartMs, ...(track ? { trackId: track.newTrackId } : {}) } });
      prunedByLastExecute = prunedTransitions;
    },
    undo: async () => {
      await deps.updateClip({ clipId, patch: { startMs: previousStartMs, ...(track ? { trackId: track.previousTrackId } : {}) } });
      await restorePrunedTransitions(deps, prunedByLastExecute);
    },
  };
}

// Same fix and reasoning as createMoveClipCommand above — trimming a
// clip's boundary can invalidate a transition on that same edge exactly
// the same way a move can (both go through updateClip's identical prune
// call), so it shares the identical capture-on-execute /
// restore-on-undo shape rather than duplicating a second copy of it.
export function createTrimClipCommand(
  deps: ClipCommandDeps,
  clipId: string,
  previous: ClipSpanPatch,
  next: ClipSpanPatch
): EditorCommand {
  let prunedByLastExecute: TransitionView[] = [];
  return {
    label: "Trim Clip",
    execute: async () => {
      const { prunedTransitions } = await deps.updateClip({ clipId, patch: next });
      prunedByLastExecute = prunedTransitions;
    },
    undo: async () => {
      await deps.updateClip({ clipId, patch: previous });
      await restorePrunedTransitions(deps, prunedByLastExecute);
    },
  };
}

// A plain "add one clip to an EXISTING track" command — undo simply
// deletes it. Small and easy to miss because most manual-editing add
// paths don't need it (a media-library drag either lands on an existing
// suitable track via a raw mutation call, or hits
// createAddTrackAndClipCommand below when it needs a NEW track too) — but
// the AI Auto-Editor's translator (Phase 12 Module 1) very often DOES
// need "add a clip to a track that already exists" as its own atomic,
// undo-able step (captions/broll/stickers/sfx/music all resolve to an
// existing track most of the time), and the standing rule for all of
// Phase 12 is that every AI-driven edit goes through the Command pattern
// — this fills that real, previously-unfilled gap rather than having the
// translator call deps.addClip directly (outside the pattern).
export function createAddClipCommand(deps: ClipCommandDeps, patch: AddClipPatch): EditorCommand {
  let currentClipId: string | null = null;
  return {
    label: "Add Clip",
    execute: async () => {
      const { clip } = await deps.addClip(patch);
      currentClipId = clip.id;
    },
    undo: async () => {
      if (currentClipId) await deps.deleteClip(currentClipId);
    },
  };
}

// Best-effort undo: deletes the newly-created second half and restores the
// first half's original duration. Correct as long as nothing else touched
// either half between execute() and undo().
export function createSplitClipCommand(
  deps: ClipCommandDeps,
  clipId: string,
  offsetMs: number,
  originalDurationMs: number
): EditorCommand {
  let secondId: string | null = null;
  return {
    label: "Split Clip",
    execute: async () => {
      const { second } = await deps.splitClip({ clipId, offsetMs });
      secondId = second.id;
    },
    undo: async () => {
      if (secondId) await deps.deleteClip(secondId);
      await deps.updateClip({ clipId, patch: { durationMs: originalDurationMs } });
    },
  };
}

// Best-effort undo: recreates the deleted clip (a NEW id — server-generated
// ids aren't recoverable via a normal insert) and restores every other
// track clip's pre-ripple startMs from the captured snapshot.
export function createRippleDeleteCommand(deps: ClipCommandDeps, deletedClip: ClipView, trackClipsBefore: ClipView[]): EditorCommand {
  // Real bug fix (2026-07-15, re-confirmed via fresh live testing — the
  // same root cause createDeleteClipCommand below already had) —
  // `execute` used to always target the ORIGINAL `deletedClip.id`
  // captured in this closure, but `undo` recreates the clip via
  // `addClip`, which returns a NEW server-generated id; a subsequent
  // redo (which just calls `execute` again) then tried to ripple-delete
  // an id that no longer exists, silently no-op'ing. Track the CURRENT
  // real id in a mutable local instead, updated every time `undo`
  // successfully recreates the clip.
  let currentClipId = deletedClip.id;
  return {
    label: "Ripple Delete",
    execute: async () => {
      await deps.rippleDeleteClip(currentClipId);
    },
    undo: async () => {
      const { clip } = await deps.addClip({
        trackId: deletedClip.trackId,
        assetId: deletedClip.assetId ?? undefined,
        startMs: deletedClip.startMs,
        durationMs: deletedClip.durationMs,
        trimStartMs: deletedClip.trimStartMs,
        content: (deletedClip.content as Record<string, unknown> | null) ?? undefined,
      });
      currentClipId = clip.id;
      await Promise.all(
        trackClipsBefore
          .filter((c) => c.id !== deletedClip.id)
          .map((c) => deps.updateClip({ clipId: c.id, patch: { startMs: c.startMs } }))
      );
    },
  };
}

export interface SceneRemovalSegment {
  // Repacked position on the SAME track, replacing originalClip.
  startMs: number;
  durationMs: number;
  // originalClip.trimStartMs + this segment's own offset within the
  // original clip — preserves which part of the SOURCE media each
  // surviving segment shows.
  trimStartMs: number;
}

// Phase 12 Module 1 (AI Auto-Editor) — cuts one or more unwanted windows
// (silence/filler/bad-take/etc, see ai-timeline-translator.ts's
// normalizeSceneRemovalWindows) out of a single clip in ONE atomic,
// undo-able step. Deliberately NOT a split+split+ripple-delete chain per
// window: createCompositeCommand runs its children in PARALLEL
// (Promise.all, see below), with no way to thread a split's server-
// generated second-half id into a later dependent step — sequential
// chaining would need a bespoke closure per window. Instead: delete the
// original clip and re-add each SURVIVING segment (computed by the
// translator as the complement of the removal windows) at repacked,
// gap-free positions — the exact same clean shape createRippleDeleteCommand's
// own undo already uses (delete + recreate-from-snapshot), just applied
// once to N pieces instead of one. `laterClipsOnTrack` (everything on this
// track starting at/after the original clip's end) shifts left ONCE by
// the total removed duration to close the gap.
// Phase 12 Module 4 — a zoom keyframe pair to apply to ONE surviving
// segment, already resolved to that segment's OWN clip-relative time by
// ai-timeline-translator.ts's mapZoomToSurvivingSegments (which also owns
// the "which segment does this zoom window land in, after removal"
// mapping — commands.ts stays a dumb executor, same architectural split
// as everywhere else in this file). Index-aligned with survivingSegments.
export interface SegmentZoomKeyframes {
  scaleFrom: number;
  scaleTo: number;
  startMs: number;
  endMs: number;
}

// Phase 12 Module 6 — a transition to add between two ADJACENT surviving
// segments, by INDEX (afterSegmentIndex connects survivingSegments[i] to
// survivingSegments[i+1]) — the same "can't be an independent parallel
// command" problem zoom already hit: GPT can't know real clip ids for
// segments that don't exist yet, and even a resolved index-pair would
// race createAddTransitionCommand against this command's own delete/
// recreate if run separately. Folded in here instead, applied after
// every segment is created (so both sides of the pair have real ids) —
// segments are already gap-free adjacent by construction
// (computeSurvivingSegments), exactly the precondition
// createAddTransitionCommand's own ripple-shift expects.
export interface SegmentBoundaryTransition {
  afterSegmentIndex: number;
  type: TransitionType;
  durationMs: number;
}

export function createSceneRemovalCommand(
  deps: ClipCommandDeps,
  originalClip: ClipView,
  survivingSegments: SceneRemovalSegment[],
  laterClipsOnTrack: { id: string; startMs: number }[],
  // Phase 12 Module 4 — zoom items targeting THIS SAME clip can't be a
  // separate, independent createUpdateTransformCommand run through the
  // parallel createCompositeCommand: that command would target
  // originalClip.id, which THIS command deletes as part of the same
  // batch — confirmed live (a real 500, "No record was found for an
  // update," P2025) the first time a scripted test actually exercised a
  // plan with both sceneRemoval AND zoom on the same clip. Folding the
  // zoom's transform update into THIS command's own sequential execute()
  // (applied to the newly-created segment clip, right after it's
  // created, before anything else can race it) is the same "write one
  // bespoke sequential command instead of reaching for the parallel
  // composite" fix Module 1's own doc comment already prescribes for
  // exactly this class of problem.
  zoomBySegment: (SegmentZoomKeyframes | undefined)[] = [],
  // Phase 12 Module 6 — see SegmentBoundaryTransition's own doc comment.
  // Undo needs no special handling: EditorTransition rows cascade-delete
  // (onDelete: Cascade on both clipA/clipB relations) the moment either
  // side's clip is deleted, which undo() below already does for every
  // created segment.
  segmentBoundaryTransitions: SegmentBoundaryTransition[] = [],
  transitionDeps?: TransitionCommandDeps
): EditorCommand {
  let currentOriginalId: string | null = originalClip.id;
  let createdSegmentIds: string[] = [];
  const totalShiftMs = originalClip.durationMs - survivingSegments.reduce((sum, s) => sum + s.durationMs, 0);

  return {
    label: "AI Scene Removal",
    execute: async () => {
      const targetId = currentOriginalId ?? originalClip.id;
      await deps.deleteClip(targetId);
      currentOriginalId = null;
      const created: string[] = [];
      for (let i = 0; i < survivingSegments.length; i++) {
        const seg = survivingSegments[i];
        const { clip } = await deps.addClip({
          trackId: originalClip.trackId,
          assetId: originalClip.assetId ?? undefined,
          startMs: seg.startMs,
          durationMs: seg.durationMs,
          trimStartMs: seg.trimStartMs,
          content: (originalClip.content as Record<string, unknown> | null) ?? undefined,
          transform: originalClip.transform ?? undefined,
        });
        created.push(clip.id);

        const zoom = zoomBySegment[i];
        if (zoom) {
          const previous = originalClip.transform ?? DEFAULT_CLIP_TRANSFORM;
          const next: ClipTransform = {
            ...previous,
            scale: {
              value: zoom.scaleFrom,
              keyframes: [
                { id: `ai-zoom-${clip.id}-in`, timeMs: zoom.startMs, value: zoom.scaleFrom, easing: DEFAULT_KEYFRAME_EASING },
                { id: `ai-zoom-${clip.id}-out`, timeMs: zoom.endMs, value: zoom.scaleTo, easing: DEFAULT_KEYFRAME_EASING },
              ],
            },
          };
          await deps.updateClip({ clipId: clip.id, patch: { transform: next } });
        }
      }
      createdSegmentIds = created;
      if (totalShiftMs > 0) {
        await Promise.all(laterClipsOnTrack.map((c) => deps.updateClip({ clipId: c.id, patch: { startMs: c.startMs - totalShiftMs } })));
      }
      // Runs AFTER every segment exists — both sides of any boundary
      // pair now have real ids, so this is safe as a sequential tail,
      // never a race against the creates above.
      if (transitionDeps) {
        for (const t of segmentBoundaryTransitions) {
          const clipAId = created[t.afterSegmentIndex];
          const clipBId = created[t.afterSegmentIndex + 1];
          if (!clipAId || !clipBId) continue; // out-of-range index — already warned at translate time
          await transitionDeps.addTransition({ trackId: originalClip.trackId, clipAId, clipBId, type: t.type, durationMs: t.durationMs });
        }
      }
    },
    undo: async () => {
      if (totalShiftMs > 0) {
        await Promise.all(laterClipsOnTrack.map((c) => deps.updateClip({ clipId: c.id, patch: { startMs: c.startMs } })));
      }
      await Promise.all(createdSegmentIds.map((id) => deps.deleteClip(id)));
      createdSegmentIds = [];
      const { clip } = await deps.addClip({
        trackId: originalClip.trackId,
        assetId: originalClip.assetId ?? undefined,
        startMs: originalClip.startMs,
        durationMs: originalClip.durationMs,
        trimStartMs: originalClip.trimStartMs,
        content: (originalClip.content as Record<string, unknown> | null) ?? undefined,
        transform: originalClip.transform ?? undefined,
      });
      currentOriginalId = clip.id;
    },
  };
}

// Best-effort undo, same caveat as Split/RippleDelete/Group above: recreates
// the deleted clip from its captured pre-delete snapshot (span, content,
// transform) but with a NEW server-generated id — server ids aren't
// recoverable via a normal insert. Unlike RippleDelete, a plain delete never
// shifted any OTHER clip's position, so undo only ever needs to restore this
// one clip, nothing else on the track.
//
// Known Issue #17 fix (2026-07-12) — every clip-delete entry point
// (SelectionToolbar's toolbar button, the per-clip context menu, and the
// Delete/Backspace keyboard shortcut) previously called
// `deps.deleteClip(clipId)` directly, bypassing the Command pattern
// entirely, making deletion the one Timeline mutation that was never
// undo-able. All three now construct this command instead.
//
// Real bug fix (2026-07-15, re-confirmed via fresh live testing) — this
// command had exactly the "new server-generated id after undo" gap the
// comment above already calls out as a known caveat, except it wasn't
// just a caveat: `execute` unconditionally targeted the ORIGINAL
// `deletedClip.id`, so delete -> undo -> redo silently no-op'd on redo
// (the id `undo` recreated the clip under was never the one `execute`
// tried to delete again). Confirmed live: redo's own Redo button visibly
// went from enabled to disabled (the redoStack was correctly popped) but
// the clip count never changed — the delete call itself was targeting a
// clip id that no longer existed. Fixed the same way
// createRippleDeleteCommand above now is: track the CURRENT real id in a
// mutable local, updated every time `undo` successfully recreates the
// clip, so a delete -> undo -> redo -> undo -> redo chain of any length
// always targets whichever id is actually live on the server right now.
export function createDeleteClipCommand(deps: ClipCommandDeps, deletedClip: ClipView): EditorCommand {
  let currentClipId = deletedClip.id;
  return {
    label: "Delete Clip",
    execute: async () => {
      await deps.deleteClip(currentClipId);
    },
    undo: async () => {
      const { clip } = await deps.addClip({
        trackId: deletedClip.trackId,
        assetId: deletedClip.assetId ?? undefined,
        startMs: deletedClip.startMs,
        durationMs: deletedClip.durationMs,
        trimStartMs: deletedClip.trimStartMs,
        content: (deletedClip.content as Record<string, unknown> | null) ?? undefined,
        transform: deletedClip.transform ?? undefined,
      });
      currentClipId = clip.id;
    },
  };
}

// Track reordering (2026-07-15) — the previously-tracked "reorderTracks()
// for the Layers panel" backlog item. Exact-position undo (not
// best-effort): reorderTrack() always reassigns the SAME pool of order
// values already in use to a fresh permutation (never invents new ones),
// so replaying it with the track's ORIGINAL index restores the exact
// original sequence — no "new server-generated id" caveat applies here
// the way it does for every delete-type command in this file, since
// nothing is being deleted/recreated, only reordered in place.
export interface TrackReorderDeps {
  reorderTrack: (input: { trackId: string; targetIndex: number }) => Promise<unknown>;
}

export function createReorderTrackCommand(deps: TrackReorderDeps, trackId: string, previousIndex: number, newIndex: number): EditorCommand {
  return {
    label: "Reorder Track",
    execute: async () => {
      await deps.reorderTrack({ trackId, targetIndex: newIndex });
    },
    undo: async () => {
      await deps.reorderTrack({ trackId, targetIndex: previousIndex });
    },
  };
}

// Smart track creation on drop (2026-07-12) — dropping an asset onto empty
// Timeline space (see resolveDropTrackKind in lib/video-editor/
// drop-track-resolution.ts) when no suitable track already exists creates a
// new track AND a clip on it in one gesture. Neither of the existing
// single-resource commands above can express that: it's genuinely two
// dependent server-side creates (the clip's `trackId` doesn't exist until
// the track create resolves), so this is its own command rather than a
// createCompositeCommand (which runs independent sibling commands, not a
// sequentially-dependent pair). Best-effort undo, same "new server-
// generated id" caveat as every other create-type command in this file:
// removes the clip then the track it was auto-created on — correct as long
// as nothing else was added to that track between execute() and undo().
export interface AddTrackAndClipDeps extends ClipCommandDeps {
  addTrack: (input: { kind: EditorTrackKind; audioSubtype?: EditorAudioSubtype; insertBelowOrder?: number }) => Promise<{ track: TrackView }>;
  removeTrack: (trackId: string) => Promise<unknown>;
}

export function createAddTrackAndClipCommand(
  deps: AddTrackAndClipDeps,
  trackInput: { kind: EditorTrackKind; audioSubtype?: EditorAudioSubtype; insertBelowOrder?: number },
  clipInput: Omit<AddClipPatch, "trackId">
): EditorCommand {
  let createdTrackId: string | null = null;
  let createdClipId: string | null = null;
  return {
    label: "Add Track",
    execute: async () => {
      const { track } = await deps.addTrack(trackInput);
      createdTrackId = track.id;
      const { clip } = await deps.addClip({ ...clipInput, trackId: track.id });
      createdClipId = clip.id;
    },
    undo: async () => {
      if (createdClipId) await deps.deleteClip(createdClipId);
      if (createdTrackId) await deps.removeTrack(createdTrackId);
    },
  };
}

// Phase 12 Module 4 — real bug fix, not a new feature: ai-timeline-
// translator.ts's translateCaptions() maps EVERY AICaption to its own
// independent createAddTrackAndClipCommand above when no SUBTITLE track
// exists yet, because it checks the STATIC snapshot's subtitleTrack
// (computed once, before any command runs) for each item — with N
// captions and no pre-existing track, that's N commands each racing to
// create their OWN new track, confirmed live: a real plan with 4
// captions produced 4 separate SUBTITLE tracks (one clip each) instead
// of one track with 4 clips. Same class of "genuinely dependent create"
// problem createAddTrackAndClipCommand's own doc comment already
// describes for ONE clip — this is that same fix generalized to N: the
// track is created ONCE, then every clip is added to it sequentially,
// all within one atomic, undo-able command.
export function createAddTrackWithClipsCommand(
  deps: AddTrackAndClipDeps,
  trackInput: { kind: EditorTrackKind; audioSubtype?: EditorAudioSubtype; insertBelowOrder?: number },
  clipInputs: Omit<AddClipPatch, "trackId">[]
): EditorCommand {
  let createdTrackId: string | null = null;
  let createdClipIds: string[] = [];
  return {
    label: "Add Track",
    execute: async () => {
      const { track } = await deps.addTrack(trackInput);
      createdTrackId = track.id;
      const clipIds: string[] = [];
      for (const clipInput of clipInputs) {
        const { clip } = await deps.addClip({ ...clipInput, trackId: track.id });
        clipIds.push(clip.id);
      }
      createdClipIds = clipIds;
    },
    undo: async () => {
      await Promise.all(createdClipIds.map((id) => deps.deleteClip(id)));
      createdClipIds = [];
      if (createdTrackId) await deps.removeTrack(createdTrackId);
      createdTrackId = null;
    },
  };
}

// Real bug found live (2026-07-18/19) — when the AI Auto-Editor needs to
// create BOTH a fresh SUBTITLE (captions) track AND a fresh OVERLAY
// (b-roll/stickers) track in the SAME apply, running them as two
// independent createAddTrackWithClipsCommands inside the top-level
// parallel createCompositeCommand raced for which one landed at the
// lower `order` (renders in front, see track-stacking.ts's own
// convention) — live-confirmed b-roll winning that race and covering
// captions for an overlapping time window. Promise.all gives no ordering
// guarantee between sibling promises, so no amount of array-ordering in
// ai-timeline-translator.ts's own `commands` list could have fixed this;
// it needed genuine sequencing. This command creates SUBTITLE first,
// AWAITS its real committed order, THEN creates OVERLAY via addTrack's
// insertBelowOrder param targeting that real value — captions render
// above b-roll by construction now, not by chance of scheduling.
// Deliberately builds only the "both fresh" case; ai-timeline-translator.ts
// only reaches for this when it actually applies (see its own call site).
export function createCaptionsAboveOverlayCommand(
  deps: AddTrackAndClipDeps,
  captionClipInputs: Omit<AddClipPatch, "trackId">[],
  overlayClipInputs: Omit<AddClipPatch, "trackId">[]
): EditorCommand {
  let subtitleTrackId: string | null = null;
  let subtitleClipIds: string[] = [];
  let overlayTrackId: string | null = null;
  let overlayClipIds: string[] = [];
  return {
    label: "Add Captions + B-roll",
    execute: async () => {
      let subtitleOrder: number | undefined;
      if (captionClipInputs.length > 0) {
        const { track } = await deps.addTrack({ kind: "SUBTITLE" });
        subtitleTrackId = track.id;
        subtitleOrder = track.order;
        const clipIds: string[] = [];
        for (const clipInput of captionClipInputs) {
          const { clip } = await deps.addClip({ ...clipInput, trackId: track.id });
          clipIds.push(clip.id);
        }
        subtitleClipIds = clipIds;
      }
      if (overlayClipInputs.length > 0) {
        const { track } = await deps.addTrack({ kind: "OVERLAY", insertBelowOrder: subtitleOrder });
        overlayTrackId = track.id;
        const clipIds: string[] = [];
        for (const clipInput of overlayClipInputs) {
          const { clip } = await deps.addClip({ ...clipInput, trackId: track.id });
          clipIds.push(clip.id);
        }
        overlayClipIds = clipIds;
      }
    },
    undo: async () => {
      await Promise.all([...subtitleClipIds, ...overlayClipIds].map((id) => deps.deleteClip(id)));
      subtitleClipIds = [];
      overlayClipIds = [];
      await Promise.all([subtitleTrackId, overlayTrackId].filter((id): id is string => !!id).map((id) => deps.removeTrack(id)));
      subtitleTrackId = null;
      overlayTrackId = null;
    },
  };
}

// Phase 12 Module 1 (AI Auto-Editor) — same "genuinely dependent creates"
// reasoning as createAddTrackAndClipCommand above (the clip needs the
// track's real id; ducking needs the SAME track's real id), extended by
// one more sequential step: apply the ducking fields the AI Auto-Editor's
// music-planning step decided on to the track its own clip just landed on.
// Reuses createUpdateTrackCommand's own dependency (TrackCommandDeps) and
// the exact same duckingEnabled/duckingAmountDb/duckingFadeMs/
// duckingVoiceTrackIds fields the manual Audio Ducking feature already
// added — nothing new on the ducking side, only the "create track + clip
// + ducking in one atomic step" composition is new.
export interface AddMusicTrackDeps extends AddTrackAndClipDeps, TrackCommandDeps {}

export interface MusicDuckingPatch {
  duckingEnabled: boolean;
  duckingAmountDb: number;
  duckingFadeMs: number;
  duckingVoiceTrackIds: string[];
}

export function createAddMusicTrackCommand(
  deps: AddMusicTrackDeps,
  clipInput: Omit<AddClipPatch, "trackId">,
  ducking: MusicDuckingPatch
): EditorCommand {
  let createdTrackId: string | null = null;
  let createdClipId: string | null = null;
  return {
    label: "AI Add Music Track",
    execute: async () => {
      const { track } = await deps.addTrack({ kind: "AUDIO", audioSubtype: "MUSIC" });
      createdTrackId = track.id;
      const { clip } = await deps.addClip({ ...clipInput, trackId: track.id });
      createdClipId = clip.id;
      await deps.updateTrack({ trackId: track.id, patch: ducking });
    },
    undo: async () => {
      if (createdClipId) await deps.deleteClip(createdClipId);
      if (createdTrackId) await deps.removeTrack(createdTrackId);
      createdClipId = null;
      createdTrackId = null;
    },
  };
}

export function createDuplicateClipCommand(deps: ClipCommandDeps, clipId: string): EditorCommand {
  let duplicateId: string | null = null;
  return {
    label: "Duplicate Clip",
    execute: async () => {
      const { clip } = await deps.duplicateClip(clipId);
      duplicateId = clip.id;
    },
    undo: async () => {
      if (duplicateId) await deps.deleteClip(duplicateId);
    },
  };
}

// Undo only restores a non-null previous asset — a clip Module 2 offers
// "Replace source" on always has one already (there'd be nothing to
// replace otherwise), so this covers every real case today.
export function createReplaceClipSourceCommand(
  deps: ClipCommandDeps,
  clipId: string,
  previousAssetId: string | null,
  newAssetId: string
): EditorCommand {
  return {
    label: "Replace Clip Source",
    execute: async () => {
      await deps.replaceClipSource({ clipId, assetId: newAssetId });
    },
    undo: async () => {
      if (previousAssetId) await deps.replaceClipSource({ clipId, assetId: previousAssetId });
    },
  };
}

// Best-effort undo: ungroups everything — correct for the common case
// (grouping previously-ungrouped clips); doesn't restore distinct prior
// groupings if the selection spanned multiple existing groups.
export function createGroupClipsCommand(deps: ClipCommandDeps, clipIds: string[]): EditorCommand {
  return {
    label: "Group Clips",
    execute: async () => {
      await deps.groupClips(clipIds);
    },
    undo: async () => {
      await deps.ungroupClips(clipIds);
    },
  };
}

// Undo re-groups the same clip ids under a brand-new group id — functionally
// equivalent grouping, different underlying id (same caveat as every
// delete-type undo above).
export function createUngroupClipsCommand(deps: ClipCommandDeps, clipIds: string[]): EditorCommand {
  return {
    label: "Ungroup Clips",
    execute: async () => {
      await deps.ungroupClips(clipIds);
    },
    undo: async () => {
      if (clipIds.length >= 2) await deps.groupClips(clipIds);
    },
  };
}

// Module 2 (Part A) — Lock and Resize both patch the same EditorTrack
// row, so one generic command covers both ("wire these into the existing
// commands pattern" — a track-lock toggle and a track-resize commit are
// each just a before/after UpdateTrackPatch, no dedicated factory needed
// per action).
export interface TrackCommandDeps {
  updateTrack: (input: { trackId: string; patch: UpdateTrackPatch }) => Promise<{ track: TrackView }>;
}

export function createUpdateTrackCommand(
  deps: TrackCommandDeps,
  trackId: string,
  previous: UpdateTrackPatch,
  next: UpdateTrackPatch
): EditorCommand {
  return {
    label: "Update Track",
    execute: async () => {
      await deps.updateTrack({ trackId, patch: next });
    },
    undo: async () => {
      await deps.updateTrack({ trackId, patch: previous });
    },
  };
}

// Module 4 — every Transform/Crop/Blend panel field goes through this one
// command, reusing the existing ClipCommandDeps.updateClip (the same
// generic clip-PATCH Move/Trim already use) rather than a dedicated
// per-property command — the whole ClipTransform object is sent each time
// (the panel always has the clip's current transform in memory), so undo
// is exact: restore the previous whole object.
export function createUpdateTransformCommand(
  deps: ClipCommandDeps,
  clipId: string,
  previous: ClipTransform,
  next: ClipTransform
): EditorCommand {
  return {
    label: "Update Transform",
    execute: async () => {
      await deps.updateClip({ clipId, patch: { transform: next } });
    },
    undo: async () => {
      await deps.updateClip({ clipId, patch: { transform: previous } });
    },
  };
}

// Module 5 — wraps N commands fired by one user gesture (e.g. a multi-select
// Transform edit committing one createUpdateTransformCommand per selected
// clip) into a single history-stack entry, so "Ctrl+Z always undoes the true
// last action" means the whole multi-select edit, not one clip at a time.
// Both execute() and undo() run the wrapped commands in parallel — they're
// independent per-clip mutations, so ordering between them doesn't matter.
//
// Fix (2026-08-06, FIX 6 — "composite timeline updates must become
// transactional; if one command fails, rollback everything") — execute()
// used to be a plain `Promise.all`, with NO rollback on a partial
// failure: if one sibling rejected, whatever OTHER siblings had already
// resolved stayed applied server-side with nothing to undo them (a real,
// previously-documented trade-off — see ai-auto-edit-panel.tsx's own
// handleApply catch-block comment, "Apply may have partially failed").
// Fixed via `Promise.allSettled` (not `Promise.all`): every child command
// is given a chance to actually finish — never abandoned mid-flight, so
// "which children truly succeeded" is always accurate, not a race against
// whichever one happened to reject first — then, if ANY child failed,
// every child that DID succeed is rolled back via its own real undo()
// (reverse order — same "undo the most recent thing first" convention
// every other multi-step undo() in this file already follows), and only
// THEN does this re-throw. The caller (runCommand, store.tsx) still sees
// the apply as failed and never pushes a half-applied change onto the
// undo stack — this composite is now genuinely all-or-nothing from the
// caller's perspective, matching a real transaction's semantics even
// though the underlying children are independent HTTP calls, not a real
// DB transaction. A rollback-time undo() failure is logged and skipped,
// never allowed to mask the original failure or stop rolling back the
// rest of the succeeded siblings.
export function createCompositeCommand(label: string, commands: EditorCommand[]): EditorCommand {
  return {
    label,
    execute: async () => {
      const results = await Promise.allSettled(commands.map((c) => c.execute()));
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      if (rejected.length === 0) return;

      const succeededCommands = commands.filter((_, i) => results[i].status === "fulfilled");
      for (const c of succeededCommands.slice().reverse()) {
        try {
          await c.undo();
        } catch (rollbackErr) {
          console.error(`["${label}"] rollback of a partially-applied composite command failed — a manual refresh/reload may be needed to see the true current state`, rollbackErr);
        }
      }

      const messages = rejected.map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
      throw new Error(`"${label}" failed and was rolled back (${rejected.length}/${commands.length} step(s) failed): ${messages.join("; ")}`);
    },
    undo: async () => {
      await Promise.all(commands.map((c) => c.undo()));
    },
  };
}

// Module 5 — Version History's "Restore" is itself undo-able. The server
// route auto-snapshots the CURRENT state into a fresh EditorProjectVersion
// row before swapping in the target version's content, then returns that
// row's id as `preRestoreVersionId` — undo() replays a restore back to it.
// Both directions go through the same restoreVersion deps call, so every
// restore (initial, undo, or redo) also produces its own new version row —
// consistent with the existing project-versioning convention that a restore
// is itself a new version, not a special case.
export interface VersionCommandDeps {
  restoreVersion: (versionId: string) => Promise<{ preRestoreVersionId: string }>;
}

export function createRestoreVersionCommand(
  deps: VersionCommandDeps,
  targetVersionId: string,
  preRestoreVersionId: string
): EditorCommand {
  return {
    label: "Restore Version",
    execute: async () => {
      await deps.restoreVersion(targetVersionId);
    },
    undo: async () => {
      await deps.restoreVersion(preRestoreVersionId);
    },
  };
}

// Module 7 — every Text/Subtitle style field (font, gradient, stroke,
// shadow, glow, spacing, rich-text runs, reveal, speaker, caption
// templates) goes through this one command, mirroring
// createUpdateTransformCommand's "whole object before/after" pattern
// exactly — the panel always has the clip's current `content` in memory,
// so undo is exact: restore the previous whole object.
export function createUpdateContentCommand(
  deps: ClipCommandDeps,
  clipId: string,
  previous: ClipContent | null,
  next: ClipContent
): EditorCommand {
  return {
    label: "Update Text Content",
    execute: async () => {
      await deps.updateClip({ clipId, patch: { content: next } });
    },
    undo: async () => {
      await deps.updateClip({ clipId, patch: { content: previous ?? {} } });
    },
  };
}

// Module 9 — Transitions. Add/Update/Remove each go through the Command
// pattern like every other Timeline mutation, so Ctrl+Z always covers them.
export interface TransitionCommandDeps {
  addTransition: (patch: AddTransitionPatch) => Promise<{ transition: TransitionView }>;
  updateTransition: (input: { transitionId: string; patch: UpdateTransitionPatch }) => Promise<{ transition: TransitionView }>;
  removeTransition: (transitionId: string) => Promise<unknown>;
}

// undo() removes the just-created transition, which itself restores the
// pre-transition gap-free placement (see lib/video-editor/transitions.ts's
// removeTransition — the exact inverse ripple-shift of addTransition).
export function createAddTransitionCommand(deps: TransitionCommandDeps, input: AddTransitionPatch): EditorCommand {
  let createdId: string | null = null;
  return {
    label: "Add Transition",
    execute: async () => {
      const { transition } = await deps.addTransition(input);
      createdId = transition.id;
    },
    undo: async () => {
      if (createdId) await deps.removeTransition(createdId);
    },
  };
}

// Resize (durationMs) and/or re-pick (type/direction/easing) — the panel/
// drag handle always has the transition's current values in memory, so
// undo is exact: restore the previous whole patch, mirroring
// createUpdateTrackCommand's pattern.
export function createUpdateTransitionCommand(
  deps: TransitionCommandDeps,
  transitionId: string,
  previous: UpdateTransitionPatch,
  next: UpdateTransitionPatch
): EditorCommand {
  return {
    label: "Update Transition",
    execute: async () => {
      await deps.updateTransition({ transitionId, patch: next });
    },
    undo: async () => {
      await deps.updateTransition({ transitionId, patch: previous });
    },
  };
}

// Best-effort undo, same caveat as Split/RippleDelete/Group above: re-adds
// an equivalent transition (same clips/type/direction/duration/easing) but
// with a NEW server-generated id — server ids aren't recoverable via a
// normal insert.
export function createRemoveTransitionCommand(deps: TransitionCommandDeps, transition: TransitionView): EditorCommand {
  return {
    label: "Remove Transition",
    execute: async () => {
      await deps.removeTransition(transition.id);
    },
    undo: async () => {
      await deps.addTransition({
        trackId: transition.trackId,
        clipAId: transition.clipAId,
        clipBId: transition.clipBId,
        type: transition.type,
        direction: transition.direction ?? undefined,
        durationMs: transition.durationMs,
        easing: transition.easing,
      });
    },
  };
}
