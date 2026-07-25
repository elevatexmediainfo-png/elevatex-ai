import { describe, expect, it } from "vitest";

import { buildRouteContext } from "./context-builder";
import type { CreativeStrategy } from "../../creative-brain/types";
import type { CampaignPlan } from "../../creative-director/types";
import type { AssetIntelligence } from "../../types";

// ── Minimal fixture builders ────────────────────────────────────────────────

function sf(value: string) {
  return { value, confidence: "high" as const, reasoning: "test" };
}

function minimalStrategy(overrides?: Partial<{
  campaignGoal: string;
  urgency:      string;
  incomeGroup:  string;
  ageGroup:     string;
  luxuryLevel:  string;
  industry:     string;
}>): CreativeStrategy {
  const o = overrides ?? {};
  return {
    marketing: {
      campaignGoal:        sf(o.campaignGoal  ?? "awareness"),
      marketingObjective:  sf("awareness"),
      conversionPriority:  sf("long_term"),
    },
    audience: {
      primaryAudience:  sf("general"),
      secondaryAudience: sf("unknown"),
      ageGroup:         sf(o.ageGroup     ?? "25-34"),
      incomeGroup:      sf(o.incomeGroup  ?? "mid_market"),
      profession:       sf("unknown"),
      knowledgeLevel:   sf("intermediate"),
      buyerStage:       sf("awareness"),
      painPoints:       sf("unknown"),
      desires:          sf("unknown"),
      objections:       sf("unknown"),
      trustRequirement: sf("medium"),
      motivation:       sf("unknown"),
      buyingIntent:     sf("medium"),
      awarenessLevel:   sf("problem_aware"),
      dominantFear:     sf("none"),
    },
    communication: {
      communicationStyle:   sf("professional"),
      confidenceLevel:      sf("confident"),
      urgency:              sf(o.urgency ?? "medium"),
      callToActionType:     sf("unknown"),
      messagingTone:        sf("unknown"),
      narrativeApproach:    sf("unknown"),
      primaryMessage:       sf("unknown"),
      supportingMessages:   sf("unknown"),
      authoritySignal:      sf("none"),
      socialProofElement:   sf("none"),
      informationDensity:   sf("moderate"),
    },
    visual: {
      luxuryLevel:         sf(o.luxuryLevel ?? "none"),
      colorPsychology:     sf("unknown"),
      visualComplexity:    sf("moderate"),
      photographyStyle:    sf("lifestyle"),
      lightingMood:        sf("neutral"),
      colorTemperature:    sf("neutral"),
      postProcessing:      sf("unknown"),
      brandColorRole:      sf("unknown"),
    },
    business: {
      industry:           sf(o.industry ?? "restaurant"),
      businessType:       sf("unknown"),
      locationContext:    sf("unknown"),
      brandMaturity:      sf("unknown"),
      competitiveContext: sf("unknown"),
    },
    platform: {
      primaryPlatform:    sf("instagram"),
      formatConstraints:  sf("unknown"),
      renderingMode:      sf("unknown"),
      contentSafetyZone:  sf("unknown"),
    },
    campaign: {
      campaignCategory:   sf("unknown"),
      promotionType:      sf("none"),
      timeConstraint:     sf("unknown"),
      geographicScope:    sf("local"),
    },
  } as unknown as CreativeStrategy;
}

function minimalPlan(overrides?: Partial<{
  coreMessage:   string;
  emotionalHook: string;
}>): CampaignPlan {
  const o = overrides ?? {};
  return {
    concept: {
      campaignTheme:    sf("unknown"),
      coreMessage:      sf(o.coreMessage   ?? "Experience the best"),
      bigIdea:          sf("unknown"),
      emotionalHook:    sf(o.emotionalHook ?? "aspiration"),
      marketingAngle:   sf("authority"),
      customerPromise:  sf("unknown"),
      valueProposition: sf("unknown"),
      campaignArchetype: sf("awareness_lifestyle"),
    },
  } as unknown as CampaignPlan;
}

