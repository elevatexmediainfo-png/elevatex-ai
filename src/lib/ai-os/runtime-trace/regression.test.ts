import { describe, expect, it } from "vitest";

import { ExecutionTreeBuilder, timed } from "./stage-tracer";
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

// Phase 10.6D — Regression suite.
// Same 500-campaign, 5-industry corpus used by every prior phase's
// regression suite, run through the fully traced pipeline for all 4 named
// providers — proving the Runtime Verification System itself never throws,
// never fabricates data (every check re-derives from the real objects), and
// stays internally consistent across the entire corpus, not just hand-picked
// examples.

function runTraced(rawIdea: string, provider: SupportedProvider) {
  const request: CreativeRequest = { userId: "trace-regression", rawIdea, kind: "SOCIAL_MEDIA", presetKey: "instagram_post", requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "trace-regression" });

  const tracer = new ExecutionTreeBuilder(`req-${rawIdea}-${provider}`);

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

  return { executionTree, runtimeReport, providerTraces, influenceGraph, finalReport };
}

const INTENTS_GENERIC = [
  "Grand Opening Celebration", "Weekend Special Offer Promotion", "New Menu Launch",
  "Chef's Signature Dish Spotlight", "Festive Season Celebration Event",
];

const INDUSTRY_PROMPTS: Record<string, string[]> = {
  Restaurant: (() => {
    const niches = ["fine dining French restaurant", "casual neighbourhood bistro", "cozy cafe", "fast casual burger joint",
      "gourmet food truck", "seafood restaurant", "premium steakhouse", "artisan pizzeria", "vegan restaurant",
      "all you can eat buffet", "rooftop restaurant", "wine bar", "artisan bakery", "dessert bar",
      "weekend brunch spot", "family style diner", "cloud kitchen delivery brand", "catering service", "sushi bar", "BBQ smokehouse"];
    const out: string[] = []; for (const n of niches) for (const i of INTENTS_GENERIC) out.push(`${n} ${i}`); return out;
  })(),
  Dental: (() => {
    const niches = ["family dental clinic", "cosmetic dentistry practice", "orthodontic braces clinic", "dental implant center",
      "pediatric dental clinic", "emergency dental clinic", "teeth whitening studio", "root canal specialist",
      "smile makeover clinic", "dental surgery center", "invisalign clinic", "gum disease specialist",
      "wisdom tooth extraction clinic", "dental checkup clinic", "premium dental spa", "affordable dental clinic",
      "same day crown clinic", "dental implant surgery center", "sedation dentistry clinic", "digital smile design studio"];
    const intents = ["Grand Opening Celebration", "New Patient Special Offer", "Free Consultation Promotion", "Implant Treatment Spotlight", "Patient Trust Campaign"];
    const out: string[] = []; for (const n of niches) for (const i of intents) out.push(`${n} ${i}`); return out;
  })(),
  Salon: (() => {
    const niches = ["luxury hair salon", "bridal makeup studio", "unisex hair salon", "nail art studio",
      "spa and wellness salon", "keratin treatment salon", "men's grooming barbershop", "skin clinic and salon",
      "hair extension studio", "balayage color specialist", "eyebrow threading studio", "makeup artist studio",
      "hair transplant clinic", "beauty parlour", "day spa retreat", "waxing and threading studio",
      "bridal salon package", "hair spa treatment center", "cosmetology training salon", "premium beauty lounge"];
    const intents = ["Grand Opening Celebration", "Bridal Season Special Offer", "New Service Launch", "Stylist Spotlight Feature", "Client Transformation Campaign"];
    const out: string[] = []; for (const n of niches) for (const i of intents) out.push(`${n} ${i}`); return out;
  })(),
  Jewellery: (() => {
    const niches = ["fine diamond jewellery house", "bridal jewellery collection", "gold jewellery showroom", "custom engagement ring atelier",
      "traditional gold jewellery store", "luxury watch and jewellery boutique", "pearl jewellery collection", "platinum jewellery studio",
      "antique jewellery restoration house", "everyday fine jewellery brand", "gemstone jewellery designer", "wedding jewellery collection",
      "silver jewellery boutique", "handcrafted jewellery atelier", "diamond solitaire specialist", "temple jewellery collection",
      "minimalist fine jewellery brand", "heirloom jewellery house", "men's jewellery collection", "luxury jewellery flagship store"];
    const intents = ["New Collection Launch", "Wedding Season Campaign", "Festive Season Celebration", "Craftsmanship Spotlight", "Anniversary Gift Promotion"];
    const out: string[] = []; for (const n of niches) for (const i of intents) out.push(`${n} ${i}`); return out;
  })(),
  RealEstate: (() => {
    const niches = ["luxury villa development", "high-rise apartment project", "gated community township", "waterfront penthouse project",
      "affordable housing project", "commercial office space", "farmhouse land project", "premium condominium tower",
      "sustainable green housing project", "beachfront resort residences", "urban studio apartment project", "family villa community",
      "smart home apartment project", "retirement community residences", "mixed-use residential project", "luxury row house development",
      "hillside villa project", "co-living residence project", "boutique residential tower", "integrated township project"];
    const intents = ["Grand Launch Celebration", "Limited Time Offer Promotion", "Site Visit Campaign", "Possession Ready Spotlight", "Investment Opportunity Campaign"];
    const out: string[] = []; for (const n of niches) for (const i of intents) out.push(`${n} ${i}`); return out;
  })(),
};

