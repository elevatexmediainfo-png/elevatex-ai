// Phase 5 — Creative Director knowledge banks.
// Campaign-level intelligence: the strategic decisions an award-winning
// Creative Director makes about every industry × goal combination.
// Pure data — no functions that generate prompts, copy, or layouts.

// ─────────────────────────────────────────────────────────────────────────────
// Campaign themes — the overarching creative territory
// ─────────────────────────────────────────────────────────────────────────────

const GENERIC_THEMES: Record<string, string> = {
  awareness:       "Introduce, Build Curiosity, Create Desire",
  lead_generation: "Earn Trust, Remove Barriers, Drive Action",
  sales:           "Make the Value Undeniable, Make the Decision Easy",
  trust:           "Prove It. Then Ask.",
  education:       "Understand First, Decide Confidently",
  engagement:      "Make Them Feel Something Worth Sharing",
  retention:       "Remember Why You Chose Us",
};

export const CAMPAIGN_THEMES: Record<string, Record<string, string>> = {
  dental: {
    education:       "Restore Your Confidence — From Knowledge to Action",
    lead_generation: "Expert Care, Real Results — Your Smile is Waiting",
    awareness:       "Your Smile Is Worth It",
    trust:           "Trusted Expertise. Natural Results. Peace of Mind.",
  },
  dental_clinic: {
    education:       "Restore Your Confidence — From Knowledge to Action",
    lead_generation: "Expert Care, Real Results — Your Smile is Waiting",
  },
  healthcare: {
    awareness:       "Your Health Is Your Future — Protect It Today",
    lead_generation: "Expert Care, Close to Home",
    trust:           "Proven Care. Trusted Outcomes.",
    education:       "Know More. Live Better.",
  },
  food_beverage: {
    awareness:       "Taste Something You'll Never Forget",
    engagement:      "Where Every Moment Becomes a Story",
    sales:           "Good Food Deserves to Be Shared",
  },
  restaurant: {
    awareness:       "Your Next Favourite Restaurant Just Opened",
    engagement:      "Food Worth Making Plans For",
  },
  real_estate: {
    awareness:       "The Life You've Always Imagined Starts Here",
    lead_generation: "Find Your Dream. Live Your Future.",
    sales:           "This Is What Home Should Feel Like",
  },
  luxury_property: {
    awareness:       "Not Just a Home. A Statement.",
    lead_generation: "Rare Opportunities. Lasting Value.",
  },
  finance: {
    education:       "Your Financial Freedom Starts Here",
    awareness:       "Wealth, Simplified",
    lead_generation: "The Smarter Way to Grow",
    trust:           "Your Money, Expertly Guided",
  },
  mutual_fund: {
    education:       "Start Small. Think Big. Grow Consistently.",
    awareness:       "SIP Your Way to Financial Freedom",
  },
  education: {
    lead_generation: "Shape Tomorrow, Starting Today",
    awareness:       "Every Child Deserves the Best",
    trust:           "Excellence You Can Measure",
  },
  beauty_wellness: {
    awareness:       "Reveal the Best Version of Yourself",
    lead_generation: "Your Transformation Begins With a Single Appointment",
    engagement:      "Because You Deserve to Feel This Good",
  },
  hair_salon: {
    awareness:       "Not Just a Haircut. A Transformation.",
    lead_generation: "Book the Change You've Been Waiting For",
  },
  jewellery_luxury: {
    sales:           "Crafted for Moments That Last Forever",
    awareness:       "Where Craft Meets Emotion",
    engagement:      "Wear What Defines You",
  },
  fine_jewellery: {
    sales:           "Crafted for Moments That Last Forever",
    awareness:       "Timeless Elegance, Perfectly Made",
  },
  automotive: {
    lead_generation: "Drive the Future, Today",
    awareness:       "Engineering Excellence, Reimagined",
    sales:           "The Car That Moves You — In Every Way",
  },
  hospitality: {
    awareness:       "Where Memories Are Made",
    sales:           "The Stay You'll Still Be Talking About",
  },
  retail: {
    awareness:       "Style That Speaks Before You Do",
    sales:           "The Collection You've Been Waiting For",
  },
};

export function getCampaignTheme(industryKey: string, campaignGoal: string): string {
  const industryThemes = CAMPAIGN_THEMES[industryKey] ?? {};
  const theme = industryThemes[campaignGoal] ?? GENERIC_THEMES[campaignGoal];
  return theme ?? "Make the Right Statement, at the Right Moment, to the Right Person";
}

// ─────────────────────────────────────────────────────────────────────────────
// Emotional hooks — the psychological triggers by campaign category
// ─────────────────────────────────────────────────────────────────────────────

