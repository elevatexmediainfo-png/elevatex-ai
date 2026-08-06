import { describe, expect, it } from "vitest";

import { MockReasoningProvider } from "./mock.provider";
import type { ReasoningPlanRequest } from "./types";

describe("MockReasoningProvider.plan", () => {
  // Fix (2026-08-06, FIX 5) — captions are now chunked/formatted via the
  // SHARED buildFallbackCaptionsFromWords (caption-formatting.ts), not an
  // inline "~8 words" loop: max 12 words per caption (2 lines x 6 words),
  // line-balanced, properly punctuated. 10 words fits entirely within one
  // 12-word caption, formatted as 2 balanced lines.
  it("chunks words into a line-balanced, punctuated caption and returns no zoom when videoAnalysis is null", async () => {
    const req: ReasoningPlanRequest = {
      words: Array.from({ length: 10 }, (_, i) => ({ word: `w${i}`, startMs: i * 100, endMs: i * 100 + 90 })),
      videoAnalysis: null,
      sourceDurationMs: 1000,
      survivingSegmentCount: 1,
    };
    const provider = new MockReasoningProvider();
    const result = await provider.plan(req);

    expect(result.captions).toEqual([
      { text: "w0 w1 w2 w3 w4\nw5 w6 w7 w8 w9.", startMs: 0, endMs: 990, reveal: expect.objectContaining({ mode: "WORD" }) },
    ]);
    expect(result.zoom).toEqual([]);
    expect(result.broll).toEqual([]);
    expect(result.stickers).toEqual([]);
    expect(result.sfx).toEqual([]);
    expect(result.transitions).toEqual([]);
    expect(result.music).toBeUndefined();
  });

  it("splits a transcript longer than 12 words into multiple captions, each at most 2 lines of at most 6 words", async () => {
    const req: ReasoningPlanRequest = {
      words: Array.from({ length: 25 }, (_, i) => ({ word: `w${i}`, startMs: i * 100, endMs: i * 100 + 90 })),
      videoAnalysis: null,
      sourceDurationMs: 3000,
      survivingSegmentCount: 1,
    };
    const provider = new MockReasoningProvider();
    const result = await provider.plan(req);

    // 25 words / 12-per-caption -> 3 captions (12, 12, 1).
    expect(result.captions).toHaveLength(3);
    for (const caption of result.captions) {
      const lines = caption.text.split("\n");
      expect(lines.length).toBeLessThanOrEqual(2);
      for (const line of lines) {
        expect(line.split(" ").length).toBeLessThanOrEqual(6);
      }
      // Proper punctuation — every caption ends in a real terminal mark.
      expect(caption.text).toMatch(/[.!?…]$/);
    }
  });

  it("never returns an empty captions array when real transcript words exist", async () => {
    const req: ReasoningPlanRequest = {
      words: [{ word: "hi", startMs: 0, endMs: 100 }],
      videoAnalysis: null,
      sourceDurationMs: 100,
      survivingSegmentCount: 1,
    };
    const provider = new MockReasoningProvider();
    const result = await provider.plan(req);

    expect(result.captions.length).toBeGreaterThan(0);
  });

  it("proposes one zoom per emphasis moment when videoAnalysis is provided", async () => {
    const req: ReasoningPlanRequest = {
      words: [{ word: "hi", startMs: 0, endMs: 100 }],
      videoAnalysis: {
        emphasisMoments: [
          { startMs: 100, endMs: 300, description: "a" },
          { startMs: 500, endMs: 700, description: "b" },
        ],
        emotionBeats: [],
        visualContext: [],
      },
      sourceDurationMs: 1000,
      survivingSegmentCount: 1,
    };
    const provider = new MockReasoningProvider();
    const result = await provider.plan(req);

    expect(result.zoom).toEqual([
      { startMs: 100, endMs: 300, scaleFrom: 100, scaleTo: 115 },
      { startMs: 500, endMs: 700, scaleFrom: 100, scaleTo: 115 },
    ]);
  });
});
