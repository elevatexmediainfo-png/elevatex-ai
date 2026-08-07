// Text & Subtitle Engine (Module 7) — pure types + logic, framework-
// agnostic, mirroring lib/video-editor/transform.ts's "pure math, safely
// importable by a future server-side export compositor" convention.
//
// Two genuinely separate systems live here, per the Module 6 investigation
// this module's brief confirmed as a design decision:
//  - Rich text STYLING (font/gradient/stroke/shadow/glow/spacing/bold-
//    italic-underline runs) — plain data on ClipContent, rendered directly,
//    no time-based interpolation at all.
//  - Word/character/karaoke REVEAL — genuinely time-based, but intentionally
//    NOT routed through resolveTransformValue()/Keyframeable<T>: a reveal
//    describes progress through a fixed sequence of text units (words or
//    characters) derived from unitDurationMs, not a value interpolated
//    between two user-placed keyframes. Different shape, different math,
//    kept as its own small function (resolveRevealUnits below) rather than
//    forced into the Motion Engine's keyframe model.
//
// Subtitle Compiler migration (2026-07-28) — this file now only exposes
// primitives (tokenize/resolveRevealUnits/richFormattingAt); the actual
// per-unit render decisions this module used to also own
// (resolveTextRenderUnits, deleted) now live in the Legacy Adapter
// (lib/video-editor/subtitles/legacy-adapter.ts), which routes them through
// the same Style/Highlight/Animation Engines every AI-generated caption
// uses. This is the ONLY subtitle decision system left in the repository.

export interface RichTextRun {
  // Character offsets into the clip's plain-text `content.text`, half-open
  // [start, end) — mirrors standard string-slice semantics so rendering is
  // just `text.slice(run.start, run.end)` per run.
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  // AI Auto-Edit power-word highlighting (2026-08-07) — an explicit literal
  // color for this run, distinct from the Highlight Engine's theme-driven
  // CURRENT_WORD/KEYWORD color mixing (subtitles/style-engine.ts): this is
  // a direct override an AI caption (or a manual user) can set per word/
  // phrase, e.g. "DON'T" red + "IGNORE" yellow + the rest white, all
  // simultaneously visible — the Highlight Engine's own single
  // highlightColor can't express two different colors on screen at once.
  // Threaded through richFormattingAt -> legacy-adapter.ts's buildLegacyWords
  // -> style-engine.ts's buildRenderWords, which uses it as a hard override
  // ahead of any highlight-driven color when present.
  color?: string;
}

export interface RichTextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

// Splits `text` into contiguous segments at every run boundary, so the
// renderer can emit one <span> per segment with its own bold/italic/
// underline instead of needing a full rich-text document model — the
// "lightweight approach" the brief asks for, since a clip is one short
// text block, not a multi-paragraph document.
export function splitRichTextSegments(text: string, runs: RichTextRun[] | undefined): RichTextSegment[] {
  if (!runs || runs.length === 0 || text.length === 0) {
    return text.length > 0 ? [{ text, bold: false, italic: false, underline: false }] : [];
  }

  const boundaries = new Set<number>([0, text.length]);
  for (const run of runs) {
    boundaries.add(Math.max(0, Math.min(text.length, run.start)));
    boundaries.add(Math.max(0, Math.min(text.length, run.end)));
  }
  const sorted = [...boundaries].sort((a, b) => a - b);

  const segments: RichTextSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start >= end) continue;
    const covering = runs.filter((r) => r.start <= start && r.end >= end);
    segments.push({
      text: text.slice(start, end),
      bold: covering.some((r) => r.bold),
      italic: covering.some((r) => r.italic),
      underline: covering.some((r) => r.underline),
    });
  }
  return segments;
}

// Used when rendering a reveal unit (word/character) that ALSO needs
// bold/italic/underline: rich runs and reveal units partition the same
// string differently, so this checks whether ANY run overlaps the unit's
// char range rather than requiring an exact boundary match.
export function richFormattingAt(runs: RichTextRun[] | undefined, charStart: number, charEnd: number): { bold: boolean; italic: boolean; underline: boolean; color?: string } {
  const overlapping = (runs ?? []).filter((r) => r.start < charEnd && r.end > charStart);
  // First run with an explicit color wins — a reveal unit is never covered
  // by two DIFFERENT color runs in practice (power-word runs are built
  // from non-overlapping word matches, see ai-timeline-translator.ts's
  // resolveCaptionHighlightRuns), so "first" is just a deterministic
  // tie-break, not a real design decision.
  const colored = overlapping.find((r) => r.color);
  return {
    bold: overlapping.some((r) => r.bold),
    italic: overlapping.some((r) => r.italic),
    underline: overlapping.some((r) => r.underline),
    color: colored?.color,
  };
}

