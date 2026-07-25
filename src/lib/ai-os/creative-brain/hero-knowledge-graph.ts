// Phase 10.4I — Hero Knowledge Graph resolution.
//
// resolveHeroGraphMeta() is the bridge between the static HERO_SUBJECTS lookup
// table and a live knowledge graph. It generates deterministic, stable IDs for
// every heroType × industryKey × campaignType combination so that:
//   • Variation memory can reject previously-seen hero/scene combinations
//   • Similarity search scores hero and scene dimensions (not just route)
//   • Diversity enforcement operates on real IDs, not empty strings
//
// ID design principle: IDs are deterministic slugs — same inputs always produce
// the same ID. No randomness. This makes them safe to compare across sessions.

import type { HeroKnowledgeGraphMeta, HeroType } from "./types";

// ── Family mappings ──────────────────────────────────────────────────────────

const HERO_FAMILY: Record<HeroType, string> = {
  authority:      "authority_professional",
  person:         "human_connection",
  product:        "product_showcase",
  environment:    "environmental_immersion",
  transformation: "transformation_narrative",
  data:           "information_visualization",
  lifestyle:      "lifestyle_aspiration",
  moment:         "emotional_moment",
};

const SCENE_FAMILY: Record<HeroType, string> = {
  authority:      "professional_environment",
  person:         "social_environment",
  product:        "product_environment",
  environment:    "architectural_environment",
  transformation: "comparative_environment",
  data:           "abstract_environment",
  lifestyle:      "lifestyle_environment",
  moment:         "experiential_environment",
};

const SCENE_CATEGORY: Record<HeroType, string> = {
  authority:      "clinical",
  person:         "social",
  product:        "product",
  environment:    "architectural",
  transformation: "comparative",
  data:           "informational",
  lifestyle:      "lifestyle",
  moment:         "experiential",
};

// ── Scene type resolution ────────────────────────────────────────────────────

