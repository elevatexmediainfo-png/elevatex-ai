import { describe, expect, it } from "vitest";
import { filterAcceptedPlan, itemKey } from "./ai-review-selection";
import { AI_TIMELINE_SCHEMA_VERSION, type AITimelinePlan } from "@/lib/validations/ai-timeline";

// Phase 12 Module 7 — filterAcceptedPlan is the ONLY thing that changes
// between "what the AI proposed" and "what Apply actually sends to the
// translator": everything else in handleApply is unchanged. Tested in
// isolation here (pure, no React/DOM needed) since it's the one piece of
// real logic in an otherwise presentational component.
function emptyPlan(overrides: Partial<AITimelinePlan> = {}): AITimelinePlan {
  return {
    version: AI_TIMELINE_SCHEMA_VERSION,
    intake: { aspectRatio: "RATIO_16_9" },
    sceneRemoval: [],
    captions: [],
    zoom: [],
    broll: [],
    stickers: [],
    sfx: [],
    transitions: [],
    ...overrides,
  };
}

describe("filterAcceptedPlan", () => {
  it("keeps every item when nothing is deselected", () => {
    const plan = emptyPlan({
      sceneRemoval: [{ startMs: 0, endMs: 1000, reason: "silence" }],
      captions: [{ text: "a", startMs: 0, endMs: 1000 }],
    });
    const result = filterAcceptedPlan("job-1", plan, new Set());
    expect(result.sceneRemoval).toHaveLength(1);
    expect(result.captions).toHaveLength(1);
  });

  it("drops exactly the deselected item, keeps the rest in the same section", () => {
    const plan = emptyPlan({
      captions: [
        { text: "keep me", startMs: 0, endMs: 1000 },
        { text: "drop me", startMs: 1000, endMs: 2000 },
        { text: "keep me too", startMs: 2000, endMs: 3000 },
      ],
    });
    const deselected = new Set([itemKey("job-1", "captions", 1)]);
    const result = filterAcceptedPlan("job-1", plan, deselected);
    expect(result.captions.map((c) => c.text)).toEqual(["keep me", "keep me too"]);
  });

  it("scopes deselection to the given jobId — the same index in a DIFFERENT job's section is unaffected", () => {
    const plan = emptyPlan({ captions: [{ text: "a", startMs: 0, endMs: 1000 }] });
    const deselected = new Set([itemKey("some-other-job", "captions", 0)]);
    const result = filterAcceptedPlan("job-1", plan, deselected);
    expect(result.captions).toHaveLength(1);
  });

  it("deselecting the music pseudo-item (index 0) turns music into undefined", () => {
    const plan = emptyPlan({ music: { searchQuery: "upbeat", duckingEnabled: true } });
    const deselected = new Set([itemKey("job-1", "music", 0)]);
    const result = filterAcceptedPlan("job-1", plan, deselected);
    expect(result.music).toBeUndefined();
  });

  it("leaves music untouched when it isn't deselected", () => {
    const plan = emptyPlan({ music: { searchQuery: "upbeat", duckingEnabled: true } });
    const result = filterAcceptedPlan("job-1", plan, new Set());
    expect(result.music).toEqual({ searchQuery: "upbeat", duckingEnabled: true });
  });

  it("deselecting everything across every section produces a fully empty (but still valid) plan", () => {
    const plan = emptyPlan({
      sceneRemoval: [{ startMs: 0, endMs: 1000, reason: "silence" }],
      captions: [{ text: "a", startMs: 0, endMs: 1000 }],
      zoom: [{ clipId: "c1", startMs: 0, endMs: 1000, scaleFrom: 100, scaleTo: 120 }],
      broll: [{ startMs: 0, endMs: 1000, trackHint: "broll", source: "stock", searchQuery: "x" }],
      stickers: [{ startMs: 0, endMs: 1000, assetQuery: "y" }],
      sfx: [{ atMs: 0, assetQuery: "z" }],
      transitions: [{ betweenClipIds: ["a", "b"], type: "CROSSFADE", durationMs: 500 }],
      music: { searchQuery: "upbeat", duckingEnabled: true },
    });
    const deselected = new Set([
      itemKey("job-1", "sceneRemoval", 0),
      itemKey("job-1", "captions", 0),
      itemKey("job-1", "zoom", 0),
      itemKey("job-1", "broll", 0),
      itemKey("job-1", "stickers", 0),
      itemKey("job-1", "sfx", 0),
      itemKey("job-1", "transitions", 0),
      itemKey("job-1", "music", 0),
    ]);
    const result = filterAcceptedPlan("job-1", plan, deselected);
    expect(result).toEqual(emptyPlan());
  });
});
