// Milestone 11 Part 2 — paragraph segmentation & silence detection are pure
// derived functions over a transcript's word/sentence timings, not a second
// provider call. Speaker segmentation is explicitly out of scope this
// milestone (future-ready only).

export interface TimedWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface TimedSegment {
  startMs: number;
  endMs: number;
}

export interface SilenceGap {
  startMs: number;
  endMs: number;
  gapMs: number;
}

const DEFAULT_SILENCE_THRESHOLD_MS = 700;

// A "silence gap" is any pause between consecutive words at or above the
// threshold — long enough to plausibly mark a sentence/paragraph boundary
// (a natural breath, a beat before the next idea), short enough that
// ordinary mid-sentence pacing doesn't trigger it.
export function detectSilenceGaps(
  words: TimedWord[],
  thresholdMs = DEFAULT_SILENCE_THRESHOLD_MS
): SilenceGap[] {
  const gaps: SilenceGap[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const gapMs = words[i + 1].startMs - words[i].endMs;
    if (gapMs >= thresholdMs) {
      gaps.push({ startMs: words[i].endMs, endMs: words[i + 1].startMs, gapMs });
    }
  }
  return gaps;
}

// Groups sentence-level segments into paragraphs: a new paragraph starts
// whenever a detected silence gap falls between the previous segment's end
// and the current segment's start. Segments with no silence gap between
// them stay in the same paragraph. Returns one paragraph index per segment,
// 0-based, monotonically non-decreasing.
export function assignParagraphIndices<T extends TimedSegment>(
  segments: T[],
  silenceGaps: SilenceGap[]
): number[] {
  const indices: number[] = [];
  let paragraphIndex = 0;

  for (let i = 0; i < segments.length; i++) {
    if (i > 0) {
      const prevEndMs = segments[i - 1].endMs;
      const curStartMs = segments[i].startMs;
      const hasGapBetween = silenceGaps.some(
        (gap) => gap.startMs >= prevEndMs - 1 && gap.endMs <= curStartMs + 1
      );
      if (hasGapBetween) paragraphIndex++;
    }
    indices.push(paragraphIndex);
  }

  return indices;
}

// Words whose time range falls within a segment's range — used to split a
// transcript's flat word list back out per-segment for TranscriptSegment.wordTimings.
export function wordsWithinSegment<T extends TimedWord>(words: T[], segment: TimedSegment): T[] {
  return words.filter((w) => w.startMs >= segment.startMs && w.endMs <= segment.endMs);
}

// Phase 12 Module 2 (AI Auto-Editor) — pure disfluency detection over a
// transcript's word timings, same "derived function, not a second provider
// call" shape as detectSilenceGaps above. Two kinds:
//  - "filler_word": a word that IS a filler ("um", "uh", "erm", "hmm" and
//    their stretched spellings — "ummm", "uhhh").
//  - "repeated_word": the same word said twice in a row (a stumble/restart
//    — "the the meeting", "and, and now") — the FIRST occurrence is the
//    one flagged for removal, the second is the one that was actually
//    meant.
// Both map onto AISceneRemovalReason's single "filler_word" value at the
// scene-removal-proposer layer (lib/video-editor/ai-scene-removal-proposer.ts)
// — this function keeps them distinguishable for testing/debugging, the
// schema doesn't need a finer-grained reason for either.
export type DisfluencyKind = "filler_word" | "repeated_word";

export interface DisfluencyMatch {
  startMs: number;
  endMs: number;
  kind: DisfluencyKind;
  word: string;
}

const FILLER_WORD_RE = /^(u+m+|u+h+|e+r+m*|h+m+)$/i;

function normalizeWord(raw: string): string {
  return raw.trim().replace(/^[.,!?…"'()[\]]+|[.,!?…"'()[\]]+$/g, "").toLowerCase();
}

export function detectFillerWords(words: TimedWord[]): DisfluencyMatch[] {
  const matches: DisfluencyMatch[] = [];

  for (const w of words) {
    const clean = normalizeWord(w.word);
    if (clean.length > 0 && FILLER_WORD_RE.test(clean)) {
      matches.push({ startMs: w.startMs, endMs: w.endMs, kind: "filler_word", word: w.word });
    }
  }

  for (let i = 0; i < words.length - 1; i++) {
    const a = normalizeWord(words[i].word);
    const b = normalizeWord(words[i + 1].word);
    if (a.length > 0 && a === b) {
      matches.push({ startMs: words[i].startMs, endMs: words[i].endMs, kind: "repeated_word", word: words[i].word });
    }
  }

  return matches.sort((a, b) => a.startMs - b.startMs);
}
