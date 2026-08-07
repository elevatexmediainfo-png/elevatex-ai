import { describe, expect, it } from "vitest";

import {
  adaptiveSilenceThresholdMs,
  assignParagraphIndices,
  detectDuplicatePhrases,
  detectFillerWords,
  detectSilenceGaps,
  detectSilenceGapsAdaptive,
  wordsWithinSegment,
} from "./segmentation";

function words(...tokens: string[]) {
  return tokens.map((word, i) => ({ word, startMs: i * 300, endMs: i * 300 + 250 }));
}

describe("detectSilenceGaps", () => {
  it("returns no gaps when words are closely spaced", () => {
    const words = [
      { word: "hi", startMs: 0, endMs: 200 },
      { word: "there", startMs: 220, endMs: 420 },
    ];
    expect(detectSilenceGaps(words)).toEqual([]);
  });

  it("detects a gap at or above the threshold", () => {
    const words = [
      { word: "hi", startMs: 0, endMs: 200 },
      { word: "there", startMs: 1200, endMs: 1400 },
    ];
    expect(detectSilenceGaps(words)).toEqual([{ startMs: 200, endMs: 1200, gapMs: 1000 }]);
  });

  it("respects a custom threshold", () => {
    const words = [
      { word: "a", startMs: 0, endMs: 100 },
      { word: "b", startMs: 300, endMs: 400 },
    ];
    expect(detectSilenceGaps(words, 700)).toEqual([]);
    expect(detectSilenceGaps(words, 150)).toEqual([{ startMs: 100, endMs: 300, gapMs: 200 }]);
  });

  it("returns no gaps for a single word or empty list", () => {
    expect(detectSilenceGaps([])).toEqual([]);
    expect(detectSilenceGaps([{ word: "solo", startMs: 0, endMs: 100 }])).toEqual([]);
  });
});

// Fix (2026-08-06, FIX 3 — "gap removal quality is poor / threshold too
// conservative, implement adaptive silence detection based on speech
// speed instead of a fixed threshold").
describe("adaptiveSilenceThresholdMs (pure scaling math)", () => {
  it("returns baseThresholdMs unchanged when local speech rate equals the reference rate", () => {
    expect(adaptiveSilenceThresholdMs(150, { referenceWpm: 150, baseThresholdMs: 800 })).toBe(800);
  });

  it("lowers the effective threshold for faster-than-reference local speech", () => {
    // 300 WPM is twice the 150 WPM reference -> half the base threshold.
    expect(adaptiveSilenceThresholdMs(300, { referenceWpm: 150, baseThresholdMs: 800 })).toBe(400);
  });

  it("raises the effective threshold for slower-than-reference local speech", () => {
    // 75 WPM is half the 150 WPM reference -> double the base threshold.
    expect(adaptiveSilenceThresholdMs(75, { referenceWpm: 150, baseThresholdMs: 800 })).toBe(1600);
  });

  it("clamps the result to maxThresholdMs even for an extremely slow local rate", () => {
    expect(adaptiveSilenceThresholdMs(1, { referenceWpm: 150, baseThresholdMs: 800, maxThresholdMs: 2500 })).toBe(2500);
  });

  it("clamps the result to minThresholdMs even for an extremely fast local rate", () => {
    expect(adaptiveSilenceThresholdMs(10_000, { referenceWpm: 150, baseThresholdMs: 800, minThresholdMs: 350 })).toBe(350);
  });

  it("falls back to baseThresholdMs when no local rate could be measured (null)", () => {
    expect(adaptiveSilenceThresholdMs(null, { baseThresholdMs: 800 })).toBe(800);
  });
});

