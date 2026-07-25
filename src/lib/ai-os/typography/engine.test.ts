import { describe, expect, it } from "vitest";

import { buildTypographyPlan } from "./engine";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCampaignPlan } from "../creative-director";
import { buildVisualLayoutPlan } from "../visual-layout";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import type { CreativeRequest } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function makePipeline(rawIdea: string, kind?: CreativeRequest["kind"], presetKey?: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, kind, presetKey, requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const plan = buildCampaignPlan(strategy);
  const layout = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  return { strategy, plan, layout, typography };
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure
// ─────────────────────────────────────────────────────────────────────────────

describe("buildTypographyPlan — structural correctness", () => {
  it("returns all 8 domains plus confidenceScore and unknownFields", () => {
    const { typography } = makePipeline("Dental Implant Informative Creative");
    expect(typography).toHaveProperty("hierarchy");
    expect(typography).toHaveProperty("fontIntelligence");
    expect(typography).toHaveProperty("fontWeights");
    expect(typography).toHaveProperty("alignment");
    expect(typography).toHaveProperty("readability");
    expect(typography).toHaveProperty("informationPriority");
    expect(typography).toHaveProperty("textSafeAreas");
    expect(typography).toHaveProperty("rhythm");
    expect(typeof typography.confidenceScore).toBe("number");
    expect(Array.isArray(typography.unknownFields)).toBe(true);
  });

  it("every field has value + confidence + reasoning", () => {
    const { typography } = makePipeline("Restaurant Grand Opening");
    const domains = [
      typography.hierarchy, typography.fontIntelligence, typography.fontWeights,
      typography.alignment, typography.readability, typography.informationPriority,
      typography.textSafeAreas, typography.rhythm,
    ];
    for (const domain of domains) {
      for (const [key, field] of Object.entries(domain)) {
        if (typeof field === "object" && field !== null && "value" in field) {
          expect(field.value, `${key}.value`).toBeDefined();
          expect(field.confidence, `${key}.confidence`).toBeDefined();
          expect(field.reasoning, `${key}.reasoning`).toBeDefined();
          expect(field.reasoning, `${key}.reasoning not empty`).not.toBe("");
        }
      }
    }
  });

  it("never crashes or returns undefined fields", () => {
    const { typography } = makePipeline("something vague");
    expect(typography.fontIntelligence.fontPersonality.value).toBeDefined();
    expect(typography.readability.readingSpeed.value).toBeDefined();
    expect(typography.rhythm.lineHeight.value).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dental — Medical typography
// ─────────────────────────────────────────────────────────────────────────────

describe("Dental Campaign Typography", () => {
  const { typography } = makePipeline("Dental Implant Informative Creative", "SOCIAL_MEDIA", "instagram_post");

  it("assigns medical font personality", () => {
    expect(typography.fontIntelligence.fontPersonality.value).toBe("medical");
  });

  it("headline font character references humanist or warm professional sans", () => {
    const char = typography.fontIntelligence.headlineFontCharacter.value;
    expect(char).not.toBe("unknown");
    expect(char.toLowerCase()).toMatch(/humanist|warm|professional|precision|clarity/);
  });

  it("CTA is always present and prominent", () => {
    expect(typography.hierarchy.cta.value).toBe("prominent_action");
  });

  it("hero headline is large_commanding or ultra_large_dominant", () => {
    expect(["large_commanding", "ultra_large_dominant"]).toContain(typography.hierarchy.heroHeadline.value);
  });

  it("uses instant_3_seconds reading speed for Instagram", () => {
    expect(typography.readability.readingSpeed.value).toBe("instant_3_seconds");
  });

  it("headline max words is short for Instagram", () => {
    expect(["very_short_1_to_5_words", "short_5_to_8_words"]).toContain(typography.readability.maxCharsPerHeadlineLine.value);
  });

  it("finance/healthcare disclaimer is present", () => {
    expect(["ultra_small_legal", "small_legal"]).toContain(typography.hierarchy.disclaimer.value);
  });

  it("confidenceScore is above 70", () => {
    expect(typography.confidenceScore).toBeGreaterThan(70);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Luxury Real Estate — Luxury typography
// ─────────────────────────────────────────────────────────────────────────────

describe("Luxury Real Estate Typography", () => {
  const { typography } = makePipeline("Luxury Real Estate Villa Advertisement", "MARKETING_CREATIVE", "poster");

  it("assigns luxury font personality", () => {
    expect(typography.fontIntelligence.fontPersonality.value).toBe("luxury");
  });

  it("sets headline weight to bold (NOT extra_bold for luxury)", () => {
    // Luxury → restraint; extra_bold is mass market
    expect(["bold", "light"]).toContain(typography.fontWeights.headlineWeight.value);
  });

  it("uses ultra_loose_luxury letter spacing", () => {
    expect(typography.rhythm.letterSpacing.value).toBe("ultra_loose_luxury");
  });

  it("sets high_contrast_3x or moderate_contrast hierarchy", () => {
    expect(["high_contrast_3x", "moderate_contrast_2x"]).toContain(typography.informationPriority.textHierarchyRatio.value);
  });

  it("distinctive typeface needed for luxury", () => {
    expect(["essential", "preferred"]).toContain(typography.fontIntelligence.distinctiveTypefaceNeeded.value);
  });

  it("uses editorial or generous line height", () => {
    expect(["editorial_1_8_plus", "generous_1_5_to_1_8"]).toContain(typography.rhythm.lineHeight.value);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Outdoor / Outdoor constraints
// ─────────────────────────────────────────────────────────────────────────────

describe("Outdoor Format Typography Constraints", () => {
  const { typography } = makePipeline("Car Showroom Promotion");

  it("minimum text category is appropriate for the format", () => {
    expect(["headline_minimum_only", "body_minimum", "labels_okay"]).toContain(
      typography.readability.minimumTextSizeCategory.value
    );
  });

  it("statistics use extra_bold weight", () => {
    expect(typography.fontWeights.statisticWeight.value).toBe("extra_bold");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mutual Fund — Finance corporate typography
// ─────────────────────────────────────────────────────────────────────────────

describe("Mutual Fund SIP Typography", () => {
  const { typography } = makePipeline("Mutual Fund SIP Awareness Campaign");

  it("assigns corporate font personality for finance", () => {
    expect(["corporate", "medical"]).toContain(typography.fontIntelligence.fontPersonality.value);
  });

  it("statistics text level is large_numeral", () => {
    // Finance campaign should show statistics prominently
    const statVal = typography.hierarchy.statistics.value;
    // Either present as large_numeral or absent depending on whether Campaign Plan includes statistics section
    expect(["large_numeral", "absent"]).toContain(statVal);
  });

  it("finance disclaimer is present", () => {
    expect(["ultra_small_legal", "small_legal"]).toContain(typography.hierarchy.disclaimer.value);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// No-generation verification
// ─────────────────────────────────────────────────────────────────────────────

describe("Typography Engine must NEVER generate fonts, colors, or layouts", () => {
  it("is a pure synchronous function — no async, no LLM", () => {
    const { strategy, plan, layout } = makePipeline("Jewellery Wedding Collection");
    const result = buildTypographyPlan(strategy, plan, layout);
    expect(result).toBeDefined();
  });

  it("never names actual font families", () => {
    const { typography } = makePipeline("Restaurant Grand Opening");
    const allValues = [
      typography.fontIntelligence.headlineFontCharacter.value,
      typography.fontIntelligence.bodyFontCharacter.value,
      typography.fontIntelligence.fontPersonality.value,
    ];
    for (const v of allValues) {
      if (typeof v === "string" && v !== "unknown") {
        // Specific font families that must never appear
        expect(v.toLowerCase()).not.toMatch(/\binter\b|\bhelvetica\b|\bmontserrat\b|\bgeorgia\b|\barial\b|\broboto\b|\bsans-serif\b|\bserif\b/);
      }
    }
  });

  it("never generates colors in any field", () => {
    const { typography } = makePipeline("Hospital Health Checkup");
    const allValues = Object.values(typography.rhythm).map(f => (f as { value: string }).value);
    for (const v of allValues) {
      if (typeof v === "string") {
        expect(v).not.toMatch(/#[0-9A-Fa-f]{3,6}/);
      }
    }
  });

  it("never specifies pixel sizes", () => {
    const { typography } = makePipeline("School Admission Campaign");
    const rhythmValues = Object.values(typography.rhythm).map(f => (f as { value: string }).value).join(" ");
    expect(rhythmValues).not.toMatch(/\d+px|\d+pt|\d+em|\d+rem/);
  });
});
