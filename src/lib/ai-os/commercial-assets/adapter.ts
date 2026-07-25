// Phase 8.7A — Creative Strategy → Commercial Asset Planner adapter.
// Translates the CreativeStrategy type system into AssetPlannerInput.
// Pure mapping — no logic, no LLM, no I/O.

import type { CreativeStrategy } from "../creative-brain/types";
import type { AssetPlannerInput, BrandType, CommercialObjective, SupportedIndustryId } from "./types";
import { planCommercialAssets } from "./planner";
import type { CommercialAssetPlan } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Industry normalization
// Maps every known industry string to a SupportedIndustryId, with "general" fallback.
// ─────────────────────────────────────────────────────────────────────────────

const INDUSTRY_MAP: Record<string, SupportedIndustryId> = {
  // Dental — listed before healthcare so subIndustry lookup wins
  dental_clinic:    "dental",

  // Restaurant / food
  restaurant:       "restaurant",
  food_beverage:    "restaurant",
  food_hospitality: "restaurant",
  cafe:             "restaurant",
  bakery:           "restaurant",
  catering:         "restaurant",
  hospitality:      "restaurant",

  // Dental
  dental:           "dental",

  // Real estate
  real_estate:      "real_estate",
  real_estate_agent:"real_estate",
  property:         "real_estate",
  luxury_property:  "real_estate",
  builder:          "real_estate",

  // Healthcare
  healthcare:       "healthcare",
  hospital:         "healthcare",
  clinic:           "healthcare",
  pharmacy:         "healthcare",
  wellness:         "healthcare",

  // Jewelry
  jewelry:          "jewelry",
  jewellery:        "jewelry",
  jewellery_luxury: "jewelry",
  fine_jewellery:   "jewelry",
  gold:             "jewelry",

  // Salon / beauty
  salon:            "salon",
  beauty_wellness:  "salon",
  hair_salon:       "salon",
  spa:              "salon",

  // Education
  education:        "education",
  school:           "education",
  university:       "education",
  coaching:         "education",
  tuition:          "education",

  // Automotive
  automotive:       "automotive",
  car:              "automotive",
  vehicle:          "automotive",

  // Finance
  finance:          "finance",
  financial:        "finance",
  banking:          "finance",
  insurance:        "finance",
  mutual_fund:      "finance",
  investment:       "finance",

  // Tech / software
  tech:             "tech",
  technology:       "tech",
  software:         "tech",
  saas:             "tech",
  tech_software:    "tech",
  app:              "tech",
  startup:          "tech",

  // Fashion / retail
  fashion:          "fashion",
  retail:           "fashion",
  retail_fashion:   "fashion",
  retail_ecommerce: "fashion",
  ecommerce:        "fashion",
  clothing:         "fashion",

  // Events / entertainment
  events:           "events",
  events_entertainment: "events",
  entertainment:    "events",
  event:            "events",
};

export function normalizeIndustryId(
  raw: string | null | undefined,
  subIndustry?: string | null,
): SupportedIndustryId {
  // Sub-industry is more specific — try it first
  if (subIndustry && subIndustry !== "unknown") {
    const subLower = subIndustry.toLowerCase().replace(/[\s-]/g, "_");
    const subMapped = INDUSTRY_MAP[subLower];
    if (subMapped) return subMapped;
  }
  if (!raw || raw === "unknown") return "general";
  const lower = raw.toLowerCase().replace(/[\s-]/g, "_");
  return INDUSTRY_MAP[lower] ?? "general";
}

// ─────────────────────────────────────────────────────────────────────────────
// Campaign goal → CommercialObjective
// ─────────────────────────────────────────────────────────────────────────────

const GOAL_TO_OBJECTIVE: Record<string, CommercialObjective> = {
  awareness:       "brand_awareness",
  lead_generation: "lead_generation",
  sales:           "direct_sale",
  trust:           "trust_building",
  education:       "trust_building",
  engagement:      "brand_awareness",
  retention:       "brand_awareness",
};

function mapGoalToObjective(goal: string | null | undefined): CommercialObjective {
  if (!goal || goal === "unknown") return "brand_awareness";
  return GOAL_TO_OBJECTIVE[goal] ?? "brand_awareness";
}

// ─────────────────────────────────────────────────────────────────────────────
// Campaign category → refined CommercialObjective override
// More specific than campaignGoal — used when campaignCategory provides signal.
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_TO_OBJECTIVE: Record<string, CommercialObjective> = {
  promotion:         "direct_sale",
  offer:             "direct_sale",
  launch:            "product_launch",
  festival:          "event_attendance",
  corporate:         "trust_building",
  branding:          "brand_awareness",
  educational:       "trust_building",
  awareness:         "brand_awareness",
};

function refinedObjective(
  goalObjective: CommercialObjective,
  campaignCategory: string | null | undefined,
): CommercialObjective {
  if (!campaignCategory || campaignCategory === "unknown") return goalObjective;
  return CATEGORY_TO_OBJECTIVE[campaignCategory] ?? goalObjective;
}

// ─────────────────────────────────────────────────────────────────────────────
// Communication style + luxury level → BrandType
// ─────────────────────────────────────────────────────────────────────────────

function mapBrandType(
  communicationStyle: string | null | undefined,
  luxuryLevel: string | null | undefined,
): BrandType {
  // Luxury override — if explicit luxury signal is present, it wins
  if (luxuryLevel === "high" || luxuryLevel === "ultra_luxury") return "luxury";
  if (luxuryLevel === "medium") return "premium";

  switch (communicationStyle) {
    case "luxury":        return "luxury";
    case "premium":       return "premium";
    case "professional":  return "professional";
    case "authority":     return "professional";
    case "educational":   return "professional";
    case "minimal":       return "premium";
    case "friendly":      return "mass_market";
    case "emotional":     return "mass_market";
    default:              return "professional";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: build AssetPlannerInput from CreativeStrategy
// ─────────────────────────────────────────────────────────────────────────────

export function strategyToAssetPlannerInput(strategy: CreativeStrategy): AssetPlannerInput {
  const goalObjective  = mapGoalToObjective(strategy.marketing.campaignGoal.value);
  const objective      = refinedObjective(goalObjective, strategy.campaign.campaignCategory.value);
  const brandType      = mapBrandType(
    strategy.communication.communicationStyle.value,
    strategy.visual.luxuryLevel.value,
  );
  const offerValue     = strategy.business.offerDetails.offerValue ?? undefined;

  return {
    industry:            normalizeIndustryId(strategy.business.industry.value, strategy.business.subIndustry.value),
    campaign:            strategy.campaign.campaignCategory.value === "unknown"
                           ? "general"
                           : (strategy.campaign.campaignCategory.value ?? "general"),
    audience:            strategy.audience.primaryAudience.value === "unknown"
                           ? "general"
                           : (strategy.audience.primaryAudience.value ?? "general"),
    commercialObjective: objective,
    brandType,
    ...(offerValue ? { offer: offerValue } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: run the planner directly from a CreativeStrategy
// ─────────────────────────────────────────────────────────────────────────────

export function planFromStrategy(strategy: CreativeStrategy): CommercialAssetPlan {
  return planCommercialAssets(strategyToAssetPlannerInput(strategy));
}
