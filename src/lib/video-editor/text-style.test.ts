import { describe, expect, it } from "vitest";

import {
  CAPTION_FONT_FAMILY_CSS_VARS,
  DEFAULT_REVEAL_CONFIG,
  resolveCaptionFontFamily,
  resolveCaptionTypography,
  resolveRevealUnits,
  resolveRunColor,
  richFormattingAt,
  splitRichTextSegments,
  type RevealConfig,
  type RichTextRun,
} from "./text-style";

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

// Fix (2026-08-15) — richFormattingAt() (above) already computed `color`
// correctly; the real bug was that the renderer (TextLayer, compositor-
// stage.tsx) never applied it. resolveRunColor() is the extracted,
// tested single source of truth for the precedence TextLayer now uses.
describe("resolveRunColor", () => {
  const NONE_REVEAL: RevealConfig = { ...DEFAULT_REVEAL_CONFIG, mode: "NONE" };
  const WORD_REVEAL: RevealConfig = { ...DEFAULT_REVEAL_CONFIG, mode: "WORD" };
  const KARAOKE_REVEAL: RevealConfig = { ...DEFAULT_REVEAL_CONFIG, mode: "KARAOKE", highlightColor: "#FF3B30" };

  it("returns an explicit richRun color for a normal (non-karaoke) reveal", () => {
    expect(resolveRunColor("#FFD60A", NONE_REVEAL, false)).toBe("#FFD60A");
    expect(resolveRunColor("#FFD60A", WORD_REVEAL, false)).toBe("#FFD60A");
  });

  it("returns undefined (falls back to the base/primary color) when no richRun color is set on a normal reveal", () => {
    expect(resolveRunColor(undefined, NONE_REVEAL, false)).toBeUndefined();
    expect(resolveRunColor(undefined, WORD_REVEAL, false)).toBeUndefined();
  });

  it("KARAOKE: an explicit richRun color wins even on the current word (hard override, matches richFormattingAt's own documented precedence)", () => {
    expect(resolveRunColor("#5AC8FA", KARAOKE_REVEAL, true)).toBe("#5AC8FA");
  });

  it("KARAOKE: falls back to reveal.highlightColor for the current word when no richRun color is set (pre-existing behavior, unchanged)", () => {
    expect(resolveRunColor(undefined, KARAOKE_REVEAL, true)).toBe("#FF3B30");
  });

  it("KARAOKE: a non-current word with no richRun color stays undefined (never gets the highlight color)", () => {
    expect(resolveRunColor(undefined, KARAOKE_REVEAL, false)).toBeUndefined();
  });
});

// Caption pipeline fix (2026-08-17, stabilization audit finding #5) —
// Poppins/Montserrat are now actually loaded (lib/fonts.ts, via the
// existing next/font/google mechanism) as CSS custom properties; this map
// is the test-safe seam that resolves the LITERAL name GPT/the manual font
// picker use into the real loaded value. See lib/fonts.test.ts for the
// companion check that lib/fonts.ts itself actually loads both fonts under
// these exact CSS variable names (that file can't be imported directly
// under vitest — next/font/google requires Next's own build pipeline).
describe("CAPTION_FONT_FAMILY_CSS_VARS / resolveCaptionFontFamily", () => {
  it("maps poppins and montserrat to their real loaded CSS variables", () => {
    expect(CAPTION_FONT_FAMILY_CSS_VARS.poppins).toBe("var(--font-poppins)");
    expect(CAPTION_FONT_FAMILY_CSS_VARS.montserrat).toBe("var(--font-montserrat)");
  });

  it("resolves 'Poppins'/'Montserrat' (any case) to the loaded CSS variable", () => {
    expect(resolveCaptionFontFamily("Poppins")).toBe("var(--font-poppins)");
    expect(resolveCaptionFontFamily("montserrat")).toBe("var(--font-montserrat)");
    expect(resolveCaptionFontFamily("MONTSERRAT")).toBe("var(--font-montserrat)");
  });

  it("passes through a font name that isn't Poppins/Montserrat unchanged (e.g. a custom Brand Kit font)", () => {
    expect(resolveCaptionFontFamily("editor-font-asset123")).toBe("editor-font-asset123");
  });

  it("returns undefined when no font family was given, letting the caller decide its own default", () => {
    expect(resolveCaptionFontFamily(undefined)).toBeUndefined();
  });
});

// Caption pipeline fix (2026-08-17, stabilization audit findings #2/#5) —
// resolveCaptionTypography is the tested single source of truth TextLayer
// now uses for "explicit style wins, otherwise a strong caption default,
// scoped to captions only (isSubtitle)."
describe("resolveCaptionTypography", () => {
  it("caption (isSubtitle=true) with no explicit style receives the strong default: loaded Poppins, weight 800, white", () => {
    const result = resolveCaptionTypography({}, true);
    expect(result.fontFamily).toBe("var(--font-poppins)");
    expect(result.fontWeight).toBe(800);
    expect(result.color).toBe("#ffffff");
  });

  it("an explicit GPT-provided fontFamily still wins over the caption default", () => {
    const result = resolveCaptionTypography({ fontFamily: "Montserrat" }, true);
    expect(result.fontFamily).toBe("var(--font-montserrat)");
  });

  it("an explicit GPT-provided fontWeight still wins over the caption default", () => {
    const result = resolveCaptionTypography({ fontWeight: 600 }, true);
    expect(result.fontWeight).toBe(600);
  });

  it("an explicit GPT-provided color still wins over the caption default", () => {
    const result = resolveCaptionTypography({ color: "#FFD60A" }, true);
    expect(result.color).toBe("#FFD60A");
  });

  it("a non-caption text clip (isSubtitle=false) with no explicit style keeps the prior inherit/400 default, untouched", () => {
    const result = resolveCaptionTypography({}, false);
    expect(result.fontFamily).toBe("inherit");
    expect(result.fontWeight).toBe(400);
    expect(result.color).toBe("#ffffff"); // color's default was always unconditional, isSubtitle-independent
  });

  it("fallback captions (no style object at all — caption-formatting.ts's buildFallbackCaptionsFromWords) get the same strong caption default as any other caption, with zero semantic highlight logic involved", () => {
    // Fallback captions never set style.fontFamily/fontWeight/color at all
    // (an empty object is exactly what reaches this function for them) —
    // this proves they receive the safe visual defaults (strong font,
    // 800, white) without needing any new deterministic highlighter.
    const result = resolveCaptionTypography({}, true);
    expect(result).toEqual({ fontFamily: "var(--font-poppins)", fontWeight: 800, color: "#ffffff" });
  });
});
