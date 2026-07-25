import { describe, expect, it } from "vitest";

import { allocateSceneDurations, computeProgress, splitScriptIntoSceneTexts } from "./engine";

describe("splitScriptIntoSceneTexts", () => {
  it("splits on [HOOK]/[BODY]/[CTA] markers", () => {
    const script = "[HOOK]\nGrab attention.\n\n[BODY]\nMain pitch.\n\n[CTA]\nCall to action.";
    expect(splitScriptIntoSceneTexts(script)).toEqual(["Grab attention.", "Main pitch.", "Call to action."]);
  });

  it("falls back to paragraph breaks when there are no markers", () => {
    const script = "First paragraph.\n\nSecond paragraph.";
    expect(splitScriptIntoSceneTexts(script)).toEqual(["First paragraph.", "Second paragraph."]);
  });

  it("falls back to a single scene for unstructured text", () => {
    expect(splitScriptIntoSceneTexts("Just one block of text, no breaks.")).toEqual([
      "Just one block of text, no breaks.",
    ]);
  });

  it("returns an empty array for an empty script", () => {
    expect(splitScriptIntoSceneTexts("   ")).toEqual([]);
  });

  it("caps at maxScenes, dropping the rest", () => {
    const script = "[HOOK]\nA\n\n[BODY]\nB\n\n[CTA]\nC";
    expect(splitScriptIntoSceneTexts(script, 2)).toEqual(["A", "B"]);
  });
});

describe("allocateSceneDurations", () => {
  it("returns an empty array for no scenes", () => {
    expect(allocateSceneDurations([], 30)).toEqual([]);
  });

  it("gives a single scene the full duration", () => {
    expect(allocateSceneDurations(["only scene"], 30)).toEqual([30]);
  });

  it("allocates proportionally to text length and sums to the total", () => {
    const texts = ["short", "a much longer piece of text here"];
    const durations = allocateSceneDurations(texts, 30, 1);
    expect(durations.reduce((sum, d) => sum + d, 0)).toBe(30);
    expect(durations[1]).toBeGreaterThan(durations[0]);
  });

  it("never allocates below the per-scene floor", () => {
    const texts = ["a", "a really very extremely long scene description by comparison"];
    const durations = allocateSceneDurations(texts, 10, 3);
    expect(durations[0]).toBeGreaterThanOrEqual(3);
  });
});

describe("computeProgress", () => {
  it("returns 0% for no scenes", () => {
    expect(computeProgress([])).toEqual({ percent: 0, total: 0, completed: 0, failed: 0 });
  });

  it("computes percent complete, rounding to the nearest integer", () => {
    const scenes = [{ status: "COMPLETED" }, { status: "COMPLETED" }, { status: "PENDING" }];
    expect(computeProgress(scenes)).toEqual({ percent: 67, total: 3, completed: 2, failed: 0 });
  });

  it("counts failed scenes separately from completed", () => {
    const scenes = [{ status: "COMPLETED" }, { status: "FAILED" }, { status: "RENDERING" }];
    expect(computeProgress(scenes)).toEqual({ percent: 33, total: 3, completed: 1, failed: 1 });
  });
});
