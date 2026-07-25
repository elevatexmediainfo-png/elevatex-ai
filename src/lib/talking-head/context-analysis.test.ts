import { describe, expect, it } from "vitest";

import {
  buildContextAnalysisPrompt,
  chunkSegments,
  emptySegmentAnalysis,
  parseContextAnalysisResponse,
} from "./context-analysis";

describe("chunkSegments", () => {
  it("splits into fixed-size chunks", () => {
    expect(chunkSegments([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns one chunk when size exceeds the array length", () => {
    expect(chunkSegments([1, 2], 8)).toEqual([[1, 2]]);
  });

  it("returns an empty array for an empty input", () => {
    expect(chunkSegments([], 4)).toEqual([]);
  });
});

describe("buildContextAnalysisPrompt", () => {
  it("numbers sentences starting at 1", () => {
    const prompt = buildContextAnalysisPrompt([
      { order: 0, text: "Hello there." },
      { order: 1, text: "Buy now." },
    ]);
    expect(prompt).toContain("1. Hello there.");
    expect(prompt).toContain("2. Buy now.");
  });
});

describe("parseContextAnalysisResponse", () => {
  it("parses a well-formed response", () => {
    const raw = [
      "SENTENCE 1:",
      "COMPANIES: Acme Corp",
      "PRODUCTS: Widget Pro",
      "NUMBERS: 50",
      "DATES: NONE",
      "LOCATIONS: NONE",
      "CONCEPTS: urgency",
      "STATISTICS: NONE",
      "HOOK: YES",
      "CTA: NO",
      "EMOTION: excited",
      "TAGS: intro, hook",
    ].join("\n");

    const [analysis] = parseContextAnalysisResponse(raw, 1);
    expect(analysis).toEqual({
      companies: ["Acme Corp"],
      products: ["Widget Pro"],
      numbers: ["50"],
      dates: [],
      locations: [],
      concepts: ["urgency"],
      statistics: [],
      isHook: true,
      isCTA: false,
      emotion: "excited",
      tags: ["intro", "hook"],
    });
  });

  it("backfills missing sentences with an empty analysis", () => {
    const raw = "SENTENCE 1:\nCOMPANIES: NONE\nPRODUCTS: NONE\nHOOK: NO\nCTA: NO\nEMOTION: neutral\nTAGS: NONE";
    const result = parseContextAnalysisResponse(raw, 3);
    expect(result).toHaveLength(3);
    expect(result[1]).toEqual(emptySegmentAnalysis());
    expect(result[2]).toEqual(emptySegmentAnalysis());
  });

  it("returns all-empty analyses for unparseable input", () => {
    const result = parseContextAnalysisResponse("not the expected format at all", 2);
    expect(result).toEqual([emptySegmentAnalysis(), emptySegmentAnalysis()]);
  });
});
