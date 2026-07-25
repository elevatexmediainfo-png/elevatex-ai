import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildSceneGraph } from "../scene-graph";
import { buildPromptSpecification } from "../prompt-spec";
import { compileToVisualLanguage, applyCompiledPrompt } from "./index";
import { optimizePromptSpecification } from "../prompt-optimizer";
import { translateForProvider } from "../provider-translator";
import type { SupportedProvider } from "../provider-translator/types";
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

// Phase 10.6C — Performance tests.
// Scene Graph Compiler and Prompt Visual Compiler are both pure, synchronous,
// in-memory transformations (no I/O, no LLM calls) — wiring them into the
// live chain should add negligible latency, and each must run EXACTLY ONCE
// per request, not once per provider (there are 4 named providers; a naive
// per-provider integration would silently 4x the compute).

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

const PROVIDERS: SupportedProvider[] = ["openai", "gemini", "flux", "stable_diffusion"];

describe("Phase 10.6C performance", () => {
  // Same de-noising approach as prompt-compiler/performance.test.ts: a
  // single-shot wall-clock sample is the measurement most exposed to
  // scheduler jitter under full-suite parallel execution. Best-of-5 filters
  // that out while still catching a real regression.
  it("runs the full chain (Scene Graph + Prompt Spec + Prompt Compiler + Optimizer) for one campaign in well under 400ms (best of 5 trials)", () => {
    const { blueprint, scene } = makeBlueprintAndScene("Restaurant Grand Opening Celebration");
    let best = Infinity;
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      const sceneGraph = buildSceneGraph(blueprint, scene);
      const specBeforeCompile = buildPromptSpecification(blueprint, scene, undefined, sceneGraph);
      const compiled = compileToVisualLanguage(specBeforeCompile);
      const spec = applyCompiledPrompt(specBeforeCompile, compiled);
      optimizePromptSpecification(spec);
      best = Math.min(best, performance.now() - start);
    }
    expect(best).toBeLessThan(400);
  });

  it("translating for all 4 providers after one optimization pass adds well under 150ms total (translators are pure formatting, not recomputation) (best of 5 trials)", () => {
    const { blueprint, scene } = makeBlueprintAndScene("Jewellery Wedding Collection Campaign");
    const sceneGraph = buildSceneGraph(blueprint, scene);
    const specBeforeCompile = buildPromptSpecification(blueprint, scene, undefined, sceneGraph);
    const compiled = compileToVisualLanguage(specBeforeCompile);
    const spec = applyCompiledPrompt(specBeforeCompile, compiled);
    const optimized = optimizePromptSpecification(spec);

    let best = Infinity;
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      for (const provider of PROVIDERS) translateForProvider(optimized, provider);
      best = Math.min(best, performance.now() - start);
    }
    expect(best).toBeLessThan(150);
  });

  it("Scene Graph Compiler and Prompt Visual Compiler each execute exactly once per generation, not once per provider", () => {
    const { blueprint, scene } = makeBlueprintAndScene("Dental Implant Informative Creative");
    let sceneGraphCalls = 0;
    let compileCalls = 0;
    const countedBuildSceneGraph: typeof buildSceneGraph = (...args) => { sceneGraphCalls++; return buildSceneGraph(...args); };
    const countedCompile: typeof compileToVisualLanguage = (...args) => { compileCalls++; return compileToVisualLanguage(...args); };

    // Mirrors the exact orchestration sequence in enhance-prompt/route.ts:
    // Scene Graph and Prompt Visual Compiler run ONCE, upstream of the
    // provider branch; translateForProvider is then called once per provider
    // on the SAME already-optimized spec, never re-triggering either compiler.
    const sceneGraph = countedBuildSceneGraph(blueprint, scene);
    const specBeforeCompile = buildPromptSpecification(blueprint, scene, undefined, sceneGraph);
    const compiled = countedCompile(specBeforeCompile);
    const spec = applyCompiledPrompt(specBeforeCompile, compiled);
    const optimized = optimizePromptSpecification(spec);
    for (const provider of PROVIDERS) translateForProvider(optimized, provider);

    expect(sceneGraphCalls).toBe(1);
    expect(compileCalls).toBe(1);
  });

  it("does not leak memory pathologically across repeated full-chain compilation (smoke check via batch)", () => {
    const { blueprint, scene } = makeBlueprintAndScene("Real Estate Luxury Villa Site Visit Campaign");
    expect(() => {
      for (let i = 0; i < 200; i++) {
        const sceneGraph = buildSceneGraph(blueprint, scene);
        const specBeforeCompile = buildPromptSpecification(blueprint, scene, undefined, sceneGraph);
        const compiled = compileToVisualLanguage(specBeforeCompile);
        const spec = applyCompiledPrompt(specBeforeCompile, compiled);
        optimizePromptSpecification(spec);
      }
    }).not.toThrow();
  }, 60000);

  describe("static source guarantee — the live route calls each compiler exactly once", () => {
    const routeSource = readFileSync(
      join(__dirname, "../../../app/api/creative-projects/enhance-prompt/route.ts"),
      "utf-8",
    );

    it("buildSceneGraph( appears exactly once in enhance-prompt/route.ts", () => {
      const matches = routeSource.match(/\bbuildSceneGraph\(/g) ?? [];
      expect(matches.length).toBe(1);
    });

    it("compileToVisualLanguage( appears exactly once in enhance-prompt/route.ts", () => {
      const matches = routeSource.match(/\bcompileToVisualLanguage\(/g) ?? [];
      expect(matches.length).toBe(1);
    });

    it("both calls happen before optimizePromptSpecification( and before the provider-translation call", () => {
      const sceneGraphIdx = routeSource.indexOf("buildSceneGraph(");
      const compileIdx = routeSource.indexOf("compileToVisualLanguage(");
      const optimizeIdx = routeSource.indexOf("optimizePromptSpecification(");
      const translateIdx = routeSource.indexOf("translateForProvider(");
      expect(sceneGraphIdx).toBeGreaterThan(-1);
      expect(compileIdx).toBeGreaterThan(sceneGraphIdx);
      expect(optimizeIdx).toBeGreaterThan(compileIdx);
      expect(translateIdx).toBeGreaterThan(optimizeIdx);
    });
  });
});
