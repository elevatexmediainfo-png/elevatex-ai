import type { UserUnderstanding, FieldConfidence } from "../types";
import type {
  ExperienceProfile,
  LuxuryProfile,
  MarketingIntelligence,
  AudienceIntelligence,
  CreativeMatrixResult,
  HeroType,
  IndustryCluster,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 — Creative Matrix
// Maps Experience × IndustryCluster × LuxuryLevel → hero type + creative archetype.
// This is the multi-axis decision that replaces the old industry × intent 2-key lookup.
// Pure function — no I/O, deterministic.
// ─────────────────────────────────────────────────────────────────────────────

// Industry cluster classification — groups industries by their natural hero affinity
const INDUSTRY_CLUSTER_MAP: Record<string, IndustryCluster> = {
  // Authority-first: professional expertise is the message
  dental:             "authority",
  dental_clinic:      "authority",
  healthcare:         "authority",
  health_clinic:      "authority",
  general_hospital:   "authority",
  finance:            "authority",
  wealth_management:  "authority",
  mutual_fund:        "authority",
  banking:            "authority",
  insurance:          "authority",
  education:          "authority",
  school:             "authority",
  college_university: "authority",
  coaching_institute: "authority",
  legal:              "authority",

  // Social-proof-first: real people and authentic experiences drive trust
  food_beverage:      "social_proof",
  restaurant:         "social_proof",
  cafe:               "social_proof",
  catering:           "social_proof",
  beauty_wellness:    "social_proof",
  hair_salon:         "social_proof",
  spa_wellness:       "social_proof",
  skincare:           "social_proof",
  hospitality:        "social_proof",
  hotel_resort:       "social_proof",
  travel_agency:      "social_proof",
  retail:             "social_proof",
  retail_store:       "social_proof",
  fashion:            "social_proof",
  fitness:            "social_proof",

  // Environmental: the space or product itself is the hero
  jewellery_luxury:   "environmental",
  fine_jewellery:     "environmental",
  jewellery:          "environmental",
  luxury_goods:       "environmental",
  real_estate:        "environmental",
  luxury_property:    "environmental",
  residential:        "environmental",
  commercial:         "environmental",

  // Balanced: multiple hero types work equally well
  automotive:         "balanced",
  automobile:         "balanced",
  car_dealership:     "balanced",
  technology:         "balanced",
  general:            "balanced",
};

// Visual archetypes by experience type
const VISUAL_ARCHETYPES: Record<string, string> = {
  transformation: "Contrast arc — before and after states in clear visual opposition",
  aspiration:     "Elevated desire — the life, object, or outcome the viewer wants to possess",
  trust:          "Authority moment — competence made visible through posture, setting, and evidence",
  luxury:         "Precision editorial — negative space, material detail, and controlled light",
  belonging:      "Human warmth — genuine connection, not performance, in a relatable setting",
  education:      "Clear information — structured, scannable, credibility through clarity",
  convenience:    "Simple revelation — the ease or outcome shown without complexity",
  celebration:    "Peak moment — the highest-energy, most joyful instant captured and frozen",
  discovery:      "Reveal — the dramatic angle, unexpected frame, or fresh perspective on the subject",
  healing:        "Relief narrative — tension before, peace after, a visible arc of restoration",
};

// Emotional drivers by experience type
const EMOTIONAL_DRIVERS: Record<string, string> = {
  transformation: "Desire for change and the satisfaction of visible improvement",
  aspiration:     "Status, identity, and the image of a better self",
  trust:          "Safety, certainty, and freedom from risk",
  luxury:         "Exclusivity, craft, and the reward of deserving something excellent",
  belonging:      "Warmth, connection, and the ease of being understood",
  education:      "Curiosity, clarity, and the confidence that comes from knowing",
  convenience:    "Relief, speed, and the elimination of friction",
  celebration:    "Joy, shared experience, and the desire to mark what matters",
  discovery:      "Excitement, novelty, and the pleasure of being first to know",
  healing:        "Relief from pain and the emotional peace of being restored",
};

// Composition priorities by experience type × cluster
function resolveCompositionPriority(
  experience: ExperienceProfile,
  cluster: IndustryCluster,
): CreativeMatrixResult["compositionPriority"] {
  if (experience.primary === "education") return "information";
  if (experience.primary === "transformation" || experience.primary === "healing") return "emotion";
  if (experience.primary === "luxury" || experience.primary === "aspiration") {
    return cluster === "environmental" ? "atmosphere" : "emotion";
  }
  if (experience.primary === "celebration") return "atmosphere";
  if (experience.primary === "trust") {
    return cluster === "authority" ? "subject" : "emotion";
  }
  if (experience.primary === "belonging") return "emotion";
  return "subject";
}

// Industries where the product itself is the hero (not the space/environment)
const PRODUCT_CENTRIC_ENV_INDUSTRIES = new Set([
  "jewellery_luxury", "fine_jewellery", "jewellery", "luxury_goods",
]);

// Industries where educational content is best shown through data/visualization
const DATA_EDUCATION_INDUSTRIES = new Set([
  "finance", "mutual_fund", "banking", "insurance", "wealth_management", "technology",
]);

// Hero type resolution: experience × cluster × luxury level × industryKey
function resolveHeroType(
  experience:  ExperienceProfile,
  cluster:     IndustryCluster,
  luxuryLevel: LuxuryProfile["level"],
  industryKey: string,
): HeroType {
  const primary = experience.primary;
  const isHighLuxury = luxuryLevel === "high" || luxuryLevel === "ultra_luxury";

  // Transformation and healing always produce a transformation visual
  if (primary === "transformation" || primary === "healing") return "transformation";

  // Celebration always produces a moment
  if (primary === "celebration") return "moment";

  // Education: data-heavy industries (finance, tech) → data visualization
  //            authority-first industries (dental, healthcare, school) → expert person
  //            others → data
  if (primary === "education") {
    if (cluster === "authority" && DATA_EDUCATION_INDUSTRIES.has(industryKey)) return "data";
    return cluster === "authority" ? "authority" : "data";
  }

  // Trust: authority industries use an expert, social-proof uses person, environmental uses environment
  if (primary === "trust") {
    if (cluster === "authority") return "authority";
    if (cluster === "social_proof") return "person";
    if (cluster === "environmental") return "environment";
    return "authority"; // balanced defaults to authority
  }

  // Luxury experience: environmental + product-centric → product; environmental + space-centric → environment
  if (primary === "luxury") {
    if (cluster === "environmental" && PRODUCT_CENTRIC_ENV_INDUSTRIES.has(industryKey)) return "product";
    if (cluster === "environmental") return "environment";
    if (cluster === "social_proof") return "person"; // wearing/using luxury
    return "environment"; // authority/balanced → luxury environment
  }

  // Aspiration × environmental:
  //   - product-centric industries (jewellery) → product (the piece is the aspiration)
  //   - space-centric industries (real estate, hotel) → environment
  if (primary === "aspiration") {
    if (cluster === "environmental" && PRODUCT_CENTRIC_ENV_INDUSTRIES.has(industryKey)) return "product";
    if (cluster === "environmental") return "environment";
    if (cluster === "social_proof") return "lifestyle";
    return "person";
  }

  // Discovery: environmental industries → product; data industries → data; else product
  if (primary === "discovery") {
    if (cluster === "environmental") return "product";
    if (cluster === "authority" && DATA_EDUCATION_INDUSTRIES.has(industryKey)) return "data";
    return "product";
  }

  // Belonging: environmental → environment; else person
  if (primary === "belonging") {
    return cluster === "environmental" ? "environment" : "person";
  }

  // Convenience: product in most cases
  if (primary === "convenience") return "product";

  // Default fallback
  return "person";
}

export function resolveCreativeMatrix(
  uu:        UserUnderstanding,
  experience: ExperienceProfile,
  luxury:    LuxuryProfile,
  marketing: MarketingIntelligence,
  audience:  AudienceIntelligence,
): CreativeMatrixResult {
  const industryKey = uu.subIndustry.value !== "unknown"
    ? uu.subIndustry.value
    : uu.industry.value !== "unknown"
    ? uu.industry.value
    : "";

  const cluster: IndustryCluster = INDUSTRY_CLUSTER_MAP[industryKey] ?? "balanced";
  const heroType = resolveHeroType(experience, cluster, luxury.level, industryKey);
  const compositionPriority = resolveCompositionPriority(experience, cluster);

  const visualArchetype = VISUAL_ARCHETYPES[experience.primary] ?? VISUAL_ARCHETYPES.aspiration;
  const emotionalDriver  = EMOTIONAL_DRIVERS[experience.primary]  ?? EMOTIONAL_DRIVERS.aspiration;

  const confidence: FieldConfidence = experience.confidence === "high" ? "high" : "medium";

  const reasoning = `Industry "${industryKey}" → cluster "${cluster}" + experience "${experience.primary}" + luxury "${luxury.level}" → hero type "${heroType}", composition "${compositionPriority}"`;

  return {
    visualArchetype,
    emotionalDriver,
    heroType,
    industryCluster: cluster,
    compositionPriority,
    confidence,
    reasoning,
  };
}
