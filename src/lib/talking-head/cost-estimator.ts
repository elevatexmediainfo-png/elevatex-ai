import { computeCost, type CostRate } from "@/lib/generation/cost";
import type { AssetSelectionKind, AssetSelectionResult } from "./asset-selector";

// Milestone 11 Part 11 — Cost Optimization. Pure: sums lib/generation/
// cost.ts's existing, already-unit-tested computeCost() across every
// scene's asset-selector decision — no new cost-math, just totaling
// decisions the SAME waterfall (lib/talking-head/asset-selector.ts) already
// made. REUSE_*/STOCK decisions are always free (Part 11's rule); only
// AI_IMAGE/AI_VIDEO ever carry a nonzero cost. Surfaced via
// GET /api/videos/[id]/cost-estimate, shown to the user before any paid
// generation runs (Part 12's confirmed free-through-planning boundary).

export interface SceneCostInput {
  sceneId: string;
  durationSeconds: number;
  decision: AssetSelectionResult | null;
}

export interface CreditRateInput {
  aiImageCredits: number;
  aiVideoCreditsPerSecond: number;
}

export interface VendorRateInput {
  image?: CostRate;
  video?: CostRate;
}

export interface SceneCostEstimate {
  sceneId: string;
  decisionKind: AssetSelectionKind | "NONE";
  creditCost: number;
  vendorCostUsd: number;
}

export interface ProjectCostEstimate {
  scenes: SceneCostEstimate[];
  totalCreditCost: number;
  totalVendorCostUsd: number;
}

export function estimateProjectCost(
  scenes: SceneCostInput[],
  creditRates: CreditRateInput,
  vendorRates: VendorRateInput
): ProjectCostEstimate {
  const sceneEstimates: SceneCostEstimate[] = scenes.map((scene) => {
    if (!scene.decision) {
      return { sceneId: scene.sceneId, decisionKind: "NONE", creditCost: 0, vendorCostUsd: 0 };
    }

    if (scene.decision.kind === "AI_IMAGE") {
      return {
        sceneId: scene.sceneId,
        decisionKind: "AI_IMAGE",
        creditCost: Math.max(0, creditRates.aiImageCredits),
        vendorCostUsd: computeCost(vendorRates.image, { images: 1 }),
      };
    }

    if (scene.decision.kind === "AI_VIDEO") {
      return {
        sceneId: scene.sceneId,
        decisionKind: "AI_VIDEO",
        creditCost: Math.max(0, Math.ceil(creditRates.aiVideoCreditsPerSecond * scene.durationSeconds)),
        vendorCostUsd: computeCost(vendorRates.video, { seconds: scene.durationSeconds }),
      };
    }

    // REUSE_EXISTING / REUSE_BRAND / REUSE_UPLOADED / STOCK — no provider
    // call, no credits.
    return { sceneId: scene.sceneId, decisionKind: scene.decision.kind, creditCost: 0, vendorCostUsd: 0 };
  });

  return {
    scenes: sceneEstimates,
    totalCreditCost: sceneEstimates.reduce((sum, s) => sum + s.creditCost, 0),
    totalVendorCostUsd: sceneEstimates.reduce((sum, s) => sum + s.vendorCostUsd, 0),
  };
}
