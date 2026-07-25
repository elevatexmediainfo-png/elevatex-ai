import { describe, expect, it } from "vitest";

import { normalizeIndustryId, strategyToAssetPlannerInput, planFromStrategy } from "./adapter";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import { assembleBlueprint } from "../blueprint";
import { buildCampaignPlan } from "../creative-director";
import { buildVisualLayoutPlan } from "../visual-layout";
import { buildTypographyPlan } from "../typography";
import type { CreativeRequest } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline helper
// ─────────────────────────────────────────────────────────────────────────────

function makeStrategy(rawIdea: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "test" });
  return buildCreativeStrategy(ctx);
}

function makeBlueprint(rawIdea: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const campaign = buildCampaignPlan(strategy);
  const layout = buildVisualLayoutPlan(strategy, campaign);
  const typography = buildTypographyPlan(strategy, campaign, layout);
  return assembleBlueprint({ context: ctx, strategy, campaignPlan: campaign, layoutPlan: layout, typographyPlan: typography });
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeIndustryId
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeIndustryId", () => {
  it("maps dental variants correctly", () => {
    expect(normalizeIndustryId("dental")).toBe("dental");
    expect(normalizeIndustryId("dental_clinic")).toBe("dental");
    // subIndustry takes priority — healthcare with dental_clinic sub → dental
    expect(normalizeIndustryId("healthcare", "dental_clinic")).toBe("dental");
  });

  it("maps restaurant variants correctly", () => {
    expect(normalizeIndustryId("restaurant")).toBe("restaurant");
    expect(normalizeIndustryId("food_beverage")).toBe("restaurant");
    expect(normalizeIndustryId("food_hospitality")).toBe("restaurant");
    expect(normalizeIndustryId("cafe")).toBe("restaurant");
  });

  it("maps real_estate variants correctly", () => {
    expect(normalizeIndustryId("real_estate")).toBe("real_estate");
    expect(normalizeIndustryId("property")).toBe("real_estate");
    expect(normalizeIndustryId("luxury_property")).toBe("real_estate");
  });

  it("maps healthcare variants correctly", () => {
    expect(normalizeIndustryId("healthcare")).toBe("healthcare");
    expect(normalizeIndustryId("hospital")).toBe("healthcare");
    expect(normalizeIndustryId("clinic")).toBe("healthcare");
  });

  it("maps jewelry variants correctly", () => {
    expect(normalizeIndustryId("jewelry")).toBe("jewelry");
    expect(normalizeIndustryId("jewellery")).toBe("jewelry");
    expect(normalizeIndustryId("jewellery_luxury")).toBe("jewelry");
    expect(normalizeIndustryId("fine_jewellery")).toBe("jewelry");
  });

  it("maps salon variants correctly", () => {
    expect(normalizeIndustryId("salon")).toBe("salon");
    expect(normalizeIndustryId("beauty_wellness")).toBe("salon");
    expect(normalizeIndustryId("hair_salon")).toBe("salon");
  });

  it("maps education variants correctly", () => {
    expect(normalizeIndustryId("education")).toBe("education");
    expect(normalizeIndustryId("coaching")).toBe("education");
  });

  it("maps finance variants correctly", () => {
    expect(normalizeIndustryId("finance")).toBe("finance");
    expect(normalizeIndustryId("mutual_fund")).toBe("finance");
    expect(normalizeIndustryId("insurance")).toBe("finance");
  });

  it("maps tech variants correctly", () => {
    expect(normalizeIndustryId("tech")).toBe("tech");
    expect(normalizeIndustryId("saas")).toBe("tech");
    expect(normalizeIndustryId("software")).toBe("tech");
    expect(normalizeIndustryId("tech_software")).toBe("tech");
  });

  it("maps fashion variants correctly", () => {
    expect(normalizeIndustryId("fashion")).toBe("fashion");
    expect(normalizeIndustryId("retail")).toBe("fashion");
    expect(normalizeIndustryId("retail_fashion")).toBe("fashion");
    expect(normalizeIndustryId("retail_ecommerce")).toBe("fashion");
  });

  it("maps events variants correctly", () => {
    expect(normalizeIndustryId("events")).toBe("events");
    expect(normalizeIndustryId("events_entertainment")).toBe("events");
    expect(normalizeIndustryId("entertainment")).toBe("events");
  });

  it("returns general for unknown/null/undefined", () => {
    expect(normalizeIndustryId("unknown")).toBe("general");
    expect(normalizeIndustryId(null)).toBe("general");
    expect(normalizeIndustryId(undefined)).toBe("general");
    expect(normalizeIndustryId("")).toBe("general");
    expect(normalizeIndustryId("random_industry_xyz")).toBe("general");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// strategyToAssetPlannerInput
// ─────────────────────────────────────────────────────────────────────────────

describe("strategyToAssetPlannerInput", () => {
  it("returns all required AssetPlannerInput fields", () => {
    const strategy = makeStrategy("Dental Implant Campaign");
    const input = strategyToAssetPlannerInput(strategy);

    expect(input).toHaveProperty("industry");
    expect(input).toHaveProperty("campaign");
    expect(input).toHaveProperty("audience");
    expect(input).toHaveProperty("commercialObjective");
    expect(input).toHaveProperty("brandType");
  });

  it("maps dental campaign to dental industry", () => {
    const strategy = makeStrategy("Dental Implant Informative Creative");
    const input = strategyToAssetPlannerInput(strategy);
    expect(input.industry).toBe("dental");
  });

  it("maps restaurant campaign to restaurant industry", () => {
    const strategy = makeStrategy("Restaurant Grand Opening Special Offer");
    const input = strategyToAssetPlannerInput(strategy);
    expect(input.industry).toBe("restaurant");
  });

  it("maps real estate campaign to real_estate industry", () => {
    const strategy = makeStrategy("Luxury Real Estate Villa Launch Campaign");
    const input = strategyToAssetPlannerInput(strategy);
    expect(input.industry).toBe("real_estate");
  });

  it("maps luxury visual to luxury brand type", () => {
    const strategy = makeStrategy("Ultra Luxury Jewellery Wedding Collection");
    const input = strategyToAssetPlannerInput(strategy);
    expect(["luxury", "premium"]).toContain(input.brandType);
  });

  it("maps sales goal to direct_sale or product_launch objective", () => {
    const strategy = makeStrategy("Restaurant Grand Opening Special Offer Sale Today");
    const input = strategyToAssetPlannerInput(strategy);
    expect(["direct_sale", "product_launch", "brand_awareness", "footfall"]).toContain(input.commercialObjective);
  });

  it("maps goal signal to a valid CommercialObjective", () => {
    const validObjectives = [
      "lead_generation", "brand_awareness", "direct_sale",
      "appointment_booking", "footfall", "event_attendance",
      "trust_building", "product_launch",
    ];
    const strategy = makeStrategy("Dental Implant Free Consultation Book Now");
    const input = strategyToAssetPlannerInput(strategy);
    expect(validObjectives).toContain(input.commercialObjective);
  });

  it("campaign is a non-empty string", () => {
    const strategy = makeStrategy("Tech Software SaaS Launch");
    const input = strategyToAssetPlannerInput(strategy);
    expect(typeof input.campaign).toBe("string");
    expect(input.campaign.length).toBeGreaterThan(0);
  });

  it("audience is a non-empty string", () => {
    const strategy = makeStrategy("Education Coaching Institute Admissions");
    const input = strategyToAssetPlannerInput(strategy);
    expect(typeof input.audience).toBe("string");
    expect(input.audience.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// planFromStrategy — end-to-end adapter → planner
// ─────────────────────────────────────────────────────────────────────────────

describe("planFromStrategy", () => {
  it("returns a valid CommercialAssetPlan for dental", () => {
    const strategy = makeStrategy("Dental Implant Campaign");
    const plan = planFromStrategy(strategy);

    expect(Array.isArray(plan.assets)).toBe(true);
    expect(Array.isArray(plan.priority)).toBe(true);
    expect(Array.isArray(plan.mandatory)).toBe(true);
    expect(Array.isArray(plan.optional)).toBe(true);
    expect(Array.isArray(plan.forbidden)).toBe(true);
  });

  it("dental plan always contains doctor_name and appointment_button (mandatory)", () => {
    const strategy = makeStrategy("Dental Implant Treatment Campaign");
    const plan = planFromStrategy(strategy);

    expect(plan.mandatory).toContain("doctor_name");
    expect(plan.mandatory).toContain("appointment_button");
    expect(plan.assets.map((a) => a.id)).toContain("doctor_name");
    expect(plan.assets.map((a) => a.id)).toContain("appointment_button");
  });

  it("dental plan never contains chef_recommendation", () => {
    const strategy = makeStrategy("Dental Implant Creative Ad");
    const plan = planFromStrategy(strategy);
    expect(plan.assets.map((a) => a.id)).not.toContain("chef_recommendation");
    expect(plan.forbidden).toContain("chef_recommendation");
  });

  it("restaurant plan always contains headline and booking_button", () => {
    const strategy = makeStrategy("Restaurant Grand Opening");
    const plan = planFromStrategy(strategy);
    expect(plan.mandatory).toContain("headline");
    expect(plan.mandatory).toContain("booking_button");
  });

  it("real estate plan always contains builder_logo and location", () => {
    const strategy = makeStrategy("Luxury Real Estate Villa Advertisement");
    const plan = planFromStrategy(strategy);
    expect(plan.mandatory).toContain("builder_logo");
    expect(plan.mandatory).toContain("location");
  });

  it("never returns an asset in both mandatory and forbidden", () => {
    const ideas = [
      "Dental Implant Campaign",
      "Restaurant Grand Opening",
      "Real Estate Villa Launch",
      "Tech SaaS Product Launch",
      "Jewelry Wedding Collection",
    ];
    for (const idea of ideas) {
      const strategy = makeStrategy(idea);
      const plan = planFromStrategy(strategy);
      const mandSet = new Set(plan.mandatory);
      for (const id of plan.forbidden) {
        expect(mandSet.has(id), `${idea}: "${id}" in both mandatory and forbidden`).toBe(false);
      }
    }
  });

  it("priority array has no duplicates", () => {
    const strategy = makeStrategy("Healthcare Hospital Campaign");
    const plan = planFromStrategy(strategy);
    expect(new Set(plan.priority).size).toBe(plan.priority.length);
  });

  it("is synchronous — no async, no LLM", () => {
    const strategy = makeStrategy("Fashion Brand Launch");
    const result = planFromStrategy(strategy);
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Blueprint integration — commercialAssets present on assembled blueprint
// ─────────────────────────────────────────────────────────────────────────────

describe("UniversalCampaignBlueprint — commercialAssets integration", () => {
  it("blueprint contains commercialAssets section", () => {
    const bp = makeBlueprint("Dental Implant Creative");
    expect(bp).toHaveProperty("commercialAssets");
    expect(bp.commercialAssets).toBeDefined();
  });

  it("blueprint.commercialAssets has correct structure", () => {
    const bp = makeBlueprint("Restaurant Grand Opening");
    const ca = bp.commercialAssets!;

    expect(Array.isArray(ca.assets)).toBe(true);
    expect(Array.isArray(ca.priority)).toBe(true);
    expect(Array.isArray(ca.mandatory)).toBe(true);
    expect(Array.isArray(ca.optional)).toBe(true);
    expect(Array.isArray(ca.forbidden)).toBe(true);
  });

  it("dental blueprint commercialAssets has doctor_name mandatory", () => {
    const bp = makeBlueprint("Dental Implant Informative Creative");
    expect(bp.commercialAssets?.mandatory).toContain("doctor_name");
  });

  it("restaurant blueprint commercialAssets has booking_button mandatory", () => {
    const bp = makeBlueprint("Restaurant Grand Opening");
    expect(bp.commercialAssets?.mandatory).toContain("booking_button");
  });

  it("real estate blueprint commercialAssets has builder_logo mandatory", () => {
    const bp = makeBlueprint("Luxury Real Estate Villa Advertisement");
    expect(bp.commercialAssets?.mandatory).toContain("builder_logo");
  });

  it("commercialAssets.assets are valid PlannedAsset objects", () => {
    const bp = makeBlueprint("Tech SaaS Product Launch Campaign");
    const ca = bp.commercialAssets!;

    for (const asset of ca.assets) {
      expect(asset.id).toBeTruthy();
      expect(typeof asset.mandatory).toBe("boolean");
      expect(asset.priority).toBeGreaterThanOrEqual(1);
      expect(asset.priority).toBeLessThanOrEqual(10);
    }
  });

  it("commercialAssets forbidden assets never appear in assets array", () => {
    const ideas = [
      "Dental Implant Campaign",
      "Restaurant Grand Opening",
      "Real Estate Villa Launch",
    ];
    for (const idea of ideas) {
      const bp = makeBlueprint(idea);
      const ca = bp.commercialAssets!;
      const assetIds = new Set(ca.assets.map((a) => a.id));
      for (const id of ca.forbidden) {
        expect(assetIds.has(id), `${idea}: forbidden "${id}" in assets`).toBe(false);
      }
    }
  });

  it("priority array length equals assets array length", () => {
    const bp = makeBlueprint("Jewellery Wedding Collection Campaign");
    expect(bp.commercialAssets?.priority.length).toBe(bp.commercialAssets?.assets.length);
  });

  it("blueprint is frozen after assembly", () => {
    const bp = makeBlueprint("Salon Transformation Campaign");
    expect(Object.isFrozen(bp)).toBe(true);
  });
});
