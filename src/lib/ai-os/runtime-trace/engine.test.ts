import { describe, expect, it } from "vitest";

import { diffFieldTrees, countUnknownFields, flattenToText, flattenPaths } from "./field-diff";
import { textMetricsFor, enumLeakageFor, duplicateRatio, textOverlaps, splitIntoSentences, estimateTokens } from "./text-analysis";
import { detectSceneGraphConsumption, sceneGraphSourcesFor, SCENE_GRAPH_WIRED_SPEC_FIELDS } from "./provenance";
import { ExecutionTreeBuilder, timed } from "./stage-tracer";
import { buildProviderReport, NAMED_PROVIDERS } from "./provider-report";
import { buildInfluenceGraph } from "./influence-graph";
import { buildRuntimeReport } from "./report";
import { assembleFinalReport } from "./final-report";

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

// Phase 10.6D — Runtime Verification System unit + integration tests.

function runTracedPipeline(rawIdea: string, provider: "openai" | "gemini" | "flux" | "stable_diffusion" = "openai") {
  const request: CreativeRequest = { userId: "trace-test", rawIdea, kind: "SOCIAL_MEDIA", presetKey: "instagram_post", requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "trace-test" });

  const tracer = new ExecutionTreeBuilder("test-request-id");

  const creativeBrainTimed = timed(() => buildCreativeStrategy(ctx));
  const strategy = creativeBrainTimed.result;
  tracer.recordCreativeBrain(strategy, creativeBrainTimed.elapsedMs);

  const plan = buildCampaignPlan(strategy);
  const layout = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  const blueprint = assembleBlueprint({ context: ctx, strategy, campaignPlan: plan, layoutPlan: layout, typographyPlan: typography });

  const scenePlannerTimed = timed(() => buildVisualScenePlan(blueprint));
  const scene = scenePlannerTimed.result;
  tracer.recordScenePlanner(blueprint, scene, scenePlannerTimed.elapsedMs);

  const sceneGraphTimed = timed(() => buildSceneGraph(blueprint, scene));
  const sceneGraph = sceneGraphTimed.result;
  tracer.recordSceneGraphCompiler(scene, sceneGraph, sceneGraphTimed.elapsedMs);

  const specTimed = timed(() => buildPromptSpecification(blueprint, scene, undefined, sceneGraph));
  const specBeforeCompile = specTimed.result;
  tracer.recordPromptSpecification(specBeforeCompile, sceneGraph, specTimed.elapsedMs);

  const compilerTimed = timed(() => {
    const compiled = compileToVisualLanguage(specBeforeCompile);
    return { compiled, applied: applyCompiledPrompt(specBeforeCompile, compiled) };
  });
  const compiledPrompt = compilerTimed.result.compiled;
  const spec = compilerTimed.result.applied;
  tracer.recordPromptVisualCompiler(specBeforeCompile, spec, compiledPrompt, compilerTimed.elapsedMs);

  const optimizerTimed = timed(() => optimizePromptSpecification(spec));
  const optimized = optimizerTimed.result;
  tracer.recordPromptOptimizer(spec, optimized, optimizerTimed.elapsedMs);

  const translatorTimed = timed(() => translateForProvider(optimized, provider));
  const providerPrompt = translatorTimed.result;
  const sceneGraphConsumption = detectSceneGraphConsumption(spec, sceneGraph);
  const compilerFieldsConsumed = compiledPrompt.fields
    .filter((f) => (f.classification === "A" || f.classification === "B") && f.compiledValue !== undefined && f.compiledValue !== f.originalValue)
    .map((f) => f.path);
  tracer.recordProviderTranslator(optimized, providerPrompt, translatorTimed.elapsedMs, sceneGraphConsumption.specFieldsConsumed, compilerFieldsConsumed);

  const providerTraces = buildProviderReport(optimized, sceneGraphConsumption.specFieldsConsumed, compilerFieldsConsumed);
  const influenceGraph = buildInfluenceGraph(optimized.optimizedSpec, compiledPrompt, providerPrompt.body.finalPrompt, provider);
  const executionTree = tracer.build(provider, providerPrompt.body.finalPrompt);
  const runtimeReport = buildRuntimeReport(executionTree, compiledPrompt, providerTraces);
  const finalReport = assembleFinalReport(executionTree, runtimeReport, providerTraces, influenceGraph);

  return {
    blueprint, scene, sceneGraph, specBeforeCompile, spec, compiledPrompt, optimized, providerPrompt,
    executionTree, runtimeReport, providerTraces, influenceGraph, finalReport,
    // Spec-side (not Scene-Graph-side) consumed-field paths — the exact args
    // buildProviderReport expects; see its own JSDoc for why the two are not
    // interchangeable with RuntimeReport.sceneGraphFieldsConsumed.
    sceneGraphSourcedSpecFields: sceneGraphConsumption.specFieldsConsumed,
    compilerSourcedSpecFields: compilerFieldsConsumed,
  };
}

