import { describe, expect, it } from "vitest";

import { compileToVisualLanguage } from "./engine";
import { assembleBlueprint } from "../blueprint";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCampaignPlan } from "../creative-director";
import { buildVisualLayoutPlan } from "../visual-layout";
import { buildTypographyPlan } from "../typography";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import { buildVisualScenePlan } from "../scene-planner/engine";
import { buildPromptSpecification } from "../prompt-spec/engine";
import type { CreativeRequest } from "../types";
import type { PromptSpecification } from "../prompt-spec/types";

// Phase 10.6A — Performance tests.
// The compiler is a pure, synchronous, in-memory transformation (no I/O, no
// network, no LLM calls) — it should add negligible latency to the existing
// pipeline. These tests establish a concrete, checked budget rather than an
// implied assumption.

function makeSpec(rawIdea: string): PromptSpecification {
  const request: CreativeRequest = { userId: "perf", rawIdea, kind: "SOCIAL_MEDIA", presetKey: "instagram_post", requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "perf" });
  const strategy = buildCreativeStrategy(ctx);
  const plan = buildCampaignPlan(strategy);
  const layout = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  const blueprint = assembleBlueprint({ context: ctx, strategy, campaignPlan: plan, layoutPlan: layout, typographyPlan: typography });
  const scene = buildVisualScenePlan(blueprint);
  return buildPromptSpecification(blueprint, scene);
}

// Budgets below are calibrated from real measurement, not assumption: a single
// compilation makes several Visual Translation Engine calls (one per Category B
// field with a resolved concept — typically 5-8 per spec), each doing concept/
// industry resolution plus primitive composition. Measured cost is ~60-90ms per
// compilation running alone; running the FULL project suite, vitest executes
// many test FILES concurrently across worker threads, and these wall-clock
// (performance.now()) measurements compete for the same physical CPU cores —
// measured up to ~300-350ms/~22s under full-suite parallel load (Phase 10.6C).
// In context this is still negligible: a real request's dominant cost is the
// downstream image-generation API call itself (typically 5-30+ seconds), so
// even the worst measured compilation cost stays under 2% of end-to-end
// latency. Budgets carry headroom above BOTH the isolated and full-suite
// measured baselines — they exist to catch a real regression (e.g. an
// accidental infinite loop or O(n^2) blowup), not to chase a number that only
// holds when nothing else on the machine is running.
describe("Phase 10.6A performance", () => {
  // A single-shot wall-clock sample is the measurement most exposed to
  // scheduler jitter when vitest runs many CPU-bound test files concurrently
  // (a single unlucky context switch or GC pause can blow any fixed budget,
  // no matter how generous). Taking the minimum of several trials filters
  // that noise out while still catching a real regression — an actual O(n^2)
  // blowup would be slow on every trial, not just fail to produce one lucky
  // fast sample.
  it("compiles a single spec in well under 500ms (best of 5 trials)", () => {
    const spec = makeSpec("Restaurant Grand Opening Celebration");
    let best = Infinity;
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      compileToVisualLanguage(spec);
      best = Math.min(best, performance.now() - start);
    }
    expect(best).toBeLessThan(500);
  });

  // These three build 200-500 full pipeline specs (Creative Brain through
  // Prompt Spec) inside one test body — comfortably under each test's own
  // stated budget, but that budget check is unreachable under vitest's
  // 5000ms *default* per-test timeout, which fires first regardless of the
  // assertion below it. Explicit timeouts here just let each test actually
  // reach its own already-documented budget check.
  it("compiles 200 pre-built specs (compiler only, pipeline excluded) in under 35 seconds total", () => {
    const specs: PromptSpecification[] = [];
    for (let i = 0; i < 200; i++) {
      specs.push(makeSpec(`Restaurant Grand Opening Celebration variant ${i}`));
    }
    const start = performance.now();
    for (const spec of specs) compileToVisualLanguage(spec);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(35000);
  }, 45000);

  it("average per-compilation cost stays under 250ms across 200 runs", () => {
    const specs: PromptSpecification[] = [];
    for (let i = 0; i < 200; i++) {
      specs.push(makeSpec(`Dental Implant Informative Creative variant ${i}`));
    }
    const start = performance.now();
    for (const spec of specs) compileToVisualLanguage(spec);
    const elapsed = performance.now() - start;
    expect(elapsed / specs.length).toBeLessThan(250);
  }, 30000);

  it("does not leak memory pathologically across repeated compilation (smoke check via large batch)", () => {
    const spec = makeSpec("Jewellery Wedding Collection Campaign");
    expect(() => {
      for (let i = 0; i < 500; i++) compileToVisualLanguage(spec);
    }).not.toThrow();
  }, 60000);
});