const SCENE_TYPE_MAP: Record<string, string> = {
  "authority:dental":           "clinical_consultation",
  "authority:dental_clinic":    "clinical_consultation",
  "authority:healthcare":       "medical_consultation",
  "authority:health_clinic":    "medical_consultation",
  "authority:general_hospital": "specialist_consultation",
  "authority:finance":          "financial_advisory",
  "authority:wealth_management":"wealth_consultation",
  "authority:mutual_fund":      "portfolio_consultation",
  "authority:banking":          "banking_consultation",
  "authority:insurance":        "insurance_advisory",
  "authority:education":        "educational_teaching",
  "authority:school":           "classroom_instruction",
  "authority:college_university":"academic_lecture",
  "authority:coaching_institute":"expert_coaching",
  "authority:legal":            "legal_consultation",
  "authority:real_estate":      "property_consultation",
  "authority:luxury_property":  "luxury_consultation",
  "person:restaurant":          "dining_social",
  "person:cafe":                "cafe_casual",
  "person:food_beverage":       "group_dining",
  "person:hospitality":         "resort_relaxation",
  "person:hotel_resort":        "resort_escape",
  "person:fitness":             "fitness_training",
  "person:retail":              "shopping_discovery",
  "person:fashion":             "fashion_editorial",
  "person:beauty_wellness":     "beauty_confidence",
  "person:hair_salon":          "salon_result",
  "person:school":              "student_collaboration",
  "person:education":           "student_achievement",
  "person:spa_wellness":        "spa_relaxation",
  "person:skincare":            "skincare_glow",
  "product:jewellery_luxury":   "luxury_showcase",
  "product:fine_jewellery":     "jewellery_cinematic",
  "product:jewellery":          "jewellery_minimal",
  "product:luxury_goods":       "luxury_product",
  "product:automotive":         "automotive_dynamic",
  "product:automobile":         "car_dramatic",
  "product:car_dealership":     "car_aspirational",
  "product:technology":         "tech_precision",
  "product:food_beverage":      "food_appetite",
  "product:restaurant":         "food_art",
  "product:cafe":               "coffee_ritual",
  "product:fashion":            "fashion_styled",
  "product:retail":             "product_context",
  "product:skincare":           "skincare_premium",
  "environment:real_estate":    "property_exterior",
  "environment:luxury_property":"luxury_interior",
  "environment:residential":    "home_interior",
  "environment:commercial":     "commercial_exterior",
  "environment:hotel_resort":   "resort_atmosphere",
  "environment:hospitality":    "hospitality_space",
  "environment:restaurant":     "dining_atmosphere",
  "environment:cafe":           "cafe_interior",
  "environment:spa_wellness":   "spa_ambiance",
  "transformation:dental":      "dental_smile_transformation",
  "transformation:dental_clinic":"dental_before_after",
  "transformation:beauty_wellness":"beauty_transformation",
  "transformation:hair_salon":  "hair_transformation",
  "transformation:spa_wellness":"wellness_journey",
  "transformation:fitness":     "fitness_transformation",
  "transformation:skincare":    "skincare_result",
  "transformation:healthcare":  "patient_recovery",
  "data:finance":               "growth_visualization",
  "data:mutual_fund":           "sip_journey",
  "data:banking":               "financial_process",
  "data:insurance":             "protection_metaphor",
  "data:healthcare":            "medical_outcome",
  "data:health_clinic":         "treatment_diagram",
  "data:education":             "outcome_data",
  "data:coaching_institute":    "results_visualization",
  "data:technology":            "feature_comparison",
  "lifestyle:automotive":       "driving_freedom",
  "lifestyle:travel_agency":    "destination_moment",
  "lifestyle:jewellery_luxury": "social_luxury",
  "lifestyle:fashion":          "lifestyle_editorial",
  "lifestyle:fitness":          "active_lifestyle",
  "lifestyle:hospitality":      "resort_living",
  "lifestyle:real_estate":      "property_lifestyle",
  "lifestyle:luxury_property":  "luxury_living",
  "moment:restaurant":          "dish_arrival",
  "moment:cafe":                "coffee_ritual_moment",
  "moment:hospitality":         "hotel_arrival",
  "moment:hotel_resort":        "resort_reveal",
  "moment:education":           "graduation_joy",
  "moment:food_beverage":       "shared_connection",
  "moment:celebration":         "peak_celebration",
};

function resolveSceneType(heroType: HeroType, industryKey: string): string {
  return SCENE_TYPE_MAP[`${heroType}:${industryKey}`] ?? `${heroType}_scene`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve the Hero Knowledge Graph metadata for a given creative combination.
 * Pure function — deterministic, no I/O.
 *
 * @param heroType    The selected hero archetype (from creative matrix)
 * @param industryKey The resolved industry key (subIndustry or industry)
 * @param campaignType The campaign goal driving this generation
 */
export function resolveHeroGraphMeta(
  heroType:     HeroType,
  industryKey:  string,
  campaignType: string,
): HeroKnowledgeGraphMeta {
  const industrySlug  = industryKey  || "general";
  const campaignSlug  = campaignType || "general";

  const heroCategory   = heroType;
  const heroFamilyId   = HERO_FAMILY[heroType];
  const sceneCategory  = SCENE_CATEGORY[heroType];
  const sceneFamily    = SCENE_FAMILY[heroType];
  const resolvedScene  = resolveSceneType(heroType, industrySlug);

  const heroMomentId     = `${heroType}:${industrySlug}:${campaignSlug}`;
  const sceneTypeId      = `${resolvedScene}:${industrySlug}`;
  const visualFingerprint = `${heroFamilyId}:${resolvedScene}:${campaignSlug}`;

  return {
    heroMomentId,
    heroFamilyId,
    heroCategory,
    sceneTypeId,
    sceneFamily,
    sceneCategory,
    industryKey:       industrySlug,
    campaignType:      campaignSlug,
    visualFingerprint,
  };
}
