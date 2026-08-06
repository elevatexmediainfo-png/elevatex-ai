// Fix (2026-08-06, FIX 5 — "modern social-media captions: max 6 words per
// line, max 2 lines, automatic line balancing, emoji optional, proper
// punctuation, never return empty captions"). Pure text/layout helpers —
// no vendor calls, no Prisma, independently testable — shared by BOTH the
// real GPT-5 reasoning path (lib/providers/reasoning/gpt5.provider.ts's
// resolveCaptionTiming) and the Mock reasoning path (lib/providers/
// reasoning/mock.provider.ts) so neither can drift from the other's
// caption-quality guarantee, and so "never empty" has exactly ONE real
// implementation rather than two independently-maintained fallbacks.
//
// Emoji are deliberately left OPTIONAL and untouched here: this module
// never strips or injects emoji, matching the requirement literally — an
// emoji the model included in its caption text survives formatting
// unchanged (it counts as part of a "word" for line-splitting purposes,
// same as any other token).

export const MAX_WORDS_PER_LINE = 6;
export const MAX_CAPTION_LINES = 2;
export const MAX_WORDS_PER_CAPTION = MAX_WORDS_PER_LINE * MAX_CAPTION_LINES; // 12

// Ensures a caption ends with real terminal punctuation — "proper
// punctuation." Never touches internal punctuation and never doubles up
// on an existing terminal mark (., !, ?, …, or a trailing closing
// quote/bracket after one of those). An already-correct caption passes
// through byte-for-byte.
export function ensureTerminalPunctuation(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return trimmed;
  if (/[.!?…][)\]"'”’]*$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

// Splits a list of words into 1-2 lines of at most MAX_WORDS_PER_LINE
// words each, balanced as evenly as possible — "automatic line
// balancing," never a lopsided trailing line (e.g. 6+1) when a more even
// split (4+3) is available. A caption already short enough for one line
// is returned unsplit.
export function balanceCaptionLines(words: string[]): string[] {
  if (words.length === 0) return [];
  if (words.length <= MAX_WORDS_PER_LINE) return [words.join(" ")];
  // The larger half (rounded up) goes first — matches how a 2-line
  // caption naturally reads (a fuller first line, a shorter finishing
  // line), and keeps the split deterministic (no arbitrary tie-break
  // needed between "first line bigger" and "second line bigger").
  const firstLineCount = Math.min(MAX_WORDS_PER_LINE, Math.ceil(words.length / 2));
  return [words.slice(0, firstLineCount).join(" "), words.slice(firstLineCount).join(" ")];
}

// Formats ONE caption's full text: proper punctuation, then reflowed into
// up to MAX_CAPTION_LINES balanced lines, joined with "\n" — the same
// newline convention this app's multi-line clip text content already
// understands. Assumes the caller guarantees `text` is at most
// MAX_WORDS_PER_CAPTION words (see splitTextIntoCaptionChunks below for
// the case where a source text is longer than that) — this function only
// lays out what it's given, it never drops words itself.
export function formatCaptionText(text: string): string {
  const punctuated = ensureTerminalPunctuation(text);
  const words = punctuated.split(/\s+/).filter(Boolean);
  return balanceCaptionLines(words).join("\n");
}

export interface TextCaptionChunk {
  text: string;
  // Fraction (0..1) of the ORIGINAL text's own word count this chunk
  // starts/ends at — callers with a known real time range map these onto
  // real startMs/endMs; callers with per-word timestamps can ignore these
  // and derive exact timing directly instead (see
  // buildFallbackCaptionsFromWords below, which never needs fractions at
  // all since it always has a real timestamp per word already).
  startFraction: number;
  endFraction: number;
}

// Splits arbitrary caption text (the model's OWN phrasing — which may be
// a rephrased/translated version of the underlying transcript words, see
// gpt5.provider.ts's Hinglish/style-preset handling, so this must never
// assume a 1:1 mapping back onto specific transcript words) into chunks
// of at most MAX_WORDS_PER_CAPTION words each, formatted (punctuation +
// line-balanced) individually. A short text returns as a single chunk
// spanning the full [0, 1] fraction range.
export function splitTextIntoCaptionChunks(text: string): TextCaptionChunk[] {
  const punctuated = ensureTerminalPunctuation(text);
  const words = punctuated.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= MAX_WORDS_PER_CAPTION) {
    return [{ text: formatCaptionText(text), startFraction: 0, endFraction: 1 }];
  }
  const chunks: TextCaptionChunk[] = [];
  let consumed = 0;
  for (let i = 0; i < words.length; i += MAX_WORDS_PER_CAPTION) {
    const chunkWords = words.slice(i, i + MAX_WORDS_PER_CAPTION);
    const startFraction = consumed / words.length;
    consumed += chunkWords.length;
    const endFraction = consumed / words.length;
    chunks.push({ text: balanceCaptionLines(chunkWords).join("\n"), startFraction, endFraction });
  }
  return chunks;
}

export interface FallbackCaptionWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface FallbackCaption {
  text: string;
  startMs: number;
  endMs: number;
}

// The ONE real "never return empty captions" implementation — chunks REAL
// transcript words (never invented/estimated) directly into
// MAX_WORDS_PER_CAPTION-word, line-balanced, properly-punctuated
// captions, timed exactly from those words' own startMs/endMs. Used as: -
// MockReasoningProvider.plan()'s entire caption output (no real reasoning
// available at all); - gpt5.provider.ts's resolveCaptionTiming() fallback,
// ONLY when the real model proposed zero usable captions despite real
// transcript words existing (see that function's own doc comment) — never
// used to override or second-guess captions the model DID successfully
// propose.
export function buildFallbackCaptionsFromWords(words: FallbackCaptionWord[]): FallbackCaption[] {
  const captions: FallbackCaption[] = [];
  for (let i = 0; i < words.length; i += MAX_WORDS_PER_CAPTION) {
    const chunk = words.slice(i, i + MAX_WORDS_PER_CAPTION);
    if (chunk.length === 0) continue;
    captions.push({
      text: formatCaptionText(chunk.map((w) => w.word).join(" ")),
      startMs: chunk[0].startMs,
      endMs: chunk[chunk.length - 1].endMs,
    });
  }
  return captions;
}