const emptyAssets: AssetIntelligence = {};

// ── Goal mapping ────────────────────────────────────────────────────────────

describe("buildRouteContext — goal mapping", () => {
  it("passes known CampaignGoal values through unchanged", () => {
    const ctx = buildRouteContext(minimalStrategy({ campaignGoal: "awareness" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.campaign.goal).toBe("awareness");
  });

  it("maps lead_generation → conversion", () => {
    const ctx = buildRouteContext(minimalStrategy({ campaignGoal: "lead_generation" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.campaign.goal).toBe("conversion");
  });

  it("maps sales → conversion", () => {
    const ctx = buildRouteContext(minimalStrategy({ campaignGoal: "sales" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.campaign.goal).toBe("conversion");
  });
});

// ── Urgency mapping ─────────────────────────────────────────────────────────

describe("buildRouteContext — urgency mapping", () => {
  it("maps 'none' → undefined (omitted from signal)", () => {
    const ctx = buildRouteContext(minimalStrategy({ urgency: "none" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.campaign.urgency).toBeUndefined();
  });

  it("maps 'unknown' → undefined", () => {
    const ctx = buildRouteContext(minimalStrategy({ urgency: "unknown" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.campaign.urgency).toBeUndefined();
  });

  it("maps 'immediate' → 'high'", () => {
    const ctx = buildRouteContext(minimalStrategy({ urgency: "immediate" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.campaign.urgency).toBe("high");
  });

  it("maps 'high' → 'high'", () => {
    const ctx = buildRouteContext(minimalStrategy({ urgency: "high" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.campaign.urgency).toBe("high");
  });

  it("maps 'medium' → 'medium'", () => {
    const ctx = buildRouteContext(minimalStrategy({ urgency: "medium" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.campaign.urgency).toBe("medium");
  });

  it("maps 'low' → 'low'", () => {
    const ctx = buildRouteContext(minimalStrategy({ urgency: "low" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.campaign.urgency).toBe("low");
  });
});

// ── Income-to-tier mapping ──────────────────────────────────────────────────

describe("buildRouteContext — audience tier from income group", () => {
  it("budget → mass", () => {
    const ctx = buildRouteContext(minimalStrategy({ incomeGroup: "budget" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.audience?.tier).toBe("mass");
  });

  it("mid_market → mid", () => {
    const ctx = buildRouteContext(minimalStrategy({ incomeGroup: "mid_market" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.audience?.tier).toBe("mid");
  });

  it("affluent → luxury", () => {
    const ctx = buildRouteContext(minimalStrategy({ incomeGroup: "affluent" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.audience?.tier).toBe("luxury");
  });

  it("high_net_worth → luxury", () => {
    const ctx = buildRouteContext(minimalStrategy({ incomeGroup: "high_net_worth" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.audience?.tier).toBe("luxury");
  });
});

// ── Luxury tier mapping ─────────────────────────────────────────────────────

describe("buildRouteContext — luxury tier", () => {
  it("none → mass", () => {
    const ctx = buildRouteContext(minimalStrategy({ luxuryLevel: "none" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.luxuryTier).toBe("mass");
  });

  it("low → mass", () => {
    const ctx = buildRouteContext(minimalStrategy({ luxuryLevel: "low" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.luxuryTier).toBe("mass");
  });

  it("medium → mid", () => {
    const ctx = buildRouteContext(minimalStrategy({ luxuryLevel: "medium" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.luxuryTier).toBe("mid");
  });

  it("high → luxury", () => {
    const ctx = buildRouteContext(minimalStrategy({ luxuryLevel: "high" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.luxuryTier).toBe("luxury");
  });

  it("ultra_luxury → luxury", () => {
    const ctx = buildRouteContext(minimalStrategy({ luxuryLevel: "ultra_luxury" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.luxuryTier).toBe("luxury");
  });
});

// ── Age group mapping ───────────────────────────────────────────────────────

describe("buildRouteContext — age range from ageGroup", () => {
  it("maps '18-24' → [18, 24]", () => {
    const ctx = buildRouteContext(minimalStrategy({ ageGroup: "18-24" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.audience?.ageRange).toEqual([18, 24]);
  });

  it("maps '35-44' → [35, 44]", () => {
    const ctx = buildRouteContext(minimalStrategy({ ageGroup: "35-44" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.audience?.ageRange).toEqual([35, 44]);
  });

  it("maps '55+' → [55, 99]", () => {
    const ctx = buildRouteContext(minimalStrategy({ ageGroup: "55+" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.audience?.ageRange).toEqual([55, 99]);
  });

  it("unknown age group → ageRange omitted", () => {
    const ctx = buildRouteContext(minimalStrategy({ ageGroup: "all_ages" }), minimalPlan(), emptyAssets, "test");
    expect(ctx.audience?.ageRange).toBeUndefined();
  });
});

// ── Psychology signal from emotional hook ───────────────────────────────────

describe("buildRouteContext — psychology signal", () => {
  it("sets primaryExperience from emotionalHook", () => {
    const ctx = buildRouteContext(minimalStrategy(), minimalPlan({ emotionalHook: "curiosity" }), emptyAssets, "test");
    expect(ctx.psychology?.primaryExperience).toBe("curiosity");
  });

  it("omits psychology when emotionalHook is 'unknown'", () => {
    const ctx = buildRouteContext(minimalStrategy(), minimalPlan({ emotionalHook: "unknown" }), emptyAssets, "test");
    expect(ctx.psychology).toBeUndefined();
  });
});

// ── Business signal ─────────────────────────────────────────────────────────

describe("buildRouteContext — business signal", () => {
  it("business is undefined when assets has no brandContext", () => {
    const ctx = buildRouteContext(minimalStrategy(), minimalPlan(), emptyAssets, "test");
    expect(ctx.business).toBeUndefined();
  });

  it("business is undefined when brandContext has no fontFamily", () => {
    const ctx = buildRouteContext(
      minimalStrategy(),
      minimalPlan(),
      { brandContext: { primaryColor: "#000" } },
      "test",
    );
    expect(ctx.business).toBeUndefined();
  });

  it("business.brandVoice includes fontFamily when present", () => {
    const ctx = buildRouteContext(
      minimalStrategy(),
      minimalPlan(),
      { brandContext: { fontFamily: "Montserrat" } },
      "test",
    );
    expect(ctx.business?.brandVoice).toContain("Montserrat");
  });
});

// ── Season signal ────────────────────────────────────────────────────────────

describe("buildRouteContext — season signal", () => {
  it("season.month is a valid 1–12 integer", () => {
    const ctx = buildRouteContext(minimalStrategy(), minimalPlan(), emptyAssets, "test");
    expect(ctx.season?.month).toBeGreaterThanOrEqual(1);
    expect(ctx.season?.month).toBeLessThanOrEqual(12);
  });
});

// ── rawIdea propagation ──────────────────────────────────────────────────────

describe("buildRouteContext — rawIdea", () => {
  it("passes rawIdea through to context", () => {
    const ctx = buildRouteContext(minimalStrategy(), minimalPlan(), emptyAssets, "Dental implant promo");
    expect(ctx.rawIdea).toBe("Dental implant promo");
  });
});

// ── key messages from coreMessage ───────────────────────────────────────────

describe("buildRouteContext — keyMessages", () => {
  it("populates keyMessages from coreMessage when not 'unknown'", () => {
    const ctx = buildRouteContext(minimalStrategy(), minimalPlan({ coreMessage: "Best value" }), emptyAssets, "test");
    expect(ctx.campaign.keyMessages).toEqual(["Best value"]);
  });

  it("omits keyMessages when coreMessage is 'unknown'", () => {
    const ctx = buildRouteContext(minimalStrategy(), minimalPlan({ coreMessage: "unknown" }), emptyAssets, "test");
    expect(ctx.campaign.keyMessages).toBeUndefined();
  });
});
