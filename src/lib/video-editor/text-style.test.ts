import { describe, expect, it } from "vitest";

import { DEFAULT_REVEAL_CONFIG, resolveRevealUnits, richFormattingAt, splitRichTextSegments, type RevealConfig, type RichTextRun } from "./text-style";

describe("splitRichTextSegments", () => {
  it("returns one plain segment when there are no runs", () => {
    expect(splitRichTextSegments("hello", undefined)).toEqual([{ text: "hello", bold: false, italic: false, underline: false }]);
  });

  it("returns an empty array for empty text", () => {
    expect(splitRichTextSegments("", undefined)).toEqual([]);
  });

  it("splits at run boundaries and applies the run's formatting", () => {
    const runs: RichTextRun[] = [{ start: 6, end: 11, bold: true }];
    const segments = splitRichTextSegments("hello world", runs);
    expect(segments).toEqual([
      { text: "hello ", bold: false, italic: false, underline: false },
      { text: "world", bold: true, italic: false, underline: false },
    ]);
  });

  it("merges overlapping runs onto the same segment", () => {
    const runs: RichTextRun[] = [
      { start: 0, end: 5, bold: true },
      { start: 2, end: 8, italic: true },
    ];
    const segments = splitRichTextSegments("abcdefgh", runs);
    expect(segments.map((s) => s.text).join("")).toBe("abcdefgh");
    // [0,2)="ab" bold-only, [2,5)="cde" bold+italic (both runs cover it), [5,8)="fgh" italic-only.
    const overlap = segments.find((s) => s.text === "cde");
    expect(overlap).toEqual({ text: "cde", bold: true, italic: true, underline: false });
  });

  it("clamps out-of-range run offsets", () => {
    const runs: RichTextRun[] = [{ start: -5, end: 999, underline: true }];
    const segments = splitRichTextSegments("hi", runs);
    expect(segments).toEqual([{ text: "hi", bold: false, italic: false, underline: true }]);
  });
});

