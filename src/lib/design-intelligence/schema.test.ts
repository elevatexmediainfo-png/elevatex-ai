import { describe, expect, it } from "vitest";

import { assetAnalysisSchema, splitAssetAnalysis } from "./schema";

describe("assetAnalysisSchema", () => {
  it("accepts an empty object — every field optional", () => {
    const parsed = assetAnalysisSchema.parse({});
    expect(parsed.colorPalette).toEqual([]);
    expect(parsed.objects).toEqual([]);
    expect(parsed.industry).toBeUndefined();
  });

  it("accepts a fully-populated analysis result", () => {
    const parsed = assetAnalysisSchema.parse({
      industry: "hospitality",
      category: "lifestyle photography",
      style: "premium editorial",
      mood: "aspirational",
      platform: "instagram",
      lighting: "soft diffused key light",
      luxuryLevel: "high",
      colorPalette: ["gold", "cream"],
      objects: ["villa", "pool"],
      visualLanguage: "warm, restrained, grid-aligned",
    });
    expect(parsed.industry).toBe("hospitality");
    expect(parsed.colorPalette).toEqual(["gold", "cream"]);
  });

  it("tolerates unknown fields via catchall", () => {
    const parsed = assetAnalysisSchema.parse({ industry: "retail", futureField: "value" });
    expect((parsed as Record<string, unknown>).futureField).toBe("value");
  });
});

describe("splitAssetAnalysis", () => {
  it("promotes the 5 indexed fields and puts everything else in details", () => {
    const result = assetAnalysisSchema.parse({
      industry: "hospitality",
      category: "lifestyle",
      style: "editorial",
      mood: "aspirational",
      platform: "instagram",
      lighting: "soft light",
      colorPalette: ["gold"],
    });
    const { indexed, details } = splitAssetAnalysis(result);
    expect(indexed).toEqual({
      industry: "hospitality",
      category: "lifestyle",
      style: "editorial",
      mood: "aspirational",
      platform: "instagram",
    });
    expect(details).not.toHaveProperty("industry");
    expect(details).not.toHaveProperty("category");
    expect(details.lighting).toBe("soft light");
    expect(details.colorPalette).toEqual(["gold"]);
  });

  it("nulls out missing indexed fields rather than omitting them", () => {
    const result = assetAnalysisSchema.parse({});
    const { indexed } = splitAssetAnalysis(result);
    expect(indexed.industry).toBeNull();
    expect(indexed.style).toBeNull();
  });
});
