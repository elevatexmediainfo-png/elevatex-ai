import { describe, expect, it } from "vitest";
import { summarizePlanCounts } from "./ai-plan-summary";
import type { AITimelinePlan } from "@/lib/validations/ai-timeline";

function basePlan(overrides: Partial<AITimelinePlan> = {}): AITimelinePlan {
  return {
    version: 1,
    intake: { aspectRatio: "RATIO_16_9" },
    sceneRemoval: [],
    captions: [],
    zoom: [],
    broll: [],
    stickers: [],
    music: undefined,
    sfx: [],
    transitions: [],
    ...overrides,
  };
}

describe("summarizePlanCounts", () => {
  it("counts every section by array length", () => {
    const plan = basePlan({
      sceneRemoval: [{ startMs: 0, endMs: 100, reason: "silence" }],
      captions: [
        { text: "hi", startMs: 0, endMs: 100 },
        { text: "there", startMs: 100, endMs: 200 },
      ],
      zoom: [{ clipId: "c1", startMs: 0, endMs: 100, scaleFrom: 100, scaleTo: 150 }],
      sfx: [{ assetId: "a1", atMs: 500 }],
      transitions: [{ betweenClipIds: ["a", "b"], type: "CROSSFADE", durationMs: 500 }],
    });

    const counts = summarizePlanCounts(plan);

    expect(counts.sceneRemoval).toBe(1);
    expect(counts.captions).toBe(2);
    expect(counts.zoom).toBe(1);
    expect(counts.sfx).toBe(1);
    expect(counts.transitions).toBe(1);
  });

  it("counts music as 1 when present, 0 when absent", () => {
    expect(summarizePlanCounts(basePlan()).music).toBe(0);
    expect(summarizePlanCounts(basePlan({ music: { assetId: "m1", duckingEnabled: true } })).music).toBe(1);
  });

  it("splits broll into total vs. generated-only (stock excluded from brollGenerated)", () => {
    const plan = basePlan({
      broll: [
        { startMs: 0, endMs: 1000, trackHint: "broll", source: "stock", searchQuery: "city" },
        { startMs: 1000, endMs: 2000, trackHint: "broll", source: "generate", generation: { kind: "image", prompt: "a cat" } },
        { startMs: 2000, endMs: 3000, trackHint: "broll", source: "generate", generation: { kind: "video", prompt: "a dog" } },
      ],
    });

    const counts = summarizePlanCounts(plan);

    expect(counts.broll).toBe(3);
    expect(counts.brollGenerated).toBe(2);
  });

  it("returns all zeros for a fully empty plan", () => {
    expect(summarizePlanCounts(basePlan())).toEqual({
      sceneRemoval: 0,
      captions: 0,
      zoom: 0,
      broll: 0,
      brollGenerated: 0,
      stickers: 0,
      music: 0,
      sfx: 0,
      transitions: 0,
    });
  });
});