describe("resolveRevealUnits", () => {
  it("mode NONE reveals everything immediately regardless of time", () => {
    const units = resolveRevealUnits("hello world", DEFAULT_REVEAL_CONFIG, 0);
    expect(units.every((u) => u.progress === 1)).toBe(true);
  });

  it("WORD mode reveals words sequentially by unitDurationMs", () => {
    const config: RevealConfig = { mode: "WORD", unitDurationMs: 200, style: "FADE", highlightColor: "#fff" };
    const units = resolveRevealUnits("one two three", config, 250);
    const words = units.filter((u) => !u.isWhitespace);
    expect(words).toHaveLength(3);
    expect(words[0].progress).toBe(1); // fully revealed (window 0-200, at t=250)
    expect(words[1].progress).toBeCloseTo(0.25, 5); // window 200-400, at t=250 -> 50/200
    expect(words[2].progress).toBe(0); // window 400-600, not started yet
  });

  it("whitespace units are always fully visible", () => {
    const config: RevealConfig = { mode: "WORD", unitDurationMs: 200, style: "FADE", highlightColor: "#fff" };
    const units = resolveRevealUnits("one two", config, 0);
    const space = units.find((u) => u.isWhitespace);
    expect(space?.progress).toBe(1);
  });

  it("CHARACTER mode reveals one character per unitDurationMs", () => {
    const config: RevealConfig = { mode: "CHARACTER", unitDurationMs: 100, style: "FADE", highlightColor: "#fff" };
    const units = resolveRevealUnits("abc", config, 150);
    expect(units[0].progress).toBe(1); // 0-100, fully revealed
    expect(units[1].progress).toBeCloseTo(0.5, 5); // 100-200, halfway
    expect(units[2].progress).toBe(0); // 200-300, not started
  });

  it("KARAOKE mode only flags the current word, with progress ramping within its own window", () => {
    const config: RevealConfig = { mode: "KARAOKE", unitDurationMs: 300, style: "COLOR_SWEEP", highlightColor: "#ff0" };
    const units = resolveRevealUnits("one two three", config, 350);
    const words = units.filter((u) => !u.isWhitespace);
    // word[0]'s window (0-300) is fully past -> progress 1.
    expect(words[0].progress).toBe(1);
    // word[1]'s window (300-600); t=350 is 1/6 of the way through.
    expect(words[1].progress).toBeCloseTo(1 / 6, 5);
    // word[2]'s window (600-900) hasn't started.
    expect(words[2].progress).toBe(0);
    // t=350 falls in word[1]'s window (300-600)
    expect(words[1].isCurrent).toBe(true);
    expect(words[0].isCurrent).toBe(false);
    expect(words[2].isCurrent).toBe(false);
  });

  it("KARAOKE never hides text — every non-whitespace unit is visible even before its window starts", () => {
    const config: RevealConfig = { mode: "KARAOKE", unitDurationMs: 300, style: "COLOR_SWEEP", highlightColor: "#ff0" };
    const units = resolveRevealUnits("one two three", config, 0);
    // Karaoke's rendering contract is "always show full text" — progress
    // may be 0 for not-yet-reached words, but the renderer must NOT gate
    // opacity on progress in karaoke mode (only WORD/CHARACTER do).
    expect(units.filter((u) => !u.isWhitespace)).toHaveLength(3);
  });

  it("tracks character offsets so a caller can cross-reference RichTextRun formatting", () => {
    const config: RevealConfig = { mode: "WORD", unitDurationMs: 200, style: "FADE", highlightColor: "#fff" };
    const units = resolveRevealUnits("one two", config, 0);
    const words = units.filter((u) => !u.isWhitespace);
    expect(words[0]).toMatchObject({ text: "one", charStart: 0, charEnd: 3 });
    expect(words[1]).toMatchObject({ text: "two", charStart: 4, charEnd: 7 });
  });
});

// Subtitle Compiler migration (2026-07-28) — resolveTextRenderUnits()
// (and its golden tests, formerly here) is deleted; the render-decision
// logic it owned now lives in the Legacy Adapter
// (lib/video-editor/subtitles/legacy-adapter.ts), whose own golden tests
// (legacy-adapter.test.ts) cover every one of the same scenarios at the
// new adapter/Compiler boundary — cross-checked against the exact values
// these tests used to assert, so no real coverage was lost.

describe("richFormattingAt", () => {
  it("returns all-false when no runs overlap", () => {
    expect(richFormattingAt([{ start: 10, end: 20, bold: true }], 0, 3)).toEqual({ bold: false, italic: false, underline: false });
  });

  it("returns true for a run that partially overlaps the range", () => {
    expect(richFormattingAt([{ start: 2, end: 5, italic: true }], 0, 3)).toEqual({ bold: false, italic: true, underline: false });
  });

  it("handles an undefined runs array", () => {
    expect(richFormattingAt(undefined, 0, 3)).toEqual({ bold: false, italic: false, underline: false });
  });

  // TASK 3 (2026-08-07, AI Auto-Edit power-word highlighting).
  it("returns the color of an overlapping colored run", () => {
    expect(richFormattingAt([{ start: 0, end: 5, color: "#FF3B30" }], 0, 3).color).toBe("#FF3B30");
  });

  it("omits color when no overlapping run has one", () => {
    expect(richFormattingAt([{ start: 0, end: 5, bold: true }], 0, 3).color).toBeUndefined();
  });

  it("returns the FIRST colored run's color when two colored runs both overlap (deterministic tie-break)", () => {
    expect(
      richFormattingAt(
        [
          { start: 0, end: 10, color: "#FF3B30" },
          { start: 0, end: 10, color: "#FFD60A" },
        ],
        0,
        3
      ).color
    ).toBe("#FF3B30");
  });
});
