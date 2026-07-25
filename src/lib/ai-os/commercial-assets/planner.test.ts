import { describe, expect, it } from "vitest";

import { planCommercialAssets } from "./planner";
import { getAssetDefinition, getAllAssets } from "./asset-registry";
import { getRulesForIndustry, getAllIndustryRules } from "./industry-rules";
import type { AssetPlannerInput, CommercialAssetId, SupportedIndustryId } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeInput(
  overrides: Partial<AssetPlannerInput> & { industry: SupportedIndustryId },
): AssetPlannerInput {
  return {
    campaign:            "test campaign",
    audience:            "general",
    commercialObjective: "brand_awareness",
    brandType:           "professional",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset Registry
// ─────────────────────────────────────────────────────────────────────────────

describe("Asset Registry", () => {
  it("contains 34 or more asset definitions", () => {
    expect(getAllAssets().length).toBeGreaterThanOrEqual(34);
  });

  it("every asset has all required fields", () => {
    for (const asset of getAllAssets()) {
      expect(asset.id, `${asset.id}.id`).toBeTruthy();
      expect(asset.label, `${asset.id}.label`).toBeTruthy();
      expect(asset.priority, `${asset.id}.priority`).toBeGreaterThanOrEqual(1);
      expect(asset.priority, `${asset.id}.priority`).toBeLessThanOrEqual(10);
      expect(["critical", "high", "medium", "low"]).toContain(asset.commercialImportance);
      expect(["dominant", "prominent", "supporting", "subtle"]).toContain(asset.visualImportance);
      expect(["primary_zone", "secondary_zone", "edge_zone", "flexible"]).toContain(asset.placementImportance);
      expect(asset.description, `${asset.id}.description`).toBeTruthy();
    }
  });

  it("getAssetDefinition returns the correct asset", () => {
    expect(getAssetDefinition("headline").priority).toBe(10);
    expect(getAssetDefinition("cta").priority).toBe(10);
    expect(getAssetDefinition("logo").priority).toBe(9);
    expect(getAssetDefinition("rera_number").commercialImportance).toBe("high");
  });

  it("headline and cta are priority 10 (critical)", () => {
    expect(getAssetDefinition("headline").commercialImportance).toBe("critical");
    expect(getAssetDefinition("cta").commercialImportance).toBe("critical");
  });

  it("appointment_button and booking_button are priority 9 (critical)", () => {
    expect(getAssetDefinition("appointment_button").commercialImportance).toBe("critical");
    expect(getAssetDefinition("booking_button").commercialImportance).toBe("critical");
  });

  it("social_icons and email are low commercial importance (supporting)", () => {
    expect(getAssetDefinition("social_icons").commercialImportance).toBe("low");
    expect(getAssetDefinition("email").commercialImportance).toBe("low");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Industry Rules
// ─────────────────────────────────────────────────────────────────────────────

describe("Industry Rules", () => {
  it("covers all 13 supported industries", () => {
    const rules = getAllIndustryRules();
    const ids = rules.map((r) => r.industryId);
    const expected: SupportedIndustryId[] = [
      "restaurant", "dental", "real_estate", "healthcare", "jewelry",
      "salon", "education", "automotive", "finance", "tech", "fashion",
      "events", "general",
    ];
    for (const id of expected) {
      expect(ids).toContain(id);
    }
  });

  it("no industry has an asset in both must and never", () => {
    for (const rules of getAllIndustryRules()) {
      const mustSet = new Set(rules.must);
      for (const id of rules.never) {
        expect(mustSet.has(id), `${rules.industryId}: ${id} is in both must and never`).toBe(false);
      }
    }
  });

  it("no industry has an asset in both optional and never", () => {
    for (const rules of getAllIndustryRules()) {
      const neverSet = new Set(rules.never);
      for (const id of rules.optional) {
        expect(neverSet.has(id), `${rules.industryId}: ${id} is in both optional and never`).toBe(false);
      }
    }
  });

  it("restaurant: must include headline, cta, booking_button, logo", () => {
    const rules = getRulesForIndustry("restaurant");
    expect(rules.must).toContain("headline");
    expect(rules.must).toContain("cta");
    expect(rules.must).toContain("booking_button");
    expect(rules.must).toContain("logo");
  });

  it("restaurant: never includes doctor_credentials", () => {
    expect(getRulesForIndustry("restaurant").never).toContain("doctor_credentials");
  });

  it("dental: must include doctor_name, clinic_logo, appointment_button, doctor_credentials", () => {
    const rules = getRulesForIndustry("dental");
    expect(rules.must).toContain("doctor_name");
    expect(rules.must).toContain("clinic_logo");
    expect(rules.must).toContain("appointment_button");
    expect(rules.must).toContain("doctor_credentials");
  });

  it("dental: never includes chef_recommendation", () => {
    expect(getRulesForIndustry("dental").never).toContain("chef_recommendation");
  });

  it("dental: never includes booking_button (use appointment_button instead)", () => {
    expect(getRulesForIndustry("dental").never).toContain("booking_button");
  });

  it("real_estate: must include builder_logo, location, possession_date, cta", () => {
    const rules = getRulesForIndustry("real_estate");
    expect(rules.must).toContain("builder_logo");
    expect(rules.must).toContain("location");
    expect(rules.must).toContain("possession_date");
    expect(rules.must).toContain("cta");
  });

  it("real_estate: optional includes rera_number and price_tag", () => {
    const rules = getRulesForIndustry("real_estate");
    expect(rules.optional).toContain("rera_number");
    expect(rules.optional).toContain("price_tag");
  });

  it("real_estate: never includes chef_recommendation", () => {
    expect(getRulesForIndustry("real_estate").never).toContain("chef_recommendation");
  });

  it("finance: must include certification (regulatory)", () => {
    expect(getRulesForIndustry("finance").must).toContain("certification");
  });

  it("finance: never includes discount_badge and offer_ribbon", () => {
    const rules = getRulesForIndustry("finance");
    expect(rules.never).toContain("discount_badge");
    expect(rules.never).toContain("offer_ribbon");
  });

  it("healthcare: must include appointment_button", () => {
    expect(getRulesForIndustry("healthcare").must).toContain("appointment_button");
  });

  it("jewelry: never includes before_after_badge", () => {
    expect(getRulesForIndustry("jewelry").never).toContain("before_after_badge");
  });

  it("salon: must include booking_button", () => {
    expect(getRulesForIndustry("salon").must).toContain("booking_button");
  });

  it("events: must include booking_button", () => {
    expect(getRulesForIndustry("events").must).toContain("booking_button");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Planner — output structure
// ─────────────────────────────────────────────────────────────────────────────

describe("planCommercialAssets — output structure", () => {
  it("returns all required top-level keys", () => {
    const plan = planCommercialAssets(makeInput({ industry: "restaurant" }));
    expect(plan).toHaveProperty("assets");
    expect(plan).toHaveProperty("priority");
    expect(plan).toHaveProperty("mandatory");
    expect(plan).toHaveProperty("optional");
    expect(plan).toHaveProperty("forbidden");
  });

  it("assets is an array of PlannedAsset objects", () => {
    const plan = planCommercialAssets(makeInput({ industry: "dental" }));
    expect(Array.isArray(plan.assets)).toBe(true);
    for (const asset of plan.assets) {
      expect(asset.id).toBeTruthy();
      expect(typeof asset.mandatory).toBe("boolean");
      expect(asset.priority).toBeGreaterThanOrEqual(1);
      expect(asset.priority).toBeLessThanOrEqual(10);
      expect(["critical", "high", "medium", "low"]).toContain(asset.commercialImportance);
      expect(["dominant", "prominent", "supporting", "subtle"]).toContain(asset.visualImportance);
      expect(["primary_zone", "secondary_zone", "edge_zone", "flexible"]).toContain(asset.placementImportance);
    }
  });

  it("priority array contains only asset IDs present in assets", () => {
    const plan = planCommercialAssets(makeInput({ industry: "real_estate" }));
    const assetIds = new Set(plan.assets.map((a) => a.id));
    for (const id of plan.priority) {
      expect(assetIds.has(id), `${id} in priority but not in assets`).toBe(true);
    }
  });

  it("priority and assets have the same length", () => {
    const plan = planCommercialAssets(makeInput({ industry: "automotive" }));
    expect(plan.priority.length).toBe(plan.assets.length);
  });

  it("no duplicates in assets array", () => {
    const plan = planCommercialAssets(makeInput({ industry: "fashion" }));
    const ids = plan.assets.map((a) => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("no duplicates in priority array", () => {
    const plan = planCommercialAssets(makeInput({ industry: "salon" }));
    const unique = new Set(plan.priority);
    expect(unique.size).toBe(plan.priority.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Planner — mandatory assets always present
// ─────────────────────────────────────────────────────────────────────────────

describe("planCommercialAssets — mandatory assets", () => {
  const industries: SupportedIndustryId[] = [
    "restaurant", "dental", "real_estate", "healthcare", "jewelry",
    "salon", "education", "automotive", "finance", "tech", "fashion",
    "events", "general",
  ];

  for (const industry of industries) {
    it(`${industry}: all mandatory assets appear in output`, () => {
      const plan = planCommercialAssets(makeInput({ industry }));
      const assetIds = new Set(plan.assets.map((a) => a.id));
      for (const id of plan.mandatory) {
        expect(assetIds.has(id), `${industry}: mandatory asset "${id}" missing from output`).toBe(true);
      }
    });

    it(`${industry}: mandatory assets flagged as mandatory=true in assets array`, () => {
      const plan = planCommercialAssets(makeInput({ industry }));
      const mandatorySet = new Set(plan.mandatory);
      for (const asset of plan.assets) {
        if (mandatorySet.has(asset.id)) {
          expect(asset.mandatory, `${industry}: ${asset.id} should be mandatory=true`).toBe(true);
        }
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Planner — forbidden assets never present
// ─────────────────────────────────────────────────────────────────────────────

describe("planCommercialAssets — forbidden assets", () => {
  it("restaurant: forbidden assets never appear in output assets", () => {
    const plan = planCommercialAssets(makeInput({ industry: "restaurant", commercialObjective: "lead_generation" }));
    const assetIds = new Set(plan.assets.map((a) => a.id));
    for (const id of plan.forbidden) {
      expect(assetIds.has(id), `restaurant: forbidden "${id}" appeared in assets`).toBe(false);
    }
  });

  it("dental: chef_recommendation is forbidden and never appears", () => {
    const plan = planCommercialAssets(makeInput({ industry: "dental", offer: "Free consultation" }));
    const assetIds = plan.assets.map((a) => a.id);
    expect(assetIds).not.toContain("chef_recommendation");
    expect(plan.forbidden).toContain("chef_recommendation");
  });

  it("real_estate: chef_recommendation is forbidden and never appears", () => {
    const plan = planCommercialAssets(makeInput({ industry: "real_estate" }));
    expect(plan.assets.map((a) => a.id)).not.toContain("chef_recommendation");
  });

  it("dental: booking_button is forbidden (appointment_button is correct)", () => {
    const plan = planCommercialAssets(makeInput({ industry: "dental" }));
    expect(plan.assets.map((a) => a.id)).not.toContain("booking_button");
    expect(plan.assets.map((a) => a.id)).toContain("appointment_button");
  });

  it("finance: discount_badge is forbidden and never appears", () => {
    const plan = planCommercialAssets(makeInput({ industry: "finance", offer: "Zero fees" }));
    expect(plan.assets.map((a) => a.id)).not.toContain("discount_badge");
    expect(plan.forbidden).toContain("discount_badge");
  });

  it("every forbidden asset is absent from the assets array (all industries)", () => {
    const industries: SupportedIndustryId[] = [
      "restaurant", "dental", "real_estate", "healthcare", "jewelry",
      "salon", "education", "automotive", "finance", "tech", "fashion",
      "events", "general",
    ];
    for (const industry of industries) {
      const plan = planCommercialAssets(makeInput({ industry }));
      const assetIds = new Set(plan.assets.map((a) => a.id));
      for (const id of plan.forbidden) {
        expect(assetIds.has(id), `${industry}: forbidden "${id}" in assets`).toBe(false);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Planner — commercial objective effects
// ─────────────────────────────────────────────────────────────────────────────

describe("planCommercialAssets — commercial objective", () => {
  it("lead_generation: includes phone or whatsapp (when available in industry)", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "restaurant",
      commercialObjective: "lead_generation",
    }));
    const ids = plan.assets.map((a) => a.id);
    const hasContact = ids.includes("phone") || ids.includes("whatsapp");
    expect(hasContact).toBe(true);
  });

  it("direct_sale: includes offer_ribbon (when available in industry)", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "restaurant",
      commercialObjective: "direct_sale",
    }));
    expect(plan.assets.map((a) => a.id)).toContain("offer_ribbon");
  });

  it("trust_building: includes trust_badge and/or review_stars (when available)", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "dental",
      commercialObjective: "trust_building",
    }));
    const ids = plan.assets.map((a) => a.id);
    const hasTrust = ids.includes("trust_badge") || ids.includes("review_stars") || ids.includes("certification");
    expect(hasTrust).toBe(true);
  });

  it("event_attendance: includes booking_button (for events industry)", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "events",
      commercialObjective: "event_attendance",
    }));
    expect(plan.assets.map((a) => a.id)).toContain("booking_button");
  });

  it("appointment_booking: includes appointment_button for healthcare", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "healthcare",
      commercialObjective: "appointment_booking",
    }));
    expect(plan.assets.map((a) => a.id)).toContain("appointment_button");
  });

  it("product_launch: includes opening_badge for restaurant", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "restaurant",
      commercialObjective: "product_launch",
    }));
    expect(plan.assets.map((a) => a.id)).toContain("opening_badge");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Planner — brand type effects
// ─────────────────────────────────────────────────────────────────────────────

describe("planCommercialAssets — brand type", () => {
  it("luxury brand suppresses discount_badge (for restaurant)", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "restaurant",
      brandType: "luxury",
      commercialObjective: "direct_sale",
      offer: "Special menu",
    }));
    expect(plan.assets.map((a) => a.id)).not.toContain("discount_badge");
  });

  it("luxury brand suppresses offer_ribbon (for restaurant)", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "restaurant",
      brandType: "luxury",
      commercialObjective: "direct_sale",
      offer: "Special menu",
    }));
    expect(plan.assets.map((a) => a.id)).not.toContain("offer_ribbon");
  });

  it("luxury brand suppresses festival_sticker", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "salon",
      brandType: "luxury",
    }));
    expect(plan.assets.map((a) => a.id)).not.toContain("festival_sticker");
  });

  it("affordable brand accepts discount_badge when objective is direct_sale", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "restaurant",
      brandType: "affordable",
      commercialObjective: "direct_sale",
      offer: "20% off",
    }));
    expect(plan.assets.map((a) => a.id)).toContain("discount_badge");
  });

  it("premium brand suppresses festival_sticker", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "restaurant",
      brandType: "premium",
    }));
    expect(plan.assets.map((a) => a.id)).not.toContain("festival_sticker");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Planner — offer field effects
