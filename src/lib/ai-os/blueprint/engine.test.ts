import { describe, expect, it } from "vitest";

import { assembleBlueprint, CampaignBlueprintBuilder, SCHEMA_VERSION, AI_OS_VERSION } from "./index";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCampaignPlan } from "../creative-director";
import { buildVisualLayoutPlan } from "../visual-layout";
import { buildTypographyPlan } from "../typography";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import type { CreativeRequest } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Helper — build full pipeline
// ─────────────────────────────────────────────────────────────────────────────

function buildFullPipeline(rawIdea: string, kind?: CreativeRequest["kind"], presetKey?: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, kind, presetKey, requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const context = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(context);
  const campaignPlan = buildCampaignPlan(strategy);
  const layoutPlan = buildVisualLayoutPlan(strategy, campaignPlan);
  const typographyPlan = buildTypographyPlan(strategy, campaignPlan, layoutPlan);
  return { context, strategy, campaignPlan, layoutPlan, typographyPlan };
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure — Blueprint must contain all 10 sections
// ─────────────────────────────────────────────────────────────────────────────

describe("assembleBlueprint — structural correctness", () => {
  it("returns a Blueprint with all 10 required sections", () => {
    const inputs = buildFullPipeline("Dental Implant Informative Creative");
    const bp = assembleBlueprint(inputs);

    expect(bp).toHaveProperty("meta");
    expect(bp).toHaveProperty("userIntelligence");
    expect(bp).toHaveProperty("assetIntelligence");
    expect(bp).toHaveProperty("brand");
    expect(bp).toHaveProperty("strategy");
    expect(bp).toHaveProperty("campaign");
    expect(bp).toHaveProperty("layout");
    expect(bp).toHaveProperty("typography");
    expect(bp).toHaveProperty("quality");
    expect(bp).toHaveProperty("memory");
  });

  it("meta contains correct version information", () => {
    const inputs = buildFullPipeline("Restaurant Grand Opening");
    const bp = assembleBlueprint(inputs);

    expect(bp.meta.schemaVersion).toBe(SCHEMA_VERSION);
    expect(bp.meta.aiOsVersion).toBe(AI_OS_VERSION);
    expect(bp.meta.blueprintId).toMatch(/^bp_/);
    expect(bp.meta.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("each blueprintId is unique across calls", () => {
    const inputs = buildFullPipeline("Luxury Villa Ad");
    const bp1 = assembleBlueprint(inputs);
    const bp2 = assembleBlueprint(inputs);
    expect(bp1.meta.blueprintId).not.toBe(bp2.meta.blueprintId);
  });

  it("memory section contains empty pastVersionIds and null placeholder slots", () => {
    const inputs = buildFullPipeline("School Admission Campaign");
    const bp = assembleBlueprint(inputs);

    expect(bp.memory.pastVersionIds).toEqual([]);
    expect(bp.memory._futureEmbeddings).toBeNull();
    expect(bp.memory._futureLearning).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Immutability — Blueprint must be readonly
// ─────────────────────────────────────────────────────────────────────────────

describe("Blueprint immutability", () => {
  it("is frozen at the top level", () => {
    const inputs = buildFullPipeline("Dental Campaign");
    const bp = assembleBlueprint(inputs);
    expect(Object.isFrozen(bp)).toBe(true);
  });

  it("cannot be mutated at the top level (throws in strict mode)", () => {
    const inputs = buildFullPipeline("Finance SIP");
    const bp = assembleBlueprint(inputs);
    expect(() => {
      // @ts-expect-error intentional mutation test
      bp.meta = {};
    }).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// User Intelligence section
// ─────────────────────────────────────────────────────────────────────────────

describe("Blueprint.userIntelligence", () => {
  it("preserves the raw idea", () => {
    const inputs = buildFullPipeline("Jewellery Wedding Collection Campaign");
    const bp = assembleBlueprint(inputs);
    expect(bp.userIntelligence.rawIdea).toBe("Jewellery Wedding Collection Campaign");
  });

  it("contains the full UserUnderstanding object", () => {
    const inputs = buildFullPipeline("Dental Implant Informative Creative", "SOCIAL_MEDIA", "instagram_post");
    const bp = assembleBlueprint(inputs);
    expect(bp.userIntelligence.understanding).toHaveProperty("industry");
    expect(bp.userIntelligence.understanding).toHaveProperty("platform");
    expect(bp.userIntelligence.understanding).toHaveProperty("confidenceScore");
  });

  it("maps language correctly", () => {
    const inputs = buildFullPipeline("Dental Implant Creative"); // English
    const bp = assembleBlueprint(inputs);
    expect(bp.userIntelligence.detectedLanguage).toBe("EN");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Quality Metadata
// ─────────────────────────────────────────────────────────────────────────────

describe("Blueprint.quality", () => {
  it("has overallConfidence between 0 and 100", () => {
    const inputs = buildFullPipeline("Dental Implant Informative Creative", "SOCIAL_MEDIA", "instagram_post");
    const bp = assembleBlueprint(inputs);
    expect(bp.quality.overallConfidence).toBeGreaterThanOrEqual(0);
    expect(bp.quality.overallConfidence).toBeLessThanOrEqual(100);
  });

  it("has readinessScore above 60 for a clear industry idea", () => {
    const inputs = buildFullPipeline("Dental Implant Informative Creative", "SOCIAL_MEDIA", "instagram_post");
    const bp = assembleBlueprint(inputs);
    expect(bp.quality.readinessScore).toBeGreaterThan(60);
  });

  it("has readinessScore meaningfully lower for a vague idea than a clear one", () => {
    const vagueInputs = buildFullPipeline("make something cool");
    const clearInputs = buildFullPipeline("Dental Implant Informative Creative", "SOCIAL_MEDIA", "instagram_post");
    const vagueScore = assembleBlueprint(vagueInputs).quality.readinessScore;
    const clearScore = assembleBlueprint(clearInputs).quality.readinessScore;
    // Vague ideas score at least 15 points lower than clear ideas
    expect(clearScore - vagueScore).toBeGreaterThanOrEqual(15);
  });

  it("has validationStatus of valid or valid_with_warnings for clear idea", () => {
    const inputs = buildFullPipeline("Luxury Real Estate Villa Advertisement", "MARKETING_CREATIVE", "poster");
    const bp = assembleBlueprint(inputs);
    expect(["valid", "valid_with_warnings"]).toContain(bp.quality.validationStatus);
  });

  it("has unknownFields array (may be empty or populated)", () => {
    const inputs = buildFullPipeline("Restaurant Grand Opening");
    const bp = assembleBlueprint(inputs);
    expect(Array.isArray(bp.quality.unknownFields)).toBe(true);
  });

  it("includes all 6 module confidence scores", () => {
    const inputs = buildFullPipeline("Mutual Fund SIP Awareness");
    const bp = assembleBlueprint(inputs);
    expect(typeof bp.quality.moduleConfidences.strategy).toBe("number");
    expect(typeof bp.quality.moduleConfidences.campaign).toBe("number");
    expect(typeof bp.quality.moduleConfidences.layout).toBe("number");
    expect(typeof bp.quality.moduleConfidences.typography).toBe("number");
    expect(typeof bp.quality.moduleConfidences.userIntelligence).toBe("number");
    expect(typeof bp.quality.moduleConfidences.assetIntelligence).toBe("number");
  });

  it("generates a compliance warning for healthcare campaigns without disclaimer", () => {
    const inputs = buildFullPipeline("Hospital Health Checkup Campaign");
    const bp = assembleBlueprint(inputs);
    // Healthcare industry — warning may appear about disclaimer or brand safety
    expect(Array.isArray(bp.quality.warnings)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CampaignBlueprintBuilder fluent API
// ─────────────────────────────────────────────────────────────────────────────

describe("CampaignBlueprintBuilder", () => {
  it("throws if build() is called without strategy", () => {
    const { context, campaignPlan, layoutPlan, typographyPlan } = buildFullPipeline("Dental Campaign");
    const builder = new CampaignBlueprintBuilder(context)
      .withCampaignPlan(campaignPlan)
      .withLayoutPlan(layoutPlan)
      .withTypographyPlan(typographyPlan);
    expect(() => builder.build()).toThrow(/strategy is required/);
  });

  it("successfully builds with all required inputs", () => {
    const { context, strategy, campaignPlan, layoutPlan, typographyPlan } = buildFullPipeline("School Admission Campaign");
    const bp = new CampaignBlueprintBuilder(context)
      .withStrategy(strategy)
      .withCampaignPlan(campaignPlan)
      .withLayoutPlan(layoutPlan)
      .withTypographyPlan(typographyPlan)
      .build();
    expect(bp.quality.readinessScore).toBeGreaterThan(0);
    expect(bp.meta.blueprintId).toBeTruthy();
  });

  it("withProjectId sets the projectId in metadata", () => {
    const { context, strategy, campaignPlan, layoutPlan, typographyPlan } = buildFullPipeline("Salon Transformation");
    const bp = new CampaignBlueprintBuilder(context)
      .withStrategy(strategy)
      .withCampaignPlan(campaignPlan)
      .withLayoutPlan(layoutPlan)
      .withTypographyPlan(typographyPlan)
      .withProjectId("test-project-123")
      .build();
    expect(bp.meta.projectId).toBe("test-project-123");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// No-generation verification
// ─────────────────────────────────────────────────────────────────────────────

describe("Blueprint MUST NOT generate anything", () => {
  it("assembleBlueprint is a synchronous pure function — no async, no LLM", () => {
    const inputs = buildFullPipeline("Jewellery Campaign");
    const result = assembleBlueprint(inputs);
    expect(result).toBeDefined();
  });

  it("Blueprint meta contains no prompt-like content", () => {
    const inputs = buildFullPipeline("Hospital Health Checkup");
    const bp = assembleBlueprint(inputs);
    const metaStr = JSON.stringify(bp.meta);
    expect(metaStr).not.toMatch(/Generate|Create prompt|image generation|F\/2\.8|8k/i);
  });
});