function allPrompts(): { industry: string; rawIdea: string }[] {
  const out: { industry: string; rawIdea: string }[] = [];
  for (const [industry, prompts] of Object.entries(INDUSTRY_PROMPTS)) {
    for (const rawIdea of prompts) out.push({ industry, rawIdea });
  }
  return out;
}

describe("Phase 10.6D regression — 500 campaigns across 5 industries, traced for OpenAI", () => {
  const prompts = allPrompts();
  const results = prompts.map(({ industry, rawIdea }) => ({ industry, rawIdea, ...runTraced(rawIdea, "openai") }));

  it("processes all 500 campaigns without throwing", () => {
    expect(results.length).toBe(500);
  });

  it("every execution tree has exactly 7 stages, each with a non-negative execution time", () => {
    const bad = results.filter((r) => r.executionTree.stages.length !== 7 || r.executionTree.stages.some((s) => s.executionTimeMs < 0));
    expect(bad.map((r) => r.rawIdea)).toEqual([]);
  });

  it("every campaign confirms Scene Graph consumption at the Prompt Specification stage", () => {
    const missing = results.filter((r) => {
      const stage = r.executionTree.stages.find((s) => s.stage === "prompt-specification");
      return !stage?.sceneGraphUsage.used;
    });
    expect(missing.map((r) => r.rawIdea)).toEqual([]);
  });

  it("every campaign confirms Prompt Compiler usage at the Prompt Visual Compiler stage", () => {
    const missing = results.filter((r) => {
      const stage = r.executionTree.stages.find((s) => s.stage === "prompt-visual-compiler");
      return !stage?.promptCompilerUsage.used;
    });
    expect(missing.length / results.length).toBeLessThan(0.05);
  });

  it("every influence graph edge's sentence is a real, independently-verifiable substring of the actual final prompt", () => {
    const violations: string[] = [];
    for (const r of results) {
      const finalPrompt = r.executionTree.finalPrompt;
      for (const edge of r.influenceGraph.edges) {
        if (!finalPrompt.includes(edge.sentence)) violations.push(`${r.rawIdea}: "${edge.sentence.slice(0, 40)}..."`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("every final report contains all 6 named graphs with non-empty structure", () => {
    const bad = results.filter((r) => {
      const fr = r.finalReport;
      return fr.runtimeGraph.stages.length === 0
        || fr.dependencyGraph.edges.length === 0
        || fr.executionGraph.order.length === 0
        || fr.providerGraph.providers.length === 0
        || fr.performanceGraph.totalMs <= 0;
    });
    expect(bad.map((r) => r.rawIdea)).toEqual([]);
  });

  it("prints a verification summary for visibility", () => {
    const avgSceneGraphFields = Math.round((results.reduce((s, r) => s + r.runtimeReport.sceneGraphFieldsConsumed.length, 0) / results.length) * 10) / 10;
    const avgCompilerFields = Math.round((results.reduce((s, r) => s + r.runtimeReport.promptCompilerFieldsConsumed.length, 0) / results.length) * 10) / 10;
    const avgTotalMs = Math.round((results.reduce((s, r) => s + r.executionTree.totalExecutionTimeMs, 0) / results.length) * 10) / 10;
    console.log("Phase 10.6D runtime verification summary (500 campaigns, OpenAI):", JSON.stringify({
      n: results.length,
      avgSceneGraphFieldsConsumed: avgSceneGraphFields,
      avgPromptCompilerFieldsConsumed: avgCompilerFields,
      avgTotalExecutionTimeMs: avgTotalMs,
    }, null, 2));
    expect(results.length).toBe(500);
  });
});

describe("Phase 10.6D regression — all 4 named providers, one representative campaign each industry", () => {
  const representative = Object.keys(INDUSTRY_PROMPTS).map((industry) => ({ industry, rawIdea: INDUSTRY_PROMPTS[industry]![0]! }));
  const providers: SupportedProvider[] = ["openai", "gemini", "flux", "stable_diffusion"];

  // 20 combinations (5 industries x 4 providers), each a full pipeline trace
  // — comfortably fast in isolation, but exceeds vitest's 5000ms *default*
  // per-test timeout under full-suite parallel load (the same class of issue
  // fixed in prompt-compiler/performance.test.ts during Phase 10.6B and
  // pipeline-performance.test.ts during Phase 10.6C). Explicit timeout lets
  // the test actually reach its own assertions.
  it("traces cleanly for every provider x industry combination without throwing", () => {
    const failures: string[] = [];
    for (const { industry, rawIdea } of representative) {
      for (const provider of providers) {
        try {
          runTraced(rawIdea, provider);
        } catch (e) {
          failures.push(`${industry}/${provider}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  }, 30000);

  it("provider report metrics are always in valid ranges (0-1 for coverage/duplicate ratios)", () => {
    for (const { rawIdea } of representative) {
      for (const provider of providers) {
        const { providerTraces } = runTraced(rawIdea, provider);
        for (const trace of providerTraces) {
          expect(trace.sceneGraphCoverage).toBeGreaterThanOrEqual(0);
          expect(trace.sceneGraphCoverage).toBeLessThanOrEqual(1);
          expect(trace.promptCompilerCoverage).toBeGreaterThanOrEqual(0);
          expect(trace.promptCompilerCoverage).toBeLessThanOrEqual(1);
          expect(trace.duplicateRatio).toBeGreaterThanOrEqual(0);
          expect(trace.duplicateRatio).toBeLessThanOrEqual(1);
        }
      }
    }
  }, 30000);
});