// ---------------------------------------------------------------------
// Word / character / karaoke reveal
// ---------------------------------------------------------------------

export type RevealMode = "NONE" | "WORD" | "CHARACTER" | "KARAOKE";
export type RevealStyle = "FADE" | "POP" | "COLOR_SWEEP";

export interface RevealConfig {
  mode: RevealMode;
  // ms allotted to each word/character before the next one starts —
  // karaoke's "current unit" highlight also uses this as its window.
  unitDurationMs: number;
  style: RevealStyle;
  // Karaoke's current-word color; unused by FADE/POP.
  highlightColor: string;
}

export const DEFAULT_REVEAL_CONFIG: RevealConfig = {
  mode: "NONE",
  unitDurationMs: 200,
  style: "FADE",
  highlightColor: "#FFD60A",
};

export interface RevealUnit {
  text: string;
  isWhitespace: boolean;
  // Character offsets into the original `text` — lets the renderer
  // cross-reference RichTextRun formatting (bold/italic/underline) per
  // reveal unit, since the two systems partition the same string
  // differently (words/characters vs. arbitrary formatting ranges).
  charStart: number;
  charEnd: number;
  // 0 (not yet revealed) .. 1 (fully revealed) — drives opacity (FADE) or
  // opacity+scale (POP) in the renderer. Whitespace units are always 1.
  progress: number;
  // KARAOKE only — true while the playhead sits inside this unit's own
  // [unitIndex*unitDurationMs, (unitIndex+1)*unitDurationMs) window.
  isCurrent: boolean;
}

export interface TextToken {
  text: string;
  isWhitespace: boolean;
  charStart: number;
  charEnd: number;
}

// CHARACTER mode splits every character (including spaces) into its own
// unit; WORD/KARAOKE split on whitespace runs, keeping the whitespace
// itself as separate always-visible units so multi-word spacing survives
// unchanged in the rendered output. Exported for the Legacy Subtitle
// Adapter (lib/video-editor/subtitles/legacy-adapter.ts), which reuses this
// exact tokenization rather than re-deriving its own.
export function tokenize(text: string, mode: RevealMode): TextToken[] {
  if (mode === "CHARACTER") {
    return [...text].map((c, i) => ({ text: c, isWhitespace: /\s/.test(c), charStart: i, charEnd: i + 1 }));
  }
  const tokens: { text: string; isWhitespace: boolean; charStart: number; charEnd: number }[] = [];
  let cursor = 0;
  for (const t of text.split(/(\s+)/)) {
    if (t.length === 0) continue;
    tokens.push({ text: t, isWhitespace: /^\s+$/.test(t), charStart: cursor, charEnd: cursor + t.length });
    cursor += t.length;
  }
  return tokens;
}

// Syllable-level karaoke would need a locale-aware hyphenation dictionary —
// out of scope; KARAOKE highlights at word granularity (documented
// simplification, same class of trade-off as Module 6's rotation-naive
// crop handles).
export function resolveRevealUnits(text: string, config: RevealConfig, atMs: number): RevealUnit[] {
  const tokens = tokenize(text, config.mode === "KARAOKE" ? "WORD" : config.mode === "NONE" ? "WORD" : config.mode);

  if (config.mode === "NONE") {
    return tokens.map((t) => ({ ...t, progress: 1, isCurrent: false }));
  }

  let unitIndex = 0;
  return tokens.map((t) => {
    if (t.isWhitespace) return { ...t, progress: 1, isCurrent: false };

    const startMs = unitIndex * config.unitDurationMs;
    const endMs = startMs + config.unitDurationMs;
    unitIndex += 1;

    if (config.mode === "KARAOKE") {
      // Karaoke shows the whole line at all times; only the highlight
      // (isCurrent) sweeps forward — progress still reports how far
      // through its own window this unit is, for an optional partial
      // color-sweep visual, but visibility itself never gates on it.
      const isCurrent = atMs >= startMs && atMs < endMs;
      const progress = atMs < startMs ? 0 : atMs >= endMs ? 1 : (atMs - startMs) / config.unitDurationMs;
      return { ...t, progress, isCurrent };
    }

    // WORD / CHARACTER — progress gates visibility (opacity/scale).
    const progress = atMs < startMs ? 0 : atMs >= endMs ? 1 : (atMs - startMs) / config.unitDurationMs;
    return { ...t, progress, isCurrent: false };
  });
}
