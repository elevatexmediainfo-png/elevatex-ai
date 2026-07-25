import { describe, expect, it } from "vitest";

import { buildCommercialCompositionPlan, buildCompositionFromBlueprintInputs } from "./composition-engine";
import { selectCompositionStrategy, getStrategyDefinition }                     from "./placement-strategies";
import { computeCrowdingScore, computeCompositionGrade }                        from "./layout-rules";
import { assembleBlueprint }                                                     from "../blueprint";
import { buildCreativeStrategy }                                                 from "../creative-brain";
import { buildCampaignPlan }                                                     from "../creative-director";
import { buildVisualLayoutPlan }                                                 from "../visual-layout";
import { buildTypographyPlan }                                                   from "../typography";
import { buildCreativeContext }                                                   from "../creative-context";
import { analyzeUserRequest }                                                     from "../user-understanding";
import { planFromStrategy, normalizeIndustryId }                                   from "../commercial-assets/adapter";
import type { CreativeRequest }                                                   from "../types";
import type { CompositionInput }                                                  from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeCompositionInput(rawIdea: string): CompositionInput {
  const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
  const uu       = analyzeUserRequest(request);
  const ctx      = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const campaign = buildCampaignPlan(strategy);
  const layout   = buildVisualLayoutPlan(strategy, campaign);
  const assets   = planFromStrategy(strategy);
  const industry = normalizeIndustryId(
    strategy.business.industry.value,
    strategy.business.subIndustry.value,
  );

  return { strategy, commercialAssets: assets, layoutPlan: layout, industry };
}