describe("detectSilenceGapsAdaptive", () => {
  it("always removes a gap at/above maxThresholdMs, regardless of local speech speed", () => {
    // Deliberately slow local articulation (long word durations) — even
    // though that would normally RAISE the effective threshold, the hard
    // ceiling still fires for a genuinely long pause.
    const words = [
      { word: "slow", startMs: 0, endMs: 900 },
      { word: "word", startMs: 3500, endMs: 4400 }, // 2600ms gap
    ];
    const gaps = detectSilenceGapsAdaptive(words, { maxThresholdMs: 2500 });
    expect(gaps).toEqual([{ startMs: 900, endMs: 3500, gapMs: 2600 }]);
  });

  it("never removes a gap below minThresholdMs, regardless of local speech speed", () => {
    // Deliberately fast local articulation (short word durations) — even
    // though that would normally LOWER the effective threshold well below
    // this gap, the hard floor still blocks a natural breathing pause.
    const words = [
      { word: "fast", startMs: 0, endMs: 60 },
      { word: "word", startMs: 300, endMs: 360 }, // 240ms gap
    ];
    const gaps = detectSilenceGapsAdaptive(words, { minThresholdMs: 350 });
    expect(gaps).toEqual([]);
  });

  it("proposes a shorter gap for fast local speech than the same-length gap would need at a normal pace", () => {
    // Fast speaker (~40ms/word => 1500 WPM articulation rate) — a 500ms
    // gap should read as comparatively long against that pace.
    const fastWords = [
      { word: "a", startMs: 0, endMs: 40 },
      { word: "b", startMs: 40, endMs: 80 },
      { word: "c", startMs: 580, endMs: 620 }, // 500ms gap after "b"
    ];
    expect(detectSilenceGapsAdaptive(fastWords, { baseThresholdMs: 800, referenceWpm: 150 })).toEqual([
      { startMs: 80, endMs: 580, gapMs: 500 },
    ]);

    // Same 500ms gap, but slow speaker (~400ms/word => 150 WPM, exactly
    // the reference rate) — effective threshold stays at the 800ms base,
    // so the same 500ms gap is NOT proposed.
    const slowWords = [
      { word: "a", startMs: 0, endMs: 400 },
      { word: "b", startMs: 400, endMs: 800 },
      { word: "c", startMs: 1300, endMs: 1700 }, // 500ms gap after "b"
    ];
    expect(detectSilenceGapsAdaptive(slowWords, { baseThresholdMs: 800, referenceWpm: 150 })).toEqual([]);
  });

  it("returns no gaps for a single word or empty list", () => {
    expect(detectSilenceGapsAdaptive([])).toEqual([]);
    expect(detectSilenceGapsAdaptive([{ word: "solo", startMs: 0, endMs: 100 }])).toEqual([]);
  });
});

describe("assignParagraphIndices", () => {
  it("keeps every segment in paragraph 0 when there are no silence gaps", () => {
    const segments = [
      { startMs: 0, endMs: 1000 },
      { startMs: 1000, endMs: 2000 },
      { startMs: 2000, endMs: 3000 },
    ];
    expect(assignParagraphIndices(segments, [])).toEqual([0, 0, 0]);
  });

  it("starts a new paragraph at a silence gap between segments", () => {
    const segments = [
      { startMs: 0, endMs: 1000 },
      { startMs: 2500, endMs: 3500 }, // gap of 1500ms after segment 0
      { startMs: 3500, endMs: 4500 }, // no gap after segment 1
    ];
    const gaps = [{ startMs: 1000, endMs: 2500, gapMs: 1500 }];
    expect(assignParagraphIndices(segments, gaps)).toEqual([0, 1, 1]);
  });

  it("increments once per detected gap, across multiple paragraphs", () => {
    const segments = [
      { startMs: 0, endMs: 1000 },
      { startMs: 2500, endMs: 3500 },
      { startMs: 5000, endMs: 6000 },
    ];
    const gaps = [
      { startMs: 1000, endMs: 2500, gapMs: 1500 },
      { startMs: 3500, endMs: 5000, gapMs: 1500 },
    ];
    expect(assignParagraphIndices(segments, gaps)).toEqual([0, 1, 2]);
  });

  it("returns an empty array for no segments", () => {
    expect(assignParagraphIndices([], [])).toEqual([]);
  });
});

