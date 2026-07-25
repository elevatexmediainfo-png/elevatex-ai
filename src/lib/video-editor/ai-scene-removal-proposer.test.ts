import { describe, expect, it } from "vitest";
import { DEFAULT_SILENCE_THRESHOLD_MS, mergeSceneRemovalCandidates, proposeSceneRemovals } from "./ai-scene-removal-proposer";

describe("proposeSceneRemovals", () => {
  it("proposes a silence removal for a gap at or above the default 800ms threshold", () => {
    const words = [
      { word: "Hello", startMs: 0, endMs: 300 },
      { word: "world", startMs: 1200, endMs: 1500 },
    ];
    const result = proposeSceneRemovals(words);
    expect(result).toEqual([{ startMs: 300, endMs: 1200, reason: "silence" }]);
  });

  it("does NOT propose a removal for a gap below the threshold", () => {
    const words = [
      { word: "Hello", startMs: 0, endMs: 300 },
      { word: "world", startMs: 500, endMs: 800 }, // 200ms gap
    ];
    expect(proposeSceneRemovals(words)).toEqual([]);
  });

  it("respects a custom silenceThresholdMs option", () => {
    const words = [
      { word: "a", startMs: 0, endMs: 100 },
      { word: "b", startMs: 300, endMs: 400 }, // 200ms gap
    ];
    expect(proposeSceneRemovals(words, { silenceThresholdMs: 500 })).toEqual([]);
    expect(proposeSceneRemovals(words, { silenceThresholdMs: 150 })).toEqual([{ startMs: 100, endMs: 300, reason: "silence" }]);
  });

  it("proposes a filler_word removal for a plain filler word", () => {
    const words = [
      { word: "So", startMs: 0, endMs: 200 },
      { word: "um", startMs: 250, endMs: 400 },
      { word: "yes", startMs: 450, endMs: 600 },
    ];
    expect(proposeSceneRemovals(words)).toEqual([{ startMs: 250, endMs: 400, reason: "filler_word" }]);
  });

  it("maps a repeated-word stumble onto the SAME filler_word reason (no separate schema value)", () => {
    const words = [
      { word: "the", startMs: 0, endMs: 100 },
      { word: "the", startMs: 100, endMs: 200 },
      { word: "meeting", startMs: 200, endMs: 500 },
    ];
    expect(proposeSceneRemovals(words)).toEqual([{ startMs: 0, endMs: 100, reason: "filler_word" }]);
  });

  it("combines silence and filler removals, sorted by startMs", () => {
    const words = [
      { word: "Hello", startMs: 0, endMs: 300 },
      { word: "world", startMs: 1200, endMs: 1500 }, // 900ms silence gap before this
      { word: "um", startMs: 1550, endMs: 1700 }, // filler right after
      { word: "again", startMs: 3000, endMs: 3300 }, // another silence gap
    ];
    const result = proposeSceneRemovals(words);
    expect(result).toEqual([
      { startMs: 300, endMs: 1200, reason: "silence" },
      { startMs: 1550, endMs: 1700, reason: "filler_word" },
      { startMs: 1700, endMs: 3000, reason: "silence" },
    ]);
  });

  it("returns an empty array for no words or a single word", () => {
    expect(proposeSceneRemovals([])).toEqual([]);
    expect(proposeSceneRemovals([{ word: "hi", startMs: 0, endMs: 100 }])).toEqual([]);
  });

  it("DEFAULT_SILENCE_THRESHOLD_MS is 800 (the founder's own example)", () => {
    expect(DEFAULT_SILENCE_THRESHOLD_MS).toBe(800);
  });
});

describe("mergeSceneRemovalCandidates", () => {
  it("returns an empty array for no candidates", () => {
    expect(mergeSceneRemovalCandidates([])).toEqual([]);
  });

  it("passes disjoint candidates through unchanged, sorted by startMs", () => {
    const candidates = [
      { startMs: 5000, endMs: 5200, reason: "filler_word" as const },
      { startMs: 0, endMs: 1000, reason: "silence" as const },
    ];
    expect(mergeSceneRemovalCandidates(candidates)).toEqual([
      { startMs: 0, endMs: 1000, reason: "silence" },
      { startMs: 5000, endMs: 5200, reason: "filler_word" },
    ]);
  });

  it("merges two overlapping candidates into one widened window", () => {
    const candidates = [
      { startMs: 1000, endMs: 3000, reason: "silence" as const },
      { startMs: 2000, endMs: 4000, reason: "bad_take" as const },
    ];
    expect(mergeSceneRemovalCandidates(candidates)).toEqual([{ startMs: 1000, endMs: 4000, reason: "bad_take" }]);
  });

  it("merges adjacent (touching) candidates, same as overlapping", () => {
    const candidates = [
      { startMs: 1000, endMs: 2000, reason: "silence" as const },
      { startMs: 2000, endMs: 2500, reason: "filler_word" as const },
    ];
    expect(mergeSceneRemovalCandidates(candidates)).toEqual([{ startMs: 1000, endMs: 2500, reason: "filler_word" }]);
  });

  it("prefers a video-derived reason over a transcript-derived one when windows overlap, regardless of input order", () => {
    const videoFirst = [
      { startMs: 1000, endMs: 3000, reason: "bad_take" as const },
      { startMs: 1500, endMs: 2000, reason: "silence" as const },
    ];
    const transcriptFirst = [
      { startMs: 1500, endMs: 2000, reason: "silence" as const },
      { startMs: 1000, endMs: 3000, reason: "bad_take" as const },
    ];
    expect(mergeSceneRemovalCandidates(videoFirst)).toEqual([{ startMs: 1000, endMs: 3000, reason: "bad_take" }]);
    expect(mergeSceneRemovalCandidates(transcriptFirst)).toEqual([{ startMs: 1000, endMs: 3000, reason: "bad_take" }]);
  });

  it("ranks reasons bad_take > duplicate_take > quality_issue > filler_word > silence when 3+ overlap into one window", () => {
    const candidates = [
      { startMs: 1000, endMs: 2000, reason: "silence" as const },
      { startMs: 1200, endMs: 2200, reason: "quality_issue" as const },
      { startMs: 1400, endMs: 2400, reason: "duplicate_take" as const },
    ];
    expect(mergeSceneRemovalCandidates(candidates)).toEqual([{ startMs: 1000, endMs: 2400, reason: "duplicate_take" }]);
  });

  it("does not merge candidates with a genuine gap between them", () => {
    const candidates = [
      { startMs: 0, endMs: 1000, reason: "silence" as const },
      { startMs: 1001, endMs: 2000, reason: "bad_take" as const },
    ];
    expect(mergeSceneRemovalCandidates(candidates)).toEqual([
      { startMs: 0, endMs: 1000, reason: "silence" },
      { startMs: 1001, endMs: 2000, reason: "bad_take" },
    ]);
  });

  it("a window fully contained inside another still widens to the priority-winning reason, not the container's original span alone", () => {
    const candidates = [
      { startMs: 0, endMs: 5000, reason: "silence" as const },
      { startMs: 1000, endMs: 1500, reason: "bad_take" as const },
    ];
    expect(mergeSceneRemovalCandidates(candidates)).toEqual([{ startMs: 0, endMs: 5000, reason: "bad_take" }]);
  });
});
