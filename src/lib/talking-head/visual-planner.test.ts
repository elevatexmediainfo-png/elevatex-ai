import { describe, expect, it } from "vitest";

import { buildVisualPlanPrompt, groupSegmentsIntoScenes, parseVisualPlanResponse } from "./visual-planner";

describe("buildVisualPlanPrompt", () => {
  it("includes tag and cue hints", () => {
    const prompt = buildVisualPlanPrompt([
      { order: 0, text: "Our new app launches today.", tags: ["launch"], isHook: true, isCTA: false },
    ]);
    expect(prompt).toContain("[tags: launch]");
    expect(prompt).toContain("[hook]");
    expect(prompt).toContain("1.");
  });
});

describe("parseVisualPlanResponse", () => {
  it("parses well-formed numbered lines", () => {
    const raw = "1: B_ROLL\n2: FACE_ONLY\n3: GRAPH";
    expect(parseVisualPlanResponse(raw, 3)).toEqual(["B_ROLL", "FACE_ONLY", "GRAPH"]);
  });

  it("falls back to FACE_ONLY for an invalid visual type", () => {
    const raw = "1: HOLOGRAM\n2: B_ROLL";
    expect(parseVisualPlanResponse(raw, 2)).toEqual(["FACE_ONLY", "B_ROLL"]);
  });

  it("falls back to FACE_ONLY for missing lines", () => {
    const raw = "1: IMAGE";
    expect(parseVisualPlanResponse(raw, 3)).toEqual(["IMAGE", "FACE_ONLY", "FACE_ONLY"]);
  });

  it("returns all FACE_ONLY for unparseable input", () => {
    expect(parseVisualPlanResponse("nonsense", 2)).toEqual(["FACE_ONLY", "FACE_ONLY"]);
  });
});

describe("groupSegmentsIntoScenes", () => {
  it("merges contiguous segments sharing the same visual type and paragraph", () => {
    const segments = [
      { id: "s1", order: 0, text: "Hi everyone.", startMs: 0, endMs: 1000, paragraphIndex: 0 },
      { id: "s2", order: 1, text: "Welcome to the show.", startMs: 1000, endMs: 2500, paragraphIndex: 0 },
    ];
    const scenes = groupSegmentsIntoScenes(segments, ["FACE_ONLY", "FACE_ONLY"]);
    expect(scenes).toEqual([
      {
        order: 0,
        text: "Hi everyone. Welcome to the show.",
        visualType: "FACE_ONLY",
        durationSeconds: 3,
        segmentIds: ["s1", "s2"],
      },
    ]);
  });

  it("starts a new scene when the visual type changes", () => {
    const segments = [
      { id: "s1", order: 0, text: "Our product helps you save time.", startMs: 0, endMs: 2000, paragraphIndex: 0 },
      { id: "s2", order: 1, text: "Here's a quick demo.", startMs: 2000, endMs: 4000, paragraphIndex: 0 },
    ];
    const scenes = groupSegmentsIntoScenes(segments, ["FACE_ONLY", "B_ROLL"]);
    expect(scenes).toHaveLength(2);
    expect(scenes[0].visualType).toBe("FACE_ONLY");
    expect(scenes[1].visualType).toBe("B_ROLL");
  });

  it("starts a new scene at a paragraph boundary even with the same visual type", () => {
    const segments = [
      { id: "s1", order: 0, text: "First idea.", startMs: 0, endMs: 1000, paragraphIndex: 0 },
      { id: "s2", order: 1, text: "Second idea.", startMs: 2500, endMs: 3500, paragraphIndex: 1 },
    ];
    const scenes = groupSegmentsIntoScenes(segments, ["FACE_ONLY", "FACE_ONLY"]);
    expect(scenes).toHaveLength(2);
    expect(scenes[0].segmentIds).toEqual(["s1"]);
    expect(scenes[1].segmentIds).toEqual(["s2"]);
  });

  it("returns an empty array for no segments", () => {
    expect(groupSegmentsIntoScenes([], [])).toEqual([]);
  });

  it("enforces a minimum duration of 1 second", () => {
    const segments = [{ id: "s1", order: 0, text: "Quick.", startMs: 0, endMs: 100, paragraphIndex: 0 }];
    const scenes = groupSegmentsIntoScenes(segments, ["FACE_ONLY"]);
    expect(scenes[0].durationSeconds).toBe(1);
  });
});
