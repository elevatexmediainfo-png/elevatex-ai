import { describe, expect, it } from "vitest";

import { ExecutionTreeBuilder } from "./stage-tracer";
import { buildProviderReport } from "./provider-report";
import { buildInfluenceGraph } from "./influence-graph";
import { buildRuntimeReport } from "./report";
import { assembleFinalReport } from "./final-report";
import { detectSceneGraphConsumption } from "./provenance";

import { buildSceneGraph } from "../scene-graph";
import { buildPromptSpecification } from "../prompt-spec";
import { compileToVisualLanguage, applyCompiledPrompt } from "../prompt-compiler";
import { optimizePromptSpecification } from "../prompt-optimizer";
import { translateForProvider } from "../provider-translator";
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

// Phase 10.6D — Performance tests.
// The tracer is read-only observation over data the pipeline already computes
// (timing wrappers + text/field analysis) — it must add negligible overhead
// on top of the pipeline cost Phase 10.6C already measured and budgeted.

function makeBlueprintAndScene(rawIdea: string): { blueprint: UniversalCampaignBlueprint; scene: VisualScenePlan } {
  const request: CreativeRequest = { userId: "trace-perf", rawIdea, kind: "SOCIAL_MEDIA", presetKey: "instagram_post", requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "trace-perf" });
  const strategy = buildCreativeStrategy(ctx);
  const plan = buildCampaignPlan(strategy);
  const layout = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  const blueprint = assembleBlueprint({ context: ctx, strategy, campaignPlan: plan, layoutPlan: layout, typographyPlan: typography });
  const scene = buildVisualScenePlan(blueprint);
  return { blueprint, scene };
}

function fullTraced(blueprint: UniversalCampaignBlueprint, scene: VisualScenePlan) {
  const tracer = new ExecutionTreeBuilder("perf-test");
  const strategy = buildCreativeStrategy(buildCreativeContext({ userId: "x", rawIdea: "x", kind: "SOCIAL_MEDIA", presetKey: "instagram_post", requestedAt: new Date() }, analyzeUserRequest({ userId: "x", rawIdea: "x", kind: "SOCIAL_MEDIA", presetKey: "instagram_post", requestedAt: new Date() }), {}, { userId: "x" }));
  tracer.recordCreativeBrain(strategy, 1);

  const sceneGraph = buildSceneGraph(blueprint, scene);
  tracer.recordScenePlanner(blueprint, scene, 1);
  tracer.recordSceneGraphCompiler(scene, sceneGraph, 1);

  const specBeforeCompile = buildPromptSpecification(blueprint, scene, undefined, sceneGraph);
  tracer.recordPromptSpecification(specBeforeCompile, sceneGraph, 1);

  const compiled = compileToVisualLanguage(specBeforeCompile);
  const spec = applyCompiledPrompt(specBeforeCompile, compiled);
  tracer.recordPromptVisualCompiler(specBeforeCompile, spec, compiled, 1);

  const optimized = optimizePromptSpecification(spec);
  tracer.recordPromptOptimizer(spec, optimized, 1);

  const providerPrompt = translateForProvider(optimized, "openai");
  const sceneGraphConsumption = detectSceneGraphConsumption(spec, sceneGraph);
  const compilerFieldsConsumed = compiled.fields.filter((f) => (f.classification === "A" || f.classification === "B") && f.compiledValue !== undefined && f.compiledValue !== f.originalValue).map((f) => f.path);
  tracer.recordProviderTranslator(optimized, providerPrompt, 1, sceneGraphConsumption.specFieldsConsumed, compilerFieldsConsumed);

  const providerTraces = buildProviderReport(optimized, sceneGraphConsumption.specFieldsConsumed, compilerFieldsConsumed);
  const influenceGraph = buildInfluenceGraph(optimized.optimizedSpec, compiled, providerPrompt.body.finalPrompt, "openai");
  const executionTree = tracer.build("openai", providerPrompt.body.finalPrompt);
  const runtimeReport = buildRuntimeReport(executionTree, compiled, providerTraces);
  return assembleFinalReport(executionTree, runtimeReport, providerTraces, influenceGraph);
}

describe("Phase 10.6D performance", () => {
  // fullTraced() rebuilds the ENTIRE pipeline (Creative Brain through
  // Provider Translator) plus the tracer's own analysis and a 4-provider
  // comparison report — the heaviest single operation measured anywhere in
  // this test suite. Budget carries the same full-suite-parallel-load
  // headroom documented in prompt-compiler/performance.test.ts and
  // prompt-compiler/pipeline-performance.test.ts: best-of-5 protects against
  // a transient scheduler blip, but not against genuinely sustained
  // contention across the whole sampling window (measured up to ~450ms
  // best-of-5 when vitest runs the complete ~99-file suite in parallel,
  // against ~150-200ms typical) — still negligible next to a real
  // image-generation API call's 5-30+ second latency.
  it("adds well under 700ms of tracing overhead on top of one already-built blueprint/scene (best of 5 trials)", () => {
    const { blueprint, scene } = makeBlueprintAndScene("Restaurant Grand Opening Celebration");
    // Warm up (module-level lazy init, JIT) before measuring.
    fullTraced(blueprint, scene);

    let best = Infinity;
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      fullTraced(blueprint, scene);
      best = Math.min(best, performance.now() - start);
    }
    expect(best).toBeLessThan(700);
  }, 60000);

  it("does not leak memory pathologically across repeated tracing (smoke check via batch)", () => {
    const { blueprint, scene } = makeBlueprintAndScene("Jewellery Wedding Collection Campaign");
    expect(() => {
      for (let i = 0; i < 100; i++) fullTraced(blueprint, scene);
    }).not.toThrow();
  }, 60000);
});
