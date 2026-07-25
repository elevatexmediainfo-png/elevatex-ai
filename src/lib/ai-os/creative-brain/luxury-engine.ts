import type { UserUnderstanding, AssetIntelligence, FieldConfidence } from "../types";
import type { BusinessIntelligence, LuxuryProfile } from "./types";
import type { getKnowledge } from "./knowledge";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 — Luxury Engine
// Multi-signal luxury level calculation. Replaces ad-hoc luxury detection in
// buildVisualReasoning with a single authoritative engine.
// Priority order: keywords > reference image > business type > industry default
// Pure function — no I/O, deterministic.
// ─────────────────────────────────────────────────────────────────────────────

const ULTRA_LUXURY_WORDS = [
  "ultra luxury", "ultra-luxury", "bespoke", "couture", "elite",
  "ultra premium", "ultra-premium", "haute", "artisanal luxury",
];

const HIGH_LUXURY_WORDS = [
  "luxury", "luxurious", "premium", "high-end", "highend",
  "exclusive", "prestige", "prestigious", "lavish", "opulent",
];

const LOW_LUXURY_WORDS = [
  "affordable", "budget", "cheap", "economy", "discount",
  "value for money", "low cost", "pocket friendly",
];

// Industry key → default luxury level
const INDUSTRY_LUXURY_DEFAULTS: Record<string, LuxuryProfile["level"]> = {
  jewellery_luxury:  "high",
  fine_jewellery:    "high",
  luxury_property:   "high",
  luxury_goods:      "high",
  hotel_resort:      "high",
  wealth_management: "high",
  real_estate:       "medium",
  residential:       "medium",
  commercial:        "medium",
  automotive:        "medium",
  automobile:        "medium",
  car_dealership:    "medium",
  hospitality:       "medium",
  spa_wellness:      "medium",
  dental:            "medium",
  dental_clinic:     "medium",
  health_clinic:     "medium",
  restaurant:        "medium",
  cafe:              "low",
  finance:           "medium",
  banking:           "medium",
  mutual_fund:       "low",
  insurance:         "low",
  education:         "low",
  school:            "low",
  college_university:"low",
  coaching_institute:"low",
  fitness:           "low",
  retail:            "low",
  retail_store:      "low",
  fashion:           "medium",
  technology:        "low",
  food_beverage:     "low",
  beauty_wellness:   "low",
  hair_salon:        "low",
  skincare:          "low",
  general:           "low",
  healthcare:        "low",
};

// Business type → luxury level
const BUSINESS_TYPE_LUXURY: Record<string, LuxuryProfile["level"]> = {
  premium_luxury:        "high",
  national_brand:        "medium",
  professional_service:  "medium",
  local_service:         "low",
  mass_market:           "none",
  ecommerce:             "low",
  retail:                "low",
  financial_service:     "medium",
  educational_institution:"low",
};

const LEVEL_RANK: Record<LuxuryProfile["level"], number> = {
  none: 0, low: 1, medium: 2, high: 3, ultra_luxury: 4,
};

function maxLevel(a: LuxuryProfile["level"], b: LuxuryProfile["level"]): LuxuryProfile["level"] {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

const LUXURY_MINIMALISM: Record<LuxuryProfile["level"], LuxuryProfile["minimalismLevel"]> = {
  ultra_luxury: "extreme",
  high:         "high",
  medium:       "moderate",
  low:          "low",
  none:         "none",
};

const LUXURY_PREMIUM_FEEL: Record<LuxuryProfile["level"], LuxuryProfile["premiumFeel"]> = {
  ultra_luxury: "luxury",
  high:         "luxury",
  medium:       "premium",
  low:          "standard",
  none:         "basic",
};

export function buildLuxuryProfile(
  uu:       UserUnderstanding,
  ai:       AssetIntelligence,
  kb:       ReturnType<typeof getKnowledge>,
  business: BusinessIntelligence,
  rawIdea:  string, // lowercase for keyword detection
): LuxuryProfile {
  const signals: string[] = [];
  let level: LuxuryProfile["level"] = "low";
  let confidence: FieldConfidence = "low";

  // Priority 1: Explicit luxury keywords in raw idea
  const hasUltra = ULTRA_LUXURY_WORDS.some(w => rawIdea.includes(w));
  const hasHigh  = HIGH_LUXURY_WORDS.some(w => rawIdea.includes(w));
  const hasLow   = LOW_LUXURY_WORDS.some(w => rawIdea.includes(w));

  if (hasUltra) {
    level = "ultra_luxury";
    confidence = "high";
    signals.push("keyword:ultra_luxury");
  } else if (hasHigh) {
    level = "high";
    confidence = "high";
    signals.push("keyword:high_luxury");
  } else if (hasLow) {
    level = "none";
    confidence = "high";
    signals.push("keyword:low_price");
  }

  // Priority 2: Reference image luxury level (Phase 3 asset intelligence)
  const refLuxury = (ai.reference as Record<string, unknown> | undefined)
    ?.luxuryLevel as { value?: string } | undefined;
  if (refLuxury?.value && refLuxury.value !== "unknown") {
    const refLevel = refLuxury.value as LuxuryProfile["level"];
    level = maxLevel(level, refLevel);
    if (confidence !== "high") confidence = "high";
    signals.push(`reference_image:${refLevel}`);
  }

  // Priority 3: Business type signal
  const bizLevel = BUSINESS_TYPE_LUXURY[business.businessType.value] ?? "low";
  if (bizLevel !== "low") {
    level = maxLevel(level, bizLevel);
    if (confidence === "low") confidence = "medium";
    signals.push(`business_type:${bizLevel}`);
  }

  // Priority 4: Industry default (always contributes as a floor)
  const industryKey = uu.subIndustry.value !== "unknown"
    ? uu.subIndustry.value
    : uu.industry.value !== "unknown"
    ? uu.industry.value
    : "";
  const industryLevel = INDUSTRY_LUXURY_DEFAULTS[industryKey] ?? "low";
  if (industryLevel !== "low") {
    level = maxLevel(level, industryLevel);
    if (confidence === "low") confidence = "medium";
    signals.push(`industry_default:${industryLevel}`);
  } else {
    signals.push("industry_default:low");
  }

  // If no signals found at all, stay at "low" with low confidence
  if (signals.length === 0) {
    signals.push("fallback:low");
  }

  const reasoning = `Luxury level "${level}" from signals: [${signals.join(", ")}]`;

  return {
    level,
    signals,
    minimalismLevel: LUXURY_MINIMALISM[level],
    premiumFeel:     LUXURY_PREMIUM_FEEL[level],
    confidence,
    reasoning,
  };
}