export const EMOTIONAL_HOOKS: Record<string, string> = {
  awareness:         "curiosity",
  lead_generation:   "aspiration",
  sales:             "fomo",
  education:         "empowerment",
  trust:             "reassurance",
  engagement:        "identity",
  retention:         "trust",
  before_after:      "hope",
  event_announcement:"excitement",
  branding:          "identity",
  promotion:         "fomo",
  launch:            "excitement",
  offer:             "fomo",
  educational:       "empowerment",
  festival:          "excitement",
  corporate:         "trust",
  long_term_campaign:"identity",
};

// ─────────────────────────────────────────────────────────────────────────────
// Marketing angles — the strategic approach per industry × goal
// ─────────────────────────────────────────────────────────────────────────────

export const MARKETING_ANGLES: Record<string, Record<string, string>> = {
  healthcare:    { education: "education",    lead_generation: "fear_reduction",  trust: "authority", awareness: "social_proof" },
  finance:       { education: "education",    lead_generation: "social_proof",    trust: "authority", awareness: "education" },
  real_estate:   { awareness: "aspiration",   lead_generation: "aspiration",      sales: "social_proof" },
  education:     { lead_generation: "social_proof", awareness: "aspiration",      trust: "authority" },
  beauty_wellness:{ awareness: "transformation", lead_generation: "transformation",sales: "social_proof" },
  food_beverage: { awareness: "aspiration",   engagement: "community",            sales: "scarcity" },
  jewellery_luxury:{ sales: "aspiration",     awareness: "aspiration",            engagement: "community" },
  automotive:    { lead_generation: "aspiration", awareness: "aspiration",        sales: "fear_reduction" },
};

export function getMarketingAngle(industryKey: string, campaignGoal: string): string {
  return MARKETING_ANGLES[industryKey]?.[campaignGoal] ?? "problem_solution";
}

// ─────────────────────────────────────────────────────────────────────────────
// Section sequences — the ordered structure by campaign goal + buyer stage
// ─────────────────────────────────────────────────────────────────────────────

export const SECTION_SEQUENCES: Record<string, string> = {
  awareness:       "Hero → Emotional Story → Benefits → Brand → CTA",
  lead_generation: "Hero → Pain Point → Solution → Trust Proof → Social Proof → CTA",
  sales:           "Hero → Offer → Key Benefits → Trust Signals → Urgency → CTA",
  education:       "Hero → Problem Statement → Information → Process → Proof → CTA",
  trust:           "Hero → Credentials → Process Transparency → Social Proof → Benefits → CTA",
  engagement:      "Hero → Story → Community → Benefits → Brand → CTA",
  retention:       "Hero → Value Reminder → New Benefit → Loyalty Reward → CTA",
  event:           "Event Hero → Date/Time/Location → What to Expect → FOMO Driver → CTA",
};

export function getSectionSequence(campaignGoal: string, campaignCategory: string): string {
  return SECTION_SEQUENCES[campaignGoal]
    ?? SECTION_SEQUENCES[campaignCategory]
    ?? "Hero → Core Message → Supporting Proof → CTA";
}

// ─────────────────────────────────────────────────────────────────────────────
// Story flows — narrative arc by campaign goal
// ─────────────────────────────────────────────────────────────────────────────

export const STORY_FLOWS: Record<string, string> = {
  awareness:       "aspiration_delivery",
  lead_generation: "problem_solution",
  sales:           "emotion_proof_action",
  education:       "education_action",
  trust:           "trust_building",
  engagement:      "emotion_proof_action",
  retention:       "aspiration_delivery",
};

// ─────────────────────────────────────────────────────────────────────────────
// Camera moods — by industry and visual reasoning
// ─────────────────────────────────────────────────────────────────────────────

export const CAMERA_MOODS: Record<string, string> = {
  dental:           "Clean and reassuring — the camera conveys precision and warmth, clinical confidence without cold sterility",
  healthcare:       "Warm and humane — professional competence with genuine human care",
  food_beverage:    "Appetite-first — the camera makes the viewer hungry before they read a word",
  real_estate:      "Aspirational and scale-aware — every frame communicates lifestyle and investment quality",
  finance:          "Composed and trustworthy — quiet confidence, no flashy angles",
  education:        "Optimistic and energetic — capturing possibility and forward momentum",
  beauty_wellness:  "Intimate and flattering — soft, personal, transformative",
  jewellery_luxury: "Reverent and precise — the camera worships the craftsmanship",
  automotive:       "Dynamic and powerful — the camera communicates motion even in a still image",
  hospitality:      "Inviting and immersive — the viewer should feel they are almost already there",
  retail:           "Clean and editorial — the product is the star, presented with editorial dignity",
};

export function getCameraMood(industryKey: string): string {
  return CAMERA_MOODS[industryKey]
    ?? CAMERA_MOODS[industryKey.split("_")[0]]
    ?? "Professional and purposeful — every visual choice serves the message, nothing distracts";
}

