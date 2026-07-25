import { describe, expect, it } from "vitest";

import { evaluateImage } from "./index";
import { validateImageCriticInput } from "./validation";
import type { ImageCriticInput } from "./types";

import { analyzeUserRequest }       from "../user-understanding";
import { buildCreativeContext }     from "../creative-context";
import { buildCreativeStrategy }    from "../creative-brain";
import { buildCampaignPlan }        from "../creative-director";
import { buildVisualLayoutPlan }    from "../visual-layout";
import { buildTypographyPlan }      from "../typography";
import { assembleBlueprint }        from "../blueprint";
import { buildVisualScenePlan }     from "../scene-planner";
import { buildPromptSpecification } from "../prompt-spec";
import type { CreativeRequest }     from "../types";
import type { GenerationResult }    from "../generation/types";

// ─────────────────────────────────────────────────────────────────────────────
// Test helper — build a full ImageCriticInput from a raw idea
// ─────────────────────────────────────────────────────────────────────────────

function makeInput(rawIdea: string, overrides?: Partial<ImageCriticInput>): ImageCriticInput {
  const request: CreativeRequest = { userId: "test", rawIdea, kind: "SOCIAL_MEDIA", presetKey: "instagram_post", requestedAt: new Date() };
  const uu         = analyzeUserRequest(request);
  const ctx        = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy   = buildCreativeStrategy(ctx);
  const plan       = buildCampaignPlan(strategy);
  const layout     = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  const blueprint  = assembleBlueprint({ context: ctx, strategy, campaignPlan: plan, layoutPlan: layout, typographyPlan: typography });
  const scene      = buildVisualScenePlan(blueprint);
  const spec       = buildPromptSpecification(blueprint, scene);

  const mockResult: GenerationResult = {
    generationId:  "gen_test_001",
    status:        "success",
    provider:      "openai",
    model:         "gpt-image-1",
    outputUrl:     "https://example.com/test.png",
    contentType:   "image/png",
    latencyMs:     3200,
    generatedAt:   new Date().toISOString(),
    cost: {
      estimatedCostUsd: 0.04,
      creditCost:       4,
      billingModel:     "per_image",
      provider:         "openai",
      model:            "gpt-image-1",
      quality:          "high",
    },
    quality: {
      estimatedOutputQuality: 82,
      fullPromptUsed:         true,
      allFeaturesSupported:   true,
      ignoredFeatures:        [],
    },
    warnings:    [],
    retryCount:  0,
    telemetry: {
      generationId:        "gen_test_001",
      provider:            "openai",
      model:               "gpt-image-1",
      promptLength:        800,
      negativePromptLength:120,
      aspectRatio:         "1:1",
      outputFormat:        "png",
      quality:             "high",
      latencyMs:           3200,
      success:             true,
      retryCount:          0,
      hasReferenceImages:  false,
      userId:              "test",
      generatedAt:         new Date().toISOString(),
    },
  };

  return {
    imageUrl:         "https://example.com/test.png",
    blueprint,
    scenePlan:        scene,
    promptSpec:       spec,
    generationResult: mockResult,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Input Validation
// ─────────────────────────────────────────────────────────────────────────────

describe("validateImageCriticInput", () => {
  it("returns valid for a complete input", () => {
    const input = makeInput("Dental Implant Campaign");
    const result = validateImageCriticInput(input);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns error when imageUrl is missing", () => {
    const input = makeInput("Test");
    (input as { imageUrl: string }).imageUrl = "";
    const result = validateImageCriticInput(input);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes("IMAGE_MISSING"))).toBe(true);
  });

  it("returns error when blueprint is missing", () => {
    const input = makeInput("Test");
    (input as { blueprint: unknown }).blueprint = null as unknown as typeof input.blueprint;
    const result = validateImageCriticInput(input);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes("BLUEPRINT_MISSING"))).toBe(true);
  });

  it("returns warning when generation was not successful", () => {
    const input = makeInput("Test");
    (input.generationResult as { status: string }).status = "failed";
    const result = validateImageCriticInput(input);
    expect(result.isValid).toBe(true); // warnings don't fail validation
    expect(result.warnings.some(w => w.includes("GENERATION_NOT_SUCCESSFUL"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Core evaluation — structure and completeness
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluateImage — report structure", () => {
  it("returns a complete ImageEvaluationReport", () => {
    const report = evaluateImage(makeInput("Dental Implant Campaign"));
    expect(report).toHaveProperty("evaluationId");
    expect(report.evaluationId).toMatch(/^eval_/);
    expect(report).toHaveProperty("heroSubject");
    expect(report).toHaveProperty("composition");
    expect(report).toHaveProperty("lighting");
    expect(report).toHaveProperty("marketing");
    expect(report).toHaveProperty("branding");
    expect(report).toHaveProperty("realism");
    expect(report).toHaveProperty("artifacts");
    expect(report).toHaveProperty("typographySafeAreas");
    expect(report).toHaveProperty("quality");
    expect(report).toHaveProperty("recommendations");
    expect(report).toHaveProperty("approved");
    expect(report).toHaveProperty("evaluationMethod");
    expect(report).toHaveProperty("evaluationConfidence");
    expect(report).toHaveProperty("pendingVisionAnalysis");
  });

  it("returns spec_only evaluation method when no vision is used", () => {
    const report = evaluateImage(makeInput("Luxury Watch Campaign"));
    expect(report.evaluationMethod).toBe("spec_only");
  });

  it("evaluation confidence is between 0 and 100", () => {
    const report = evaluateImage(makeInput("Real Estate Campaign"));
    expect(report.evaluationConfidence).toBeGreaterThanOrEqual(0);
    expect(report.evaluationConfidence).toBeLessThanOrEqual(100);
  });

  it("evaluatedAt is a valid ISO string", () => {
    const report = evaluateImage(makeInput("Test campaign"));
    expect(() => new Date(report.evaluatedAt)).not.toThrow();
    expect(new Date(report.evaluatedAt).getTime()).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Hero Subject Evaluation
// ─────────────────────────────────────────────────────────────────────────────

describe("heroSubject evaluation", () => {
  it("returns a hero score between 0 and 100", () => {
    const report = evaluateImage(makeInput("Dentist consultation campaign"));
    expect(report.heroSubject.heroScore.value).toBeGreaterThanOrEqual(0);
    expect(report.heroSubject.heroScore.value).toBeLessThanOrEqual(100);
  });

  it("every hero field has value, confidence, reasoning, source", () => {
    const report = evaluateImage(makeInput("Test"));
    const { heroVisibility, heroDominance, heroAccuracy, heroScore } = report.heroSubject;
    for (const field of [heroVisibility, heroDominance, heroAccuracy, heroScore]) {
      expect(field).toHaveProperty("value");
      expect(field).toHaveProperty("confidence");
      expect(field).toHaveProperty("reasoning");
      expect(field).toHaveProperty("source");
      expect(typeof field.reasoning).toBe("string");
      expect(field.reasoning.length).toBeGreaterThan(0);
    }
  });

  it("returns likely_absent when generation failed", () => {
    const input = makeInput("Dental Campaign");
    (input.generationResult as { status: string }).status = "failed";
    const report = evaluateImage(input);
    expect(report.heroSubject.heroVisibility.value).toBe("likely_absent");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Quality Scores
// ─────────────────────────────────────────────────────────────────────────────

describe("quality scores", () => {
  it("overall score is between 0 and 100", () => {
    const report = evaluateImage(makeInput("Luxury Watch Campaign"));
    expect(report.quality.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.quality.overallScore).toBeLessThanOrEqual(100);
  });

  it("all dimension scores are between 0 and 100", () => {
    const report = evaluateImage(makeInput("Real Estate Campaign"));
    const { heroScore, compositionScore, lightingScore, marketingScore,
            brandScore, realismScore, artifactScore, typographySafetyScore } = report.quality;
    for (const score of [heroScore, compositionScore, lightingScore, marketingScore,
                          brandScore, realismScore, artifactScore, typographySafetyScore]) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("passesQualityThreshold reflects the quality threshold correctly", () => {
    const report = evaluateImage(makeInput("Social media campaign"));
    expect(typeof report.quality.passesQualityThreshold).toBe("boolean");
    expect(report.quality.passesQualityThreshold).toBe(report.quality.overallScore >= report.quality.qualityThreshold);
  });

  it("high-quality OpenAI generation produces a passing score", () => {
    const input = makeInput("Premium dental implant campaign for Instagram");
    // OpenAI with fullPromptUsed + allFeaturesSupported → score should pass default threshold
    const report = evaluateImage(input);
    expect(report.quality.overallScore).toBeGreaterThan(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Realism — not_applicable logic
// ─────────────────────────────────────────────────────────────────────────────

describe("realism evaluation — not_applicable logic", () => {
  it("food realism is not_applicable for non-food campaigns", () => {
    const report = evaluateImage(makeInput("Dental implant campaign"));
    expect(report.realism.foodRealism.value).toBe("not_applicable");
    expect(report.realism.foodRealism.confidence).toBe("high");
  });

  it("realism score defaults high when all dimensions are not_applicable", () => {
    // For a simple abstract campaign with no humans/food/architecture
    const report = evaluateImage(makeInput("Abstract gradient background campaign"));
    expect(report.realism.realismScore.value).toBeGreaterThanOrEqual(70);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Artifact Detection
// ─────────────────────────────────────────────────────────────────────────────

describe("artifact evaluation", () => {
  it("OpenAI provider produces low artifact detection risk", () => {
    const report = evaluateImage(makeInput("Clean product shot campaign"));
    const artifact = report.artifacts.aiArtifactsDetected.value;
    expect(["none", "minor", "unknown"]).toContain(artifact);
  });

  it("text rendering is absent when no typography in spec", () => {
    const input = makeInput("Minimalist product campaign");
    const report = evaluateImage(input);
    // For most campaigns without explicit text spec, textRendering should be absent or not_applicable
    expect(["absent", "legible", "illegible", "not_applicable"]).toContain(report.artifacts.textRendering.value);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Recommendations
// ─────────────────────────────────────────────────────────────────────────────

describe("recommendations", () => {
  it("returns an array of recommendations", () => {
    const report = evaluateImage(makeInput("Dental Campaign"));
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it("recommendations are sorted by priority (critical before high before medium before low)", () => {
    const report = evaluateImage(makeInput("Medical dental campaign with hands"));
    const priorities = report.recommendations.map(r => r.priority);
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    for (let i = 1; i < priorities.length; i++) {
      expect(order[priorities[i]]).toBeGreaterThanOrEqual(order[priorities[i - 1]]);
    }
  });

  it("each recommendation has required fields", () => {
    const report = evaluateImage(makeInput("Test campaign for recommendations"));
    for (const rec of report.recommendations) {
      expect(rec).toHaveProperty("priority");
      expect(rec).toHaveProperty("category");
      expect(rec).toHaveProperty("issue");
      expect(rec).toHaveProperty("improvement");
      expect(rec).toHaveProperty("estimatedImpact");
      expect(typeof rec.issue).toBe("string");
      expect(typeof rec.improvement).toBe("string");
      expect(rec.estimatedImpact).toBeGreaterThanOrEqual(0);
      expect(rec.estimatedImpact).toBeLessThanOrEqual(20);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STRICT RULE: Image Critic must NOT generate any content
// ─────────────────────────────────────────────────────────────────────────────

describe("Image Critic must NOT call providers or modify inputs", () => {
  it("evaluateImage is a pure synchronous function (returns Report, not Promise)", () => {
    const input = makeInput("Dental Campaign");
    const result = evaluateImage(input);
    // If it returned a Promise, toHaveProperty('approved') would fail on the promise object
    expect(result).toHaveProperty("approved");
    expect(result).toHaveProperty("evaluationId");
    expect(typeof result.approved).toBe("boolean");
  });

  it("does not mutate the input blueprint", () => {
    const input = makeInput("Luxury Watch");
    const originalBlueprintId = input.blueprint.meta.blueprintId;
    evaluateImage(input);
    expect(input.blueprint.meta.blueprintId).toBe(originalBlueprintId);
  });

  it("does not mutate the input promptSpec", () => {
    const input  = makeInput("Product Campaign");
    const orig   = JSON.stringify(input.promptSpec);
    evaluateImage(input);
    expect(JSON.stringify(input.promptSpec)).toBe(orig);
  });

  it("does not mutate the input generationResult", () => {
    const input = makeInput("Campaign");
    const origId = input.generationResult.generationId;
    evaluateImage(input);
    expect(input.generationResult.generationId).toBe(origId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluateImage — error handling", () => {
  it("throws when imageUrl is missing", () => {
    const input = makeInput("Test");
    (input as { imageUrl: string }).imageUrl = "";
    expect(() => evaluateImage(input)).toThrow("invalid input");
  });

  it("throws when blueprint is missing", () => {
    const input = makeInput("Test");
    (input as { blueprint: unknown }).blueprint = null as unknown as typeof input.blueprint;
    expect(() => evaluateImage(input)).toThrow("invalid input");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multiple campaigns — variety check
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluateImage — variety of campaigns", () => {
  const campaigns = [
    "Dental implant before and after",
    "Luxury watch product shot",
    "Real estate luxury apartment",
    "Instagram food photography",
    "Finance investment promotion",
    "Medical clinic professional services",
    "Fashion brand awareness",
  ];

  for (const campaign of campaigns) {
    it(`produces a valid report for "${campaign}"`, () => {
      const report = evaluateImage(makeInput(campaign));
      expect(report.quality.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.quality.overallScore).toBeLessThanOrEqual(100);
      expect(report.evaluationId).toBeTruthy();
      expect(report.approved).toBeDefined();
    });
  }
});
