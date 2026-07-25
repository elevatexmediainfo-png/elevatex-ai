import { describe, expect, it } from "vitest";

import { estimateProjectCost, type SceneCostInput } from "./cost-estimator";
import type { AssetSelectionResult } from "./asset-selector";

const creditRates = { aiImageCredits: 1, aiVideoCreditsPerSecond: 2 };
const vendorRates = { image: { unit: "PER_IMAGE" as const, rate: 0.04 }, video: { unit: "PER_SECOND" as const, rate: 0.3 } };

function decision(kind: AssetSelectionResult["kind"]): AssetSelectionResult {
  return { kind, mediaKind: kind === "AI_VIDEO" ? "VIDEO" : "IMAGE", reason: "test" };
}

describe("estimateProjectCost", () => {
  it("charges nothing for a scene with no decision (FACE_ONLY/TEXT_OVERLAY)", () => {
    const scenes: SceneCostInput[] = [{ sceneId: "s1", durationSeconds: 5, decision: null }];
    const result = estimateProjectCost(scenes, creditRates, vendorRates);
    expect(result.scenes[0]).toEqual({ sceneId: "s1", decisionKind: "NONE", creditCost: 0, vendorCostUsd: 0 });
  });

  it("charges nothing for reuse/stock decisions", () => {
    const scenes: SceneCostInput[] = [
      { sceneId: "s1", durationSeconds: 5, decision: decision("REUSE_EXISTING") },
      { sceneId: "s2", durationSeconds: 5, decision: decision("STOCK") },
    ];
    const result = estimateProjectCost(scenes, creditRates, vendorRates);
    expect(result.totalCreditCost).toBe(0);
    expect(result.totalVendorCostUsd).toBe(0);
  });

  it("charges aiImageCredits and the per-image vendor rate for AI_IMAGE", () => {
    const scenes: SceneCostInput[] = [{ sceneId: "s1", durationSeconds: 5, decision: decision("AI_IMAGE") }];
    const result = estimateProjectCost(scenes, creditRates, vendorRates);
    expect(result.scenes[0]).toEqual({ sceneId: "s1", decisionKind: "AI_IMAGE", creditCost: 1, vendorCostUsd: 0.04 });
  });

  it("charges duration-scaled credits and vendor cost for AI_VIDEO", () => {
    const scenes: SceneCostInput[] = [{ sceneId: "s1", durationSeconds: 5, decision: decision("AI_VIDEO") }];
    const result = estimateProjectCost(scenes, creditRates, vendorRates);
    expect(result.scenes[0]).toEqual({ sceneId: "s1", decisionKind: "AI_VIDEO", creditCost: 10, vendorCostUsd: 1.5 });
  });

  it("sums totals across multiple scenes", () => {
    const scenes: SceneCostInput[] = [
      { sceneId: "s1", durationSeconds: 5, decision: decision("AI_IMAGE") },
      { sceneId: "s2", durationSeconds: 4, decision: decision("AI_VIDEO") },
      { sceneId: "s3", durationSeconds: 3, decision: null },
    ];
    const result = estimateProjectCost(scenes, creditRates, vendorRates);
    expect(result.totalCreditCost).toBe(1 + 8);
    expect(result.totalVendorCostUsd).toBeCloseTo(0.04 + 1.2);
  });

  it("returns zero totals for no scenes", () => {
    const result = estimateProjectCost([], creditRates, vendorRates);
    expect(result).toEqual({ scenes: [], totalCreditCost: 0, totalVendorCostUsd: 0 });
  });
});
