import { describe, expect, it } from "vitest";

import { buildMinimalPrompt } from "./index";
import { optimizePromptSpecification } from "../prompt-optimizer";
import { compileToVisualLanguage, applyCompiledPrompt } from "../prompt-compiler";
import { buildPromptSpecification } from "../prompt-spec";
import { buildSceneGraph } from "../scene-graph";
import { buildVisualScenePlan } from "../scene-planner";
import { assembleBlueprint } from "../blueprint";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCampaignPlan } from "../creative-director";
import { buildVisualLayoutPlan } from "../visual-layout";
import { buildTypographyPlan } from "../typography";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import { translateForProvider } from "../provider-translator";
import type { CreativeRequest } from "../types";
import type { OptimizedPromptSpecification } from "../prompt-optimizer/types";

// Mirrors enhance-prompt/route.ts's real modern-path sequence exactly
// (Creative Brain → Scene Planner → Scene Graph → Prompt Specification →
// Prompt Visual Compiler → Prompt Optimizer) so this module is tested
// against the same OptimizedPromptSpecification the real translator sees —
// not a lighter fixture that skips Phase 10.6B/10.6C's wiring.
function makeOptimized(rawIdea: string): OptimizedPromptSpecification {
  const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const plan = buildCampaignPlan(strategy);
  const layout = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  const blueprint = assembleBlueprint({ context: ctx, strategy, campaignPlan: plan, layoutPlan: layout, typographyPlan: typography });
  const scene = buildVisualScenePlan(blueprint);
  const sceneGraph = buildSceneGraph(blueprint, scene);
  const specRaw = buildPromptSpecification(blueprint, scene, undefined, sceneGraph);
  const compiled = compileToVisualLanguage(specRaw);
  const spec = applyCompiledPrompt(specRaw, compiled);
  return optimizePromptSpecification(spec);
}

describe("buildMinimalPrompt — Phase 10.6F translator bypass", () => {
  it("produces a non-empty prompt from real fields, never the literal sentinel values", () => {
    const optimized = makeOptimized("Restaurant Grand Opening Celebration");
    const result = buildMinimalPrompt(optimized);
    expect(result.finalPrompt.length).toBeGreaterThan(0);
    expect(result.fieldsIncluded.length).toBeGreaterThan(0);
    expect(result.finalPrompt).not.toMatch(/\bunknown\b/);
    expect(result.finalPrompt).not.toMatch(/\bnot_applicable\b/);
  });

  it("every included field path resolves to a real, non-empty StrategyField value on the spec", () => {
    const optimized = makeOptimized("Dental Implant Informative Creative");
    const result = buildMinimalPrompt(optimized);
    for (const path of result.fieldsIncluded) {
      const [section, field] = path.split(".");
      const sectionObj = (optimized.optimizedSpec as unknown as Record<string, unknown>)[section!];
      const fieldObj = (sectionObj as Record<string, unknown>)[field!] as { value: string };
      expect(fieldObj.value).not.toBe("unknown");
      expect(fieldObj.value).not.toBe("not_applicable");
      expect(result.finalPrompt).toContain(fieldObj.value);
    }
  });

  it("never emits translator-owned structure — no block headers, quality sentence, or AVOID list", () => {
    const optimized = makeOptimized("Luxury Jewellery Wedding Collection Campaign");
    const result = buildMinimalPrompt(optimized);
    for (const marker of [
      "PRIMARY HERO", "STORY CONTEXT", "VISIBLE EMOTION", "SECONDARY SUBJECTS",
      "ADVERTISEMENT ZONES", "MARKETING INTENT", "CAMPAIGN THEME", "AVOID:",
      "professional photography", "commercial quality",
    ]) {
      expect(result.finalPrompt).not.toContain(marker);
    }
  });

  it("is deterministic for a fixed OptimizedPromptSpecification", () => {
    const optimized = makeOptimized("Real Estate Luxury Villa Launch");
    const a = buildMinimalPrompt(optimized);
    const b = buildMinimalPrompt(optimized);
    expect(a.finalPrompt).toBe(b.finalPrompt);
    expect(a.fieldsIncluded).toEqual(b.fieldsIncluded);
  });

  it("differs from the real translator's output for the same optimized spec, proving something genuinely changed", () => {
    const optimized = makeOptimized("Salon Bridal Makeover Package Promotion");
    const minimal = buildMinimalPrompt(optimized);
    const translated = translateForProvider(optimized, "openai");
    expect(minimal.finalPrompt).not.toBe(translated.body.finalPrompt);
  });

  it("uses spec.gptNarrative verbatim when present and valid, instead of the generic field walk", () => {
    const optimized = makeOptimized("Restaurant Grand Opening Celebration");
    const narrativeText = "A GPT-authored single narrative sentence that must survive unchanged.";
    const withNarrative: OptimizedPromptSpecification = {
      ...optimized,
      optimizedSpec: {
        ...optimized.optimizedSpec,
        gptNarrative: {
          narrativePrompt: narrativeText,
          quality: { status: "valid", score: 100, checks: [], failedChecks: [] },
          fieldsConsumed: ["hero.heroSubject", "mission.whatToGenerate"],
          fieldsMissing: [],
        },
      },
    };
    const result = buildMinimalPrompt(withNarrative);
    expect(result.finalPrompt).toBe(narrativeText);
    expect(result.usedGptNarrative).toBe(true);
    expect(result.fieldsIncluded).toEqual(["hero.heroSubject", "mission.whatToGenerate"]);
  });

  it("falls back to the generic field walk when gptNarrative quality is 'failed'", () => {
    const optimized = makeOptimized("Restaurant Grand Opening Celebration");
    const withFailedNarrative: OptimizedPromptSpecification = {
      ...optimized,
      optimizedSpec: {
        ...optimized.optimizedSpec,
        gptNarrative: {
          narrativePrompt: "This should never appear in the output.",
          quality: { status: "failed", score: 10, checks: [], failedChecks: ["too_short"] },
          fieldsConsumed: [],
          fieldsMissing: ["hero.heroSubject"],
        },
      },
    };
    const result = buildMinimalPrompt(withFailedNarrative);
    expect(result.usedGptNarrative).toBe(false);
    expect(result.finalPrompt).not.toContain("This should never appear in the output.");
  });

  it("walks every section PromptSpecification declares, not a hand-picked subset", () => {
    const optimized = makeOptimized("Jewellery Diamond Necklace Festive Collection");
    const result = buildMinimalPrompt(optimized);
    const sectionsSeen = new Set(result.fieldsIncluded.concat(result.fieldsSkipped).map((p) => p.split(".")[0]));
    for (const expected of ["mission", "hero", "supporting", "composition", "camera", "lighting", "environment", "rendering"]) {
      expect(sectionsSeen.has(expected)).toBe(true);
    }
  });
});
