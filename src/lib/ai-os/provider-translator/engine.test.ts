import { describe, expect, it, vi } from "vitest";

import { translateForProvider, translateForAllProviders, SUPPORTED_PROVIDERS } from "./index";
import { optimizePromptSpecification } from "../prompt-optimizer";
import { buildPromptSpecification } from "../prompt-spec";
import { buildVisualScenePlan } from "../scene-planner";
import { assembleBlueprint } from "../blueprint";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCampaignPlan } from "../creative-director";
import { buildVisualLayoutPlan } from "../visual-layout";
import { buildTypographyPlan } from "../typography";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import type { CreativeRequest, } from "../types";
import type { SupportedProvider } from "./types";

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
  return optimizePromptSpecification(spec);
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure — every provider must return the correct ProviderPrompt shape
// ─────────────────────────────────────────────────────────────────────────────

describe("translateForProvider — structural correctness", () => {
  it("returns all required sections for every provider", () => {
    const optimized = makeOptimized("Dental Implant Informative Creative", "SOCIAL_MEDIA", "instagram_post");
    for (const provider of SUPPORTED_PROVIDERS) {
      const result = translateForProvider(optimized, provider);
      expect(result, `${provider} should return ProviderPrompt`).toBeDefined();
      expect(result.meta.provider).toBe(provider);
      expect(result.body.finalPrompt.length).toBeGreaterThan(10);
      expect(result.body.estimatedPromptLength).toBeGreaterThan(0);
      expect(result.body.estimatedTokenCount).toBeGreaterThan(0);
      expect(typeof result.quality.translationConfidence).toBe("number");
      expect(typeof result.quality.estimatedQuality).toBe("number");
      expect(Array.isArray(result.quality.warnings)).toBe(true);
      expect(Array.isArray(result.body.orderedSections)).toBe(true);
    }
  });

  it("hero is first section for Gemini; OpenAI now leads with the no-text instruction, hero second (prompt-bloat fix)", () => {
    const optimized = makeOptimized("Restaurant Grand Opening");
    const openai = translateForProvider(optimized, "openai");
    const gemini = translateForProvider(optimized, "gemini");
    // Prompt-bloat fix: OpenAI's highest-priority instruction (don't render
    // text) now leads, ahead of hero — Gemini's translator is unchanged.
    expect(openai.body.orderedSections[0]).toBe("noText");
    expect(openai.body.orderedSections[1]).toBe("hero");
    expect(gemini.body.orderedSections[0]).toBe("hero");
  });

  it("meta contains correct provider and sourceOptimizationId", () => {
    const optimized = makeOptimized("Luxury Villa Advertisement");
    const result = translateForProvider(optimized, "openai");
    expect(result.meta.provider).toBe("openai");
    expect(result.meta.sourceOptimizationId).toBe(optimized.meta.optimizationId);
    expect(result.meta.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Format-style correctness
// ─────────────────────────────────────────────────────────────────────────────

describe("Provider format styles", () => {
  it("OpenAI uses prose format", () => {
    const optimized = makeOptimized("Dental Implant Creative", "SOCIAL_MEDIA", "instagram_post");
    const result = translateForProvider(optimized, "openai");
    expect(result.body.formatStyle).toBe("prose");
  });

  it("Flux uses tag format", () => {
    const optimized = makeOptimized("Dental Implant Creative");
    const result = translateForProvider(optimized, "flux");
    expect(result.body.formatStyle).toBe("tags");
  });

  it("SDXL uses tag format", () => {
    const optimized = makeOptimized("Restaurant Grand Opening");
    const result = translateForProvider(optimized, "stable_diffusion");
    expect(result.body.formatStyle).toBe("tags");
  });

  it("Video providers use temporal format", () => {
    const optimized = makeOptimized("Restaurant Grand Opening");
    for (const provider of ["veo", "runway", "kling"] as SupportedProvider[]) {
      const result = translateForProvider(optimized, provider);
      expect(result.body.formatStyle).toBe("temporal");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Provider length limits
// ─────────────────────────────────────────────────────────────────────────────

describe("Provider length limits are respected", () => {
  it("Flux prompt stays within 512 chars", () => {
    const optimized = makeOptimized("Dental Campaign");
    const result = translateForProvider(optimized, "flux");
    expect(result.body.finalPrompt.length).toBeLessThanOrEqual(512);
  });

  it("SDXL prompt stays within 300 chars", () => {
    const optimized = makeOptimized("Restaurant Grand Opening");
    const result = translateForProvider(optimized, "stable_diffusion");
    expect(result.body.finalPrompt.length).toBeLessThanOrEqual(300);
  });

  it("OpenAI prompt stays within 32000 chars", () => {
    const optimized = makeOptimized("Luxury Villa Advertisement", "MARKETING_CREATIVE", "poster");
    const result = translateForProvider(optimized, "openai");
    expect(result.body.finalPrompt.length).toBeLessThanOrEqual(32000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Negative prompts
// ─────────────────────────────────────────────────────────────────────────────

describe("Negative prompts", () => {
  it("Flux includes a separate negativePrompt", () => {
    const optimized = makeOptimized("Jewellery Wedding Collection");
    const result = translateForProvider(optimized, "flux");
    expect(result.body.negativePrompt).toBeDefined();
    expect((result.body.negativePrompt ?? "").length).toBeGreaterThan(5);
  });

  it("SDXL includes a separate negativePrompt", () => {
    const optimized = makeOptimized("Dental Campaign");
    const result = translateForProvider(optimized, "stable_diffusion");
    expect(result.body.negativePrompt).toBeDefined();
  });

  it("OpenAI folds negatives into finalPrompt (no separate negativePrompt)", () => {
    const optimized = makeOptimized("Dental Campaign");
    const result = translateForProvider(optimized, "openai");
    expect(result.body.negativePrompt).toBeUndefined();
    // Negatives should appear in the finalPrompt as "Avoid: ..."
    expect(result.body.finalPrompt.toLowerCase()).toMatch(/avoid|without|no /);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// translateForAllProviders
// ─────────────────────────────────────────────────────────────────────────────

describe("translateForAllProviders", () => {
  it("returns a prompt for every supported provider", () => {
    const optimized = makeOptimized("Hospital Health Checkup");
    const allPrompts = translateForAllProviders(optimized);
    for (const provider of SUPPORTED_PROVIDERS) {
      expect(allPrompts[provider]).toBeDefined();
      expect(allPrompts[provider].body.finalPrompt.length).toBeGreaterThan(10);
    }
  });

  it("each provider's prompt is different (not the same text)", () => {
    const optimized = makeOptimized("Dental Implant Creative");
    const allPrompts = translateForAllProviders(optimized);
    const openaiPrompt = allPrompts.openai.body.finalPrompt;
    const fluxPrompt   = allPrompts.flux.body.finalPrompt;
    // Prose vs. tags must be different
    expect(openaiPrompt).not.toBe(fluxPrompt);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// No-generation verification
// ─────────────────────────────────────────────────────────────────────────────

describe("Provider Translator must NEVER call providers", () => {
  it("is a pure synchronous function — no async, no API calls", () => {
    const optimized = makeOptimized("Salon Campaign");
    const result = translateForProvider(optimized, "openai");
    expect(result).toBeDefined();
  });

  it("does not invent objects or copy not in the spec", () => {
    const optimized = makeOptimized("Dental Implant Creative");
    const result = translateForProvider(optimized, "openai");
    // Should not invent specific product names not in the spec
    expect(result.body.finalPrompt).not.toMatch(/Nobel Biocare|Straumann|Osstem/i);
  });

  it("does not contain provider API parameters in the prompt body", () => {
    const optimized = makeOptimized("Luxury Villa");
    const result = translateForProvider(optimized, "openai");
    const prompt = result.body.finalPrompt;
    expect(prompt).not.toMatch(/"quality":|"n":|"size":|model:/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4G: Semantic Richness
// Verifies the translator is a semantic compiler, NOT a summarizer.
// All tests exercise the buildOpenAIPrompt path (gptNarrative is undefined
// in the test pipeline since no GPTCampaignDirection is passed).
// ─────────────────────────────────────────────────────────────────────────────

describe("OpenAI Semantic Richness (Phase 10.4G)", () => {
  it("PRIMARY HERO section label is present in the prompt", () => {
    const optimized = makeOptimized("Restaurant Grand Opening");
    const result = translateForProvider(optimized, "openai");
    expect(result.body.finalPrompt).toContain("PRIMARY HERO");
  });

  it("CAMERA section label is present in the prompt", () => {
    const optimized = makeOptimized("Dental Implant Creative", "SOCIAL_MEDIA", "instagram_post");
    const result = translateForProvider(optimized, "openai");
    expect(result.body.finalPrompt).toContain("CAMERA");
  });

  it("MARKETING INTENT section label is NOT present in the prompt (prompt-bloat fix — non-visual, dropped)", () => {
    const optimized = makeOptimized("Luxury Villa Advertisement");
    const result = translateForProvider(optimized, "openai");
    expect(result.body.finalPrompt).not.toContain("MARKETING INTENT");
  });

  it("AVOID: section is present and contains content", () => {
    const optimized = makeOptimized("Salon Campaign");
    const result = translateForProvider(optimized, "openai");
    expect(result.body.finalPrompt).toContain("AVOID:");
  });

  it("Indian-by-default instruction is present, with its override clause, and explicitly covers secondary/background people (quality.ts fix)", () => {
    const optimized = makeOptimized("Restaurant Grand Opening");
    const result = translateForProvider(optimized, "openai");
    expect(result.body.finalPrompt).toContain("every human subject in the image is Indian");
    expect(result.body.finalPrompt).toContain("including any secondary, background, or incidental people");
    expect(result.body.finalPrompt).toContain("Unless the brief explicitly specifies otherwise");
  });

  it("real-photograph realism instruction is present (quality.ts fix)", () => {
    const optimized = makeOptimized("Restaurant Grand Opening");
    const result = translateForProvider(optimized, "openai");
    expect(result.body.finalPrompt).toContain("real photograph of real people");
  });

  it("PRIMARY HERO section content is substantive — not a 3-word collapse", () => {
    const optimized = makeOptimized("Restaurant Grand Opening");
    const result = translateForProvider(optimized, "openai");
    const prompt = result.body.finalPrompt;
    const heroMatch = prompt.match(/PRIMARY HERO\n([\s\S]+?)(?:\n\n|$)/);
    expect(heroMatch).not.toBeNull();
    const heroContent = heroMatch![1]!.trim();
    expect(heroContent.length).toBeGreaterThan(20);
  });

  it("BACKGROUND section uses layered environment labels", () => {
    const optimized = makeOptimized("Restaurant Grand Opening");
    const result = translateForProvider(optimized, "openai");
    const prompt = result.body.finalPrompt;
    expect(prompt).toMatch(/Setting:|Foreground:|Midground:|Background:/);
  });

  it("orderedSections reflects the trimmed 12-section structure (prompt-bloat fix)", () => {
    const optimized = makeOptimized("Dental Implant Informative Creative", "SOCIAL_MEDIA", "instagram_post");
    const result = translateForProvider(optimized, "openai");
    // Prompt-bloat fix: no-text leads; adZones/marketing/campaignTheme dropped
    // (non-visual, or duplicated elsewhere); typography compressed to keepClearZones.
    expect(result.body.orderedSections).toEqual([
      "noText", "hero", "story", "emotion", "secondary",
      "camera", "lighting", "background", "keepClearZones",
      "intent", "quality", "negatives",
    ]);
  });

  it("translator version is 2.0.0 for all providers", () => {
    const optimized = makeOptimized("Hospital Health Checkup");
    for (const provider of SUPPORTED_PROVIDERS) {
      const result = translateForProvider(optimized, provider);
      expect(result.meta.translatorVersion).toBe("2.0.0");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4K.2 — Modern translator path activation
// Regression suite for the two-path flag:
//   Modern (default): buildOpenAIPrompt() — all section builders active
//   Legacy (OPENAI_LEGACY_TRANSLATOR=true): gptNarrative.narrativePrompt used
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.4K.2 — OpenAI modern path (default, no flag set)", () => {
  it("STORY CONTEXT block is present but no longer carries non-visual labels — Phase 10.4J ad intelligence, trimmed by the prompt-bloat fix", () => {
    const optimized = makeOptimized(
      "Dental Implant Clinic — IDA Certified, 15 Years Experience, Free Consultation, Lead Generation"
    );
    const result = translateForProvider(optimized, "openai");
    expect(result.body.finalPrompt).toContain("STORY CONTEXT");
    // Dropped as non-visual marketing-strategy framing (prompt-bloat fix):
    expect(result.body.finalPrompt).not.toContain("Conversion intent");
    expect(result.body.finalPrompt).not.toContain("Identity signal");
  });

  it("MARKETING INTENT section is NOT present — dropped by the prompt-bloat fix (verbatim-duplicated VISIBLE EMOTION anyway)", () => {
    const optimized = makeOptimized(
      "Dental Implant Clinic — Lead Generation, Free Consultation"
    );
    const result = translateForProvider(optimized, "openai");
    expect(result.body.finalPrompt).not.toContain("MARKETING INTENT");
  });

  it("ADVERTISEMENT ZONES section is NOT present — dropped by the prompt-bloat fix (ad-layout language, not photography direction)", () => {
    const optimized = makeOptimized("Dental Implant Clinic — IDA Certified");
    const result = translateForProvider(optimized, "openai");
    expect(result.body.finalPrompt).not.toContain("ADVERTISEMENT ZONES");
  });

  it("keep-clear zone instruction is present, compressed from the old verbose TYPOGRAPHY ZONES block (prompt-bloat fix)", () => {
    const optimized = makeOptimized("Restaurant Grand Opening — Lead Generation");
    const result = translateForProvider(optimized, "openai");
    expect(result.body.finalPrompt).toContain("Leave clean, empty space at:");
    expect(result.body.finalPrompt).not.toContain("TYPOGRAPHY ZONES");
  });

  it("NO TEXT instruction is present in the prompt (prompt-bloat fix — the 'Gutistaction' garbled-text root cause)", () => {
    const optimized = makeOptimized("Restaurant Grand Opening — Lead Generation");
    const result = translateForProvider(optimized, "openai");
    expect(result.body.finalPrompt).toContain(
      "Do not render any text, letters, words, numbers, or logos anywhere in this image"
    );
  });

  it("gptNarrative is ignored even when present in spec — modern path always uses buildOpenAIPrompt", () => {
    const optimized = makeOptimized("Dental Implant Creative");
    const withGptNarrative = {
      ...optimized,
      optimizedSpec: {
        ...optimized.optimizedSpec,
        gptNarrative: {
          narrativePrompt: "LEGACY_PATH_SENTINEL_MUST_NOT_APPEAR_IN_MODERN_MODE",
          quality: { status: "valid" as const, score: 90, checks: [], failedChecks: [] },
          fieldsConsumed: ["heroSubject"],
          fieldsMissing: [],
        },
      },
    };
    const result = translateForProvider(withGptNarrative, "openai");
    expect(result.body.finalPrompt).not.toContain("LEGACY_PATH_SENTINEL_MUST_NOT_APPEAR_IN_MODERN_MODE");
    expect(result.body.finalPrompt).toContain("PRIMARY HERO");
  });

  it("CAMPAIGN THEME block is present when campaignTheme field is populated", () => {
    const optimized = makeOptimized(
      "Dental Implant Clinic — IDA Certified, Lead Generation"
    );
    // campaignTheme may or may not be populated depending on creative brain output;
    // verify the prompt contains it when the section builder fires
    const prompt = translateForProvider(optimized, "openai").body.finalPrompt;
    // If campaignTheme was generated, it appears as a labeled block
    if (prompt.includes("CAMPAIGN THEME")) {
      const afterLabel = prompt.split("CAMPAIGN THEME\n")[1] ?? "";
      expect(afterLabel.length).toBeGreaterThan(0);
    }
    // Whether or not the block appears, the prompt must always contain PRIMARY HERO
    expect(prompt).toContain("PRIMARY HERO");
  });
});

describe("Phase 10.4K.2 — OpenAI legacy path (OPENAI_LEGACY_TRANSLATOR=true)", () => {
  it("gptNarrative.narrativePrompt is used as the prompt base when legacy flag is on and quality is valid", () => {
    vi.stubEnv("OPENAI_LEGACY_TRANSLATOR", "true");
    try {
      const optimized = makeOptimized("Dental Implant Creative");
      const withGptNarrative = {
        ...optimized,
        optimizedSpec: {
          ...optimized.optimizedSpec,
          gptNarrative: {
            narrativePrompt: "LEGACY_SENTINEL: IDA certified dental implant clinic narrative from GPT director.",
            quality: { status: "valid" as const, score: 90, checks: [], failedChecks: [] },
            fieldsConsumed: ["heroSubject"],
            fieldsMissing: [],
          },
        },
      };
      const result = translateForProvider(withGptNarrative, "openai");
      expect(result.body.finalPrompt).toContain("LEGACY_SENTINEL:");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("falls back to buildOpenAIPrompt even in legacy mode when gptNarrative quality is failed", () => {
    vi.stubEnv("OPENAI_LEGACY_TRANSLATOR", "true");
    try {
      const optimized = makeOptimized("Dental Implant Creative");
      const withFailedNarrative = {
        ...optimized,
        optimizedSpec: {
          ...optimized.optimizedSpec,
          gptNarrative: {
            narrativePrompt: "FAILED_LEGACY_SENTINEL_MUST_NOT_APPEAR",
            quality: { status: "failed" as const, score: 20, checks: [], failedChecks: ["hero"] },
            fieldsConsumed: [],
            fieldsMissing: ["heroSubject"],
          },
        },
      };
      const result = translateForProvider(withFailedNarrative, "openai");
      // quality failed → isGPTNarrativeActive=false even in legacy mode → buildOpenAIPrompt
      expect(result.body.finalPrompt).not.toContain("FAILED_LEGACY_SENTINEL_MUST_NOT_APPEAR");
      expect(result.body.finalPrompt).toContain("PRIMARY HERO");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
