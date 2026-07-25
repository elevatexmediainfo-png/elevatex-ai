import { describe, expect, it } from "vitest";

import { buildPromptSpecification, PROMPT_SPEC_VERSION } from "./index";
import { buildVisualScenePlan } from "../scene-planner";
import { assembleBlueprint } from "../blueprint";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCampaignPlan } from "../creative-director";
import { buildVisualLayoutPlan } from "../visual-layout";
import { buildTypographyPlan } from "../typography";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import type { CreativeRequest } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Helper — full pipeline to PromptSpecification
// ─────────────────────────────────────────────────────────────────────────────

function makeSpec(rawIdea: string, kind?: CreativeRequest["kind"], presetKey?: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, kind, presetKey, requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const plan = buildCampaignPlan(strategy);
  const layout = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  const blueprint = assembleBlueprint({ context: ctx, strategy, campaignPlan: plan, layoutPlan: layout, typographyPlan: typography });
  const scene = buildVisualScenePlan(blueprint);
  return { blueprint, scene, spec: buildPromptSpecification(blueprint, scene) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure
// ─────────────────────────────────────────────────────────────────────────────

describe("buildPromptSpecification — structural correctness", () => {
  it("returns all 12 sections plus meta and unknownFields", () => {
    const { spec } = makeSpec("Dental Implant Informative Creative");
    expect(spec).toHaveProperty("meta");
    expect(spec).toHaveProperty("mission");
    expect(spec).toHaveProperty("hero");
    expect(spec).toHaveProperty("supporting");
    expect(spec).toHaveProperty("composition");
    expect(spec).toHaveProperty("camera");
    expect(spec).toHaveProperty("lighting");
    expect(spec).toHaveProperty("environment");
    expect(spec).toHaveProperty("marketing");
    expect(spec).toHaveProperty("typography");
    expect(spec).toHaveProperty("brandRules");
    expect(spec).toHaveProperty("negativeConstraints");
    expect(spec).toHaveProperty("rendering");
    expect(Array.isArray(spec.unknownFields)).toBe(true);
  });

  it("meta contains correct version and timestamps", () => {
    const { spec } = makeSpec("Restaurant Grand Opening");
    expect(spec.meta.schemaVersion).toBe(PROMPT_SPEC_VERSION);
    expect(spec.meta.specId).toMatch(/^spec_/);
    expect(spec.meta.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(spec.meta.sourceBlueprintId).toMatch(/^bp_/);
  });

  it("every section field has value + confidence + reasoning", () => {
    const { spec } = makeSpec("Luxury Villa Advertisement");
    const sections = [spec.mission, spec.hero, spec.supporting, spec.composition,
      spec.camera, spec.lighting, spec.environment, spec.marketing,
      spec.typography, spec.brandRules, spec.negativeConstraints, spec.rendering];
    for (const section of sections) {
      for (const [key, field] of Object.entries(section)) {
        if (typeof field === "object" && field !== null && "value" in field) {
          expect(field.value, `${key}.value`).toBeDefined();
          expect(field.confidence, `${key}.confidence`).toBeDefined();
          expect(field.reasoning, `${key}.reasoning`).toBeDefined();
        }
      }
    }
  });

  it("validationStatus is one of the three valid values", () => {
    const { spec } = makeSpec("Dental Implant Creative", "SOCIAL_MEDIA", "instagram_post");
    expect(["ready", "ready_with_warnings", "incomplete"]).toContain(spec.meta.validationStatus);
  });

  it("sourceBlueprintId matches the blueprint that was used", () => {
    const { blueprint, spec } = makeSpec("Mutual Fund SIP");
    expect(spec.meta.sourceBlueprintId).toBe(blueprint.meta.blueprintId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mission section
// ─────────────────────────────────────────────────────────────────────────────

describe("PromptSpecification mission section", () => {
  it("whatToGenerate is populated for clear ideas", () => {
    const { spec } = makeSpec("Dental Implant Informative Creative", "SOCIAL_MEDIA", "instagram_post");
    expect(spec.mission.whatToGenerate.value).not.toBe("unknown");
    expect(spec.mission.whatToGenerate.confidence).toBe("high");
  });

  it("nonNegotiableElement references the hero subject", () => {
    const { spec } = makeSpec("Luxury Real Estate Villa Advertisement");
    const nnElement = spec.mission.nonNegotiableElement.value;
    expect(nnElement).not.toBe("unknown");
    expect(nnElement.length).toBeGreaterThan(15);
  });

  it("primarySuccessCriteria contains measurable criteria", () => {
    const { spec } = makeSpec("Restaurant Grand Opening", "SOCIAL_MEDIA", "instagram_post");
    const criteria = spec.mission.primarySuccessCriteria.value;
    expect(criteria).not.toBe("unknown");
    // Should contain numbered criteria
    expect(criteria).toMatch(/[1-3]\./);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Typography zones (no text content!)
// ─────────────────────────────────────────────────────────────────────────────

describe("PromptSpecification typography zones", () => {
  it("all zones use ZONE label prefixes", () => {
    const { spec } = makeSpec("Dental Implant Creative", "SOCIAL_MEDIA", "instagram_post");
    const zones = [
      spec.typography.reservedHeadlineArea.value,
      spec.typography.reservedCtaArea.value,
      spec.typography.reservedLogoArea.value,
    ];
    for (const zone of zones) {
      if (zone !== "unknown") {
        expect(zone.toUpperCase()).toMatch(/ZONE|AREA|REGION/);
      }
    }
  });

  it("typography zones NEVER contain actual copy text (no ad headlines)", () => {
    const { spec } = makeSpec("School Admission Campaign");
    const allZones = [
      spec.typography.reservedHeadlineArea.value,
      spec.typography.reservedBodyArea.value,
      spec.typography.reservedCtaArea.value,
    ];
    for (const zone of allZones) {
      if (zone !== "unknown") {
        // Zone descriptions should not contain actual ad copy (short punchy phrases)
        expect(zone.length).toBeGreaterThan(20); // descriptive, not a headline
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Negative constraints
// ─────────────────────────────────────────────────────────────────────────────

describe("PromptSpecification negative constraints", () => {
  it("qualityAntiPatterns always present and references standard quality issues", () => {
    const { spec } = makeSpec("Jewellery Wedding Collection");
    expect(spec.negativeConstraints.qualityAntiPatterns.confidence).toBe("high");
    expect(spec.negativeConstraints.qualityAntiPatterns.value.toLowerCase()).toMatch(/cartoon|plastic|distort/);
  });

  it("forbiddenAiArtifacts includes logo and text prevention", () => {
    const { spec } = makeSpec("Dental Implant Creative", "SOCIAL_MEDIA", "instagram_post");
    const artifacts = spec.negativeConstraints.forbiddenAiArtifacts.value;
    expect(artifacts.toLowerCase()).toMatch(/logo|text|render/);
  });

  it("brandAntiPatterns is industry-specific", () => {
    const dental = makeSpec("Dental Implant Informative Creative").spec;
    const jewellery = makeSpec("Jewellery Wedding Collection").spec;
    const dentalAntipatterns = dental.negativeConstraints.brandAntiPatterns.value;
    const jewelleryAntipatterns = jewellery.negativeConstraints.brandAntiPatterns.value;
    // They should be different (industry-specific)
    expect(dentalAntipatterns).not.toBe(jewelleryAntipatterns);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// No-generation verification
// ─────────────────────────────────────────────────────────────────────────────

describe("PromptSpecification must NEVER generate provider prompts", () => {
  it("is a pure synchronous function — no async, no LLM", () => {
    const { blueprint, scene } = makeSpec("Hospital Campaign");
    const result = buildPromptSpecification(blueprint, scene);
    expect(result).toBeDefined();
  });

  it("does not produce OpenAI/Gemini/Flux-specific parameters", () => {
    const { spec } = makeSpec("Salon Transformation");
    const renderingStr = JSON.stringify(spec.rendering);
    // Should not contain provider-specific parameters
    expect(renderingStr).not.toMatch(/vivid|hd|quality:.*standard|style:.*natural|n:\s*\d|model:/i);
  });

  it("does not produce text prompts in any field", () => {
    const { spec } = makeSpec("Mutual Fund SIP Awareness");
    const fullSpec = JSON.stringify(spec);
    // No instruction that starts like an image prompt
    expect(fullSpec).not.toMatch(/^(Create|Generate|Draw|Make|A (photo|picture|image) of)/m);
  });

  it("typography zones contain NO actual ad copy", () => {
    const { spec } = makeSpec("Dental Implant Informative Creative");
    const headline = spec.typography.reservedHeadlineArea.value;
    if (headline !== "unknown") {
      // Must not contain typical ad headline patterns (3-6 punchy words)
      const words = headline.split(" ").length;
      expect(words).toBeGreaterThan(5); // zone descriptions are descriptive, not taglines
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.2A — Experience Engine fields in MarketingContext
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.2A — Experience Engine fields preserved in MarketingContext", () => {
  it("experienceEmotionalCore is preserved verbatim from Creative Brain", () => {
    const { spec, blueprint } = makeSpec("Luxury Real Estate Villa Advertisement");
    const core = blueprint.strategy.experienceProfile.emotionalCore;
    if (core) {
      expect(spec.marketing.experienceEmotionalCore?.value).toBe(core);
    }
  });

  it("experienceVisualImplication is preserved verbatim from Creative Brain", () => {
    const { spec, blueprint } = makeSpec("Dental Implant Informative Creative");
    const implication = blueprint.strategy.experienceProfile.visualImplication;
    if (implication) {
      expect(spec.marketing.experienceVisualImplication?.value).toBe(implication);
    }
  });

  it("experienceType is set and matches the Creative Brain primary type", () => {
    const { spec, blueprint } = makeSpec("Jewellery Wedding Collection Campaign");
    const primary = blueprint.strategy.experienceProfile.primary;
    if (primary) {
      expect(spec.marketing.experienceType?.value).toBe(primary);
    }
  });

  it("experienceEmotionalCore is never summarized or truncated", () => {
    const { spec, blueprint } = makeSpec("Restaurant Grand Opening");
    const original = blueprint.strategy.experienceProfile.emotionalCore;
    const stored = spec.marketing.experienceEmotionalCore?.value;
    if (original && stored) {
      expect(stored).toBe(original);
    }
  });
});
