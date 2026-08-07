// Phase 12 Module 1 (AI Auto-Editor) — Timeline JSON -> Commands
// translator. Pure and testable: given a validated AITimelinePlan, the
// project's current tracks/clips, and the same command-mutation deps
// manual editing already uses, produces ONE composite EditorCommand
// (undo-able as a single unit) plus a list of items the plan referenced
// but couldn't resolve yet (e.g. B-roll still waiting on stock search /
// generation). No live AI API calls, no execution — this only maps data
// to Commands. See ai-timeline-schema.ts (lib/validations/ai-timeline.ts)
// for the input contract and commands.ts for every constructor used here.
//
// Standing rule for all of Phase 12 (per the founder): every AI-driven
// edit executes through the EXACT SAME Command pattern manual editing
// uses — this file is that bridge. Every section below ends in a real
// call to an EXISTING commands.ts constructor, never a raw mutation call
// and never a parallel rendering/mutation path.

import {
  createAddClipCommand,
  createAddMusicTrackCommand,
  createAddTrackWithClipsCommand,
  createAddTransitionCommand,
  createCaptionsAboveOverlayCommand,
  createCompositeCommand,
  createSceneRemovalCommand,
  createUpdateTrackCommand,
  createUpdateTransformCommand,
  type AddMusicTrackDeps,
  type AddTrackAndClipDeps,
  type ClipCommandDeps,
  type EditorCommand,
  type SceneRemovalSegment,
  type SegmentBoundaryTransition,
  type SegmentZoomKeyframes,
  type TrackCommandDeps,
  type TransitionCommandDeps,
} from "./commands";
import type { AddClipPatch } from "./queries";
import type { ClipContent, ClipView, TrackView } from "../types";
import { DEFAULT_CLIP_TRANSFORM, DEFAULT_KEYFRAME_EASING, type ClipTransform } from "@/lib/video-editor/transform";
import { DEFAULT_REVEAL_CONFIG, type RichTextRun } from "@/lib/video-editor/text-style";
import {
  AI_TRANSITION_SEGMENT_PLACEHOLDER_PREFIX,
  type AIBroll,
  type AICaption,
  type AIMusic,
  type AISceneRemoval,
  type AISfx,
  type AISticker,
  type AITimelinePlan,
  type AITransitionPlan,
  type AIZoom,
} from "@/lib/validations/ai-timeline";

export interface AITimelineTranslatorDeps {
  clip: ClipCommandDeps;
  track: TrackCommandDeps;
  addTrackAndClip: AddTrackAndClipDeps;
  addMusicTrack: AddMusicTrackDeps;
  transition: TransitionCommandDeps;
}

// The translator's read-only view of "what does the project look like
// right now" — durationMs is the project's own cached total (ProjectView.
// durationMs), needed because music has no explicit timing of its own (it
// spans the whole project by design, not a per-item AI decision).
export interface AITimelineProjectSnapshot {
  tracks: TrackView[];
  clips: ClipView[];
  durationMs: number;
}

export type UnresolvedAssetSection = "broll" | "sticker" | "sfx" | "music";
export type UnresolvedAssetReason = "missing_resolved_asset_id";

export interface UnresolvedAssetItem {
  section: UnresolvedAssetSection;
  reason: UnresolvedAssetReason;
  // The original plan item, untouched — a later module resolves it (stock
  // search / generation) and re-submits, rather than this translator
  // guessing or silently dropping it.
  item: AIBroll | AISticker | AISfx | AIMusic;
}

export interface AITimelineTranslationResult {
  // null when the plan produced no commands at all (e.g. every section
  // empty, or every item unresolved) — callers should treat this as
  // "nothing to run", not construct an empty composite.
  command: EditorCommand | null;
  unresolvedAssets: UnresolvedAssetItem[];
  // Non-fatal issues that caused an item to be skipped for a reason OTHER
  // than "needs asset resolution" (e.g. a zoom/transition referencing a
  // clip id that doesn't exist in this project) — surfaced, not silently
  // dropped, matching the same "don't silently drop it" principle the
  // founder called out for unresolved B-roll specifically.
  warnings: string[];
}

// =======================================================================
// Pure helpers — each independently unit-tested.
// =======================================================================

// Sorts and merges overlapping/adjacent [startMs, endMs) windows into the
// minimal non-overlapping set. "Adjacent" (endA === startB) merges too —
// two back-to-back removal windows are functionally one continuous cut.
export function normalizeSceneRemovalWindows(windows: { startMs: number; endMs: number }[]): { startMs: number; endMs: number }[] {
  if (windows.length === 0) return [];
  const sorted = [...windows].sort((a, b) => a.startMs - b.startMs);
  const merged: { startMs: number; endMs: number }[] = [{ ...sorted[0] }];
  for (const w of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (w.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, w.endMs);
    } else {
      merged.push({ ...w });
    }
  }
  return merged;
}

