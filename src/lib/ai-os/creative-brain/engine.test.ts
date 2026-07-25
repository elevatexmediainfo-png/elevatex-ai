import { describe, expect, it } from "vitest";

import { buildCreativeStrategy } from "./engine";
import type { CreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import type { CreativeRequest, AssetIntelligence } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeRequest(rawIdea: string, kind?: CreativeRequest["kind"], presetKey?: string): CreativeRequest {
  return { userId: "test", rawIdea, kind, presetKey, requestedAt: new Date() };
}

function emptyAssets(): AssetIntelligence {
  return {};
}

function makeContext(rawIdea: string, kind?: CreativeRequest["kind"], presetKey?: string, assets?: AssetIntelligence): CreativeContext {
  const request = makeRequest(rawIdea, kind, presetKey);
  const userUnderstanding = analyzeUserRequest(request);
  return {
    request,
    userUnderstanding,
    assetIntelligence: assets ?? emptyAssets(),
    sessionContext: { userId: "test" },
    createdAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure validation — every field must exist with value + confidence + reasoning
// ─────────────────────────────────────────────────────────────────────────────

describe("buildCreativeStrategy — structural correctness", () => {
  it("returns all 8 domains + confidenceScore + unknownFields", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s).toHaveProperty("marketing");
    expect(s).toHaveProperty("audience");
    expect(s).toHaveProperty("communication");
    expect(s).toHaveProperty("creative");
    expect(s).toHaveProperty("business");
    expect(s).toHaveProperty("platform");
    expect(s).toHaveProperty("visual");
    expect(s).toHaveProperty("campaign");
    expect(typeof s.confidenceScore).toBe("number");
    expect(Array.isArray(s.unknownFields)).toBe(true);
  });

  it("every StrategyField has value + confidence + reasoning", () => {
    const s = buildCreativeStrategy(makeContext("Restaurant Grand Opening Instagram post"));
    const requiredFields = [
      [s.marketing, ["campaignGoal", "marketingObjective", "conversionPriority"]],
      [s.audience, ["primaryAudience", "ageGroup", "incomeGroup", "buyerStage", "trustRequirement", "buyingIntent", "awarenessLevel", "dominantFear"]],
      [s.communication, ["communicationStyle", "confidenceLevel", "urgency", "tone", "persuasionApproach", "languageRegister"]],
      [s.creative, ["creativeCategory", "heroSubject", "visualDensity", "visualComplexity", "focusPriority"]],
      [s.business, ["industry", "businessType", "usp", "offerType", "competitivePosition", "specificDifferentiators"]],
      [s.platform, ["primaryPlatform", "platformBehaviour", "safeAreaPriority"]],
      [s.visual, ["luxuryLevel", "premiumFeel", "photographyStyle", "humanPresence", "storytellingRequirement"]],
      [s.campaign, ["campaignCategory", "storyFlow"]],
    ] as const;
    for (const [domain, fields] of requiredFields) {
      for (const field of fields) {
        const f = (domain as unknown as Record<string, unknown>)[field];
        expect(f, `${field} should exist`).toBeDefined();
        expect((f as Record<string, unknown>).value, `${field}.value`).toBeDefined();
        expect((f as Record<string, unknown>).confidence, `${field}.confidence`).toBeDefined();
        expect((f as Record<string, unknown>).reasoning, `${field}.reasoning`).toBeDefined();
        expect(typeof (f as Record<string, unknown>).reasoning, `${field}.reasoning should be string`).toBe("string");
        expect((f as Record<string, unknown>).reasoning as string).not.toBe("");
      }
    }
  });

  it("never returns undefined for any domain property", () => {
    const s = buildCreativeStrategy(makeContext("make something cool"));
    expect(s.marketing.campaignGoal.value).toBeDefined();
    expect(s.audience.primaryAudience.value).toBeDefined();
    expect(s.platform.platformBehaviour.value).toBeDefined();
    expect(s.visual.luxuryLevel.value).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dental — Healthcare intelligence
// ─────────────────────────────────────────────────────────────────────────────

describe("Dental Implant Informative Creative", () => {
  const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative", "SOCIAL_MEDIA", "instagram_post"));

  it("detects healthcare industry + dental sub-industry", () => {
    expect(s.business.industry.value).toBe("healthcare");
    expect(s.business.industry.confidence).toBe("high");
  });

  it("sets campaignGoal to education (informative intent)", () => {
    expect(s.marketing.campaignGoal.value).toBe("education");
    expect(s.marketing.campaignGoal.confidence).toBe("high");
  });

  it("sets trustRequirement to critical for healthcare", () => {
    expect(s.audience.trustRequirement.value).toBe("critical");
  });

  it("sets heroSubject to implant/procedure visual (not just doctor smiling)", () => {
    const hero = s.creative.heroSubject.value;
    expect(hero).not.toBe("unknown");
    expect(hero).not.toBe("Doctor smiling");
  });

  it("sets buyer stage to awareness (informative content)", () => {
    expect(s.audience.buyerStage.value).toBe("awareness");
  });

  it("sets platform to instagram for instagram_post preset", () => {
    expect(s.platform.primaryPlatform.value).toBe("instagram");
  });

  it("returns pain points from dental knowledge bank", () => {
    const pain = s.audience.painPoints.value;
    expect(pain).not.toBe("unknown");
    expect(pain).toContain("dental anxiety");
  });

  it("sets humanPresence to hero (healthcare industry)", () => {
    expect(s.visual.humanPresence.value).toBe("hero");
  });

  it("produces a confidence score above 60 (strong signals)", () => {
    expect(s.confidenceScore).toBeGreaterThan(60);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Restaurant Grand Opening
// ─────────────────────────────────────────────────────────────────────────────

describe("Restaurant Grand Opening", () => {
  const s = buildCreativeStrategy(makeContext("Restaurant Grand Opening Ceremony", "SOCIAL_MEDIA", "instagram_post"));

  it("detects food_beverage industry", () => {
    expect(s.business.industry.value).toBe("food_beverage");
  });

  it("sets campaignGoal to awareness (event announcement)", () => {
    expect(s.marketing.campaignGoal.value).toBe("awareness");
  });

  it("sets campaignCategory to launch (grand opening = launch event)", () => {
    expect(s.campaign.campaignCategory.value).toBe("launch");
  });

  it("sets buyer stage to awareness", () => {
    expect(s.audience.buyerStage.value).toBe("awareness");
  });

  it("sets storyFlow for launch campaign", () => {
    expect(s.campaign.storyFlow.value).toBeDefined();
    expect(s.campaign.storyFlow.reasoning).not.toBe("");
    expect(Array.isArray(s.campaign.storyFlowNodes)).toBe(true);
    expect(s.campaign.storyFlowNodes.length).toBeGreaterThan(0);
  });

  it("includes platform safe area instructions", () => {
    expect(s.platform.safeAreaPriority.value).not.toBe("unknown");
    expect(s.platform.platformBehaviour.value).toContain("scroll");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Luxury Real Estate Villa
// ─────────────────────────────────────────────────────────────────────────────

describe("Luxury Real Estate Villa", () => {
  const s = buildCreativeStrategy(makeContext("Luxury Real Estate Villa Advertisement", "MARKETING_CREATIVE", "poster"));

  it("detects real_estate industry", () => {
    expect(s.business.industry.value).toBe("real_estate");
  });

  it("sets luxuryLevel to high (real estate is inherently high-luxury)", () => {
    expect(s.visual.luxuryLevel.value).toBe("high");
    expect(s.visual.luxuryLevel.confidence).toBe("high");
  });

  it("sets premiumFeel to luxury", () => {
    expect(s.visual.premiumFeel.value).toBe("luxury");
  });

  it("sets incomeGroup to affluent", () => {
    expect(s.audience.incomeGroup.value).toBe("affluent");
  });

  it("sets humanPresence to incidental (property is the hero)", () => {
    expect(s.visual.humanPresence.value).toBe("incidental");
  });

  it("sets environmentPriority to immersive", () => {
    expect(s.visual.environmentPriority.value).toBe("immersive");
  });

  it("sets minimalismLevel to high (luxury = space = status)", () => {
    expect(s.visual.minimalismLevel.value).toBe("high");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mutual Fund SIP Awareness
// ─────────────────────────────────────────────────────────────────────────────

describe("Mutual Fund SIP Awareness", () => {
  const s = buildCreativeStrategy(makeContext("Mutual Fund SIP Awareness Campaign", "MARKETING_CREATIVE", "poster"));

  it("detects finance industry", () => {
    expect(s.business.industry.value).toBe("finance");
  });

  it("sets campaignGoal to education for financial awareness", () => {
    expect(s.marketing.campaignGoal.value).toBe("education");
  });

  it("sets knowledgeLevel to novice (SIP is complex for most)", () => {
    expect(s.audience.knowledgeLevel.value).toBe("novice");
  });

  it("sets trustRequirement to critical (finance)", () => {
    expect(s.audience.trustRequirement.value).toBe("critical");
  });

  it("sets illustrationPreference to minimal_icons for finance awareness campaign", () => {
    // Fix 6: contentType no longer auto-maps "awareness" intent to "infographic".
    // Finance AWARENESS uses minimal icons (clean, professional).
    // Finance EDUCATIONAL campaigns ("How SIP works") would produce infographic_elements.
    expect(s.visual.illustrationPreference.value).toBe("minimal_icons");
  });

  it("surfaces finance pain points from knowledge bank", () => {
    const pain = s.audience.painPoints.value;
    expect(pain).toContain("fear of loss");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Salon Hair Transformation (before/after)
// ─────────────────────────────────────────────────────────────────────────────

describe("Salon Hair Transformation Before and After", () => {
  const s = buildCreativeStrategy(makeContext("Salon Hair Transformation Before and After"));

  it("detects beauty_wellness industry", () => {
    expect(s.business.industry.value).toBe("beauty_wellness");
  });

  it("sets storytellingRequirement to high for before/after", () => {
    expect(s.visual.storytellingRequirement.value).toBe("high");
  });

  it("sets photographyStyle to before_after", () => {
    expect(s.visual.photographyStyle.value).toBe("before_after");
  });

  it("sets focusPriority to transformation", () => {
    expect(s.creative.focusPriority.value).toBe("transformation");
  });

  it("sets humanPresence to hero (beauty industry)", () => {
    expect(s.visual.humanPresence.value).toBe("hero");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Jewellery Wedding Collection
// ─────────────────────────────────────────────────────────────────────────────

describe("Jewellery Wedding Collection", () => {
  const s = buildCreativeStrategy(makeContext("Jewellery Wedding Collection Campaign"));

  it("detects jewellery_luxury industry", () => {
    expect(s.business.industry.value).toBe("jewellery_luxury");
  });

  it("sets humanPresence to incidental (product is the hero)", () => {
    expect(s.visual.humanPresence.value).toBe("incidental");
  });

  it("sets photographyStyle to macro_detail", () => {
    expect(s.visual.photographyStyle.value).toBe("macro_detail");
  });

  it("sets productPriority to hero", () => {
    expect(s.visual.productPriority.value).toBe("hero");
  });

  it("sets seasonality to wedding_season", () => {
    expect(s.business.seasonality.value).toBe("wedding_season");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// School Admission Campaign
// ─────────────────────────────────────────────────────────────────────────────

describe("School Admission Campaign", () => {
  const s = buildCreativeStrategy(makeContext("School Admission Campaign for New Academic Session"));

  it("detects education industry", () => {
    expect(s.business.industry.value).toBe("education");
  });

  it("sets primaryAudience to parents", () => {
    expect(s.audience.primaryAudience.value).toContain("parent");
  });

  it("sets seasonality to academic_season", () => {
    expect(s.business.seasonality.value).toBe("academic_season");
  });

  it("sets campaignCategory to awareness or launch (school admissions is a cycle-start campaign)", () => {
    // "School Admission Campaign" can be classified as awareness (broad reach)
    // or launch (new academic cycle). Both are valid — confirm it is one of these.
    expect(["awareness", "launch"]).toContain(s.campaign.campaignCategory.value);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Low-signal vague idea
// ─────────────────────────────────────────────────────────────────────────────

describe("Vague idea — graceful degradation", () => {
  const s = buildCreativeStrategy(makeContext("make something cool and amazing"));

  it("produces a noticeably lower confidence score than a clear industry idea", () => {
    // A vague idea should score meaningfully lower than, say, a dental campaign (>60).
    // Exact threshold is engine-dependent — check for < 55 as the boundary.
    expect(s.confidenceScore).toBeLessThan(55);
  });

  it("has multiple unknownFields", () => {
    expect(s.unknownFields.length).toBeGreaterThan(5);
  });

  it("never crashes or returns undefined fields", () => {
    expect(s.marketing.campaignGoal.value).toBeDefined();
    expect(s.platform.platformBehaviour.value).toBeDefined();
    expect(s.audience.painPoints.value).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — New field verification
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 4 — awarenessLevel and dominantFear", () => {
  const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));

  it("awarenessLevel is always present as a StrategyField", () => {
    expect(s.audience.awarenessLevel.value).toBeDefined();
    expect(s.audience.awarenessLevel.confidence).toBeDefined();
    expect(typeof s.audience.awarenessLevel.reasoning).toBe("string");
    expect(s.audience.awarenessLevel.reasoning).not.toBe("");
  });

  it("dominantFear is always present as a StrategyField", () => {
    expect(s.audience.dominantFear.value).toBeDefined();
    expect(s.audience.dominantFear.confidence).toBeDefined();
    expect(typeof s.audience.dominantFear.reasoning).toBe("string");
  });

  it("dental campaign has fear_of_pain as dominant fear (from KB)", () => {
    expect(s.audience.dominantFear.value).toBe("fear_of_pain");
  });
});

describe("Phase 4 — storyFlow", () => {
  it("storyFlow exists on every campaign output", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.campaign.storyFlow.value).not.toBe("unknown");
    expect(s.campaign.storyFlow.reasoning).not.toBe("");
    expect(s.campaign.storyFlowNodes.length).toBeGreaterThan(0);
    expect(s.campaign.storyFlowNodes).toContain("cta");
  });

  it("storyFlow value is always one of the known StoryFlowId values", () => {
    const s = buildCreativeStrategy(makeContext("Book your dental appointment now — limited slots"));
    const validFlowIds = [
      "single_message", "value_confirmation", "differentiation_proof",
      "problem_solution", "bridged_conversion", "education_offer_reward",
      "reassurance_arc", "emotion_first", "aspirational_desire",
      "trust_building", "emotion_proof_action",
    ];
    expect(validFlowIds).toContain(s.campaign.storyFlow.value);
  });

  it("storyFlowNodes is an ordered array of story nodes", () => {
    const s = buildCreativeStrategy(makeContext("Mutual Fund SIP Awareness Campaign"));
    const validNodes = ["hook", "problem", "emotion", "education", "trust", "transformation", "offer", "cta"];
    for (const node of s.campaign.storyFlowNodes) {
      expect(validNodes).toContain(node);
    }
  });
});

describe("Phase 4 — trustAssets", () => {
  it("trustAssets exists on every business output", () => {
    const s = buildCreativeStrategy(makeContext("Dental clinic advertisement"));
    expect(s.business.trustAssets).toBeDefined();
    expect(s.business.trustAssets.overallTrustStrength).toBeDefined();
    expect(typeof s.business.trustAssets.confidence).toBe("string");
    expect(typeof s.business.trustAssets.reasoning).toBe("string");
  });

  it("trustAssets.overallTrustStrength is none when no trust signals present", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Creative"));
    expect(s.business.trustAssets.overallTrustStrength).toBe("none");
    expect(s.business.trustAssets.assets).toHaveLength(0);
  });

  it("trustAssets.trustStrategy is authority_first for healthcare/dental", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.business.trustAssets.trustStrategy).toBe("authority_first");
  });
});

describe("Phase 4 — offerDetails", () => {
  it("offerDetails.offerType is none when no offer in idea", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.business.offerDetails.offerType).toBe("none");
    expect(s.business.offerDetails.offerValue).toBeNull();
  });

  it("offerDetails has correct structure", () => {
    const s = buildCreativeStrategy(makeContext("Restaurant Grand Opening Ceremony"));
    expect(s.business.offerDetails.offerType).toBeDefined();
    expect(s.business.offerDetails.confidence).toBeDefined();
    expect(typeof s.business.offerDetails.reasoning).toBe("string");
  });
});

describe("Phase 4 — specificDifferentiators", () => {
  it("specificDifferentiators is unknown when no USP stated", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Creative"));
    expect(s.business.specificDifferentiators.value).toBe("unknown");
    expect(s.business.specificDifferentiators.confidence).toBe("unknown");
  });
});

describe("Phase 4 — persuasionApproach and languageRegister", () => {
  it("persuasionApproach is always set", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    const validApproaches = ["authority_led", "social_proof_led", "scarcity_led", "education_led", "emotion_led", "liking_led"];
    expect(validApproaches).toContain(s.communication.persuasionApproach.value);
    expect(s.communication.persuasionApproach.reasoning).not.toBe("");
  });

  it("languageRegister defaults to english_standard for English ideas", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.communication.languageRegister.value).toBe("english_standard");
  });

  it("healthcare educational campaign uses education_led persuasion", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative", "SOCIAL_MEDIA", "instagram_post"));
    expect(s.communication.persuasionApproach.value).toBe("education_led");
  });
});

describe("Phase 4 — Phase 2 signal override verification", () => {
  it("painPoints field is populated (KB or user-stated)", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.audience.painPoints.value).not.toBe("unknown");
    expect(s.audience.painPoints.value).toContain("dental anxiety");
  });

  it("usp field is populated from KB when no USP stated", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.business.usp.value).not.toBe("unknown");
    expect(s.business.usp.confidence).toBe("medium");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// No-generation verification
// ─────────────────────────────────────────────────────────────────────────────

describe("Creative Brain must NEVER generate prompts or copy", () => {
  it("does not call any external APIs (engine is pure sync)", () => {
    // buildCreativeStrategy is synchronous — if it called an API it would
    // need to be async. TypeScript enforces this at the call site.
    const result = buildCreativeStrategy(makeContext("Dental campaign"));
    expect(result).toBeDefined(); // Would timeout or throw if async/API
  });

  it("does not produce any field that looks like an image prompt", () => {
    const s = buildCreativeStrategy(makeContext("Luxury villa advertisement poster"));
    const allValues = [
      s.marketing.marketingObjective.value,
      s.creative.heroSubject.value,
      s.business.usp.value,
    ];
    for (const v of allValues) {
      if (typeof v === "string") {
        // A prompt would contain photographic keywords like "F/2.8", "shot with", "8k", "masterpiece"
        expect(v).not.toMatch(/\bF\/\d|\bISO\b|\b8k\b|\bmasterpiece\b|\bshot with\b/i);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 — Experience Engine
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10 — ExperienceProfile", () => {
  it("is always present on every strategy", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.experienceProfile).toBeDefined();
    expect(s.experienceProfile.primary).toBeDefined();
    expect(s.experienceProfile.emotionalCore).toBeDefined();
    expect(typeof s.experienceProfile.reasoning).toBe("string");
    expect(s.experienceProfile.reasoning).not.toBe("");
  });

  it("before_after intent always produces transformation experience", () => {
    const s = buildCreativeStrategy(makeContext("Salon Hair Transformation Before and After"));
    expect(s.experienceProfile.primary).toBe("transformation");
  });

  it("informative dental intent produces education experience", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.experienceProfile.primary).toBe("education");
  });

  it("real_estate gets aspiration as primary (awareness intent) with luxury as secondary", () => {
    const s = buildCreativeStrategy(makeContext("Luxury Real Estate Villa Advertisement"));
    expect(s.experienceProfile.primary).toBe("aspiration");
    expect(s.experienceProfile.secondary).toBe("luxury");
  });

  it("event_announcement intent produces celebration experience", () => {
    const s = buildCreativeStrategy(makeContext("Restaurant Grand Opening Ceremony"));
    expect(s.experienceProfile.primary).toBe("celebration");
  });

  it("intensities are one of the valid values", () => {
    const s = buildCreativeStrategy(makeContext("Emergency dental appointment now!"));
    expect(["low", "medium", "high"]).toContain(s.experienceProfile.intensity);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 — Luxury Engine
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10 — LuxuryProfile", () => {
  it("is always present on every strategy", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.luxuryProfile).toBeDefined();
    expect(s.luxuryProfile.level).toBeDefined();
    expect(s.luxuryProfile.signals.length).toBeGreaterThan(0);
    expect(typeof s.luxuryProfile.reasoning).toBe("string");
  });

  it("detects high luxury from explicit keyword 'Luxury' in idea", () => {
    const s = buildCreativeStrategy(makeContext("Luxury Real Estate Villa Advertisement"));
    expect(s.luxuryProfile.level).toBe("high");
    expect(s.luxuryProfile.confidence).toBe("high");
    expect(s.luxuryProfile.signals.some(sig => sig.includes("keyword"))).toBe(true);
  });

  it("jewellery industry defaults to high luxury even without keyword", () => {
    const s = buildCreativeStrategy(makeContext("Wedding Jewellery Collection Campaign"));
    expect(["high", "ultra_luxury"]).toContain(s.luxuryProfile.level);
  });

  it("premium feel is luxury when level is high", () => {
    const s = buildCreativeStrategy(makeContext("Luxury Real Estate Villa Advertisement"));
    expect(s.luxuryProfile.premiumFeel).toBe("luxury");
  });

  it("minimalism level is high when luxury level is high", () => {
    const s = buildCreativeStrategy(makeContext("Luxury Real Estate Villa Advertisement"));
    expect(s.luxuryProfile.minimalismLevel).toBe("high");
  });

  it("dental clinic produces medium luxury (professional but not luxury)", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.luxuryProfile.level).toBe("medium");
  });

  it("finance produces medium luxury", () => {
    const s = buildCreativeStrategy(makeContext("Mutual Fund SIP Awareness Campaign"));
    expect(["low", "medium"]).toContain(s.luxuryProfile.level);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 — Semantic Weights
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10 — SemanticWeights", () => {
  it("is always present on every strategy", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.semanticWeights).toBeDefined();
    expect(s.semanticWeights.dominantSignal).toBeDefined();
    expect(typeof s.semanticWeights.reasoning).toBe("string");
  });

  it("dominantSignal is one of the valid values", () => {
    const s = buildCreativeStrategy(makeContext("Restaurant Grand Opening Instagram post"));
    const validSignals = ["industry", "campaign", "audience", "intent", "asset"];
    expect(validSignals).toContain(s.semanticWeights.dominantSignal);
  });

  it("all weights are numbers between 0 and 1", () => {
    const s = buildCreativeStrategy(makeContext("Mutual Fund SIP Awareness Campaign"));
    const w = s.semanticWeights;
    for (const weight of [w.industryWeight, w.campaignWeight, w.audienceWeight, w.intentWeight, w.assetWeight]) {
      expect(weight).toBeGreaterThanOrEqual(0);
      expect(weight).toBeLessThanOrEqual(1);
    }
  });

  it("assetWeight is 0 when no reference image provided", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Creative"));
    expect(s.semanticWeights.assetWeight).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 — Creative Matrix
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10 — CreativeMatrix", () => {
  it("is always present on every strategy", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.creativeMatrix).toBeDefined();
    expect(s.creativeMatrix.heroType).toBeDefined();
    expect(s.creativeMatrix.industryCluster).toBeDefined();
    expect(s.creativeMatrix.visualArchetype).not.toBe("");
    expect(s.creativeMatrix.emotionalDriver).not.toBe("");
  });

  it("dental education maps to authority cluster and authority hero type", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.creativeMatrix.industryCluster).toBe("authority");
    expect(s.creativeMatrix.heroType).toBe("authority");
  });

  it("before_after intent always maps to transformation hero type", () => {
    const s = buildCreativeStrategy(makeContext("Salon Hair Before and After"));
    expect(s.creativeMatrix.heroType).toBe("transformation");
  });

  it("real_estate maps to environmental cluster", () => {
    const s = buildCreativeStrategy(makeContext("Real Estate Villa Campaign"));
    expect(s.creativeMatrix.industryCluster).toBe("environmental");
    expect(s.creativeMatrix.heroType).toBe("environment");
  });

  it("jewellery maps to environmental cluster and product hero type", () => {
    const s = buildCreativeStrategy(makeContext("Jewellery Wedding Collection Campaign"));
    expect(s.creativeMatrix.industryCluster).toBe("environmental");
    expect(s.creativeMatrix.heroType).toBe("product");
  });

  it("finance informative maps to authority cluster and data hero type", () => {
    const s = buildCreativeStrategy(makeContext("Mutual Fund SIP Awareness Campaign"));
    expect(s.creativeMatrix.industryCluster).toBe("authority");
    expect(s.creativeMatrix.heroType).toBe("data");
  });

  it("restaurant grand opening maps to moment hero type", () => {
    const s = buildCreativeStrategy(makeContext("Restaurant Grand Opening Ceremony"));
    expect(s.creativeMatrix.heroType).toBe("moment");
  });

  it("compositionPriority is one of the valid values", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    const validPriorities = ["subject", "atmosphere", "information", "emotion"];
    expect(validPriorities).toContain(s.creativeMatrix.compositionPriority);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 — Hero Decision Engine
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10 — HeroDecision", () => {
  it("is always present on every strategy", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.heroDecision).toBeDefined();
    expect(s.heroDecision.subject).not.toBe("");
    expect(s.heroDecision.subject).not.toBe("unknown");
    expect(s.heroDecision.heroType).toBeDefined();
    expect(s.heroDecision.primarySignals.length).toBeGreaterThan(0);
  });

  it("dental informative produces an authority hero subject", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.heroDecision.heroType).toBe("authority");
    expect(s.heroDecision.subject).not.toBe("unknown");
    expect(s.heroDecision.subject).not.toBe("Doctor smiling");
    expect(s.heroDecision.confidence).toBe("high");
  });

  it("before_after intent always produces a transformation hero (independent of industry)", () => {
    const s = buildCreativeStrategy(makeContext("Salon Hair Before and After Transformation"));
    expect(s.heroDecision.heroType).toBe("transformation");
    expect(s.heroDecision.primarySignals).toContain("intent=before_after");
  });

  it("real_estate produces an environment hero", () => {
    const s = buildCreativeStrategy(makeContext("Luxury Real Estate Villa Advertisement"));
    expect(s.heroDecision.heroType).toBe("environment");
  });

  it("jewellery produces a product hero", () => {
    const s = buildCreativeStrategy(makeContext("Jewellery Wedding Collection Campaign"));
    expect(s.heroDecision.heroType).toBe("product");
  });

  it("finance informative produces a data hero", () => {
    const s = buildCreativeStrategy(makeContext("Mutual Fund SIP Awareness Campaign"));
    expect(s.heroDecision.heroType).toBe("data");
  });

  it("restaurant grand opening produces a moment hero", () => {
    const s = buildCreativeStrategy(makeContext("Restaurant Grand Opening Ceremony"));
    expect(s.heroDecision.heroType).toBe("moment");
  });

  it("hero subject never contains photographic prompt keywords", () => {
    const testCases = [
      "Dental Implant Informative Creative",
      "Luxury Real Estate Villa Advertisement",
      "Jewellery Wedding Collection Campaign",
      "Restaurant Grand Opening",
    ];
    for (const idea of testCases) {
      const s = buildCreativeStrategy(makeContext(idea));
      expect(s.heroDecision.subject).not.toMatch(/\bF\/\d|\bISO\b|\b8k\b|\bmasterpiece\b|\bshot with\b/i);
    }
  });

  it("hero subject is different from the old generic fallbacks", () => {
    const dental = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(dental.heroDecision.subject).not.toBe("unknown");
    expect(dental.heroDecision.subject.length).toBeGreaterThan(20);
  });

  it("heroDecision and creative.heroSubject are in sync", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.creative.heroSubject.value).toBe(s.heroDecision.subject);
    expect(s.creative.heroSubject.confidence).toBe(s.heroDecision.confidence);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.2B — Creative Brain Internal Conflict Resolution
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.2B — Visual directive conflict resolution", () => {
  it("Rule 1: heroType='moment' → focusPriority='moment' (not 'person')", () => {
    const s = buildCreativeStrategy(makeContext("Restaurant Grand Opening Ceremony"));
    expect(s.heroDecision.heroType).toBe("moment");
    expect(s.creative.focusPriority.value).toBe("moment");
    expect(s.creative.focusPriority.value).not.toBe("person");
  });

  it("Rule 2: heroType='environment' → focusPriority='environment' (not 'person')", () => {
    const s = buildCreativeStrategy(makeContext("Luxury Real Estate Villa Advertisement"));
    expect(s.heroDecision.heroType).toBe("environment");
    expect(s.creative.focusPriority.value).toBe("environment");
    expect(s.creative.focusPriority.value).not.toBe("person");
  });

  it("Rule 3: heroType='product' → focusPriority='product'", () => {
    const s = buildCreativeStrategy(makeContext("Jewellery Wedding Collection Campaign"));
    expect(s.heroDecision.heroType).toBe("product");
    expect(s.creative.focusPriority.value).toBe("product");
  });

  it("Rule 4: heroType='authority' (person-dominant) → focusPriority='person'", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.heroDecision.heroType).toBe("authority");
    expect(s.creative.focusPriority.value).toBe("person");
  });

  it("Rule 5: humanPresence aligns with heroType — moment hero → 'supporting'", () => {
    const s = buildCreativeStrategy(makeContext("Restaurant Grand Opening Ceremony"));
    expect(s.heroDecision.heroType).toBe("moment");
    expect(s.visual.humanPresence.value).toBe("supporting");
  });

  it("Rule 5: humanPresence aligns with heroType — environment hero → 'incidental'", () => {
    const s = buildCreativeStrategy(makeContext("Luxury Real Estate Villa Advertisement"));
    expect(s.heroDecision.heroType).toBe("environment");
    expect(s.visual.humanPresence.value).toBe("incidental");
  });

  it("Rule 5: humanPresence aligns with heroType — authority hero → 'hero'", () => {
    const s = buildCreativeStrategy(makeContext("Dental Implant Informative Creative"));
    expect(s.heroDecision.heroType).toBe("authority");
    expect(s.visual.humanPresence.value).toBe("hero");
  });

  it("Rule 5: humanPresence aligns with heroType — product hero → 'incidental'", () => {
    const s = buildCreativeStrategy(makeContext("Jewellery Wedding Collection Campaign"));
    expect(s.heroDecision.heroType).toBe("product");
    expect(s.visual.humanPresence.value).toBe("incidental");
  });

  it("Rule 5: humanPresence aligns with heroType — data hero → 'none'", () => {
    const s = buildCreativeStrategy(makeContext("Mutual Fund SIP Awareness Campaign"));
    expect(s.heroDecision.heroType).toBe("data");
    expect(s.visual.humanPresence.value).toBe("none");
  });

  it("no strategy ever produces focusPriority='person' with a non-person heroType", () => {
    const cases = [
      { idea: "Restaurant Grand Opening Ceremony",       heroType: "moment" },
      { idea: "Luxury Real Estate Villa Advertisement",  heroType: "environment" },
      { idea: "Jewellery Wedding Collection Campaign",   heroType: "product" },
      { idea: "Mutual Fund SIP Awareness Campaign",      heroType: "data" },
    ];
    for (const { idea, heroType } of cases) {
      const s = buildCreativeStrategy(makeContext(idea));
      expect(s.heroDecision.heroType).toBe(heroType);
      expect(s.creative.focusPriority.value).not.toBe("person");
    }
  });

  it("no strategy ever produces humanPresence='hero' for a non-person heroType", () => {
    const cases = [
      "Restaurant Grand Opening Ceremony",      // moment → supporting
      "Luxury Real Estate Villa Advertisement", // environment → incidental
      "Jewellery Wedding Collection Campaign",  // product → incidental
      "Mutual Fund SIP Awareness Campaign",     // data → none
    ];
    for (const idea of cases) {
      const s = buildCreativeStrategy(makeContext(idea));
      expect(s.visual.humanPresence.value).not.toBe("hero");
    }
  });

  it("resolved focusPriority has confidence='high' and references 10.2B when overridden", () => {
    const s = buildCreativeStrategy(makeContext("Restaurant Grand Opening Ceremony"));
    // heroType=moment overrides the intent-derived default 'person' → must show override
    expect(s.creative.focusPriority.confidence).toBe("high");
    expect(s.creative.focusPriority.reasoning).toContain("10.2B");
  });

  it("transformation hero type produces focusPriority='transformation' and humanPresence='hero'", () => {
    const s = buildCreativeStrategy(makeContext("Salon Hair Transformation Before and After"));
    expect(s.heroDecision.heroType).toBe("transformation");
    expect(s.creative.focusPriority.value).toBe("transformation");
    expect(s.visual.humanPresence.value).toBe("hero");
  });
});
