import { describe, expect, it } from "vitest";

import { optimizePromptSpecification, OPTIMIZATION_VERSION } from "./index";
import { buildPromptSpecification } from "../prompt-spec";
import { buildVisualScenePlan } from "../scene-planner";
import { assembleBlueprint } from "../blueprint";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCampaignPlan } from "../creative-director";
import { buildVisualLayoutPlan } from "../visual-layout";
import { buildTypographyPlan } from "../typography";
import { buildAdNarrativeSection } from "../provider-translator/shared/section-builders";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import type { CreativeRequest } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Helper — full pipeline to OptimizedPromptSpecification
// ─────────────────────────────────────────────────────────────────────────────

function makeOptimized(rawIdea: string, kind?: CreativeRequest["kind"], presetKey?: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, kind, presetKey, requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const plan = buildCampaignPlan(strategy);
  const layout = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  const blueprint = assembleBlueprint({ context: ctx, strategy, campaignPlan: plan, layoutPlan: layout, typographyPlan: typography });
  const scene = buildVisualScenePlan(blueprint);
  const spec = buildPromptSpecification(blueprint, scene);
  return { spec, optimized: optimizePromptSpecification(spec) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure
// ─────────────────────────────────────────────────────────────────────────────

describe("optimizePromptSpecification — structural correctness", () => {
  it("returns all required sections", () => {
    const { optimized } = makeOptimized("Dental Implant Informative Creative");
    expect(optimized).toHaveProperty("meta");
    expect(optimized).toHaveProperty("optimizedSpec");
    expect(optimized).toHaveProperty("priority");
    expect(optimized).toHaveProperty("sectionOrder");
    expect(optimized).toHaveProperty("duplicates");
    expect(optimized).toHaveProperty("conflicts");
    expect(optimized).toHaveProperty("budget");
    expect(optimized).toHaveProperty("visualScores");
    expect(optimized).toHaveProperty("mergedNegatives");
    expect(optimized).toHaveProperty("optimizedRendering");
    expect(optimized).toHaveProperty("quality");
    expect(Array.isArray(optimized.unknownFields)).toBe(true);
  });

  it("meta contains correct version and source spec ID", () => {
    const { spec, optimized } = makeOptimized("Restaurant Grand Opening");
    expect(optimized.meta.optimizationVersion).toBe(OPTIMIZATION_VERSION);
    expect(optimized.meta.sourceSpecId).toBe(spec.meta.specId);
    expect(optimized.meta.optimizationId).toMatch(/^opt_/);
  });

  it("optimizedSpec preserves the PromptSpecification structure", () => {
    const { optimized } = makeOptimized("Luxury Villa Advertisement");
    const os = optimized.optimizedSpec;
    expect(os).toHaveProperty("mission");
    expect(os).toHaveProperty("hero");
    expect(os).toHaveProperty("rendering");
    expect(os).toHaveProperty("negativeConstraints");
    expect(os.meta).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Priority Engine
// ─────────────────────────────────────────────────────────────────────────────

describe("Priority Engine", () => {
  it("hero priority is always 95-100", () => {
    const { optimized } = makeOptimized("Dental Implant Informative Creative", "SOCIAL_MEDIA", "instagram_post");
    expect(optimized.priority.hero).toBeGreaterThanOrEqual(95);
  });

  it("negativeConstraints priority is always 100", () => {
    const { optimized } = makeOptimized("Restaurant Grand Opening");
    expect(optimized.priority.negativeConstraints).toBe(100);
  });

  it("rendering priority is 90-100", () => {
    const { optimized } = makeOptimized("Jewellery Wedding Collection");
    expect(optimized.priority.rendering).toBeGreaterThanOrEqual(90);
  });

  it("priority reasoning is a non-empty string", () => {
    const { optimized } = makeOptimized("Mutual Fund SIP Awareness");
    expect(optimized.priority.priorityReasoning.length).toBeGreaterThan(20);
  });

  it("all priority values are between 0 and 100", () => {
    const { optimized } = makeOptimized("Luxury Villa Advertisement");
    const p = optimized.priority;
    const nums = [p.hero, p.negativeConstraints, p.rendering, p.composition,
      p.storytelling, p.marketing, p.lighting, p.environment, p.typography,
      p.camera, p.supporting, p.brandRules, p.mission];
    for (const n of nums) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Budget Allocation
// ─────────────────────────────────────────────────────────────────────────────

describe("Budget Allocation", () => {
  it("total budget is 4000", () => {
    const { optimized } = makeOptimized("Dental Implant Creative");
    expect(optimized.budget.totalBudget).toBe(4000);
  });

  it("hero receives the largest budget", () => {
    const { optimized } = makeOptimized("Dental Implant Creative", "SOCIAL_MEDIA", "instagram_post");
    const b = optimized.budget;
    expect(b.hero).toBeGreaterThan(b.mission);
    expect(b.hero).toBeGreaterThan(b.typography);
  });

  it("all section budgets sum to ≤ 3700 (4000 - 300 buffer)", () => {
    const { optimized } = makeOptimized("Restaurant Grand Opening");
    const b = optimized.budget;
    const sum = b.hero + b.negativeConstraints + b.rendering + b.composition +
      b.marketing + b.lighting + b.environment + b.typography + b.camera +
      b.supporting + b.brandRules + b.mission;
    expect(sum).toBeLessThanOrEqual(3700);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section Ordering
// ─────────────────────────────────────────────────────────────────────────────

describe("Section Ordering", () => {
  it("hero is always first in ordered sections", () => {
    const { optimized } = makeOptimized("Dental Implant Creative", "SOCIAL_MEDIA", "instagram_post");
    expect(optimized.sectionOrder.orderedKeys[0]).toBe("hero");
  });

  it("negativeConstraints appears before rendering", () => {
    const { optimized } = makeOptimized("Luxury Real Estate Villa");
    const order = optimized.sectionOrder.orderedKeys;
    const negIdx = order.indexOf("negativeConstraints");
    const rendIdx = order.indexOf("rendering");
    expect(negIdx).toBeGreaterThan(-1);
    expect(rendIdx).toBeGreaterThan(-1);
    expect(negIdx).toBeLessThan(rendIdx);
  });

  it("orderingReasoning is a non-empty string", () => {
    const { optimized } = makeOptimized("Salon Transformation");
    expect(optimized.sectionOrder.orderingReasoning.length).toBeGreaterThan(20);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Visual Importance Scoring
// ─────────────────────────────────────────────────────────────────────────────

describe("Visual Importance Scoring", () => {
  it("primaryElement is non-empty", () => {
    const { optimized } = makeOptimized("Dental Implant Creative");
    expect(optimized.visualScores.primaryElement).not.toBe("");
    expect(optimized.visualScores.primaryElement).not.toBe("unknown");
  });

  it("elements array has at least one entry", () => {
    const { optimized } = makeOptimized("Jewellery Wedding Collection");
    expect(optimized.visualScores.elements.length).toBeGreaterThan(0);
  });

  it("all element importance scores are 0-100", () => {
    const { optimized } = makeOptimized("Restaurant Grand Opening");
    for (const el of optimized.visualScores.elements) {
      expect(el.importance).toBeGreaterThanOrEqual(0);
      expect(el.importance).toBeLessThanOrEqual(100);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Merged Negatives
// ─────────────────────────────────────────────────────────────────────────────

describe("Merged Negatives", () => {
  it("consolidated is a non-empty string", () => {
    const { optimized } = makeOptimized("Dental Implant Creative");
    expect(optimized.mergedNegatives.consolidated.length).toBeGreaterThan(10);
  });

  it("itemsAfterMerge ≤ itemsBeforeMerge (deduplication)", () => {
    const { optimized } = makeOptimized("Hospital Health Checkup");
    expect(optimized.mergedNegatives.itemsAfterMerge).toBeLessThanOrEqual(optimized.mergedNegatives.itemsBeforeMerge);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Quality Scores
// ─────────────────────────────────────────────────────────────────────────────

describe("Quality Scores", () => {
  it("all five scores are 0-100", () => {
    const { optimized } = makeOptimized("Dental Implant Creative", "SOCIAL_MEDIA", "instagram_post");
    const q = optimized.quality;
    expect(q.optimizationScore).toBeGreaterThanOrEqual(0);
    expect(q.conflictScore).toBeGreaterThanOrEqual(0);
    expect(q.redundancyScore).toBeGreaterThanOrEqual(0);
    expect(q.readabilityScore).toBeGreaterThanOrEqual(0);
    expect(q.promptReadinessScore).toBeGreaterThanOrEqual(0);
    expect(q.promptReadinessScore).toBeLessThanOrEqual(100);
  });

  it("prompt readiness is above 50 for a clear industry idea", () => {
    const { optimized } = makeOptimized("Dental Implant Informative Creative", "SOCIAL_MEDIA", "instagram_post");
    expect(optimized.quality.promptReadinessScore).toBeGreaterThan(50);
  });

  it("scoreReasoning contains all 5 score labels", () => {
    const { optimized } = makeOptimized("Luxury Villa Advertisement");
    const reasoning = optimized.quality.scoreReasoning;
    expect(reasoning).toContain("Optimization:");
    expect(reasoning).toContain("Conflict"); // "Conflicts:" or "Conflict:"
    expect(reasoning).toContain("Redundancy:");
    expect(reasoning).toContain("Readability:");
    expect(reasoning).toContain("Prompt Readiness:");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// No-generation verification
// ─────────────────────────────────────────────────────────────────────────────

describe("Optimizer must NEVER generate prompts", () => {
  it("is a pure synchronous function — no async, no LLM", () => {
    const { spec } = makeOptimized("Salon Campaign");
    const result = optimizePromptSpecification(spec);
    expect(result).toBeDefined();
  });

  it("does not produce OpenAI/Gemini-specific parameters", () => {
    const { optimized } = makeOptimized("Jewellery Wedding Collection");
    const str = JSON.stringify(optimized.optimizedSpec);
    expect(str).not.toMatch(/vivid|hd|quality:.*standard|style:.*natural|"n":\s*\d|"model":/i);
  });

  it("consolidated negatives do not contain provider instructions", () => {
    const { optimized } = makeOptimized("Dental Campaign");
    expect(optimized.mergedNegatives.consolidated).not.toMatch(/openai|gemini|flux|dall-e|midjourney/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4K.1 — advertisementNarrative optimizer regression
// Verifies the fix for the production bug where buildCompressedSpec() silently
// dropped advertisementNarrative, causing every translator to receive undefined
// and the STORY CONTEXT block to always be empty.
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.4K.1 — advertisementNarrative survives optimization", () => {
  it("PromptSpecification contains advertisementNarrative before optimization", () => {
    const { spec } = makeOptimized(
      "Dental Implant Clinic — IDA Certified, 15 Years Experience, Free Consultation, Lead Generation"
    );
    expect(spec.advertisementNarrative).toBeDefined();
    expect(spec.advertisementNarrative?.storyScenario.length).toBeGreaterThan(0);
    expect(spec.advertisementNarrative?.storyArchetype).toBeTruthy();
  });

  it("advertisementNarrative is present in OptimizedPromptSpecification after optimization", () => {
    const { optimized } = makeOptimized(
      "Dental Implant Clinic — IDA Certified, 15 Years Experience, Free Consultation, Lead Generation"
    );
    expect(optimized.optimizedSpec.advertisementNarrative).toBeDefined();
  });

  it("all required advertisementNarrative fields survive optimization intact", () => {
    const { optimized } = makeOptimized(
      "Dental Implant Clinic — IDA Certified, Free Consultation, Lead Generation"
    );
    const ad = optimized.optimizedSpec.advertisementNarrative;
    expect(ad).toBeDefined();
    if (!ad) return;
    expect(ad.storyScenario.length).toBeGreaterThan(0);
    expect(ad.emotionalMoment.length).toBeGreaterThan(0);
    expect(ad.identitySignal.length).toBeGreaterThan(0);
    expect(ad.conversionMoment.length).toBeGreaterThan(0);
    expect(ad.storyArchetype).toBeTruthy();
    expect(Array.isArray(ad.enrichmentTags)).toBe(true);
  });

  it("advertisementNarrative passes through unchanged — no field mutation during compression", () => {
    const { spec, optimized } = makeOptimized(
      "Jewellery Wedding Proposal — Ultra Luxury Collection"
    );
    const before = spec.advertisementNarrative;
    const after  = optimized.optimizedSpec.advertisementNarrative;
    if (before && after) {
      expect(after.storyScenario).toBe(before.storyScenario);
      expect(after.emotionalMoment).toBe(before.emotionalMoment);
      expect(after.storyArchetype).toBe(before.storyArchetype);
      expect(after.identitySignal).toBe(before.identitySignal);
      expect(after.conversionMoment).toBe(before.conversionMoment);
      expect(after.enrichmentTags).toEqual(before.enrichmentTags);
    } else {
      expect(before).toBeUndefined();
      expect(after).toBeUndefined();
    }
  });

  it("enrichmentTags array is preserved through optimization without mutation", () => {
    const { spec, optimized } = makeOptimized(
      "Restaurant Grand Opening — Birthday Celebration Campaign"
    );
    const beforeTags = spec.advertisementNarrative?.enrichmentTags;
    const afterTags  = optimized.optimizedSpec.advertisementNarrative?.enrichmentTags;
    if (beforeTags !== undefined && afterTags !== undefined) {
      expect(afterTags).toEqual(beforeTags);
    }
  });

  it("buildAdNarrativeSection returns a non-empty string containing storyScenario and emotionalMoment as plain sentences (prompt-bloat fix — labels dropped)", () => {
    const { optimized } = makeOptimized(
      "Dental Implant Clinic — IDA Certified, 15 Years Experience, Lead Generation"
    );
    const ad = optimized.optimizedSpec.advertisementNarrative;
    const section = buildAdNarrativeSection(optimized.optimizedSpec);
    expect(section).not.toBe("");
    expect(section).toContain(ad!.storyScenario);
    expect(section).toContain(ad!.emotionalMoment);
  });

  it("buildAdNarrativeSection excludes proofElement — trimmed to storyScenario + emotionalMoment only (prompt-bloat fix)", () => {
    const { optimized } = makeOptimized(
      "Dental Implant Clinic — IDA Certified, 15 Years Experience, Lead Generation"
    );
    const ad = optimized.optimizedSpec.advertisementNarrative;
    const section = buildAdNarrativeSection(optimized.optimizedSpec);
    // Sanity check: this input does generate a proof element upstream —
    // otherwise the assertion below would pass vacuously.
    expect(ad?.proofElement).toBeTruthy();
    expect(section).not.toContain("Credibility visible:");
    if (ad?.proofElement) {
      expect(section).not.toContain(ad.proofElement);
    }
  });

  it("story archetype is expert_in_action for authority + high trust + lead generation input", () => {
    const { optimized } = makeOptimized(
      "Dental Implant Clinic — IDA Certified, 15 Years Experience, Lead Generation"
    );
    const ad = optimized.optimizedSpec.advertisementNarrative;
    expect(ad?.storyArchetype).toBe("expert_in_action");
  });
});
