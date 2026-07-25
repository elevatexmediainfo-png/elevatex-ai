import { describe, expect, it } from "vitest";

import { assignParagraphIndices, detectFillerWords, detectSilenceGaps, wordsWithinSegment } from "./segmentation";

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