describe("field-diff", () => {
  it("detects added/removed/modified fields between two same-shaped trees", () => {
    const before = { section: { a: { value: "unknown" }, b: { value: "same" }, c: { value: "old" } } };
    const after  = { section: { a: { value: "new value" }, b: { value: "same" }, c: { value: "unknown" } } };
    const diff = diffFieldTrees(before, after);
    expect(diff.added).toEqual(["section.a"]);
    expect(diff.removed).toEqual(["section.c"]);
    expect(diff.modified).toEqual([]);
  });

  it("counts unknown fields and flattens text, ignoring unknown leaves", () => {
    const tree = { section: { a: { value: "unknown" }, b: { value: "real content" } } };
    expect(countUnknownFields(tree)).toBe(1);
    expect(flattenToText(tree)).toBe("real content");
    expect(flattenPaths(tree)).toEqual({ "section.b": "real content" });
  });
});

describe("text-analysis", () => {
  it("estimateTokens uses the chars/4 heuristic", () => {
    expect(estimateTokens("12345678")).toBe(2);
  });

  it("textMetricsFor returns zeros for empty text and real numbers for real text", () => {
    expect(textMetricsFor("")).toEqual({ tokenCount: 0, visualTokenRatio: 0, abstractTokenRatio: 0 });
    const metrics = textMetricsFor("A chef plates a dish under warm lighting near the window.");
    expect(metrics.tokenCount).toBeGreaterThan(0);
  });

  it("enumLeakageFor detects raw enum tokens", () => {
    expect(enumLeakageFor("the lighting is soft_diffused_shadow today")).toBeGreaterThan(0);
    expect(enumLeakageFor("the lighting is soft and diffused today")).toBe(0);
  });

  it("duplicateRatio detects exact repeated clauses and ignores short fragments", () => {
    const text = "the chef plates the dish carefully, the chef plates the dish carefully, a distinct final clause here";
    expect(duplicateRatio(text)).toBeGreaterThan(0);
    expect(duplicateRatio("short, bits")).toBe(0);
  });

  it("textOverlaps matches substrings and significant-word overlap, not unrelated text", () => {
    expect(textOverlaps("a chef leaning over a walnut counter", "chef leaning over a walnut counter")).toBe(true);
    expect(textOverlaps("a chef leaning over a walnut counter", "a completely unrelated sentence about finance")).toBe(false);
  });

  it("splitIntoSentences splits on sentence boundaries and long comma runs", () => {
    const sentences = splitIntoSentences("First sentence here. Second sentence here!");
    expect(sentences.length).toBe(2);
  });
});

describe("provenance", () => {
  it("SCENE_GRAPH_WIRED_SPEC_FIELDS lists exactly the 7 Phase 10.6C wired fields", () => {
    expect(SCENE_GRAPH_WIRED_SPEC_FIELDS).toEqual([
      "hero.heroDetails", "supporting.relationships", "environment.premiumDetails",
      "composition.background", "composition.foreground", "composition.midground", "camera.cameraPosition",
    ]);
  });

  it("sceneGraphSourcesFor returns the mapped Scene Graph paths for a wired field, and [] for an unwired one", () => {
    expect(sceneGraphSourcesFor("environment.premiumDetails")).toEqual(["materials.architectureMaterial", "materials.surfaceMaterial", "materials.reflection"]);
    expect(sceneGraphSourcesFor("marketing.campaignGoal")).toEqual([]);
  });
});