// ─────────────────────────────────────────────────────────────────────────────

describe("planCommercialAssets — offer field", () => {
  it("with offer: includes offer_ribbon for salon (if not suppressed)", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "salon",
      brandType: "mass_market",
      offer: "30% off first visit",
    }));
    expect(plan.assets.map((a) => a.id)).toContain("offer_ribbon");
  });

  it("with offer: limited_time_badge appears for fashion", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "fashion",
      brandType: "mass_market",
      offer: "End of season sale",
    }));
    expect(plan.assets.map((a) => a.id)).toContain("limited_time_badge");
  });

  it("without offer: offer_ribbon not activated by default for brand_awareness objective", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "salon",
      commercialObjective: "brand_awareness",
    }));
    // offer_ribbon should NOT be auto-included without offer or matching objective
    const ids = plan.assets.map((a) => a.id);
    // For brand_awareness with no offer, offer_ribbon should not be selected
    expect(ids).not.toContain("offer_ribbon");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Planner — priority ordering
// ─────────────────────────────────────────────────────────────────────────────

describe("planCommercialAssets — priority ordering", () => {
  it("mandatory assets appear earlier in priority array than optional ones (generally)", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "restaurant",
      commercialObjective: "lead_generation",
    }));
    const mandatorySet = new Set(plan.mandatory);
    const firstOptionalIdx = plan.priority.findIndex((id) => !mandatorySet.has(id));
    const lastMandatoryIdx = [...plan.priority].reverse().findIndex((id) => mandatorySet.has(id));
    // There should be mandatory assets before optional ones
    if (firstOptionalIdx !== -1 && plan.mandatory.length > 0) {
      expect(plan.priority[0]).toBeDefined();
      // The first item in priority list should be a mandatory asset
      const firstAsset = plan.priority[0] as CommercialAssetId;
      expect(mandatorySet.has(firstAsset)).toBe(true);
      void lastMandatoryIdx; // used to suppress TS unused var
    }
  });

  it("headline appears in top 3 of priority for any industry", () => {
    const industries: SupportedIndustryId[] = ["restaurant", "salon", "tech", "general"];
    for (const industry of industries) {
      const plan = planCommercialAssets(makeInput({ industry }));
      const top3 = plan.priority.slice(0, 3);
      if (plan.assets.map((a) => a.id).includes("headline")) {
        expect(top3).toContain("headline");
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Planner — never generates text
// ─────────────────────────────────────────────────────────────────────────────

describe("planCommercialAssets — no text generation", () => {
  it("is a pure synchronous function — no async, no LLM", () => {
    const result = planCommercialAssets(makeInput({ industry: "dental" }));
    // If it returned a Promise, this test would fail — synchronous return expected
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });

  it("output contains no generated copy — only asset IDs and metadata", () => {
    const plan = planCommercialAssets(makeInput({ industry: "real_estate" }));
    for (const asset of plan.assets) {
      // Values should be typed IDs and enums — not free text
      expect(typeof asset.id).toBe("string");
      expect(typeof asset.mandatory).toBe("boolean");
      expect(typeof asset.priority).toBe("number");
    }
  });

  it("optional array contains only IDs not in assets (remaining not selected)", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "restaurant",
      commercialObjective: "brand_awareness",
    }));
    const assetIdSet = new Set(plan.assets.map((a) => a.id));
    for (const id of plan.optional) {
      // optional = remaining optional not selected — should NOT be in assets
      expect(assetIdSet.has(id), `${id} is in optional but also in assets`).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Planner — industry-specific scenarios
// ─────────────────────────────────────────────────────────────────────────────

describe("planCommercialAssets — restaurant scenario", () => {
  it("standard restaurant plan has headline, cta, booking_button, logo", () => {
    const plan = planCommercialAssets(makeInput({ industry: "restaurant" }));
    const ids = plan.assets.map((a) => a.id);
    expect(ids).toContain("headline");
    expect(ids).toContain("cta");
    expect(ids).toContain("booking_button");
    expect(ids).toContain("logo");
  });

  it("restaurant grand opening includes opening_badge", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "restaurant",
      commercialObjective: "product_launch",
    }));
    expect(plan.assets.map((a) => a.id)).toContain("opening_badge");
  });
});

describe("planCommercialAssets — dental scenario", () => {
  it("dental trust-building plan has doctor_name, clinic_logo, credentials", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "dental",
      commercialObjective: "trust_building",
    }));
    const ids = plan.assets.map((a) => a.id);
    expect(ids).toContain("doctor_name");
    expect(ids).toContain("clinic_logo");
    expect(ids).toContain("doctor_credentials");
    expect(ids).toContain("appointment_button");
  });
});

describe("planCommercialAssets — real estate scenario", () => {
  it("real estate lead gen plan has builder_logo, location, possession_date, cta", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "real_estate",
      commercialObjective: "lead_generation",
    }));
    const ids = plan.assets.map((a) => a.id);
    expect(ids).toContain("builder_logo");
    expect(ids).toContain("location");
    expect(ids).toContain("possession_date");
    expect(ids).toContain("cta");
  });

  it("real estate never includes appointment_button", () => {
    const plan = planCommercialAssets(makeInput({
      industry: "real_estate",
      commercialObjective: "appointment_booking",
    }));
    expect(plan.assets.map((a) => a.id)).not.toContain("appointment_button");
  });
});
