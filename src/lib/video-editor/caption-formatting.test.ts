import { describe, expect, it } from "vitest";

import {
  balanceCaptionLines,
  buildFallbackCaptionsFromWords,
  ensureTerminalPunctuation,
  formatCaptionText,
  MAX_CAPTION_LINES,
  MAX_WORDS_PER_CAPTION,
  MAX_WORDS_PER_LINE,
  splitTextIntoCaptionChunks,
} from "./caption-formatting";

// Fix (2026-08-06, FIX 5 — "modern social-media captions: max 6 words per
// line, max 2 lines, automatic line balancing, emoji optional, proper
// punctuation, never return empty captions").

describe("constants", () => {
  it("caps at 6 words per line, 2 lines, 12 words per caption", () => {
    expect(MAX_WORDS_PER_LINE).toBe(6);
    expect(MAX_CAPTION_LINES).toBe(2);
    expect(MAX_WORDS_PER_CAPTION).toBe(12);
  });
});

describe("ensureTerminalPunctuation", () => {
  it("appends a period to text with no terminal punctuation", () => {
    expect(ensureTerminalPunctuation("Hello world")).toBe("Hello world.");
  });

  it("leaves text that already ends in ./!/?/… unchanged", () => {
    expect(ensureTerminalPunctuation("Are you ready?")).toBe("Are you ready?");
    expect(ensureTerminalPunctuation("Let's go!")).toBe("Let's go!");
    expect(ensureTerminalPunctuation("Wait…")).toBe("Wait…");
    expect(ensureTerminalPunctuation("Done.")).toBe("Done.");
  });

  it("leaves text ending in a closing quote/bracket after terminal punctuation unchanged", () => {
    expect(ensureTerminalPunctuation('She said "no."')).toBe('She said "no."');
  });

  it("does not treat a comma as terminal punctuation", () => {
    expect(ensureTerminalPunctuation("Wait, what")).toBe("Wait, what.");
  });

  it("returns an empty string unchanged for empty input", () => {
    expect(ensureTerminalPunctuation("")).toBe("");
    expect(ensureTerminalPunctuation("   ")).toBe("");
  });

  it("leaves an emoji at the end of the text untouched, still adding punctuation before it is not forced (emoji optional, left as-is)", () => {
    // Emoji is just another token here — this module never strips or
    // injects one, per the "emoji optional" requirement.
    expect(ensureTerminalPunctuation("So excited 🎉")).toBe("So excited 🎉.");
  });
});

describe("balanceCaptionLines", () => {
  it("keeps 6 or fewer words on a single line", () => {
    expect(balanceCaptionLines(["one", "two", "three"])).toEqual(["one two three"]);
    expect(balanceCaptionLines(["a", "b", "c", "d", "e", "f"])).toEqual(["a b c d e f"]);
  });

  it("balances 7 words as 4+3, not a lopsided 6+1", () => {
    expect(balanceCaptionLines(["a", "b", "c", "d", "e", "f", "g"])).toEqual(["a b c d", "e f g"]);
  });

  it("balances 8 words as 4+4", () => {
    expect(balanceCaptionLines(Array.from({ length: 8 }, (_, i) => `w${i}`))).toEqual(["w0 w1 w2 w3", "w4 w5 w6 w7"]);
  });

  it("caps each line at 6 words even for a 12-word input (6+6)", () => {
    expect(balanceCaptionLines(Array.from({ length: 12 }, (_, i) => `w${i}`))).toEqual(["w0 w1 w2 w3 w4 w5", "w6 w7 w8 w9 w10 w11"]);
  });

  it("returns an empty array for no words", () => {
    expect(balanceCaptionLines([])).toEqual([]);
  });
});

describe("formatCaptionText", () => {
  it("punctuates and keeps a short caption on one line", () => {
    expect(formatCaptionText("This is great")).toBe("This is great.");
  });

  it("punctuates and balances a longer caption across two lines", () => {
    expect(formatCaptionText("this is a genuinely longer caption text")).toBe("this is a genuinely\nlonger caption text.");
  });
});

describe("splitTextIntoCaptionChunks", () => {
  it("returns one chunk spanning the full [0,1] range for text at or under the 12-word cap", () => {
    const chunks = splitTextIntoCaptionChunks("a short caption");
    expect(chunks).toEqual([{ text: "a short caption.", startFraction: 0, endFraction: 1 }]);
  });

  it("splits text over 12 words into multiple chunks with contiguous, monotonic fractions", () => {
    const words = Array.from({ length: 14 }, (_, i) => `w${i}`).join(" ");
    const chunks = splitTextIntoCaptionChunks(words);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].startFraction).toBe(0);
    expect(chunks[0].endFraction).toBe(chunks[1].startFraction);
    expect(chunks[1].endFraction).toBe(1);
    for (const chunk of chunks) {
      const lines = chunk.text.split("\n");
      expect(lines.length).toBeLessThanOrEqual(2);
      for (const line of lines) {
        expect(line.split(" ").length).toBeLessThanOrEqual(6);
      }
    }
  });

  it("returns an empty array for empty text", () => {
    expect(splitTextIntoCaptionChunks("")).toEqual([]);
    expect(splitTextIntoCaptionChunks("   ")).toEqual([]);
  });
});

describe("buildFallbackCaptionsFromWords", () => {
  it("never returns an empty array when real words exist", () => {
    const words = [{ word: "hi", startMs: 0, endMs: 100 }];
    expect(buildFallbackCaptionsFromWords(words).length).toBeGreaterThan(0);
  });

  it("returns an empty array for no words (nothing to caption)", () => {
    expect(buildFallbackCaptionsFromWords([])).toEqual([]);
  });

  it("chunks at most MAX_WORDS_PER_CAPTION words per caption, timed from the real words at each chunk's boundary", () => {
    const words = Array.from({ length: 25 }, (_, i) => ({ word: `w${i}`, startMs: i * 100, endMs: i * 100 + 90 }));
    const captions = buildFallbackCaptionsFromWords(words);

    expect(captions).toHaveLength(3); // 12, 12, 1
    expect(captions[0].startMs).toBe(words[0].startMs);
    expect(captions[0].endMs).toBe(words[11].endMs);
    expect(captions[1].startMs).toBe(words[12].startMs);
    expect(captions[1].endMs).toBe(words[23].endMs);
    expect(captions[2].startMs).toBe(words[24].startMs);
    expect(captions[2].endMs).toBe(words[24].endMs);
    for (const caption of captions) {
      expect(caption.text).toMatch(/[.!?…]$/);
    }
  });
});
