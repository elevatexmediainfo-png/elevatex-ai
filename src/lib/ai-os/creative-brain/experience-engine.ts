import type { UserUnderstanding, FieldConfidence } from "../types";
import type {
  ExperienceProfile,
  ExperienceType,
  MarketingIntelligence,
  AudienceIntelligence,
  CommunicationIntelligence,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 — Experience Engine
// Derives the experiential layer: what emotional/sensory journey is being sold.
// Pure function — no I/O, no side effects, fully deterministic.
// ─────────────────────────────────────────────────────────────────────────────

// Intent → primary experience mapping
const INTENT_TO_PRIMARY: Record<string, ExperienceType> = {
  before_after:        "transformation",
  testimonial:         "trust",
  lead_generation:     "trust",
  brand_building:      "aspiration",
  product_showcase:    "discovery",
  educational:         "education",
  informative:         "education",
  event_announcement:  "celebration",
  awareness:           "aspiration",
  promotional:         "aspiration",
};

// Campaign goal can override or strengthen the primary experience
const GOAL_TO_PRIMARY: Record<string, ExperienceType> = {
  trust:      "trust",
  education:  "education",
  engagement: "belonging",
  retention:  "belonging",
};

// Industry-specific secondary experience (layered on top of primary)
const INDUSTRY_SECONDARY: Record<string, ExperienceType> = {
  dental:            "healing",
  dental_clinic:     "healing",
  healthcare:        "healing",
  health_clinic:     "healing",
  general_hospital:  "healing",
  fitness:           "transformation",
  beauty_wellness:   "transformation",
  hair_salon:        "transformation",
  spa_wellness:      "healing",
  real_estate:       "luxury",
  luxury_property:   "luxury",
  residential:       "aspiration",
  jewellery_luxury:  "luxury",
  fine_jewellery:    "luxury",
  jewellery:         "luxury",
  luxury_goods:      "luxury",
  restaurant:        "belonging",
  cafe:              "belonging",
  food_beverage:     "belonging",
  catering:          "belonging",
  hospitality:       "belonging",
  hotel_resort:      "luxury",
  travel_agency:     "aspiration",
  finance:           "trust",
  banking:           "trust",
  mutual_fund:       "trust",
  insurance:         "trust",
  wealth_management: "trust",
  education:         "discovery",
  school:            "belonging",
  college_university:"discovery",
  coaching_institute:"discovery",
  automotive:        "aspiration",
  fashion:           "aspiration",
  retail:            "discovery",
  skincare:          "healing",
  technology:        "discovery",
};

const EMOTIONAL_CORE: Record<ExperienceType, string> = {
  transformation: "The before-and-after emotional journey — from problem to result",
  aspiration:     "The desire for a better life, status, or self-image",
  trust:          "Confidence that this brand or service is safe and reliable",
  luxury:         "The feeling of deserving and possessing something exceptional",
  belonging:      "Connection, warmth, and shared human experience",
  education:      "Clarity and empowerment through knowledge",
  convenience:    "Relief and ease — the problem solved effortlessly",
  celebration:    "Joy, occasion, and the marking of a special moment",
  discovery:      "Curiosity and excitement at something new or revealed",
  healing:        "Relief from pain or discomfort — physical or emotional",
};

const VISUAL_IMPLICATION: Record<ExperienceType, string> = {
  transformation: "A clear visual contrast or journey: before vs. after, dull vs. vibrant, problem vs. solution",
  aspiration:     "An elevated, desirable scene that makes the viewer want to be in it",
  trust:          "A composed, credible visual that communicates expertise and safety",
  luxury:         "Exquisite detail, craftsmanship, negative space, and premium lighting",
  belonging:      "Warm human moments, genuine connection, and inclusive energy",
  education:      "Clear, organized visual information — diagrams, process flows, or expert demonstration",
  convenience:    "Simple, clean visual of the ease or outcome — no clutter",
  celebration:    "Peak joyful moment: vibrant, warm, emotionally immediate",
  discovery:      "Dramatic reveal or unexpected angle that creates intrigue",
  healing:        "Calm, relief-conveying visual — peace after pain, glow after dullness",
};

export function buildExperienceProfile(
  uu:            UserUnderstanding,
  marketing:     MarketingIntelligence,
  audience:      AudienceIntelligence,
  communication: CommunicationIntelligence,
): ExperienceProfile {
  const intent    = uu.intent.value;
  const industryKey = uu.subIndustry.value !== "unknown" ? uu.subIndustry.value : uu.industry.value;
  const goal      = marketing.campaignGoal.value;
  const urgency   = communication.urgency.value;
  const awareness = audience.awarenessLevel.value;
  const commStyle = communication.communicationStyle.value;

  // Primary: before_after always transforms; goal override > intent mapping > default
  let primary: ExperienceType = "aspiration";
  if (intent === "before_after") {
    primary = "transformation";
  } else if (GOAL_TO_PRIMARY[goal]) {
    primary = GOAL_TO_PRIMARY[goal];
  } else if (INTENT_TO_PRIMARY[intent]) {
    primary = INTENT_TO_PRIMARY[intent];
  }

  // Secondary from industry
  const secondary: ExperienceType | "none" = INDUSTRY_SECONDARY[industryKey] ?? "none";

  // Intensity
  let intensity: ExperienceProfile["intensity"] = "medium";
  if (urgency === "immediate" || urgency === "high") {
    intensity = "high";
  } else if (urgency === "none" || urgency === "low") {
    intensity = "low";
  }
  // Luxury experience at luxury communication style → always high intensity
  if ((primary === "luxury" || secondary === "luxury") && commStyle === "luxury") {
    intensity = "high";
  }
  // Unaware audiences need stronger emotional punch
  if (awareness === "unaware" && goal === "awareness") {
    intensity = "high";
  }
  // Already-committed audience needs less intensity
  if (awareness === "most_aware") {
    intensity = "low";
  }

  // Confidence: high when both intent and industry are known
  let confidence: FieldConfidence = "medium";
  if (uu.intent.confidence === "high" && uu.industry.confidence === "high") confidence = "high";
  if (uu.intent.confidence === "unknown" || intent === "unknown") confidence = "low";

  const signals: string[] = [];
  if (intent !== "unknown") signals.push(`intent="${intent}"`);
  if (goal !== "unknown") signals.push(`goal="${goal}"`);
  if (industryKey !== "unknown") signals.push(`industry="${industryKey}"`);
  if (urgency !== "unknown") signals.push(`urgency="${urgency}"`);

  const reasoning = `Primary experience "${primary}" from [${signals.join(", ")}]. Secondary "${secondary}" from industry pattern. Intensity "${intensity}" (urgency="${urgency}", awareness="${awareness}").`;

  return {
    primary,
    secondary,
    intensity,
    emotionalCore:     EMOTIONAL_CORE[primary],
    visualImplication: VISUAL_IMPLICATION[primary],
    confidence,
    reasoning,
  };
}