// The complement of `removalWindows` within one clip's own span, repacked
// to gap-free positions starting at clip.startMs. `removalWindows` must
// already be normalized (normalizeSceneRemovalWindows) — this function
// doesn't merge, only complements.
export function computeSurvivingSegments(clip: ClipView, removalWindows: { startMs: number; endMs: number }[]): SceneRemovalSegment[] {
  const relativeWindows = removalWindows
    .map((w) => ({ startMs: Math.max(0, w.startMs - clip.startMs), endMs: Math.min(clip.durationMs, w.endMs - clip.startMs) }))
    .filter((w) => w.endMs > w.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  const segments: SceneRemovalSegment[] = [];
  let cursor = 0;
  let packedStartMs = clip.startMs;
  for (const w of relativeWindows) {
    if (w.startMs > cursor) {
      const durationMs = w.startMs - cursor;
      segments.push({ startMs: packedStartMs, durationMs, trimStartMs: clip.trimStartMs + cursor });
      packedStartMs += durationMs;
    }
    cursor = Math.max(cursor, w.endMs);
  }
  if (cursor < clip.durationMs) {
    segments.push({ startMs: packedStartMs, durationMs: clip.durationMs - cursor, trimStartMs: clip.trimStartMs + cursor });
  }
  return segments;
}

// Real bug found live (2026-07-20, launch-readiness audit) — a full AI
// Auto-Edit run that included both sceneRemoval AND music produced a
// project with real, correctly gap-free video (0 -> 2726 -> 2918 -> 3015
// -> 6412ms, exactly matching computeSurvivingSegments' own repacking)
// sitting inside a timeline that stayed at its PRE-removal length
// (14808ms) — because translateMusic (below) sized the music clip from
// `project.durationMs`, which is the Apply-time SNAPSHOT taken before
// scene removal executes, not the real post-removal length. Every
// download/preview second past the real content's end (6412ms here) was
// solid black with the music still playing underneath — confirmed via a
// real export's ffprobe (14.8s) and frame-by-frame check (frames at 7s
// and 12s both fully black; only content within the correct 0-6412ms
// range rendered). recomputeProjectDuration (server-side, runs after
// every clip mutation) wasn't the bug — it correctly takes the max
// across every clip's real end time, but MAX is only correct if every
// clip's own length is already correct, and music's never was. Fixed by
// computing the REAL effective duration (every untouched clip's own end,
// but the scene-removed clip's NEW post-removal end instead of its old
// one) and using that instead of the stale snapshot value, but only for
// music — every other translateAITimelinePlan section already reasons in
// SOURCE-relative or post-removal-mapped time, this was the one place
// still reading the raw pre-removal snapshot number.
function computeEffectiveDurationMs(
  project: AITimelineProjectSnapshot,
  removalTarget: { clip: ClipView; segments: SceneRemovalSegment[] } | null
): number {
  if (!removalTarget) return project.durationMs;
  const lastSegment = removalTarget.segments[removalTarget.segments.length - 1];
  const removedClipNewEndMs = lastSegment ? lastSegment.startMs + lastSegment.durationMs : removalTarget.clip.startMs;
  let maxEndMs = 0;
  for (const c of project.clips) {
    const endMs = c.id === removalTarget.clip.id ? removedClipNewEndMs : c.startMs + c.durationMs;
    maxEndMs = Math.max(maxEndMs, endMs);
  }
  return maxEndMs;
}

// Maps a caption's "top"/"center"/"bottom" preset onto ClipContent's own
// 0..1 fraction-of-frame `y` convention — the AI reasons about a position
// PRESET (something a text-only planning step can pick confidently), the
// translator resolves it to the real coordinate.
function resolveCaptionY(position: "top" | "center" | "bottom" | undefined): number | undefined {
  if (position === "top") return 0.1;
  if (position === "center") return 0.5;
  if (position === "bottom") return 0.85;
  return undefined;
}

function findTrackByKind(tracks: TrackView[], kind: TrackView["kind"], audioSubtype?: TrackView["audioSubtype"]): TrackView | undefined {
  return tracks.find((t) => t.kind === kind && (audioSubtype === undefined || t.audioSubtype === audioSubtype));
}

// =======================================================================
// Section translators — each returns EditorCommand[] (never executes
// anything itself) plus whatever it couldn't resolve.
// =======================================================================

// Phase 12 Module 4 — maps each AIZoom item (ORIGINAL clip, timeline-
// absolute time, same coordinate space as originalClip.startMs) onto
// whichever surviving segment(s) still contain it after scene removal —
// a zoom whose window fell entirely inside a REMOVED region has nothing
// left to zoom into and is dropped (not an error, a natural consequence
// of the removal decision — not warned). When 2+ zoom items land on the
// SAME segment, only the last one's keyframes survive
// (createUpdateTransformCommand's own pre-existing "each update computes
// `next` from a snapshot, not chained" limitation, unchanged here, just
// now reachable within one segment too) — warned, not silently dropped.
// Pure and independently testable, same as computeSurvivingSegments.
export function mapZoomToSurvivingSegments(
  originalClip: ClipView,
  survivingSegments: SceneRemovalSegment[],
  zoomItems: AIZoom[],
  warnings: string[]
): (SegmentZoomKeyframes | undefined)[] {
  const bySegment: (SegmentZoomKeyframes | undefined)[] = survivingSegments.map(() => undefined);
  for (const zoom of zoomItems) {
    const zoomRelStart = zoom.startMs - originalClip.startMs;
    const zoomRelEnd = zoom.endMs - originalClip.startMs;
    let matched = false;
    survivingSegments.forEach((seg, i) => {
      const segStart = seg.trimStartMs - originalClip.trimStartMs;
      const segEnd = segStart + seg.durationMs;
      const overlapStart = Math.max(zoomRelStart, segStart);
      const overlapEnd = Math.min(zoomRelEnd, segEnd);
      if (overlapEnd <= overlapStart) return;
      matched = true;
      if (bySegment[i]) {
        warnings.push(
          `zoom [${zoom.startMs}, ${zoom.endMs}) on clip "${zoom.clipId}" overlaps another zoom already mapped to the same surviving segment after removal — only the later one's effect is kept.`
        );
      }
      bySegment[i] = {
        scaleFrom: zoom.scaleFrom,
        scaleTo: zoom.scaleTo,
        startMs: Math.max(0, overlapStart - segStart),
        endMs: Math.min(seg.durationMs, overlapEnd - segStart),
      };
    });
    if (!matched) {
      warnings.push(`zoom [${zoom.startMs}, ${zoom.endMs}) on clip "${zoom.clipId}" fell entirely within a removed scene-removal window — skipped (nothing left to zoom into).`);
    }
  }
  return bySegment;
}

// Bugfix (2026-07-17, found via Module 6's own full-pipeline live
// verification) — captions/broll/stickers/sfx are reasoned about in
// SOURCE-relative time, exactly like sceneRemoval/zoom/transitions, but
// (unlike zoom/transitions) were never actually remapped onto the
// GAP-CLOSED post-removal timeline: a caption whose source window fell
// inside a REMOVED region still showed up at its raw, stale timeline
// position, overlapping completely different (surviving) footage —
// confirmed live via an exported frame showing a "bad take" caption
// burned in over the KEPT retake's video. Same overlap math as
// mapZoomToSurvivingSegments above, generalized to return ABSOLUTE
// timeline positions (not one clip's own local keyframe offsets), since
// the caller here places a REAL, separate clip rather than an in-place
// transform keyframe. A window can overlap more than one surviving
// segment (it straddled a removed boundary) — every overlapping piece is
// returned; the caller decides whether to keep all of them or just the
// first (captions/broll/stickers/sfx keep only the first, since
// duplicating one caption's text or one b-roll clip across a gap would
// look like a bug, not a feature — see remapAgainstSceneRemoval below).
export function mapWindowToSurvivingSegments(
  originalClip: ClipView,
  survivingSegments: SceneRemovalSegment[],
  windowStartMs: number,
  windowEndMs: number
): { startMs: number; endMs: number }[] {
  const relStart = windowStartMs - originalClip.startMs;
  const relEnd = windowEndMs - originalClip.startMs;
  const results: { startMs: number; endMs: number }[] = [];
  survivingSegments.forEach((seg) => {
    const segStart = seg.trimStartMs - originalClip.trimStartMs;
    const segEnd = segStart + seg.durationMs;
    const overlapStart = Math.max(relStart, segStart);
    const overlapEnd = Math.min(relEnd, segEnd);
    if (overlapEnd <= overlapStart) return;
    const packedOffset = overlapStart - segStart;
    results.push({
      startMs: originalClip.startMs + seg.startMs + packedOffset,
      endMs: originalClip.startMs + seg.startMs + packedOffset + (overlapEnd - overlapStart),
    });
  });
  return results;
}

// Phase 12 Module 6 — parses AI_TRANSITION_SEGMENT_PLACEHOLDER_PREFIX-
// encoded betweenClipIds (see that constant's own doc comment,
// lib/validations/ai-timeline.ts, for why transitions can't reference
// real clip ids at plan time) into segment-boundary indices, validated
// against how many surviving segments this clip's own scene removal
// actually produces. A transition using real clip ids (not this
// encoding) is left untouched for translateTransitions' own independent
// path below — this function only claims the ones it recognizes.
// Pure and independently testable, same as mapZoomToSurvivingSegments.
export function mapTransitionsToSegmentBoundaries(
  survivingSegmentCount: number,
  transitions: AITransitionPlan[],
  warnings: string[]
): { boundaryTransitions: SegmentBoundaryTransition[]; consumedIndices: Set<number> } {
  const boundaryTransitions: SegmentBoundaryTransition[] = [];
  const consumedIndices = new Set<number>();

  transitions.forEach((t, i) => {
    const [a, b] = t.betweenClipIds;
    if (!a.startsWith(AI_TRANSITION_SEGMENT_PLACEHOLDER_PREFIX) || !b.startsWith(AI_TRANSITION_SEGMENT_PLACEHOLDER_PREFIX)) {
      return; // a real-clip-id transition — not this function's concern
    }
    consumedIndices.add(i);
    // GPT is instructed to emit "__scene_segment_N__" (trailing double
    // underscore for dunder-style readability) — strip both the prefix AND
    // any trailing underscores left over from that suffix before parsing.
    const idxA = Number(a.slice(AI_TRANSITION_SEGMENT_PLACEHOLDER_PREFIX.length).replace(/_+$/, ""));
    const idxB = Number(b.slice(AI_TRANSITION_SEGMENT_PLACEHOLDER_PREFIX.length).replace(/_+$/, ""));
    if (!Number.isInteger(idxA) || !Number.isInteger(idxB) || idxB !== idxA + 1) {
      warnings.push(`transition [${a}, ${b}] doesn't reference two ADJACENT surviving segments (in order) — skipped.`);
      return;
    }
    if (idxA < 0 || idxB >= survivingSegmentCount) {
      warnings.push(`transition [${a}, ${b}] references a segment boundary that doesn't exist — only ${survivingSegmentCount} surviving segment(s) after scene removal — skipped.`);
      return;
    }
    boundaryTransitions.push({ afterSegmentIndex: idxA, type: t.type, durationMs: t.durationMs });
  });

  return { boundaryTransitions, consumedIndices };
}

function translateSceneRemoval(
  items: AISceneRemoval[],
  zoomItems: AIZoom[],
  transitionItems: AITransitionPlan[],
  project: AITimelineProjectSnapshot,
  deps: ClipCommandDeps,
  transitionDeps: TransitionCommandDeps,
  warnings: string[]
): {
  commands: EditorCommand[];
  consumedZoomClipIds: Set<string>;
  consumedTransitionIndices: Set<number>;
  removalTarget: { clip: ClipView; segments: SceneRemovalSegment[] } | null;
} {
  const consumedZoomClipIds = new Set<string>();
  const consumedTransitionIndices = new Set<number>();
  if (items.length === 0) return { commands: [], consumedZoomClipIds, consumedTransitionIndices, removalTarget: null };
  // Group by which clip each window falls within (by absolute-time
  // containment) — Module 1's supported case is removal windows against
  // a SINGLE clip per group (the common "one uploaded video = one raw
  // clip" case); a window that doesn't fall fully within any clip is
  // reported as a warning, not silently dropped.
  const byClipId = new Map<string, { clip: ClipView; windows: { startMs: number; endMs: number }[] }>();
  for (const removal of items) {
    const clip = project.clips.find((c) => removal.startMs >= c.startMs && removal.endMs <= c.startMs + c.durationMs);
    if (!clip) {
      warnings.push(`sceneRemoval [${removal.startMs}, ${removal.endMs}) (${removal.reason}) doesn't fall within any single existing clip — skipped.`);
      continue;
    }
    const entry = byClipId.get(clip.id) ?? { clip, windows: [] };
    entry.windows.push({ startMs: removal.startMs, endMs: removal.endMs });
    byClipId.set(clip.id, entry);
  }

  const commands: EditorCommand[] = [];
  // Boundary-index transitions (AI_TRANSITION_SEGMENT_PLACEHOLDER_PREFIX)
  // reference "the Nth surviving segment" with no clip identity of their
  // own — meaningful only for ONE clip's own removal. Applied to the
  // FIRST clip processed, matching this whole pipeline's already-
  // established single-source-clip scope (Module 2 onward: one uploaded
  // video per AI Auto-Edit pass). A second scene-removed clip in the same
  // plan (not producible by this app's own reasoning step today) simply
  // never sees boundary transitions — not a silent bug, just outside
  // this scope, same as every other section's documented limit.
  let isFirstClip = true;
  let removalTarget: { clip: ClipView; segments: SceneRemovalSegment[] } | null = null;
  for (const { clip, windows } of byClipId.values()) {
    const merged = normalizeSceneRemovalWindows(windows);
    const segments = computeSurvivingSegments(clip, merged);
    const totalRemovedMs = merged.reduce((sum, w) => sum + (w.endMs - w.startMs), 0);
    const laterClipsOnTrack = project.clips
      .filter((c) => c.trackId === clip.trackId && c.id !== clip.id && c.startMs >= clip.startMs + clip.durationMs)
      .map((c) => ({ id: c.id, startMs: c.startMs }));
    if (totalRemovedMs > 0) {
      // zoom items targeting THIS SAME clip can't be a separate,
      // independent command run through the parallel composite (see
      // createSceneRemovalCommand's own doc comment for the real 500
      // this caused the first time it was actually exercised) — folded
      // in here, resolved to each surviving segment's own clip-relative
      // time, and applied sequentially inside the SAME command.
      const zoomForClip = zoomItems.filter((z) => z.clipId === clip.id);
      if (zoomForClip.length > 0) consumedZoomClipIds.add(clip.id);
      const zoomBySegment = mapZoomToSurvivingSegments(clip, segments, zoomForClip, warnings);

      let boundaryTransitions: SegmentBoundaryTransition[] = [];
      if (isFirstClip) {
        const mapped = mapTransitionsToSegmentBoundaries(segments.length, transitionItems, warnings);
        boundaryTransitions = mapped.boundaryTransitions;
        mapped.consumedIndices.forEach((i) => consumedTransitionIndices.add(i));
      }
      isFirstClip = false;
      if (!removalTarget) removalTarget = { clip, segments };

      commands.push(createSceneRemovalCommand(deps, clip, segments, laterClipsOnTrack, zoomBySegment, boundaryTransitions, transitionDeps));
    }
  }
  return { commands, consumedZoomClipIds, consumedTransitionIndices, removalTarget };
}

// Fix (2026-08-07) — turns the AI's word-level highlightWords proposal
// (aiCaptionHighlightWordSchema — "word": "DON'T", "color": "#FF3B30")
// into real character-offset RichTextRuns against THIS caption's own
// text. The AI names semantics (which word, what color); this is the
// deterministic mechanics layer that finds exactly where that word sits
// — same "AI proposes, app computes the precise part" split as
// sourceWordStartIndex/sourceWordEndIndex already established for
// caption timing one layer up (resolveCaptionTiming, gpt5.provider.ts).
// Case-insensitive, first occurrence only (a word named twice in one
// short caption is rare, and highlighting only the first instance is a
// reasonable, deterministic choice rather than highlighting every
// occurrence indiscriminately). A highlight word that doesn't actually
// appear in this caption's text (can happen when an oversized caption
// was split into multiple chunks — see resolveCaptionTiming's own doc
// comment) simply produces no run for this chunk — never an error.
function resolveCaptionHighlightRuns(text: string, highlightWords: AICaption["highlightWords"]): RichTextRun[] {
  if (!highlightWords || highlightWords.length === 0) return [];
  const lowerText = text.toLowerCase();
  const runs: RichTextRun[] = [];
  for (const { word, color } of highlightWords) {
    const idx = lowerText.indexOf(word.toLowerCase());
    if (idx === -1) continue;
    runs.push({ start: idx, end: idx + word.length, color });
  }
  return runs;
}

// Pure — computes the clip inputs a set of AI captions would produce,
// with no track-resolution decision baked in. Extracted (2026-07-19) so
// the "both SUBTITLE and OVERLAY need fresh creation" coordination case
// (see createCaptionsAboveOverlayCommand's own doc comment) can build
// this same data without going through translateCaptions' own
// existing-vs-fresh-track branching, which doesn't apply there.
function buildCaptionClipInputs(items: AICaption[]): Omit<AddClipPatch, "trackId">[] {
  return items.map((caption) => {
    const reveal = caption.reveal ?? { ...DEFAULT_REVEAL_CONFIG, mode: "WORD" as const };
    const richRuns = resolveCaptionHighlightRuns(caption.text, caption.highlightWords);
    const content: ClipContent = {
      text: caption.text,
      fontFamily: caption.style?.fontFamily,
      fontSize: caption.style?.fontSize,
      fontWeight: caption.style?.fontWeight,
      color: caption.style?.color,
      y: resolveCaptionY(caption.style?.position),
      reveal,
      ...(richRuns.length > 0 ? { richRuns } : {}),
    };
    return {
      startMs: caption.startMs,
      durationMs: caption.endMs - caption.startMs,
      content: content as Record<string, unknown>,
    };
  });
}

function translateCaptions(items: AICaption[], subtitleTrack: TrackView | undefined, deps: { clip: ClipCommandDeps; addTrackAndClip: AddTrackAndClipDeps }): EditorCommand[] {
  if (items.length === 0) return [];
  const clipInputs = buildCaptionClipInputs(items);

  if (subtitleTrack) {
    // A real track already exists — every clip-add is independent
    // (targets an id that already exists and nothing else in this batch
    // touches), safe as N separate commands in the parallel composite.
    return clipInputs.map((clipInput) => createAddClipCommand(deps.clip, { ...clipInput, trackId: subtitleTrack.id }));
  }
  // No track yet — genuinely dependent creates (every clip needs the
  // SAME new track's real id), so this must be ONE sequential command,
  // never N independent createAddTrackAndClipCommands (see that command's
  // sibling createAddTrackWithClipsCommand's own doc comment for the real
  // bug this fixes: N commands would each create their OWN new track).
  return [createAddTrackWithClipsCommand(deps.addTrackAndClip, { kind: "SUBTITLE" }, clipInputs)];
}

function translateZoom(items: AIZoom[], project: AITimelineProjectSnapshot, deps: ClipCommandDeps, warnings: string[]): EditorCommand[] {
  const commands: EditorCommand[] = [];
  for (const zoom of items) {
    const clip = project.clips.find((c) => c.id === zoom.clipId);
    if (!clip) {
      warnings.push(`zoom referenced clipId "${zoom.clipId}" which doesn't exist in this project — skipped.`);
      continue;
    }
    const previous = clip.transform ?? DEFAULT_CLIP_TRANSFORM;
    // timeMs is CLIP-RELATIVE (0 = clip start) — see transform.ts's own
    // EditorKeyframe doc comment — while the AI plan's startMs/endMs are
    // absolute timeline ms like every other section, for one consistent
    // coordinate system the AI reasons in. Converted here, not upstream.
    const next: ClipTransform = {
      ...previous,
      scale: {
        value: zoom.scaleFrom,
        keyframes: [
          { id: `ai-zoom-${zoom.clipId}-in`, timeMs: Math.max(0, zoom.startMs - clip.startMs), value: zoom.scaleFrom, easing: DEFAULT_KEYFRAME_EASING },
          { id: `ai-zoom-${zoom.clipId}-out`, timeMs: Math.min(clip.durationMs, zoom.endMs - clip.startMs), value: zoom.scaleTo, easing: DEFAULT_KEYFRAME_EASING },
        ],
      },
    };
    commands.push(createUpdateTransformCommand(deps, zoom.clipId, previous, next));
  }
  return commands;
}

// Phase 12 Module 6 — real bug fix: broll (Module 5) and stickers
// (Module 1's own translateStickers, just never fed real data before
// this module) both target the OVERLAY track. Kept as two independent
// functions, each with its own createAddTrackAndClipCommand fallback,
// they'd race the EXACT SAME "N items each create their own new track"
// bug already fixed for captions/SUBTITLE (Module 4's
// createAddTrackWithClipsCommand) — just one level up, at the SECTION
// pair instead of within one section: a plan with both broll AND
// stickers and no pre-existing OVERLAY track would create TWO overlay
// tracks, one per section. Combined into one function so there's only
// ever ONE "no track yet" branch for the two sections that share a track.
// Pure — same extraction reasoning as buildCaptionClipInputs above.
function buildOverlayClipInputs(broll: AIBroll[], stickers: AISticker[], unresolved: UnresolvedAssetItem[]): Omit<AddClipPatch, "trackId">[] {
  const clipInputs: Omit<AddClipPatch, "trackId">[] = [];

  for (const broll_ of broll) {
    if (!broll_.resolvedAssetId) {
      unresolved.push({ section: "broll", reason: "missing_resolved_asset_id", item: broll_ });
      continue;
    }
    clipInputs.push({ assetId: broll_.resolvedAssetId, startMs: broll_.startMs, durationMs: broll_.endMs - broll_.startMs });
  }

  for (const sticker of stickers) {
    if (!sticker.assetId) {
      unresolved.push({ section: "sticker", reason: "missing_resolved_asset_id", item: sticker });
      continue;
    }
    const content: ClipContent = sticker.position ? { x: sticker.position.x, y: sticker.position.y } : {};
    clipInputs.push({
      assetId: sticker.assetId,
      startMs: sticker.startMs,
      durationMs: sticker.endMs - sticker.startMs,
      content: content as Record<string, unknown>,
    });
  }

  return clipInputs;
}

// Phase 12 Module 6 — real bug fix: broll (Module 5) and stickers
// (Module 1's own translateStickers, just never fed real data before
// this module) both target the OVERLAY track. Kept as two independent
// functions, each with its own createAddTrackAndClipCommand fallback,
// they'd race the EXACT SAME "N items each create their own new track"
// bug already fixed for captions/SUBTITLE (Module 4's
// createAddTrackWithClipsCommand) — just one level up, at the SECTION
// pair instead of within one section: a plan with both broll AND
// stickers and no pre-existing OVERLAY track would create TWO overlay
// tracks, one per section. Combined into one function so there's only
// ever ONE "no track yet" branch for the two sections that share a track.
//
// `insertBelowOrder` (2026-07-19) — passed through to a fresh OVERLAY
// track's creation ONLY (has no effect on the existing-track branch).
// Real bug fix: when a SUBTITLE track already exists but OVERLAY needs
// fresh creation, addTrack's default prepend-to-top would place OVERLAY
// ABOVE the pre-existing SUBTITLE track, covering captions — the caller
// (translateAITimelinePlan) passes subtitleTrack.order here specifically
// to prevent that. The "BOTH need fresh creation" case is NOT handled
// here at all — that needs genuine sequencing between the two track
// creates, which this single-section function has no way to do; see
// createCaptionsAboveOverlayCommand and this function's own call site.
// Given ALREADY-COMPUTED clip inputs (see buildOverlayClipInputs) — split
// out (2026-07-19) so translateCaptionsAndOverlay's "otherwise" branch
// below can reuse this without calling buildOverlayClipInputs a second
// time, which would double-push the SAME unresolved items (that function
// mutates its `unresolved` array as a side effect).
function buildOverlayCommands(
  clipInputs: Omit<AddClipPatch, "trackId">[],
  overlayTrack: TrackView | undefined,
  deps: { clip: ClipCommandDeps; addTrackAndClip: AddTrackAndClipDeps },
  insertBelowOrder?: number
): EditorCommand[] {
  if (clipInputs.length === 0) return [];

  if (overlayTrack) {
    // A real track already exists — every clip-add is independent, safe
    // as N separate commands (same reasoning as captions' own existing-
    // track branch).
    return clipInputs.map((clipInput) => createAddClipCommand(deps.clip, { ...clipInput, trackId: overlayTrack.id }));
  }
  // No track yet — ONE sequential command creates it and adds every
  // broll+sticker clip to it, never two independent track-creates racing.
  return [createAddTrackWithClipsCommand(deps.addTrackAndClip, { kind: "OVERLAY", insertBelowOrder }, clipInputs)];
}

// Real bug found live (2026-07-18/19) — the top-level coordination point
// for the caption/b-roll stacking-order guarantee (see
// createCaptionsAboveOverlayCommand's own doc comment, commands.ts, for
// the root mechanism). translateCaptions and buildOverlayCommands each
// independently decide "existing track vs. create fresh" — the ONE case
// neither of them can safely handle alone is "both need fresh creation
// this apply," since that requires genuine sequencing between two track
// creates, and NEITHER function's own signature carries the other
// section's track state. This function is the one place with visibility
// into BOTH `subtitleTrack` and `overlayTrack` at once, so it's the
// right (and only) place to detect that case and route around it.
function translateCaptionsAndOverlay(
  captions: AICaption[],
  broll: AIBroll[],
  stickers: AISticker[],
  subtitleTrack: TrackView | undefined,
  overlayTrack: TrackView | undefined,
  deps: { clip: ClipCommandDeps; addTrackAndClip: AddTrackAndClipDeps },
  unresolved: UnresolvedAssetItem[]
): EditorCommand[] {
  const overlayClipInputs = buildOverlayClipInputs(broll, stickers, unresolved);
  const needsFreshOverlayTrack = overlayClipInputs.length > 0 && !overlayTrack;
  const needsFreshSubtitleTrack = captions.length > 0 && !subtitleTrack;

  if (needsFreshOverlayTrack && needsFreshSubtitleTrack) {
    // Both fresh — the one case that needs real sequencing (see
    // createCaptionsAboveOverlayCommand). translateCaptions' own
    // resolveCaptionY/reveal-defaults logic is duplicated via
    // buildCaptionClipInputs (same pure function translateCaptions
    // itself calls), not reimplemented.
    return [createCaptionsAboveOverlayCommand(deps.addTrackAndClip, buildCaptionClipInputs(captions), overlayClipInputs)];
  }

  // Otherwise, at most ONE side needs fresh creation (or neither does) —
  // no ordering race is possible, so each section's own existing,
  // independent logic is safe. When overlay is the one needing fresh
  // creation and a subtitle track already exists, insertBelowOrder
  // guarantees overlay lands below it instead of the default
  // prepend-to-top (which would otherwise cover the existing captions).
  // Reuses the overlayClipInputs already computed above — calling
  // buildOverlayClipInputs a second time would double-push `unresolved`.
  return [
    ...translateCaptions(captions, subtitleTrack, deps),
    ...buildOverlayCommands(overlayClipInputs, overlayTrack, deps, needsFreshOverlayTrack ? subtitleTrack?.order : undefined),
  ];
}

const DEFAULT_SFX_DURATION_MS = 800;

// Real bug fix (mirrors buildOverlayCommands' own fix for broll+stickers,
// and Module 4's original fix for captions): N items with no existing
// track must never each independently call createAddTrackAndClipCommand
// — that races N separate "no track yet" branches into N separate new
// AUDIO/SFX tracks instead of one track with N clips. Build every clip
// input first, then branch ONCE on whether a track already exists.
function translateSfx(
  items: AISfx[],
  sfxTrack: TrackView | undefined,
  deps: { clip: ClipCommandDeps; addTrackAndClip: AddTrackAndClipDeps },
  unresolved: UnresolvedAssetItem[]
): EditorCommand[] {
  const clipInputs: Omit<AddClipPatch, "trackId">[] = [];
  for (const sfx of items) {
    if (!sfx.assetId) {
      unresolved.push({ section: "sfx", reason: "missing_resolved_asset_id", item: sfx });
      continue;
    }
    clipInputs.push({ assetId: sfx.assetId, startMs: sfx.atMs, durationMs: DEFAULT_SFX_DURATION_MS });
  }
  if (clipInputs.length === 0) return [];

  if (sfxTrack) {
    // A real track already exists — every clip-add is independent, safe
    // as N separate commands.
    return clipInputs.map((clipInput) => createAddClipCommand(deps.clip, { ...clipInput, trackId: sfxTrack.id }));
  }
  // No track yet — ONE sequential command creates it and adds every SFX
  // clip to it, never N independent track-creates racing.
  return [createAddTrackWithClipsCommand(deps.addTrackAndClip, { kind: "AUDIO", audioSubtype: "SFX" }, clipInputs)];
}

function translateMusic(
  music: AIMusic | undefined,
  project: AITimelineProjectSnapshot,
  musicTrack: TrackView | undefined,
  deps: { clip: ClipCommandDeps; track: TrackCommandDeps; addMusicTrack: AddMusicTrackDeps },
  unresolved: UnresolvedAssetItem[]
): EditorCommand[] {
  if (!music) return [];
  if (!music.assetId) {
    unresolved.push({ section: "music", reason: "missing_resolved_asset_id", item: music });
    return [];
  }
  // Voice-track hint resolution — falls back to the ducking feature's own
  // EXISTING "empty array = auto, every VOICE track" default (see
  // EditorTrack.duckingVoiceTrackIds's doc comment) rather than inventing
  // a second auto-resolution rule here.
  const voiceTrackIds = music.duckingVoiceTrackHint
    ? project.tracks.filter((t) => t.audioSubtype === "VOICE").map((t) => t.id)
    : [];
  const ducking = {
    duckingEnabled: music.duckingEnabled,
    duckingAmountDb: musicTrack?.duckingAmountDb ?? -12,
    duckingFadeMs: musicTrack?.duckingFadeMs ?? 300,
    duckingVoiceTrackIds: voiceTrackIds,
  };
  const clipInput: Omit<AddClipPatch, "trackId"> = {
    assetId: music.assetId,
    startMs: 0,
    durationMs: project.durationMs,
  };

  if (musicTrack) {
    // Track already exists — the clip-add and the ducking update are
    // genuinely independent of each other (both target data that already
    // exists), safe to run as a plain parallel composite.
    return [
      createAddClipCommand(deps.clip, { ...clipInput, trackId: musicTrack.id }),
      createUpdateTrackCommand(
        deps.track,
        musicTrack.id,
        {
          duckingEnabled: musicTrack.duckingEnabled,
          duckingAmountDb: musicTrack.duckingAmountDb,
          duckingFadeMs: musicTrack.duckingFadeMs,
          duckingVoiceTrackIds: musicTrack.duckingVoiceTrackIds,
        },
        ducking
      ),
    ];
  }
  return [createAddMusicTrackCommand(deps.addMusicTrack, clipInput, ducking)];
}

function translateTransitions(items: AITransitionPlan[], project: AITimelineProjectSnapshot, deps: TransitionCommandDeps, warnings: string[]): EditorCommand[] {
  const commands: EditorCommand[] = [];
  for (const transition of items) {
    const [clipAId, clipBId] = transition.betweenClipIds;
    const clipA = project.clips.find((c) => c.id === clipAId);
    const clipB = project.clips.find((c) => c.id === clipBId);
    if (!clipA || !clipB) {
      warnings.push(`transition references a clip id that doesn't exist (${clipAId} / ${clipBId}) — skipped.`);
      continue;
    }
    if (clipA.trackId !== clipB.trackId) {
      warnings.push(`transition's two clips (${clipAId} / ${clipBId}) aren't on the same track — skipped.`);
      continue;
    }
    commands.push(
      createAddTransitionCommand(deps, {
        trackId: clipA.trackId,
        clipAId,
        clipBId,
        type: transition.type,
        durationMs: transition.durationMs,
      })
    );
  }
  return commands;
}

// =======================================================================
// Entry point
// =======================================================================

export function translateAITimelinePlan(
  plan: AITimelinePlan,
  project: AITimelineProjectSnapshot,
  deps: AITimelineTranslatorDeps
): AITimelineTranslationResult {
  const warnings: string[] = [];
  const unresolvedAssets: UnresolvedAssetItem[] = [];

  const subtitleTrack = findTrackByKind(project.tracks, "SUBTITLE");
  const overlayTrack = findTrackByKind(project.tracks, "OVERLAY");
  const sfxTrack = findTrackByKind(project.tracks, "AUDIO", "SFX");
  const musicTrack = findTrackByKind(project.tracks, "AUDIO", "MUSIC");

  // zoom items targeting a clip that sceneRemoval ALSO touches, and
  // segment-boundary transitions, both get folded into that same
  // sequential command (see translateSceneRemoval's own doc comment) —
  // only the LEFTOVER items (a zoom whose clip sceneRemoval never
  // touches; a transition using real clip ids, not the boundary-index
  // encoding) go through the plain, independent translateZoom/
  // translateTransitions below, safe to run in the composite's usual
  // parallel execute().
  const sceneRemovalResult = translateSceneRemoval(plan.sceneRemoval, plan.zoom, plan.transitions, project, deps.clip, deps.transition, warnings);
  const independentZoomItems = plan.zoom.filter((z) => !sceneRemovalResult.consumedZoomClipIds.has(z.clipId));
  const independentTransitionItems = plan.transitions.filter((_, i) => !sceneRemovalResult.consumedTransitionIndices.has(i));

  // Bugfix (2026-07-17) — captions/broll/stickers/sfx windows are
  // SOURCE-relative, same as sceneRemoval/zoom, but were never remapped
  // onto the gap-closed post-removal timeline the way zoom already is
  // (see mapWindowToSurvivingSegments's own doc comment for the live
  // evidence that surfaced this). A no-op when sceneRemoval touched
  // nothing (removalTarget is null) — every item passes through
  // unchanged, exactly like before this fix.
  const { removalTarget } = sceneRemovalResult;
  const effectiveDurationMs = computeEffectiveDurationMs(project, removalTarget);
  function remapAgainstSceneRemoval(startMs: number, endMs: number, describe: () => string): { startMs: number; endMs: number } | null {
    if (!removalTarget) return { startMs, endMs };
    const mapped = mapWindowToSurvivingSegments(removalTarget.clip, removalTarget.segments, startMs, endMs);
    if (mapped.length === 0) {
      warnings.push(`${describe()} fell entirely within a removed scene-removal window — skipped.`);
      return null;
    }
    if (mapped.length > 1) {
      warnings.push(`${describe()} spans a removed scene-removal boundary — truncated to the first surviving portion.`);
    }
    return mapped[0];
  }

  const remappedCaptions = plan.captions
    .map((c) => {
      const w = remapAgainstSceneRemoval(c.startMs, c.endMs, () => `caption "${c.text.slice(0, 40)}"`);
      return w ? { ...c, startMs: w.startMs, endMs: w.endMs } : null;
    })
    .filter((c): c is AICaption => c !== null);

  const remappedBroll = plan.broll
    .map((b) => {
      const w = remapAgainstSceneRemoval(b.startMs, b.endMs, () => `broll [${b.startMs}, ${b.endMs})`);
      return w ? { ...b, startMs: w.startMs, endMs: w.endMs } : null;
    })
    .filter((b): b is AIBroll => b !== null);

  const remappedStickers = plan.stickers
    .map((s) => {
      const w = remapAgainstSceneRemoval(s.startMs, s.endMs, () => `sticker "${s.assetQuery ?? s.assetId ?? ""}"`);
      return w ? { ...s, startMs: w.startMs, endMs: w.endMs } : null;
    })
    .filter((s): s is AISticker => s !== null);

  const remappedSfx = plan.sfx
    .map((s) => {
      const w = remapAgainstSceneRemoval(s.atMs, s.atMs + 1, () => `sfx at ${s.atMs}`);
      return w ? { ...s, atMs: w.startMs } : null;
    })
    .filter((s): s is AISfx => s !== null);

  const commands: EditorCommand[] = [
    ...sceneRemovalResult.commands,
    ...translateCaptionsAndOverlay(
      remappedCaptions,
      remappedBroll,
      remappedStickers,
      subtitleTrack,
      overlayTrack,
      { clip: deps.clip, addTrackAndClip: deps.addTrackAndClip },
      unresolvedAssets
    ),
    ...translateZoom(independentZoomItems, project, deps.clip, warnings),
    ...translateSfx(remappedSfx, sfxTrack, { clip: deps.clip, addTrackAndClip: deps.addTrackAndClip }, unresolvedAssets),
    ...translateMusic(
      plan.music,
      { ...project, durationMs: effectiveDurationMs },
      musicTrack,
      { clip: deps.clip, track: deps.track, addMusicTrack: deps.addMusicTrack },
      unresolvedAssets
    ),
    ...translateTransitions(independentTransitionItems, project, deps.transition, warnings),
  ];

  if (commands.length === 0) {
    return { command: null, unresolvedAssets, warnings };
  }
  // The ENTIRE AI pass undoes/redoes as one action (per the founder's own
  // requirement) — createCompositeCommand (Module 9's existing pattern).
  return { command: createCompositeCommand("AI Auto-Edit", commands), unresolvedAssets, warnings };
}