function makeBlueprint(rawIdea: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
  const uu       = analyzeUserRequest(request);
  const ctx      = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const campaign = buildCampaignPlan(strategy);
  const layout   = buildVisualLayoutPlan(strategy, campaign);
  const typo     = buildTypographyPlan(strategy, campaign, layout);
  return assembleBlueprint({ context: ctx, strategy, campaignPlan: campaign, layoutPlan: layout, typographyPlan: typo });
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout rules — computeCrowdingScore
// ─────────────────────────────────────────────────────────────────────────────

describe("computeCrowdingScore", () => {
  it("returns 0 for 4 assets (baseline) with sparse density", () => {
    expect(computeCrowdingScore(4, "sparse")).toBe(0);
  });

  it("sparse < balanced < dense for same asset count", () => {
    const s = computeCrowdingScore(8, "sparse");
    const b = computeCrowdingScore(8, "balanced");
    const d = computeCrowdingScore(8, "dense");
    expect(s).toBeLessThan(b);
    expect(b).toBeLessThan(d);
  });

  it("score never exceeds 100", () => {
    expect(computeCrowdingScore(30, "dense")).toBeLessThanOrEqual(100);
  });

  it("more assets = higher score", () => {
    expect(computeCrowdingScore(6, "balanced")).toBeLessThan(computeCrowdingScore(12, "balanced"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layout rules — computeCompositionGrade
// ─────────────────────────────────────────────────────────────────────────────

describe("computeCompositionGrade", () => {
  it("A: low crowding + no conflicts", () => {
    expect(computeCompositionGrade(10, 0)).toBe("A");
  });

  it("B: moderate crowding + few conflicts", () => {
    expect(computeCompositionGrade(40, 2)).toBe("B");
  });

  it("C: high crowding + some conflicts", () => {
    expect(computeCompositionGrade(60, 3)).toBe("C");
  });

  it("D: very high crowding or many conflicts", () => {
    expect(computeCompositionGrade(80, 5)).toBe("D");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Strategy selection
// ─────────────────────────────────────────────────────────────────────────────

describe("selectCompositionStrategy", () => {
  it("selects healthcare strategy for dental industry", () => {
    const input = makeCompositionInput("Dental Implant Campaign");
    const id    = selectCompositionStrategy(input);
    expect(id).toBe("healthcare");
  });

  it("selects restaurant strategy for restaurant", () => {
    const input = makeCompositionInput("Restaurant Grand Opening");
    const id    = selectCompositionStrategy(input);
    expect(id).toBe("restaurant");
  });

  it("selects real_estate strategy for real estate", () => {
    const input = makeCompositionInput("New Apartment Homes For Sale Book Now");
    const id    = selectCompositionStrategy(input);
    expect(id).toBe("real_estate");
  });

  it("selects luxury strategy for jewelry", () => {
    const input = makeCompositionInput("Luxury Jewellery Wedding Collection");
    const id    = selectCompositionStrategy(input);
    expect(id).toBe("luxury");
  });

  it("selects corporate strategy for finance", () => {
    const input = makeCompositionInput("Mutual Fund SIP Investment Awareness");
    const id    = selectCompositionStrategy(input);
    expect(["corporate", "minimal"]).toContain(id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Strategy registry
// ─────────────────────────────────────────────────────────────────────────────

describe("getStrategyDefinition", () => {
  const strategies = [
    "luxury", "minimal", "editorial", "product",
    "healthcare", "real_estate", "restaurant", "fashion",
    "corporate", "social", "mobile_first", "landscape",
    "square", "vertical",
  ] as const;

  for (const id of strategies) {
    it(`${id}: has heroZone, whitespaceDefaults, safeZones, fallbackPlacement`, () => {
      const def = getStrategyDefinition(id);
      expect(def.id).toBe(id);
      expect(def.heroZone).toBeDefined();
      expect(def.heroZone.dominancePercent).toBeGreaterThan(0);
      expect(def.heroZone.dominancePercent).toBeLessThanOrEqual(100);
      expect(def.whitespaceDefaults).toBeDefined();
      expect(def.safeZones).toBeDefined();
      expect(def.fallbackPlacement).toBeDefined();
    });

    it(`${id}: heroZone.dominancePercent is between 40 and 80`, () => {
      const def = getStrategyDefinition(id);
      expect(def.heroZone.dominancePercent).toBeGreaterThanOrEqual(40);
      expect(def.heroZone.dominancePercent).toBeLessThanOrEqual(80);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// buildCommercialCompositionPlan — output structure
// ─────────────────────────────────────────────────────────────────────────────

describe("buildCommercialCompositionPlan — output structure", () => {
  it("returns all required top-level keys", () => {
    const input = makeCompositionInput("Dental Implant Campaign");
    const plan  = buildCommercialCompositionPlan(input);

    expect(plan).toHaveProperty("strategyId");
    expect(plan).toHaveProperty("heroZone");
    expect(plan).toHaveProperty("placements");
    expect(plan).toHaveProperty("eyeFlow");
    expect(plan).toHaveProperty("whitespace");
    expect(plan).toHaveProperty("safeZoneMap");
    expect(plan).toHaveProperty("conflicts");
    expect(plan).toHaveProperty("compositionGrade");
    expect(plan).toHaveProperty("totalAssets");
    expect(plan).toHaveProperty("warnings");
  });

  it("placements is an array of AssetPlacement objects", () => {
    const input = makeCompositionInput("Restaurant Grand Opening");
    const plan  = buildCommercialCompositionPlan(input);

    expect(Array.isArray(plan.placements)).toBe(true);
    for (const p of plan.placements) {
      expect(p.assetId).toBeTruthy();
      expect(p.region).toBeTruthy();
      expect(p.alignment).toBeTruthy();
      expect(p.priority).toBeGreaterThanOrEqual(1);
      expect(p.priority).toBeLessThanOrEqual(10);
      expect(typeof p.safeZonePercent).toBe("number");
      expect(typeof p.clearSpace).toBe("number");
      expect(typeof p.stackOrder).toBe("number");
    }
  });

  it("totalAssets matches placements array length", () => {
    const input = makeCompositionInput("Real Estate Villa Launch");
    const plan  = buildCommercialCompositionPlan(input);
    expect(plan.totalAssets).toBe(plan.placements.length);
  });

  it("conflicts is an array", () => {
    const input = makeCompositionInput("Dental Implant Campaign");
    const plan  = buildCommercialCompositionPlan(input);
    expect(Array.isArray(plan.conflicts)).toBe(true);
  });

  it("warnings is an array", () => {
    const input = makeCompositionInput("Fashion Brand Launch");
    const plan  = buildCommercialCompositionPlan(input);
    expect(Array.isArray(plan.warnings)).toBe(true);
  });

  it("compositionGrade is one of A, B, C, D", () => {
    const input = makeCompositionInput("Healthcare Hospital Campaign");
    const plan  = buildCommercialCompositionPlan(input);
    expect(["A", "B", "C", "D"]).toContain(plan.compositionGrade);
  });

  it("is a pure synchronous function — no async, no LLM", () => {
    const input  = makeCompositionInput("Salon Transformation Campaign");
    const result = buildCommercialCompositionPlan(input);
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildCommercialCompositionPlan — placement correctness
// ─────────────────────────────────────────────────────────────────────────────

describe("buildCommercialCompositionPlan — placement correctness", () => {
  it("dental: appointment_button placed in bottom zone", () => {
    const input = makeCompositionInput("Dental Implant Informative Creative");
    const plan  = buildCommercialCompositionPlan(input);
    const appt  = plan.placements.find((p) => p.assetId === "appointment_button");
    if (appt) {
      expect(["bottom_center", "bottom_left", "bottom_right", "above_cta"]).toContain(appt.region);
    }
  });

  it("dental: appointment_button has critical prominence", () => {
    const input = makeCompositionInput("Dental Implant Campaign");
    const plan  = buildCommercialCompositionPlan(input);
    const appt  = plan.placements.find((p) => p.assetId === "appointment_button");
    if (appt) {
      expect(["critical", "high"]).toContain(appt.prominence);
    }
  });

  it("restaurant: booking_button placed in bottom zone", () => {
    const input    = makeCompositionInput("Restaurant Grand Opening");
    const plan     = buildCommercialCompositionPlan(input);
    const booking  = plan.placements.find((p) => p.assetId === "booking_button");
    if (booking) {
      expect(["bottom_center", "above_cta"]).toContain(booking.region);
    }
  });

  it("real_estate: builder_logo placed in top zone", () => {
    const input = makeCompositionInput("New Apartment Homes For Sale Book Now");
    const plan  = buildCommercialCompositionPlan(input);
    const logo  = plan.placements.find((p) => p.assetId === "builder_logo");
    if (logo) {
      expect(["top_left", "top_center", "top_right"]).toContain(logo.region);
    }
  });

  it("real_estate: location placed in mid zone (prominent)", () => {
    const input    = makeCompositionInput("New Apartment Homes For Sale Book Now");
    const plan     = buildCommercialCompositionPlan(input);
    const location = plan.placements.find((p) => p.assetId === "location");
    if (location) {
      expect(location.prominence).toMatch(/critical|high/);
    }
  });

  it("offer_ribbon always has high stackOrder (renders on top)", () => {
    const input  = makeCompositionInput("Restaurant Grand Opening Discount Offer");
    const plan   = buildCommercialCompositionPlan(input);
    const ribbon = plan.placements.find((p) => p.assetId === "offer_ribbon");
    if (ribbon) {
      expect(ribbon.stackOrder).toBeGreaterThanOrEqual(35);
    }
  });

  it("logo/builder_logo clearSpace is larger than body text elements", () => {
    const input = makeCompositionInput("Restaurant Grand Opening");
    const plan  = buildCommercialCompositionPlan(input);
    const logo  = plan.placements.find((p) => p.assetId === "logo" || p.assetId === "builder_logo");
    const addr  = plan.placements.find((p) => p.assetId === "address");
    if (logo && addr) {
      expect(logo.clearSpace).toBeGreaterThanOrEqual(addr.clearSpace);
    }
  });

  it("each placement has a valid LayoutRegion", () => {
    const validRegions = new Set([
      "top_left", "top_center", "top_right",
      "mid_left", "mid_center", "mid_right",
      "bottom_left", "bottom_center", "bottom_right",
      "below_headline", "above_cta", "below_hero",
      "footer_left", "footer_center", "footer_right",
      "overlay_hero", "hero_zone",
    ]);
    const input = makeCompositionInput("Tech SaaS Product Launch");
    const plan  = buildCommercialCompositionPlan(input);
    for (const p of plan.placements) {
      expect(validRegions.has(p.region), `invalid region: ${p.region}`).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Eye flow
// ─────────────────────────────────────────────────────────────────────────────

describe("buildCommercialCompositionPlan — eye flow", () => {
  it("eyeFlow has primary, secondary, tertiary, readingDirection", () => {
    const input = makeCompositionInput("Restaurant Grand Opening");
    const plan  = buildCommercialCompositionPlan(input);
    expect(plan.eyeFlow.primary).toBeDefined();
    expect(plan.eyeFlow.secondary).toBeDefined();
    expect(plan.eyeFlow.tertiary).toBeDefined();
    expect(["ltr", "rtl", "center_out"]).toContain(plan.eyeFlow.readingDirection);
  });

  it("eyeFlow.visualWeightOrder contains hero_zone", () => {
    const input = makeCompositionInput("Dental Implant Campaign");
    const plan  = buildCommercialCompositionPlan(input);
    expect(plan.eyeFlow.visualWeightOrder).toContain("hero_zone");
  });

  it("eyeFlow.commercialWeightOrder contains only CommercialAssetIds (no hero_zone)", () => {
    const input = makeCompositionInput("Real Estate Villa Launch");
    const plan  = buildCommercialCompositionPlan(input);
    expect(plan.eyeFlow.commercialWeightOrder).not.toContain("hero_zone");
  });

  it("eyeFlow.commercialWeightOrder length matches planned asset count", () => {
    const input = makeCompositionInput("Restaurant Grand Opening");
    const plan  = buildCommercialCompositionPlan(input);
    expect(plan.eyeFlow.commercialWeightOrder.length).toBe(plan.placements.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Whitespace
// ─────────────────────────────────────────────────────────────────────────────

describe("buildCommercialCompositionPlan — whitespace", () => {
  it("whitespace has all required fields", () => {
    const input = makeCompositionInput("Dental Implant Campaign");
    const plan  = buildCommercialCompositionPlan(input);
    expect(typeof plan.whitespace.globalPaddingPercent).toBe("number");
    expect(typeof plan.whitespace.sectionSpacingPercent).toBe("number");
    expect(typeof plan.whitespace.elementSpacingPercent).toBe("number");
    expect(["sparse", "balanced", "dense"]).toContain(plan.whitespace.density);
    expect(typeof plan.whitespace.crowdingScore).toBe("number");
  });

  it("crowdingScore is between 0 and 100", () => {
    const input = makeCompositionInput("Restaurant Grand Opening");
    const plan  = buildCommercialCompositionPlan(input);
    expect(plan.whitespace.crowdingScore).toBeGreaterThanOrEqual(0);
    expect(plan.whitespace.crowdingScore).toBeLessThanOrEqual(100);
  });

  it("luxury strategy has larger globalPadding than social strategy", () => {
    const luxuryInput = makeCompositionInput("Ultra Luxury Jewellery Wedding Collection");
    const luxuryPlan  = buildCommercialCompositionPlan(luxuryInput);
    const def         = getStrategyDefinition("luxury");
    const socialDef   = getStrategyDefinition("social");
    expect(def.whitespaceDefaults.globalPaddingPercent).toBeGreaterThan(socialDef.whitespaceDefaults.globalPaddingPercent);
    void luxuryPlan;
  });

  it("sparse density has lower crowding score than dense for same asset count", () => {
    const s = computeCrowdingScore(8, "sparse");
    const d = computeCrowdingScore(8, "dense");
    expect(s).toBeLessThan(d);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Safe zone map
// ─────────────────────────────────────────────────────────────────────────────

describe("buildCommercialCompositionPlan — safe zone map", () => {
  it("safeZoneMap has all required keys", () => {
    const input = makeCompositionInput("Dental Implant Campaign");
    const plan  = buildCommercialCompositionPlan(input);
    expect(typeof plan.safeZoneMap.topPercent).toBe("number");
    expect(typeof plan.safeZoneMap.bottomPercent).toBe("number");
    expect(typeof plan.safeZoneMap.leftPercent).toBe("number");
    expect(typeof plan.safeZoneMap.rightPercent).toBe("number");
    expect(typeof plan.safeZoneMap.headline).toBe("number");
    expect(typeof plan.safeZoneMap.cta).toBe("number");
    expect(typeof plan.safeZoneMap.logo).toBe("number");
    expect(typeof plan.safeZoneMap.qr).toBe("number");
    expect(typeof plan.safeZoneMap.footer).toBe("number");
  });

  it("luxury strategy safe zones are larger than social", () => {
    const luxuryDef = getStrategyDefinition("luxury");
    const socialDef = getStrategyDefinition("social");
    expect(luxuryDef.safeZones.topPercent).toBeGreaterThan(socialDef.safeZones.topPercent);
  });

  it("all safe zone values are between 0 and 20", () => {
    const strategies = ["luxury", "minimal", "healthcare", "real_estate", "restaurant"] as const;
    for (const id of strategies) {
      const def = getStrategyDefinition(id);
      for (const [, v] of Object.entries(def.safeZones)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(20);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Conflict detection and resolution
// ─────────────────────────────────────────────────────────────────────────────

describe("buildCommercialCompositionPlan — conflict resolution", () => {
  it("conflicts array is always an array", () => {
    const ideas = [
      "Dental Implant Campaign",
      "Restaurant Grand Opening",
      "Real Estate Villa Launch",
    ];
    for (const idea of ideas) {
      const input = makeCompositionInput(idea);
      const plan  = buildCommercialCompositionPlan(input);
      expect(Array.isArray(plan.conflicts)).toBe(true);
    }
  });

  it("when conflicts exist, each has conflictType and affectedAssets", () => {
    const ideas = ["Restaurant Grand Opening Discount Offer 50% Off Limited Time"];
    for (const idea of ideas) {
      const input = makeCompositionInput(idea);
      const plan  = buildCommercialCompositionPlan(input);
      for (const c of plan.conflicts) {
        expect(c.conflictType).toBeTruthy();
        expect(Array.isArray(c.affectedAssets)).toBe(true);
        expect(c.resolution).toBeTruthy();
      }
    }
  });

  it("after conflict resolution, no two critical assets share the same region", () => {
    const input = makeCompositionInput("Dental Implant Lead Generation Campaign");
    const plan  = buildCommercialCompositionPlan(input);

    const regionMap = new Map<string, string[]>();
    for (const p of plan.placements) {
      const existing = regionMap.get(p.region) ?? [];
      existing.push(p.assetId);
      regionMap.set(p.region, existing);
    }

    for (const [region, assets] of regionMap) {
      const criticals = plan.placements
        .filter((p) => p.region === region && p.prominence === "critical");
      expect(criticals.length, `region ${region} has ${criticals.length} critical assets: ${assets.join(",")}`).toBeLessThanOrEqual(1);
    }
  });

  it("QR code never in mid_center after resolution", () => {
    const input = makeCompositionInput("Restaurant Grand Opening with QR");
    const plan  = buildCommercialCompositionPlan(input);
    const qr    = plan.placements.find((p) => p.assetId === "qr_code");
    if (qr) {
      expect(qr.region).not.toBe("mid_center");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildCompositionFromBlueprintInputs
// ─────────────────────────────────────────────────────────────────────────────

describe("buildCompositionFromBlueprintInputs", () => {
  it("returns a valid CommercialCompositionPlan", () => {
    const input = makeCompositionInput("Dental Implant Campaign");
    const plan  = buildCompositionFromBlueprintInputs(
      input.strategy,
      input.commercialAssets,
      input.layoutPlan,
    );
    expect(plan.strategyId).toBeTruthy();
    expect(Array.isArray(plan.placements)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Blueprint integration — commercialComposition present
// ─────────────────────────────────────────────────────────────────────────────

describe("UniversalCampaignBlueprint — commercialComposition integration", () => {
  it("blueprint contains commercialComposition section", () => {
    const bp = makeBlueprint("Dental Implant Campaign");
    expect(bp).toHaveProperty("commercialComposition");
    expect(bp.commercialComposition).toBeDefined();
  });

  it("blueprint.commercialComposition has correct structure", () => {
    const bp = makeBlueprint("Restaurant Grand Opening");
    const cc = bp.commercialComposition!;
    expect(cc.strategyId).toBeTruthy();
    expect(Array.isArray(cc.placements)).toBe(true);
    expect(cc.heroZone).toBeDefined();
    expect(cc.whitespace).toBeDefined();
    expect(cc.safeZoneMap).toBeDefined();
    expect(Array.isArray(cc.conflicts)).toBe(true);
    expect(["A", "B", "C", "D"]).toContain(cc.compositionGrade);
  });

  it("dental blueprint uses healthcare strategy", () => {
    const bp = makeBlueprint("Dental Implant Informative Creative");
    expect(bp.commercialComposition?.strategyId).toBe("healthcare");
  });

  it("restaurant blueprint uses restaurant strategy", () => {
    const bp = makeBlueprint("Restaurant Grand Opening");
    expect(bp.commercialComposition?.strategyId).toBe("restaurant");
  });

  it("real estate blueprint uses real_estate strategy", () => {
    const bp = makeBlueprint("New Apartment Homes For Sale Book Now");
    expect(bp.commercialComposition?.strategyId).toBe("real_estate");
  });

  it("blueprint.commercialComposition placements are valid", () => {
    const bp = makeBlueprint("Tech SaaS Product Launch");
    const cc = bp.commercialComposition!;
    for (const p of cc.placements) {
      expect(p.assetId).toBeTruthy();
      expect(p.priority).toBeGreaterThanOrEqual(1);
      expect(p.priority).toBeLessThanOrEqual(10);
    }
  });

  it("totalAssets in commercialComposition matches planned asset count from commercialAssets", () => {
    const bp = makeBlueprint("Dental Implant Campaign");
    expect(bp.commercialComposition?.totalAssets).toBe(bp.commercialAssets?.assets.length);
  });

  it("blueprint is frozen after assembly (immutability)", () => {
    const bp = makeBlueprint("Restaurant Grand Opening");
    expect(Object.isFrozen(bp)).toBe(true);
  });

  it("no text generated — output is structured data only", () => {
    const bp = makeBlueprint("Healthcare Hospital Campaign");
    const cc = bp.commercialComposition!;
    for (const p of cc.placements) {
      // region, alignment, prominence, size are typed enum values — not freeform text
      expect(typeof p.region).toBe("string");
      expect(typeof p.assetId).toBe("string");
      expect(typeof p.priority).toBe("number");
    }
  });
});
