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

// Fix (2026-08-06, FIX 3 — "gap removal quality is poor / threshold too
// conservative") — detectSilenceGaps above uses ONE fixed threshold for
// the entire transcript, which is exactly the founder-reported problem:
// a speaker who talks quickly makes a fixed threshold feel too lenient
// (their natural rhythm has short gaps that read as "dead air" relative
// to their own pace), while a slower, more deliberate speaker makes the
// SAME fixed threshold too aggressive (their natural breathing pauses get
// proposed for removal). detectSilenceGapsAdaptive replaces the single
// threshold with one computed PER GAP from the LOCAL speech rate around
// it (words per minute in a small window on either side — pacing
// genuinely varies within one recording, a fast intro vs. a slower
// explanation, so this is intentionally local, not a whole-transcript
// average), scaled around a neutral reference rate. Two hard clamps keep
// this safe at the extremes, exactly matching the founder's own two
// requirements: `maxThresholdMs` — a pause this long is ALWAYS proposed
// for removal regardless of pacing (an unnaturally long pause is dead air
// no matter how fast or slow the speaker talks around it); `minThresholdMs`
// — a pause below this is NEVER proposed, regardless of pacing (a natural
// breathing/comma-level pause every speaker needs). Only gaps strictly
// between the two clamps get the actual adaptive calculation.
export interface AdaptiveSilenceOptions {
  // Never propose a removal below this, regardless of local speech speed —
  // the natural-breathing floor. Deliberately shorter than
  // DEFAULT_SILENCE_THRESHOLD_MS's own fixed 700ms/800ms defaults: this is
  // a hard safety floor, not the "typical" threshold.
  minThresholdMs?: number;
  // Always propose a removal at or above this, regardless of local speech
  // speed — the long-pause ceiling.
  maxThresholdMs?: number;
  // The speech rate (words per minute) this calibration is centered on —
  // a local rate at or near this produces a threshold close to
  // baseThresholdMs; a FASTER local rate lowers the effective threshold
  // (a given pause reads as comparatively longer against a quick pace, so
  // it's fair to remove it sooner), a SLOWER local rate raises it (the
  // same absolute pause may just be that speaker's own natural rhythm).
  referenceWpm?: number;
  // The threshold used when local speech rate equals referenceWpm exactly
  // — the pivot the adaptive scaling is centered on. Same 800ms default as
  // DEFAULT_SILENCE_THRESHOLD_MS/AI_EDIT_SILENCE_THRESHOLD_MS (admin
  // config) so an admin's existing tuning of "the typical case" carries
  // over unchanged; only the extremes now adapt around it.
  baseThresholdMs?: number;
  // How many words on EACH side of a gap to sample for its local
  // speech-rate estimate.
  windowWords?: number;
}

export const DEFAULT_ADAPTIVE_SILENCE_OPTIONS: Required<AdaptiveSilenceOptions> = {
  minThresholdMs: 350,
  maxThresholdMs: 2500,
  referenceWpm: 150,
  baseThresholdMs: DEFAULT_SILENCE_THRESHOLD_MS,
  windowWords: 8,
};

// Pure — local ARTICULATION rate (words per minute of actual speaking
// time) in a small window straddling `index` (the word right before the
// gap being evaluated). Deliberately measured from the SUM OF EACH WORD'S
// OWN DURATION (endMs - startMs) in the window, never from the window's
// total wall-clock span — a wall-clock span would include the very gaps
// between words, and since the gap being evaluated sits INSIDE this
// window, a long silence would inflate the span and artificially LOWER
// the computed rate, which would then RAISE the adaptive threshold and
// make a long pause LESS likely to be flagged — the exact opposite of
// "long pauses must always be removed." Measuring articulation time only
// (how fast the speaker actually pronounces words, independent of how
// long they pause between them) avoids that circularity entirely: this is
// a genuine, independent signal for local pacing, not derived from the
// gap it's being used to judge. Returns null when there isn't a
// meaningful window to measure (start of transcript, fewer than 2 words,
// or degenerate zero-duration words).
function computeLocalWpm(words: TimedWord[], index: number, windowWords: number): number | null {
  const start = Math.max(0, index - windowWords + 1);
  const end = Math.min(words.length - 1, index + windowWords);
  if (end <= start) return null;
  let totalWordDurationMs = 0;
  const count = end - start + 1;
  for (let i = start; i <= end; i++) {
    totalWordDurationMs += Math.max(0, words[i].endMs - words[i].startMs);
  }
  if (totalWordDurationMs <= 0) return null;
  const avgWordDurationMs = totalWordDurationMs / count;
  return 60_000 / avgWordDurationMs;
}