describe("wordsWithinSegment", () => {
  it("returns only words whose range falls inside the segment", () => {
    const words = [
      { word: "a", startMs: 0, endMs: 100 },
      { word: "b", startMs: 100, endMs: 200 },
      { word: "c", startMs: 500, endMs: 600 },
    ];
    expect(wordsWithinSegment(words, { startMs: 0, endMs: 200 })).toEqual([
      { word: "a", startMs: 0, endMs: 100 },
      { word: "b", startMs: 100, endMs: 200 },
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    const words = [{ word: "a", startMs: 1000, endMs: 1100 }];
    expect(wordsWithinSegment(words, { startMs: 0, endMs: 200 })).toEqual([]);
  });
});

describe("detectFillerWords", () => {
  it("detects a plain filler word", () => {
    const words = [
      { word: "So", startMs: 0, endMs: 200 },
      { word: "um", startMs: 300, endMs: 500 },
      { word: "yes", startMs: 600, endMs: 800 },
    ];
    expect(detectFillerWords(words)).toEqual([{ startMs: 300, endMs: 500, kind: "filler_word", word: "um" }]);
  });

  it("detects stretched-spelling variants (ummm, uhhh) and is case-insensitive", () => {
    const words = [
      { word: "Ummm", startMs: 0, endMs: 200 },
      { word: "UHHH", startMs: 300, endMs: 500 },
      { word: "erm", startMs: 600, endMs: 800 },
      { word: "hmm", startMs: 900, endMs: 1000 },
    ];
    expect(detectFillerWords(words).map((m) => m.kind)).toEqual(["filler_word", "filler_word", "filler_word", "filler_word"]);
  });

  it("strips surrounding punctuation before matching", () => {
    const words = [{ word: "\"um,\"", startMs: 0, endMs: 200 }];
    expect(detectFillerWords(words)).toEqual([{ startMs: 0, endMs: 200, kind: "filler_word", word: "\"um,\"" }]);
  });

  it("does NOT flag an ordinary word that merely contains filler-like letters", () => {
    const words = [{ word: "hum", startMs: 0, endMs: 200 }]; // a real word, not a filler
    expect(detectFillerWords(words)).toEqual([]);
  });

  // Fix (2026-08-07, TASK 7 — "remove aaa") — elongated vowel filler.
  it("detects elongated vowel fillers (aaa, ah, aah)", () => {
    const words = [
      { word: "aaa", startMs: 0, endMs: 200 },
      { word: "ah", startMs: 300, endMs: 500 },
      { word: "aah", startMs: 600, endMs: 800 },
    ];
    expect(detectFillerWords(words).map((m) => m.kind)).toEqual(["filler_word", "filler_word", "filler_word"]);
  });

  it("does NOT flag the bare indefinite article 'a' as a filler", () => {
    const words = [
      { word: "a", startMs: 0, endMs: 100 },
      { word: "dog", startMs: 100, endMs: 300 },
    ];
    expect(detectFillerWords(words)).toEqual([]);
  });

  it("detects a repeated-word stumble, flagging the FIRST occurrence", () => {
    const words = [
      { word: "the", startMs: 0, endMs: 100 },
      { word: "the", startMs: 100, endMs: 200 },
      { word: "meeting", startMs: 200, endMs: 500 },
    ];
    expect(detectFillerWords(words)).toEqual([{ startMs: 0, endMs: 100, kind: "repeated_word", word: "the" }]);
  });

  it("repeated-word detection is case/punctuation-insensitive", () => {
    const words = [
      { word: "And,", startMs: 0, endMs: 100 },
      { word: "and", startMs: 100, endMs: 200 },
    ];
    expect(detectFillerWords(words)).toEqual([{ startMs: 0, endMs: 100, kind: "repeated_word", word: "And," }]);
  });

  it("does not flag two DIFFERENT consecutive words", () => {
    const words = [
      { word: "hello", startMs: 0, endMs: 100 },
      { word: "world", startMs: 100, endMs: 200 },
    ];
    expect(detectFillerWords(words)).toEqual([]);
  });

  it("returns matches sorted by startMs even when filler + repeated-word matches interleave", () => {
    const words = [
      { word: "no", startMs: 0, endMs: 100 },
      { word: "no", startMs: 100, endMs: 200 },
      { word: "um", startMs: 300, endMs: 400 },
    ];
    const result = detectFillerWords(words);
    expect(result.map((m) => m.startMs)).toEqual([0, 300]);
  });

  it("returns an empty array for no words or a single word", () => {
    expect(detectFillerWords([])).toEqual([]);
    expect(detectFillerWords([{ word: "hi", startMs: 0, endMs: 100 }])).toEqual([]);
  });
});

// Quality upgrade (2026-08-07, "cinematic editing — sentence restarts").
describe("detectDuplicatePhrases", () => {
  it("flags a multi-word sentence restart, keeping the SECOND (better) delivery", () => {
    const w = words("so", "we", "need", "to", "so", "we", "need", "to", "actually", "focus");
    const result = detectDuplicatePhrases(w);
    expect(result).toHaveLength(1);
    expect(result[0].phrase).toBe("so we need to");
    expect(result[0].startMs).toBe(w[0].startMs); // the EARLIER (abandoned) occurrence
    expect(result[0].endMs).toBe(w[3].endMs);
  });

  it("prefers the LONGEST matching phrase at a position, not just the shortest 2-word one", () => {
    const w = words("i", "think", "that", "we", "should", "i", "think", "that", "we", "should", "go");
    const result = detectDuplicatePhrases(w);
    expect(result).toHaveLength(1);
    expect(result[0].phrase).toBe("i think that we should"); // 5 words, not just "i think"
  });

  it("does not flag ordinary speech with no repeated phrase", () => {
    const w = words("today", "we", "will", "learn", "about", "investing", "wisely");
    expect(detectDuplicatePhrases(w)).toEqual([]);
  });

  it("does not flag a repeat that falls outside the lookahead window", () => {
    const filler = Array.from({ length: 20 }, (_, i) => `filler${i}`);
    const w = words("so", "we", "need", "to", ...filler, "so", "we", "need", "to");
    expect(detectDuplicatePhrases(w)).toEqual([]);
  });

  it("a single repeated word alone does not trigger a phrase match (that's detectFillerWords' job)", () => {
    const w = words("no", "no", "thanks");
    expect(detectDuplicatePhrases(w)).toEqual([]);
  });

  it("handles empty and short input without throwing", () => {
    expect(detectDuplicatePhrases([])).toEqual([]);
    expect(detectDuplicatePhrases(words("hi"))).toEqual([]);
  });
});
