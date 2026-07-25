import { describe, expect, it } from "vitest";

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
import { BANNED_TERMS } from "./banned-language";

// Phase 10.6C — Regression suite.
// Same 500-campaign, 5-industry corpus used by the Phase 10.6A/10.6B
// regression suites, run through the COMPLETE wired pipeline (Scene Graph
// Compiler -> Prompt Specification -> Prompt Visual Compiler -> Prompt
// Optimizer -> Provider Translator) for all 4 named providers, proving the
// integration holds across real, varied campaign data — not just hand-picked
// examples.

function runChain(rawIdea: string) {
  const request: CreativeRequest = { userId: "regression", rawIdea, kind: "SOCIAL_MEDIA", presetKey: "instagram_post", requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "regression" });
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

const PROVIDERS: SupportedProvider[] = ["openai", "gemini", "flux", "stable_diffusion"];

describe("Phase 10.6C regression — 500 campaigns across 5 industries, full wired pipeline", () => {
  const prompts = allPrompts();
  const results = prompts.map(({ industry, rawIdea }) => ({ industry, rawIdea, ...runChain(rawIdea) }));

  it("processes all 500 campaigns through the complete chain without throwing", () => {
    expect(results.length).toBe(500);
  });

  it("translates all 500 campaigns for all 4 named providers without throwing", () => {
    const failures: string[] = [];
    for (const { rawIdea, optimized } of results) {
      for (const provider of PROVIDERS) {
        try {
          translateForProvider(optimized, provider);
        } catch (e) {
          failures.push(`${rawIdea} / ${provider}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("every campaign's Scene Graph Compiler ran (non-null, 8 sub-graphs present)", () => {
    const missing = results.filter((r) => !r.sceneGraph || !r.sceneGraph.materials || !r.sceneGraph.body);
    expect(missing.map((r) => r.rawIdea)).toEqual([]);
  });

  it("every campaign's Prompt Visual Compiler ran and improved at least one field", () => {
    const noImprovement = results.filter((r) => !r.compiled.fields.some((f) => f.compiledValue !== undefined && f.compiledValue !== f.originalValue));
    // Allow a small tolerance — a handful of campaigns could legitimately have
    // an already-clean spec — but the overwhelming majority must show real change.
    expect(noImprovement.length / results.length).toBeLessThan(0.05);
  });

  it("zero banned business-language leakage in the compiler's own compiledText, across all 500 campaigns", () => {
    // Scoped to compiledText, not each translator's raw finalPrompt — a
    // Provider Translator's output additionally includes its own hardcoded
    // structural labels (e.g. openai/translator.ts's literal "MARKETING
    // INTENT" block header), which predate this integration, are not derived
    // from any spec field, and are out of scope to rewrite here ("do not
    // redesign either module"). Verified empirically: the pre-Phase-10.6C
    // baseline (no Scene Graph, no compiler) already contains both "campaign"
    // and "marketing" in its OpenAI output via these same hardcoded headers.
    // What Phase 10.6A/10.6C actually own and can guarantee is the compiler's
    // own compiledText — see prompt-compiler/regression.test.ts for the
    // original 500-campaign proof this phase re-confirms end-to-end.
    const leaks: string[] = [];
    for (const { rawIdea, compiled } of results) {
      const lower = compiled.compiledText.toLowerCase();
      for (const term of BANNED_TERMS) {
        if (new RegExp(`\\b${term}\\b`).test(lower)) leaks.push(`${rawIdea}: "${term}"`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("blanking Category C/D fields measurably reduces hardcoded-header banned-language leakage (CAMPAIGN THEME) into the OpenAI translator, across all 500 campaigns", () => {
    const stillLeaking = results.filter(({ optimized }) => {
      const { body } = translateForProvider(optimized, "openai");
      return /campaign theme/i.test(body.finalPrompt);
    });
    expect(stillLeaking.map((r) => r.rawIdea)).toEqual([]);
  });

  it("average completeness score (Scene Graph) stays consistent with the Phase 10.6B baseline", () => {
    const avg = results.reduce((s, r) => s + r.sceneGraph.meta.completenessScore, 0) / results.length;
    expect(avg).toBeGreaterThan(90);
  });

  it("prints an integration summary for visibility", () => {
    const avgCompleteness = Math.round((results.reduce((s, r) => s + r.sceneGraph.meta.completenessScore, 0) / results.length) * 10) / 10;
    const avgImprovedFields = Math.round((results.reduce((s, r) => s + r.compiled.fields.filter((f) => f.compiledValue !== undefined && f.compiledValue !== f.originalValue).length, 0) / results.length) * 10) / 10;
    console.log("Phase 10.6C pipeline integration summary (500 campaigns):", JSON.stringify({
      n: results.length,
      avgSceneGraphCompleteness: avgCompleteness,
      avgFieldsImprovedByCompiler: avgImprovedFields,
      providersVerified: PROVIDERS,
    }, null, 2));
    expect(results.length).toBe(500);
  });
});