// Resolves each field individually with `??`, NEVER a blind object spread
// over the caller's options — a real bug found live while wiring this up
// (ai-scene-removal-proposer.ts passes an options object where an omitted
// admin config resolves to a plain `undefined` VALUE on an OWN property,
// e.g. `{ minThresholdMs: undefined }`, not an absent key). `{ ...DEFAULT,
// ...options }` overwrites the default with that explicit `undefined`
// (object spread doesn't skip undefined-valued keys, only absent ones),
// silently turning every ceiling/floor/reference-rate check into
// `>= undefined`/`Math.max(undefined, ...)` — both always `false`/`NaN`,
// which made the whole adaptive detector propose ZERO removals, ever.
// Per-field `??` is immune to that regardless of how the options object
// was built.
function resolveAdaptiveOptions(options: AdaptiveSilenceOptions): Required<AdaptiveSilenceOptions> {
  return {
    minThresholdMs: options.minThresholdMs ?? DEFAULT_ADAPTIVE_SILENCE_OPTIONS.minThresholdMs,
    maxThresholdMs: options.maxThresholdMs ?? DEFAULT_ADAPTIVE_SILENCE_OPTIONS.maxThresholdMs,
    referenceWpm: options.referenceWpm ?? DEFAULT_ADAPTIVE_SILENCE_OPTIONS.referenceWpm,
    baseThresholdMs: options.baseThresholdMs ?? DEFAULT_ADAPTIVE_SILENCE_OPTIONS.baseThresholdMs,
    windowWords: options.windowWords ?? DEFAULT_ADAPTIVE_SILENCE_OPTIONS.windowWords,
  };
}

// Pure — the adaptive threshold for one gap, clamped to
// [minThresholdMs, maxThresholdMs]. Exported for independent unit testing
// of the scaling math itself, separate from the gap-scanning loop below.
export function adaptiveSilenceThresholdMs(localWpm: number | null, options: AdaptiveSilenceOptions = {}): number {
  const resolved = resolveAdaptiveOptions(options);
  if (localWpm === null || localWpm <= 0) return resolved.baseThresholdMs;
  const scaled = resolved.baseThresholdMs * (resolved.referenceWpm / localWpm);
  return Math.min(resolved.maxThresholdMs, Math.max(resolved.minThresholdMs, scaled));
}

// The adaptive replacement for detectSilenceGaps, used by
// ai-scene-removal-proposer.ts's proposeSceneRemovals(). detectSilenceGaps
// itself is UNCHANGED and still used as-is by paragraph segmentation
// (assignParagraphIndices) — that's a different purpose (marking a
// paragraph BREAK, not deciding what to CUT from the final video) with its
// own pre-existing fixed-threshold calibration, out of this fix's scope.
export function detectSilenceGapsAdaptive(words: TimedWord[], options: AdaptiveSilenceOptions = {}): SilenceGap[] {
  const resolved = resolveAdaptiveOptions(options);
  const gaps: SilenceGap[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const gapMs = words[i + 1].startMs - words[i].endMs;
    // Hard ceiling — a long pause is ALWAYS removed, regardless of pacing.
    if (gapMs >= resolved.maxThresholdMs) {
      gaps.push({ startMs: words[i].endMs, endMs: words[i + 1].startMs, gapMs });
      continue;
    }
    // Hard floor — a natural breathing pause is NEVER removed, regardless
    // of pacing.
    if (gapMs < resolved.minThresholdMs) continue;
    const localWpm = computeLocalWpm(words, i, resolved.windowWords);
    const threshold = adaptiveSilenceThresholdMs(localWpm, resolved);
    if (gapMs >= threshold) {
      gaps.push({ startMs: words[i].endMs, endMs: words[i + 1].startMs, gapMs });
    }
  }
  return gaps;
}

// Phase 12 Module 2 (AI Auto-Editor) — pure disfluency detection over a
// transcript's word timings, same "derived function, not a second provider
// call" shape as detectSilenceGaps above. Two kinds:
//  - "filler_word": a word that IS a filler ("um", "uh", "erm", "hmm" and
//    their stretched spellings — "ummm", "uhhh"; also elongated vowel
//    fillers "aaa"/"ah"/"aah", added 2026-08-07 — see FILLER_WORD_RE's own
//    doc comment for why a bare single "a" is deliberately excluded).
//  - "repeated_word": the same word said twice in a row (a stumble/restart
//    — "the the meeting", "and, and now") — the FIRST occurrence is the
//    one flagged for removal, the second is the one that was actually
//    meant. This is also this module's answer to "false starts": a false
//    start that repeats the SAME word before continuing differently ("I
//    was— I was going to say...") is caught here; one that abandons a
//    word entirely mid-sentence with no repetition ("I was go— actually,
//    I went") has no reliable text-only signal to detect without real
//    semantic understanding, and is deliberately NOT guessed at — a wrong
//    guess here risks cutting real, meaningful words, which is a worse
//    outcome than leaving a rare false start in. "Long breaths" are NOT a
//    word-level pattern at all (ASR transcripts don't transcribe
//    breathing) — they surface as a plain GAP between words instead,
//    already handled by detectSilenceGapsAdaptive above, not by this
//    function.
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

// `a{2,}` (2+ repeated a's, e.g. "aaa"/"aaaa") and `a+h+` (any a's followed
// by at least one h, e.g. "ah"/"aah"/"aaah") both match the elongated
// vowel-filler sound — deliberately NOT a bare single "a" alone, which is
// the real English indefinite article ("a dog," "a moment") and must
// never be treated as a disfluency.
const FILLER_WORD_RE = /^(u+m+|u+h+|e+r+m*|h+m+|a{2,}|a+h+)$/i;

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
