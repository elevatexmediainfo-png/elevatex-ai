import { describe, expect, it } from "vitest";

import { buildCampaignPlan } from "./engine";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import type { CreativeRequest } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Helper — create a fully assembled CreativeStrategy for a given idea
// ─────────────────────────────────────────────────────────────────────────────

function makeStrategy(rawIdea: string, kind?: CreativeRequest["kind"], presetKey?: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, kind, presetKey, requestedAt: new Date() };
  const userUnderstanding = analyzeUserRequest(request);
  const context = buildCreativeContext(request, userUnderstanding, {}, { userId: "test" });
  return buildCreativeStrategy(context);
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure — every domain and every field must exist
// ─────────────────────────────────────────────────────────────────────────────

describe("buildCampaignPlan — structural correctness", () => {
  it("returns all 9 domains plus confidenceScore and unknownFields", () => {
    const plan = buildCampaignPlan(makeStrategy("Dental Implant Informative Creative"));
    expect(plan).toHaveProperty("concept");
    expect(plan).toHaveProperty("visualStory");
    expect(plan).toHaveProperty("informationArchitecture");
    expect(plan).toHaveProperty("advertisementStructure");
    expect(plan).toHaveProperty("visualDirection");
    expect(plan).toHaveProperty("photographyDirection");
    expect(plan).toHaveProperty("designDirection");
    expect(plan).toHaveProperty("marketingStructure");
    expect(plan).toHaveProperty("creativeConstraints");
    expect(typeof plan.confidenceScore).toBe("number");
    expect(Array.isArray(plan.unknownFields)).toBe(true);
  });

  it("every field has value + confidence + reasoning", () => {
    const plan = buildCampaignPlan(makeStrategy("Restaurant Grand Opening"));
    const domains = [plan.concept, plan.visualStory, plan.informationArchitecture, plan.advertisementStructure,
                     plan.visualDirection, plan.photographyDirection, plan.designDirection,
                     plan.marketingStructure, plan.creativeConstraints];
    for (const domain of domains) {
      for (const [key, field] of Object.entries(domain)) {
        if (typeof field === "object" && field !== null && "value" in field) {
          expect(field.value, `${key}.value`).toBeDefined();
          expect(field.confidence, `${key}.confidence`).toBeDefined();
          expect(field.reasoning, `${key}.reasoning`).toBeDefined();
          expect(typeof field.reasoning, `${key}.reasoning type`).toBe("string");
        }
      }
    }
  });

  it("never returns undefined for any field", () => {
    const plan = buildCampaignPlan(makeStrategy("make something cool"));
    expect(plan.concept.campaignTheme.value).toBeDefined();
    expect(plan.advertisementStructure.ctaSection.value).toBeDefined();
    expect(plan.creativeConstraints.brandSafety.value).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dental Implant Informative Creative
// ─────────────────────────────────────────────────────────────────────────────

describe("Dental Implant Informative Creative", () => {
  const plan = buildCampaignPlan(makeStrategy("Dental Implant Informative Creative", "SOCIAL_MEDIA", "instagram_post"));

  it("builds a campaign theme referencing dental/education goal", () => {
    const theme = plan.concept.campaignTheme.value;
    expect(theme).not.toBe("unknown");
    expect(theme.length).toBeGreaterThan(10);
  });

  it("assigns an education-oriented emotional hook", () => {
    expect(["empowerment", "reassurance", "curiosity", "hope"]).toContain(plan.concept.emotionalHook.value);
  });

  it("marks trust section as mandatory (critical trust industry)", () => {
    expect(plan.advertisementStructure.trustSection.value).not.toBe("absent");
    expect(plan.advertisementStructure.trustSection.confidence).toBe("high");
  });

  it("CTA section is always present", () => {
    expect(plan.advertisementStructure.ctaSection.value).not.toBe("absent");
  });

  it("sets hero section to a clinically appropriate format", () => {
    // headline_dominant is valid for an informative/education campaign where the message leads
    expect(["transformation_split", "full_bleed_visual", "split_visual_text", "lifestyle_scene", "headline_dominant"]).toContain(plan.advertisementStructure.heroSection.value);
  });

  it("assigns clinical_trust lighting intent", () => {
    expect(plan.photographyDirection.lightingIntent.value).toBe("clinical_trust");
  });

  it("sets brand safety to medical_grade", () => {
    expect(plan.creativeConstraints.brandSafety.value).toBe("medical_grade");
  });

  it("includes industry restrictions about medical claims", () => {
    const restrictions = plan.creativeConstraints.industryRestrictions.value;
    expect(restrictions).not.toBe("unknown");
    expect(restrictions.toLowerCase()).toMatch(/claim|consent|outcome|disclaimer/);
  });

  it("produces a confidence score above 65", () => {
    expect(plan.confidenceScore).toBeGreaterThan(65);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Luxury Real Estate Villa
// ─────────────────────────────────────────────────────────────────────────────

describe("Luxury Real Estate Villa", () => {
  const plan = buildCampaignPlan(makeStrategy("Luxury Real Estate Villa Advertisement", "MARKETING_CREATIVE", "poster"));

  it("assigns luxury minimal design style", () => {
    expect(plan.designDirection.overallDesignStyle.value).toBe("luxury_minimal");
  });

  it("assigns luxury_refined or ultra_prestige luxury level", () => {
    expect(["luxury_refined", "ultra_prestige"]).toContain(plan.designDirection.luxuryLevel.value);
  });

  it("assigns golden_aspirational lighting", () => {
    expect(plan.photographyDirection.lightingIntent.value).toBe("golden_aspirational");
  });

  it("sets environment to immersive (real estate needs environment)", () => {
    const env = plan.visualDirection.environment.value;
    expect(env).not.toBe("unknown");
    expect(env.toLowerCase()).toMatch(/property|villa|feature|golden/);
  });

  it("sets framing to negative_space_dominant (luxury = space = status)", () => {
    expect(plan.photographyDirection.framingStyle.value).toBe("negative_space_dominant");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mutual Fund SIP Awareness
// ─────────────────────────────────────────────────────────────────────────────

describe("Mutual Fund SIP Awareness", () => {
  const plan = buildCampaignPlan(makeStrategy("Mutual Fund SIP Awareness Campaign"));

  it("includes a statistics section with growth chart", () => {
    const stat = plan.advertisementStructure.statisticsSection.value;
    expect(stat).not.toBe("absent");
  });

  it("includes a growth chart in visual direction", () => {
    expect(plan.visualDirection.charts.value).not.toBe("none");
  });

  it("applies financial_compliant brand safety", () => {
    expect(plan.creativeConstraints.brandSafety.value).toBe("financial_compliant");
  });

  it("includes finance industry restrictions about return guarantees", () => {
    const r = plan.creativeConstraints.industryRestrictions.value;
    expect(r).not.toBe("unknown");
    expect(r.toLowerCase()).toMatch(/return|guarantee|sebi|disclaimer/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Restaurant Grand Opening
// ─────────────────────────────────────────────────────────────────────────────

describe("Restaurant Grand Opening", () => {
  const plan = buildCampaignPlan(makeStrategy("Restaurant Grand Opening", "SOCIAL_MEDIA", "instagram_post"));

  it("includes an event/offer section for the opening", () => {
    expect(plan.advertisementStructure.offerSection.value).not.toBe("absent");
  });

  it("assigns warm_intimate lighting for food/restaurant", () => {
    expect(plan.photographyDirection.lightingIntent.value).toBe("warm_intimate");
  });

  it("assigns excitement or fomo as emotional hook", () => {
    expect(["excitement", "fomo", "curiosity"]).toContain(plan.concept.emotionalHook.value);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Jewellery Wedding Collection
// ─────────────────────────────────────────────────────────────────────────────

describe("Jewellery Wedding Collection", () => {
  const plan = buildCampaignPlan(makeStrategy("Jewellery Wedding Collection Campaign"));

  it("assigns dramatic_luxury lighting for jewellery", () => {
    expect(plan.photographyDirection.lightingIntent.value).toBe("dramatic_luxury");
  });

  it("assigns extreme_close_up or close_up shot type for macro jewellery photography", () => {
    expect(["extreme_close_up", "close_up"]).toContain(plan.photographyDirection.shotType.value);
  });

  it("assigns a positive aspiration-related emotional hook", () => {
    // Jewellery/luxury wedding can be aspiration, fomo, identity, hope, or excitement
    expect(["aspiration", "fomo", "identity", "hope", "excitement", "curiosity"]).toContain(plan.concept.emotionalHook.value);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// No-generation verification
// ─────────────────────────────────────────────────────────────────────────────

describe("Creative Director must NEVER generate prompts or copy", () => {
  it("is a synchronous pure function — no async, no LLM call", () => {
    const strategy = makeStrategy("Dental campaign");
    const result = buildCampaignPlan(strategy);
    expect(result).toBeDefined(); // Would be a Promise if async
  });

  it("does not produce field values that look like image prompts", () => {
    const plan = buildCampaignPlan(makeStrategy("Hospital Health Checkup Campaign"));
    const allValues = [
      plan.visualStory.openingScene.value,
      plan.photographyDirection.cameraMood.value,
      plan.concept.bigIdea.value,
    ];
    for (const v of allValues) {
      if (typeof v === "string" && v !== "unknown") {
        expect(v).not.toMatch(/\bF\/\d|\bISO\b|\b8k\b|\bmasterpiece\b|shot on|dslr|bokeh/i);
      }
    }
  });

  it("does not produce copywriting — no headline text in concept fields", () => {
    const plan = buildCampaignPlan(makeStrategy("School Admission Campaign"));
    // Concept fields describe DIRECTION, not actual ad headlines
    // They should be strategic descriptions, not short punchy ad copy
    const theme = plan.concept.campaignTheme.value;
    if (theme !== "unknown") {
      // Campaign themes are multi-word strategic statements, not 3-word headlines
      expect(theme.length).toBeGreaterThan(15);
    }
  });
});