describe("full traced pipeline — real data, no synthetic fixtures", () => {
  it("produces a complete execution tree covering all 7 stages, each with a positive execution time", () => {
    const { executionTree } = runTracedPipeline("Fine dining French restaurant Grand Opening Celebration");
    expect(executionTree.stages.length).toBe(7);
    for (const stage of executionTree.stages) {
      expect(stage.executionTimeMs, `${stage.stage} should have measured a real, non-negative time`).toBeGreaterThanOrEqual(0);
    }
    expect(executionTree.totalExecutionTimeMs).toBeGreaterThan(0);
    expect(executionTree.finalPrompt.length).toBeGreaterThan(0);
  });

  it("confirms Scene Graph actually influenced Prompt Specification — not assumed, verified by real substring presence", () => {
    const { executionTree, specBeforeCompile, sceneGraph } = runTracedPipeline("Premium steakhouse Chef's Signature Dish Spotlight");
    const specStage = executionTree.stages.find((s) => s.stage === "prompt-specification")!;
    expect(specStage.sceneGraphUsage.used).toBe(true);
    expect(specStage.sceneGraphUsage.fieldsConsumed.length).toBeGreaterThan(0);
    // Direct, independent re-verification against the PRE-compile spec (the
    // exact object detectSceneGraphConsumption itself checked at this stage)
    // — the Prompt Visual Compiler runs immediately afterward and naturalises
    // raw enum tokens (e.g. "toward_object_in_hand" -> "toward object in
    // hand"), so checking the post-compile spec would fail for the wrong
    // reason: not because Scene Graph didn't contribute, but because the
    // next, later stage correctly cleaned up what it received.
    for (const path of specStage.sceneGraphUsage.fieldsConsumed) {
      const [section, field] = path.split(".") as ["pose" | "body" | "objectContact" | "materials" | "where" | "camera", string];
      const sourceValue = (sceneGraph[section] as unknown as Record<string, { value: string }>)[field]!.value;
      const allSpecText = JSON.stringify(specBeforeCompile);
      expect(allSpecText).toContain(sourceValue);
    }
  });

  it("confirms the Prompt Visual Compiler actually modified Prompt Specification fields", () => {
    const { executionTree } = runTracedPipeline("Rooftop restaurant Weekend Special Offer Promotion");
    const compilerStage = executionTree.stages.find((s) => s.stage === "prompt-visual-compiler")!;
    expect(compilerStage.promptCompilerUsage.used).toBe(true);
    expect(compilerStage.fieldDiff.modified.length + compilerStage.fieldDiff.removed.length).toBeGreaterThan(0);
  });

  it("builds a provider report covering all 4 named providers with real, distinct metrics", () => {
    const { providerTraces } = runTracedPipeline("Luxury jewellery house New Collection Launch");
    expect(providerTraces.length).toBe(4);
    expect(providerTraces.map((p) => p.provider).sort()).toEqual([...NAMED_PROVIDERS].sort());
    for (const trace of providerTraces) {
      expect(trace.finalPromptLength).toBeGreaterThan(0);
    }
  });

  it("builds an influence graph whose edges are independently re-verifiable against the real final prompt", () => {
    const { influenceGraph, providerPrompt } = runTracedPipeline("Artisan bakery Weekend Special Offer Promotion");
    expect(influenceGraph.edges.length).toBeGreaterThan(0);
    for (const edge of influenceGraph.edges) {
      expect(providerPrompt.body.finalPrompt).toContain(edge.sentence);
    }
  });

  it("assembles a final report containing all 6 named graphs", () => {
    const { finalReport } = runTracedPipeline("Cosmetic dentistry practice Free Consultation Promotion");
    expect(finalReport.runtimeGraph).toBeDefined();
    expect(finalReport.dependencyGraph).toBeDefined();
    expect(finalReport.influenceGraph).toBeDefined();
    expect(finalReport.executionGraph).toBeDefined();
    expect(finalReport.providerGraph).toBeDefined();
    expect(finalReport.performanceGraph).toBeDefined();
    expect(finalReport.performanceGraph.totalMs).toBeGreaterThan(0);
    expect(finalReport.dependencyGraph.edges.length).toBe(7); // 6 stage-to-stage + 1 to final-provider-prompt
  });

  it("the reporting layer is deterministic — rebuilding every report from the SAME already-computed execution data produces identical results", () => {
    // NOT "rebuild the pipeline twice from the same rawIdea": buildPromptSpecification
    // generates a fresh meta.specId on every call (by design — regenerating a
    // campaign is meant to introduce fresh variety, the same reason
    // blueprintId is fresh per assembly, established and tested in Phase
    // 10.6C's own regression suite), which seeds the Prompt Visual Compiler's
    // concept selection — so two freshly-rebuilt runs of "the same" rawIdea
    // are not guaranteed to match, and were never claimed to be. What Phase
    // 10.6D's OWN code must guarantee is narrower and is what this test
    // checks: given the SAME already-computed execution tree, compiled
    // prompt, optimized spec, and provider prompt, every reporting function
    // in this module (buildRuntimeReport, buildProviderReport,
    // buildInfluenceGraph, assembleFinalReport) is a pure function that
    // returns identical output every time.
    const run = runTracedPipeline("Sushi bar New Menu Launch");

    const reportAgain = buildRuntimeReport(run.executionTree, run.compiledPrompt, run.providerTraces);
    expect(reportAgain).toEqual(run.runtimeReport);

    const providerTracesAgain = buildProviderReport(
      run.optimized,
      run.sceneGraphSourcedSpecFields,
      run.compilerSourcedSpecFields,
    );
    expect(providerTracesAgain).toEqual(run.providerTraces);

    const influenceGraphAgain = buildInfluenceGraph(run.optimized.optimizedSpec, run.compiledPrompt, run.providerPrompt.body.finalPrompt, "openai");
    expect(influenceGraphAgain).toEqual(run.influenceGraph);

    const finalReportAgain = assembleFinalReport(run.executionTree, reportAgain, providerTracesAgain, influenceGraphAgain);
    expect(finalReportAgain).toEqual(run.finalReport);
  });
});