// ─────────────────────────────────────────────────────────────────────────────
// Trust strategies — by trust requirement level and industry
// ─────────────────────────────────────────────────────────────────────────────

export const TRUST_STRATEGIES: Record<string, string> = {
  critical:    "credentials_first",
  high:        "results_first",
  medium:      "testimonials_first",
  low:         "statistics_first",
};

// ─────────────────────────────────────────────────────────────────────────────
// Conversion strategies — by campaign goal and urgency
// ─────────────────────────────────────────────────────────────────────────────

export const CONVERSION_STRATEGIES: Record<string, Record<string, string>> = {
  immediate: { lead_generation: "urgency_scarcity",  sales: "urgency_scarcity",  default: "low_barrier_cta" },
  high:      { lead_generation: "low_barrier_cta",   sales: "value_clarity",     default: "low_barrier_cta" },
  medium:    { lead_generation: "authority_directive",sales: "social_momentum",   default: "value_clarity" },
  low:       { default: "value_clarity" },
  none:      { default: "authority_directive" },
};

export function getConversionStrategy(urgency: string, campaignGoal: string): string {
  const map = CONVERSION_STRATEGIES[urgency] ?? CONVERSION_STRATEGIES.none;
  return map[campaignGoal] ?? map.default ?? "value_clarity";
}

// ─────────────────────────────────────────────────────────────────────────────
// Industry restrictions — legal / ethical / platform by industry
// ─────────────────────────────────────────────────────────────────────────────

export const INDUSTRY_RESTRICTIONS: Record<string, string> = {
  healthcare:      "No medical claims without qualification; no guaranteed treatment outcomes; no patient before/after imagery without explicit consent; use 'consult your doctor' disclaimer where applicable",
  finance:         "No guaranteed returns; include SEBI/regulatory disclaimer; no comparisons to specific competitor funds without current data; past performance disclaimer required",
  education:       "No misleading placement statistics; no fabricated testimonials; realistic outcome messaging only",
  jewellery_luxury:"Hallmark certification must be present or implied; ethical sourcing language where diamonds are featured",
  automotive:      "No unverified performance claims; safety feature messaging requires tested data",
  food_beverage:   "FSSAI license compliance; no health claims without certification; allergen transparency where relevant",
  beauty_wellness: "No extreme 'before/after' imagery that implies guaranteed results; no medical claims for cosmetic procedures",
};

export const INDUSTRY_MUSTS: Record<string, string> = {
  healthcare:      "Brand logo, clinic contact details, professional certification badge, 'Consult a Doctor' advisory",
  finance:         "Regulatory registration number, risk disclaimer, brand logo",
  education:       "Institution name, contact information, accreditation badge, academic year context",
  jewellery_luxury:"Brand hallmark or certification, contact/store location, collection name",
  automotive:      "Brand logo, dealer contact, model name, key specification callout",
  food_beverage:   "Restaurant name, address/reservation link, opening date if launch, signature dish image",
  beauty_wellness: "Salon name, booking contact, stylist credential or achievement if featuring transformation",
};

// Maps sub-industry keys to their parent top-level industry key so the
// restriction and must-appear lookups find the right row even for sub-industries
// whose names don't share a word with their parent (dental_clinic → healthcare,
// mutual_fund → finance, etc.).
const SUB_TO_PARENT_INDUSTRY: Record<string, string> = {
  dental_clinic:      "healthcare",
  dental:             "healthcare",
  general_hospital:   "healthcare",
  health_clinic:      "healthcare",
  mutual_fund:        "finance",
  banking:            "finance",
  insurance:          "finance",
  wealth_management:  "finance",
  restaurant:         "food_beverage",
  cafe:               "food_beverage",
  luxury_property:    "real_estate",
  residential:        "real_estate",
  school:             "education",
  college_university: "education",
  coaching_institute: "education",
  hair_salon:         "beauty_wellness",
  spa_wellness:       "beauty_wellness",
  skincare:           "beauty_wellness",
  fine_jewellery:     "jewellery_luxury",
  luxury_goods:       "jewellery_luxury",
  car_dealership:     "automotive",
  hotel_resort:       "hospitality",
  travel_agency:      "hospitality",
  fashion_clothing:   "retail",
};

export function getIndustryRestrictions(industryKey: string): { restrictions: string; musts: string } {
  const key = industryKey;
  const parentIndustry = SUB_TO_PARENT_INDUSTRY[key] ?? key;
  return {
    restrictions:
      INDUSTRY_RESTRICTIONS[key] ??
      INDUSTRY_RESTRICTIONS[parentIndustry] ??
      "Standard advertising standards apply — no misleading claims, no prohibited comparisons, no harmful stereotypes",
    musts:
      INDUSTRY_MUSTS[key] ??
      INDUSTRY_MUSTS[parentIndustry] ??
      "Brand logo, primary contact information, core message",
  };
}
