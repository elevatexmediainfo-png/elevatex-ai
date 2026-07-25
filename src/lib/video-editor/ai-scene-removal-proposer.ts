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

import { detectFillerWords, detectSilenceGaps, type TimedWord } from "@/lib/transcription/segmentation";
import type { AISceneRemoval, AISceneRemovalReason } from "@/lib/validations/ai-timeline";

export interface SceneRemovalProposerOptions {
  // >800ms by default — matches the founder's own example. Deliberately a
  // DIFFERENT default from detectSilenceGaps' own 700ms (tuned for
  // paragraph-boundary detection, Milestone 11's own purpose) — cutting
  // silence out of a final video calls for a longer bar than merely
  // marking a paragraph break.
  silenceThresholdMs?: number;
}

export const DEFAULT_SILENCE_THRESHOLD_MS = 800;

export function proposeSceneRemovals(words: TimedWord[], options: SceneRemovalProposerOptions = {}): AISceneRemoval[] {
  const silenceThresholdMs = options.silenceThresholdMs ?? DEFAULT_SILENCE_THRESHOLD_MS;

  const silenceRemovals: AISceneRemoval[] = detectSilenceGaps(words, silenceThresholdMs).map((gap) => ({
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

  return [...silenceRemovals, ...fillerRemovals].sort((a, b) => a.startMs - b.startMs);
}

// Higher priority = kept when two candidates overlap and get merged into
// one window. Video-derived reasons rank above transcript-derived ones —
// a visual/verbal signal (a visibly restarted take, a duplicate delivery,
// a framing problem) is a more SPECIFIC, more informative reason for a
// human reviewer than "there was a pause here," even when the windows
// genuinely coincide (e.g. a bad take often IS also a silence gap while
// the speaker collects themselves).
const REASON_PRIORITY: Record<AISceneRemovalReason, number> = {
  bad_take: 5,
  duplicate_take: 4,
  quality_issue: 3,
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
