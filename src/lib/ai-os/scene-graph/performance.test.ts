import { describe, expect, it } from "vitest";

import { buildSceneGraph } from "./engine";
import { assembleBlueprint } from "../blueprint";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCampaignPlan } from "../creative-director";
import { buildVisualLayoutPlan } from "../visual-layout";
import { buildTypographyPlan } from "../typography";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import { buildVisualScenePlan } from "../scene-planner/engine";
import type { CreativeRequest } from "../types";
import type { UniversalCampaignBlueprint } from "../blueprint/types";
import type { VisualScenePlan } from "../scene-planner/types";

// Phase 10.6B — Performance tests.
// buildSceneGraph() is a pure, synchronous, in-memory transformation (no I/O,
// no network, no LLM calls) — every axis is a plain array index computed from
// a cheap djb2 hash. Budgets below are calibrated from real measurement, not
// assumption, following the same methodology as the Phase 10.6A performance
// suite it sits directly upstream of.

function makeBlueprintAndScene(rawIdea: string): { blueprint: UniversalCampaignBlueprint; scene: VisualScenePlan } {
  const request: CreativeRequest = { userId: "perf", rawIdea, kind: "SOCIAL_MEDIA", presetKey: "instagram_post", requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "perf" });
  const strategy = buildCreativeStrategy(ctx);
  const plan = buildCampaignPlan(strategy);
  const layout = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  const blueprint = assembleBlueprint({ context: ctx, strategy, campaignPlan: plan, layoutPlan: layout, typographyPlan: typography });
  const scene = buildVisualScenePlan(blueprint);
  return { blueprint, scene };
}

describe("Phase 10.6B performance", () => {
  it("compiles a single scene graph in well under 100ms", () => {
    const { blueprint, scene } = makeBlueprintAndScene("Restaurant Grand Opening Celebration");
    const start = performance.now();
    buildSceneGraph(blueprint, scene);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it("compiles 200 pre-built blueprint/scene pairs (compiler only) in under 5 seconds total", () => {
    const pairs = Array.from({ length: 200 }, (_, i) => makeBlueprintAndScene(`Dental Implant Informative Creative variant ${i}`));
    const start = performance.now();
    for (const { blueprint, scene } of pairs) buildSceneGraph(blueprint, scene);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  it("average per-compilation cost stays under 25ms across 200 runs", () => {
    const pairs = Array.from({ length: 200 }, (_, i) => makeBlueprintAndScene(`Jewellery Wedding Collection variant ${i}`));
    const start = performance.now();
    for (const { blueprint, scene } of pairs) buildSceneGraph(blueprint, scene);
    const elapsed = performance.now() - start;
    expect(elapsed / pairs.length).toBeLessThan(25);
  });

  it("does not leak memory pathologically across repeated compilation (smoke check via large batch)", () => {
    const { blueprint, scene } = makeBlueprintAndScene("Real Estate Luxury Villa Site Visit Campaign");
    expect(() => {
      for (let i = 0; i < 500; i++) buildSceneGraph(blueprint, scene);
    }).not.toThrow();
  });
});
