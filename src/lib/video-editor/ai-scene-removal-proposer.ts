// Phase 12 Module 2 (AI Auto-Editor) — turns a transcript's word timings
// into a candidate sceneRemoval list matching Module 1's own schema
// (lib/validations/ai-timeline.ts's AISceneRemoval). Rule-based/heuristic
// on purpose (silence-gap detection from timestamps, simple filler-word
// pattern matching) — this doesn't need GPT reasoning yet.
//
// Reuses the EXISTING transcript-analysis primitives (lib/transcription/
// segmentation.ts's detectSilenceGaps/detectFillerWords) rather than
// reimplementing timestamp math — this file is only the "map those onto
// AISceneRemoval reasons" layer.
//
// Phase 12 Module 3 added mergeSceneRemovalCandidates below: bad_take/
// duplicate_take/quality_issue genuinely need video/audio UNDERSTANDING
// (Gemini "watching" the footage, lib/providers/video-understanding) —
// this file's own rule-based proposeSceneRemovals() only ever produces
// silence/filler_word. The merge function combines both sources into one
// sensible, non-redundant candidate list.

import { detectDuplicatePhrases, detectFillerWords, detectSilenceGapsAdaptive, type TimedWord } from "@/lib/transcription/segmentation";
import type { AISceneRemoval, AISceneRemovalReason } from "@/lib/validations/ai-timeline";

export interface SceneRemovalProposerOptions {
  // >800ms by default — matches the founder's own example. Deliberately a
  // DIFFERENT default from detectSilenceGaps' own 700ms (tuned for
  // paragraph-boundary detection, Milestone 11's own purpose) — cutting
  // silence out of a final video calls for a longer bar than merely
  // marking a paragraph break. Fix (2026-08-06, FIX 3) — this is now the
  // ADAPTIVE detector's pivot/base value (see detectSilenceGapsAdaptive,
  // lib/transcription/segmentation.ts), not a flat cutoff — kept the same
  // option name/meaning for the common case (an admin's existing tuning of
  // "the typical threshold" still means the same thing) while the actual
  // per-gap decision now also accounts for local speech speed and the two
  // hard clamps below.
  silenceThresholdMs?: number;
  // Fix (2026-08-06, FIX 3) — "long pauses must always be removed / natural
  // breathing pauses should remain." Both admin-configurable
  // (AI_EDIT_SILENCE_MIN_THRESHOLD_MS/AI_EDIT_SILENCE_MAX_THRESHOLD_MS,
  // read by ai-edit-jobs.ts, same "config read at the orchestration layer,
  // passed down as a plain option" convention as silenceThresholdMs
  // itself). Omitted means detectSilenceGapsAdaptive's own defaults (350ms
  // floor, 2500ms ceiling).
  minThresholdMs?: number;
  maxThresholdMs?: number;
  // Fix (2026-08-06, FIX 3) — the speech rate this calibration pivots
  // around (AI_EDIT_SILENCE_REFERENCE_WPM). Omitted means
  // detectSilenceGapsAdaptive's own default (150 WPM).
  referenceWpm?: number;
}

export const DEFAULT_SILENCE_THRESHOLD_MS = 800;

export function proposeSceneRemovals(words: TimedWord[], options: SceneRemovalProposerOptions = {}): AISceneRemoval[] {
  const silenceThresholdMs = options.silenceThresholdMs ?? DEFAULT_SILENCE_THRESHOLD_MS;

  const silenceRemovals: AISceneRemoval[] = detectSilenceGapsAdaptive(words, {
    baseThresholdMs: silenceThresholdMs,
    minThresholdMs: options.minThresholdMs,
    maxThresholdMs: options.maxThresholdMs,
    referenceWpm: options.referenceWpm,
  }).map((gap) => ({
    startMs: gap.startMs,
    endMs: gap.endMs,
    reason: "silence" as const,
  }));

  // Both filler_word and repeated_word disfluencies map onto the schema's
  // single "filler_word" reason (see detectFillerWords' own doc comment) —
  // a stumble/restart is the same class of "cut this, it's not part of
  // the final cut" decision as a plain "um".
  const fillerRemovals: AISceneRemoval[] = detectFillerWords(words).map((match) => ({
    startMs: match.startMs,
    endMs: match.endMs,
    reason: "filler_word" as const,
  }));

  // Quality upgrade (2026-08-07) — multi-word sentence restarts
  // ("so we— so we actually need to..."), the complement to
  // repeated_word's single-word case. See detectDuplicatePhrases' own doc
  // comment (segmentation.ts).
  const duplicatePhraseRemovals: AISceneRemoval[] = detectDuplicatePhrases(words).map((match) => ({
    startMs: match.startMs,
    endMs: match.endMs,
    reason: "duplicate_phrase" as const,
  }));

  return [...silenceRemovals, ...fillerRemovals, ...duplicatePhraseRemovals].sort((a, b) => a.startMs - b.startMs);
}

// Higher priority = kept when two candidates overlap and get merged into
// one window. Video-derived reasons rank above transcript-derived ones —
// a visual/verbal signal (a visibly restarted take, a duplicate delivery,
// a framing problem) is a more SPECIFIC, more informative reason for a
// human reviewer than "there was a pause here," even when the windows
// genuinely coincide (e.g. a bad take often IS also a silence gap while
// the speaker collects themselves).
// Quality upgrade (2026-08-07) — camera_adjustment/dead_reaction (video-
// derived, like bad_take/duplicate_take/quality_issue) slot in alongside
// their existing video-derived siblings; duplicate_phrase (transcript-
// derived, like filler_word) slots in just above filler_word — a
// multi-word restart is a MORE specific, informative signal than a bare
// filler sound when the two windows happen to overlap.
const REASON_PRIORITY: Record<AISceneRemovalReason, number> = {
  bad_take: 7,
  duplicate_take: 6,
  camera_adjustment: 5,
  dead_reaction: 4,
  quality_issue: 3,
  duplicate_phrase: 2.5,
  filler_word: 2,
  silence: 1,
};

// Combines candidates from BOTH sources (Module 2's transcript-based
// silence/filler_word + Module 3's Gemini-derived bad_take/duplicate_take/
// quality_issue) into one sensible, non-redundant list — overlapping or
// adjacent candidates from either/both sources merge into a single
// widened window rather than proposing two redundant overlapping cuts.
// Order of input candidates doesn't matter; this sorts internally.
export function mergeSceneRemovalCandidates(candidates: AISceneRemoval[]): AISceneRemoval[] {
  if (candidates.length === 0) return [];
  const sorted = [...candidates].sort((a, b) => a.startMs - b.startMs);
  const merged: AISceneRemoval[] = [{ ...sorted[0] }];

  for (const candidate of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (candidate.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, candidate.endMs);
      if (REASON_PRIORITY[candidate.reason] > REASON_PRIORITY[last.reason]) {
        last.reason = candidate.reason;
      }
    } else {
      merged.push({ ...candidate });
    }
  }

  return merged;
}
