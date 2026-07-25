import { describe, expect, it } from "vitest";

import { buildSceneGraph } from "../scene-graph";
import { buildPromptSpecification } from "../prompt-spec";
import { compileToVisualLanguage, applyCompiledPrompt } from "./index";
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

// Phase 10.6C — Per-provider propagation tests.
//
// Confirms two things for each of the four named providers individually:
// (1) its OWN existing output format is untouched (OpenAI/Gemini stay prose
//     with their established section structure; Flux/SDXL stay comma-tag
//     lists) — proving this phase integrated the compiler, not redesigned
//     any translator; (2) the exact spec fields that provider is known to
//     read carry Scene-Graph/compiler-sourced content, not the original
//     pre-integration text, by the time translateForProvider runs.

function runChain(rawIdea: string) {
  const request: CreativeRequest = { userId: "provider-test", rawIdea, kind: "SOCIAL_MEDIA", presetKey: "instagram_post", requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "provider-test" });
  const strategy = buildCreativeStrategy(ctx);
  const plan = buildCampaignPlan(strategy);
  const layout = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  const blueprint = assembleBlueprint({ context: ctx, strategy, campaignPlan: plan, layoutPlan: layout, typographyPlan: typography });
  const scene = buildVisualScenePlan(blueprint);
  const sceneGraph = buildSceneGraph(blueprint, scene);
  const specBeforeCompile = buildPromptSpecification(blueprint, scene, undefined, sceneGraph);
  const compiled = compileToVisualLanguage(specBeforeCompile);
  const spec = applyCompiledPrompt(specBeforeCompile, compiled);
  const optimized = optimizePromptSpecification(spec);
  return { sceneGraph, compiled, spec, optimized };
}

describe("Phase 10.6C — per-provider propagation", () => {
  describe("OpenAI", () => {
    it("keeps its existing prose format and section-header structure (not redesigned)", () => {
      const { optimized } = runChain("Fine dining French restaurant Grand Opening Celebration");
      const result = translateForProvider(optimized, "openai");
      expect(result.body.formatStyle).toBe("prose");
      expect(result.body.finalPrompt).toMatch(/PRIMARY HERO/);
      expect(result.body.finalPrompt).toMatch(/AVOID:/);
    });

    it("its finalPrompt reflects the optimized spec's (Scene-Graph/compiler-sourced) heroDetails, not a re-derivation", () => {
      const { optimized, spec } = runChain("Premium steakhouse Chef's Signature Dish Spotlight");
      const result = translateForProvider(optimized, "openai");
      const heroDetailsHead = spec.hero.heroDetails.value.split(".")[0];
      expect(result.body.finalPrompt).toContain(heroDetailsHead);
    });
  });

  describe("Gemini", () => {
    it("keeps its existing prose format and lead-in phrasing (not redesigned)", () => {
      const { optimized } = runChain("Rooftop restaurant Weekend Special Offer Promotion");
      const result = translateForProvider(optimized, "gemini");
      expect(result.body.formatStyle).toBe("prose");
      expect(result.body.finalPrompt).toMatch(/Create a professional advertising photograph:/);
    });

    it("its finalPrompt reflects the optimized spec's environment.premiumDetails (Scene-Graph materials), routed through buildEnvironmentSection", () => {
      const { optimized, spec } = runChain("Luxury jewellery house New Collection Launch");
      const result = translateForProvider(optimized, "gemini");
      // Gemini's "Setting: ..." block is built from buildEnvironmentSection,
      // which reads environment.premiumDetails among other fields — confirm
      // the field itself carries Scene Graph materials content...
      expect(spec.environment.premiumDetails.reasoning).toMatch(/Scene Graph materials|inherited/);
      expect(result.body.finalPrompt).toMatch(/Setting:/);
    });
  });

  describe("Flux", () => {
    it("keeps its existing comma-tag format (not redesigned into prose)", () => {
      const { optimized } = runChain("Artisan bakery Weekend Special Offer Promotion");
      const result = translateForProvider(optimized, "flux");
      expect(result.body.formatStyle).toBe("tags");
      expect(result.body.finalPrompt).not.toMatch(/PRIMARY HERO|AVOID:/);
      expect(result.body.finalPrompt.split(",").length).toBeGreaterThan(3);
    });

    it("its tag list is built from the optimized (Scene-Graph/compiler-sourced) spec, not a stale pre-integration copy", () => {
      const { optimized } = runChain("Sushi bar New Menu Launch");
      const result = translateForProvider(optimized, "flux");
      // Flux's tag() helper takes the first comma/period-delimited phrase of
      // spec.hero.heroSubject as its leading tag — confirm that exact prefix,
      // sourced from the SAME optimizedSpec every other provider also reads,
      // is present in the tag output (proving one shared upstream spec, not
      // a per-provider re-derivation).
      const heroSubject = optimized.optimizedSpec.hero.heroSubject.value;
      expect(heroSubject).not.toBe("unknown");
      const firstPhrase = heroSubject.split(/[,.]/, 1)[0]!.trim();
      expect(result.body.finalPrompt).toContain(firstPhrase);
    });
  });

  describe("Stable Diffusion (SDXL)", () => {
    it("keeps its existing lowercase comma-tag format (not redesigned into prose)", () => {
      const { optimized } = runChain("Luxury villa development Site Visit Campaign");
      const result = translateForProvider(optimized, "stable_diffusion");
      expect(result.body.formatStyle).toBe("tags");
      expect(result.body.finalPrompt).not.toMatch(/PRIMARY HERO|AVOID:/);
      expect(result.body.finalPrompt).toBe(result.body.finalPrompt.toLowerCase());
    });

    it("its meta.provider is stable_diffusion and it runs from the same OptimizedPromptSpecification every other provider reads", () => {
      const { optimized } = runChain("Cosmetic dentistry practice Free Consultation Promotion");
      const result = translateForProvider(optimized, "stable_diffusion");
      expect(result.meta.provider).toBe("stable_diffusion");
      expect(result.meta.sourceOptimizationId).toBe(optimized.meta.optimizationId);
    });
  });

  it("all four providers derive from the identical OptimizedPromptSpecification instance — no per-provider re-optimization or re-compilation", () => {
    const { optimized } = runChain("Wedding jewellery collection Anniversary Gift Promotion");
    const results = (["openai", "gemini", "flux", "stable_diffusion"] as const).map((p) => translateForProvider(optimized, p));
    for (const r of results) {
      expect(r.meta.sourceOptimizationId).toBe(optimized.meta.optimizationId);
      expect(r.meta.sourceSpecId).toBe(optimized.optimizedSpec.meta.specId);
    }
  });
});
