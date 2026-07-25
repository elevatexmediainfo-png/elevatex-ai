import { describe, expect, it } from "vitest";

import { MockReasoningProvider } from "./mock.provider";
import type { ReasoningPlanRequest } from "./types";

describe("MockReasoningProvider.plan", () => {
  it("chunks words into captions and returns no zoom when videoAnalysis is null", async () => {
    const req: ReasoningPlanRequest = {
      words: Array.from({ length: 10 }, (_, i) => ({ word: `w${i}`, startMs: i * 100, endMs: i * 100 + 90 })),
      videoAnalysis: null,
      sourceDurationMs: 1000,
      survivingSegmentCount: 1,
    };
    const provider = new MockReasoningProvider();
    const result = await provider.plan(req);

    expect(result.captions.length).toBeGreaterThan(0);
    expect(result.captions[0].text).toBe("w0 w1 w2 w3 w4 w5 w6 w7");
    expect(result.zoom).toEqual([]);
    expect(result.broll).toEqual([]);
    expect(result.stickers).toEqual([]);
    expect(result.sfx).toEqual([]);
    expect(result.transitions).toEqual([]);
    expect(result.music).toBeUndefined();
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
