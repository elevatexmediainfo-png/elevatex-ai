import type {
  CreativeRequest, UserIntent, UnderstandingField, UserUnderstanding, FieldConfidence,
  IntelligenceField, CustomerAwarenessLevel,
  ExtractedPainPoint, PainPointCategory,
  ExtractedUsp, UspCategory,
  AudienceResolution,
  DetectedOffer, OfferType,
  AuthoritySignal, AuthoritySignalType,
  SocialProofSignal, SocialProofType,
} from "../types";

// Phase 2 — User Understanding Engine.
// Transforms a raw user idea into structured business intelligence across
// 25 dimensions. Pure functions only — no LLM, no DB, no I/O, no prompt
// generation, no marketing reasoning. Every detector is deterministic and
// synchronous. Cross-field inference runs after primary detection so inferred
// values are always labelled "inferred from X" in their reason strings.

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary aware match — prevents "gold" matching "golden", etc. */
function hasWord(text: string, keyword: string): boolean {
  return new RegExp(`\\b${esc(keyword)}\\b`, "i").test(text);
}

/** Returns true if ANY keyword in the list matches using word-boundary rules. */
function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => hasWord(text, kw));
}

/** Returns the first matching keyword string, or undefined. */
function firstMatch(text: string, keywords: string[]): string | undefined {
  return keywords.find((kw) => hasWord(text, kw));
}

function field<T extends string>(
  value: T | "unknown",
  confidence: FieldConfidence,
  reason: string
): UnderstandingField<T> {
  return { value, confidence, reason } as UnderstandingField<T>;
}

function unknownField(fieldName: string): UnderstandingField {
  return field("unknown", "unknown", `No signals found for ${fieldName} in the provided idea`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Language detection
// ─────────────────────────────────────────────────────────────────────────────

const DEVANAGARI_RE = /[ऀ-ॿ]/;
const MIXED_RE = /[a-zA-Z]/;

export function detectLanguage(text: string): UnderstandingField<"english" | "hindi" | "mixed"> {
  const hasDevanagari = DEVANAGARI_RE.test(text);
  const hasLatin = MIXED_RE.test(text);
  if (hasDevanagari && hasLatin) return field("mixed", "high", `Language "mixed" — both Devanagari and Latin scripts found in the same idea; content will need bilingual treatment`);
  if (hasDevanagari) return field("hindi", "high", `Language "hindi" — Devanagari script characters detected; creative pipeline will use Hindi-language context`);
  return field("english", "high", `Language "english" — Latin script only detected; defaulting to English content context`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Industry + Sub-industry
// ─────────────────────────────────────────────────────────────────────────────

interface IndustryDef {
  key: string;
  label: string;
  keywords: string[];
  subIndustries: Array<{ key: string; label: string; keywords: string[] }>;
}

const INDUSTRIES: IndustryDef[] = [
  {
    key: "healthcare",
    label: "Healthcare",
    keywords: ["dental", "dentist", "tooth", "teeth", "implant", "orthodont", "hospital", "clinic", "medical", "doctor", "health", "patient", "healthcare", "surgery", "treatment", "checkup", "smile restoration", "oral health", "dental care"],
    subIndustries: [
      { key: "dental_clinic", label: "Dental Clinic", keywords: ["dental", "dentist", "tooth", "teeth", "implant", "orthodont", "smile clinic", "smile", "restoration", "implant surgery", "smile restoration", "dental care", "oral"] },
      { key: "general_hospital", label: "Hospital / Medical Centre", keywords: ["hospital", "medical center", "healthcare center", "multi-specialty"] },
      { key: "health_clinic", label: "Health Clinic", keywords: ["clinic", "checkup", "health checkup", "health camp", "screening"] },
    ],
  },
  {
    key: "food_beverage",
    label: "Food & Beverage",
    keywords: ["restaurant", "dining", "cafe", "café", "food", "dish", "bistro", "menu", "chef", "cuisine", "eat", "drink", "bakery", "catering", "eatery"],
    subIndustries: [
      { key: "restaurant", label: "Restaurant", keywords: ["restaurant", "dining", "bistro", "eatery", "diner"] },
      { key: "cafe", label: "Café / Coffee Shop", keywords: ["cafe", "café", "coffee", "bakery"] },
      { key: "catering", label: "Catering / Food Service", keywords: ["catering", "food service", "canteen"] },
    ],
  },
  {
    key: "real_estate",
    label: "Real Estate",
    keywords: ["villa", "real estate", "property", "home", "apartment", "residence", "estate", "architecture", "house", "plot", "flat", "bungalow", "township"],
    subIndustries: [
      { key: "luxury_property", label: "Luxury Property", keywords: ["villa", "luxury", "premium", "penthouse", "bungalow"] },
      { key: "residential", label: "Residential Real Estate", keywords: ["apartment", "flat", "home", "house", "residence", "township", "plot"] },
      { key: "commercial", label: "Commercial Real Estate", keywords: ["office", "commercial", "workspace", "co-working"] },
    ],
  },
  {
    key: "finance",
    label: "Finance & Investment",
    keywords: ["mutual fund", "sip", "investment", "finance", "bank", "insurance", "wealth", "stock", "portfolio", "loan", "fd", "nps", "ipo", "trading", "financial"],
    subIndustries: [
      { key: "mutual_fund", label: "Mutual Fund / SIP", keywords: ["mutual fund", "sip", "portfolio", "nfo", "ipo"] },
      { key: "banking", label: "Banking", keywords: ["bank", "savings", "account", "loan", "fd", "fixed deposit", "recurring"] },
      { key: "insurance", label: "Insurance", keywords: ["insurance", "policy", "life cover", "term plan", "health insurance"] },
      { key: "wealth_management", label: "Wealth Management", keywords: ["wealth", "financial planning", "retirement", "nps"] },
    ],
  },
  {
    key: "education",
    label: "Education",
    keywords: ["school", "college", "university", "admission", "campus", "academic", "student", "learning", "education", "course", "class", "teacher", "faculty", "institute", "coaching"],
    subIndustries: [
      { key: "school", label: "School", keywords: ["school", "cbse", "icse", "ib", "primary", "secondary", "k-12"] },
      { key: "college_university", label: "College / University", keywords: ["college", "university", "degree", "undergraduate", "postgraduate", "campus"] },
      { key: "coaching_institute", label: "Coaching / Training Institute", keywords: ["coaching", "institute", "training", "course", "certification"] },
    ],
  },
  {
    key: "beauty_wellness",
    label: "Beauty & Wellness",
    keywords: ["salon", "spa", "beauty", "hair", "skincare", "makeup", "wellness", "grooming", "skin", "facial", "massage", "transformation"],
    subIndustries: [
      { key: "hair_salon", label: "Hair Salon", keywords: ["salon", "hair", "haircut", "styling", "keratin", "balayage"] },
      { key: "spa_wellness", label: "Spa / Wellness Centre", keywords: ["spa", "massage", "wellness", "relaxation", "therapy"] },
      { key: "skincare", label: "Skincare / Beauty", keywords: ["skincare", "skin", "facial", "makeup", "beauty"] },
    ],
  },
  {
    key: "jewellery_luxury",
    label: "Jewellery & Luxury",
    keywords: ["jewellery", "jewelry", "diamond", "ring", "necklace", "gold", "gemstone", "watch", "luxury brand", "designer", "accessory"],
    subIndustries: [
      { key: "fine_jewellery", label: "Fine Jewellery", keywords: ["jewellery", "jewelry", "diamond", "ring", "necklace", "gold", "gemstone"] },
      { key: "luxury_goods", label: "Luxury Goods / Watch", keywords: ["watch", "luxury brand", "designer"] },
    ],
  },
  {
    key: "automotive",
    label: "Automotive",
    keywords: ["car", "vehicle", "showroom", "motor", "sedan", "suv", "automotive", "automobile", "dealership", "test drive", "launch"],
    subIndustries: [
      { key: "car_dealership", label: "Car Dealership / Showroom", keywords: ["showroom", "dealership", "test drive", "car launch"] },
      { key: "auto_service", label: "Auto Service / Workshop", keywords: ["service centre", "workshop", "repair", "garage"] },
    ],
  },
  {
    key: "hospitality",
    label: "Hospitality & Travel",
    keywords: ["hotel", "resort", "travel", "tourism", "holiday", "vacation", "trip", "tour", "accommodation", "staycation"],
    subIndustries: [
      { key: "hotel_resort", label: "Hotel / Resort", keywords: ["hotel", "resort", "stay", "accommodation", "staycation"] },
      { key: "travel_agency", label: "Travel Agency / Tour", keywords: ["travel", "tourism", "tour", "trip", "vacation", "holiday"] },
    ],
  },
  {
    key: "retail",
    label: "Retail & Fashion",
    keywords: ["fashion", "clothing", "apparel", "store", "collection", "brand", "shop", "shopping", "outfit", "style"],
    subIndustries: [
      { key: "fashion_clothing", label: "Fashion / Clothing", keywords: ["fashion", "clothing", "apparel", "outfit", "style", "collection"] },
      { key: "retail_store", label: "Retail Store", keywords: ["store", "shop", "shopping", "brand outlet"] },
    ],
  },
];

export function detectIndustry(text: string): { industry: string; subIndustry: string; confidence: FieldConfidence } {
  for (const ind of INDUSTRIES) {
    if (matchesAny(text, ind.keywords)) {
      // Find the best sub-industry match
      const subMatched = ind.subIndustries.find((sub) => matchesAny(text, sub.keywords));
      return {
        industry: ind.key,
        subIndustry: subMatched ? subMatched.key : ind.subIndustries[0]?.key ?? ind.key,
        confidence: subMatched ? "high" : "medium",
      };
    }
  }
  return { industry: "general", subIndustry: "general", confidence: "unknown" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent detection
// ─────────────────────────────────────────────────────────────────────────────

const INTENT_PATTERNS: Array<{ value: string; keywords: string[] }> = [
  { value: "before_after",      keywords: ["before after", "before and after", "transformation"] },
  { value: "testimonial",       keywords: ["testimonial", "review", "success story", "case study", "patient story"] },
  { value: "educational",       keywords: ["how to", "what is", "guide", "steps", "process", "learn", "educate", "understand", "explained"] },
  { value: "informative",       keywords: ["informative", "information", "awareness", "precaution", "tip", "fact"] },
  { value: "product_showcase",  keywords: ["product", "showcase", "feature", "highlight", "new arrival", "collection launch"] },
  { value: "event_announcement",keywords: ["grand opening", "opening", "launch event", "inauguration", "event", "festival", "celebration", "ceremony"] },
  { value: "promotional",       keywords: ["sale", "offer", "discount", "promo", "deal", "limited", "exclusive", "% off", "save"] },
  { value: "lead_generation",   keywords: ["consultation", "inquiry", "contact", "book", "appointment", "call us", "get a quote", "free trial"] },
  { value: "awareness",         keywords: ["awareness", "campaign", "spread", "raise awareness", "world day"] },
  { value: "brand_building",    keywords: ["brand", "trust", "heritage", "story", "philosophy", "values", "since", "years of"] },
];

export function detectIntent(text: string): UnderstandingField {
  for (const { value, keywords } of INTENT_PATTERNS) {
    const matched = firstMatch(text, keywords);
    if (matched) return field(value, "high", `Intent "${value}" detected — keyword "${matched}" found in the request, indicating a ${value.replace(/_/g, " ")} type of creative`);
  }
  return unknownField("intent");
}

// ─────────────────────────────────────────────────────────────────────────────
// Campaign goal
// ─────────────────────────────────────────────────────────────────────────────

const CAMPAIGN_GOAL_PATTERNS: Array<{ value: string; keywords: string[] }> = [
  { value: "lead_capture",     keywords: ["consultation", "inquiry", "form", "sign up", "register", "book", "apply"] },
  { value: "event_attendance", keywords: ["join us", "attend", "rsvp", "opening", "event", "festival", "ceremony"] },
  { value: "conversion",       keywords: ["buy", "purchase", "shop", "order", "pay", "sale", "discount", "offer"] },
  { value: "awareness",        keywords: ["awareness", "know", "introduce", "launch", "announce", "now open"] },
  { value: "consideration",    keywords: ["learn more", "find out", "discover", "explore", "compare", "see why"] },
];

export function detectCampaignGoal(text: string): UnderstandingField {
  for (const { value, keywords } of CAMPAIGN_GOAL_PATTERNS) {
    const matched = firstMatch(text, keywords);
    if (matched) return field(value, "high", `Keyword matched: "${matched}"`);
  }
  return unknownField("campaignGoal");
}

// ─────────────────────────────────────────────────────────────────────────────
// Business goal
// ─────────────────────────────────────────────────────────────────────────────

const BUSINESS_GOAL_PATTERNS: Array<{ value: string; keywords: string[] }> = [
  { value: "generate_leads",    keywords: ["consultation", "inquiry", "book", "appointment", "call", "get a quote"] },
  { value: "drive_sales",       keywords: ["buy", "purchase", "shop", "sale", "offer", "discount"] },
  { value: "announce_launch",   keywords: ["grand opening", "now open", "launching", "introducing", "announcing", "new branch"] },
  { value: "promote_offer",     keywords: ["offer", "deal", "discount", "limited time", "promo", "% off", "save"] },
  { value: "educate_audience",  keywords: ["informative", "education", "how to", "guide", "learn", "awareness", "understand"] },
  { value: "build_trust",       keywords: ["certified", "experienced", "trusted", "expertise", "quality", "guarantee", "reliable"] },
  { value: "increase_awareness",keywords: ["awareness", "campaign", "brand", "know us", "discover", "introduce"] },
];

export function detectBusinessGoal(text: string): UnderstandingField {
  for (const { value, keywords } of BUSINESS_GOAL_PATTERNS) {
    const matched = firstMatch(text, keywords);
    if (matched) return field(value, "high", `Keyword matched: "${matched}"`);
  }
  return unknownField("businessGoal");
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform + Output format
// ─────────────────────────────────────────────────────────────────────────────

interface PlatformDef { value: string; format: string; keywords: string[]; kindSignal?: string }

const PLATFORM_DEFS: PlatformDef[] = [
  { value: "story",     format: "story_vertical", keywords: ["story", "stories", "reel"] },
  { value: "instagram", format: "square",          keywords: ["instagram", "instagram post", "instagram feed"] },
  { value: "facebook",  format: "landscape",       keywords: ["facebook", "fb", "facebook post", "facebook ad"] },
  { value: "linkedin",  format: "landscape",       keywords: ["linkedin"] },
  { value: "pinterest", format: "portrait",        keywords: ["pinterest", "pin"] },
  { value: "twitter",   format: "landscape",       keywords: ["twitter", "x post", "tweet"] },
  { value: "poster",    format: "poster_portrait", keywords: ["poster", "flyer", "brochure"] },
  { value: "billboard", format: "landscape",       keywords: ["banner", "billboard", "hoardings", "outdoor"] },
];

export function detectPlatform(
  text: string,
  kind?: string,
  presetKey?: string
): { platform: UnderstandingField; outputFormat: UnderstandingField } {
  // PresetKey is the most direct signal available
  if (presetKey) {
    const presetPlatformMap: Record<string, { platform: string; format: string }> = {
      instagram_post:     { platform: "instagram", format: "square" },
      instagram_portrait: { platform: "instagram", format: "portrait" },
      instagram_story:    { platform: "story",     format: "story_vertical" },
      instagram_carousel: { platform: "instagram", format: "square" },
      facebook_post:      { platform: "facebook",  format: "square" },
      facebook_feed:      { platform: "facebook",  format: "portrait" },
      facebook_cover:     { platform: "facebook",  format: "landscape" },
      pinterest_pin:      { platform: "pinterest", format: "portrait" },
      linkedin_post:      { platform: "linkedin",  format: "landscape" },
      twitter_post:       { platform: "twitter",   format: "landscape" },
      poster:             { platform: "poster",    format: "poster_portrait" },
      flyer:              { platform: "poster",    format: "poster_portrait" },
      banner:             { platform: "billboard", format: "landscape" },
    };
    const mapped = presetPlatformMap[presetKey];
    if (mapped) {
      return {
        platform: field(mapped.platform, "high", `Resolved from presetKey="${presetKey}"`),
        outputFormat: field(mapped.format, "high", `Resolved from presetKey="${presetKey}"`),
      };
    }
  }

  // kind as a secondary signal
  if (kind === "MARKETING_CREATIVE") {
    // Keyword match within the idea for specific platform
    for (const def of PLATFORM_DEFS) {
      const matched = firstMatch(text, def.keywords);
      if (matched) {
        return {
          platform: field(def.value, "high", `Keyword matched: "${matched}"`),
          outputFormat: field(def.format, "high", `Format inferred from platform "${def.value}"`),
        };
      }
    }
    return {
      platform: field("poster", "medium", `kind=MARKETING_CREATIVE with no specific platform keyword`),
      outputFormat: field("poster_portrait", "medium", "Inferred from MARKETING_CREATIVE kind"),
    };
  }

  if (kind === "SOCIAL_MEDIA") {
    for (const def of PLATFORM_DEFS) {
      const matched = firstMatch(text, def.keywords);
      if (matched) {
        return {
          platform: field(def.value, "high", `Keyword matched: "${matched}"`),
          outputFormat: field(def.format, "high", `Format inferred from platform "${def.value}"`),
        };
      }
    }
    return {
      platform: field("instagram", "medium", `kind=SOCIAL_MEDIA with no specific platform keyword — defaulting to Instagram`),
      outputFormat: field("square", "medium", "Inferred from SOCIAL_MEDIA kind default"),
    };
  }

  // Text-only matching
  for (const def of PLATFORM_DEFS) {
    const matched = firstMatch(text, def.keywords);
    if (matched) {
      return {
        platform: field(def.value, "high", `Keyword matched: "${matched}"`),
        outputFormat: field(def.format, "high", `Format inferred from platform "${def.value}"`),
      };
    }
  }

  return {
    platform: unknownField("platform"),
    outputFormat: field("square", "low", "No platform signal — defaulting to square"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Urgency
// ─────────────────────────────────────────────────────────────────────────────

const URGENCY_PATTERNS: Array<{ value: string; keywords: string[] }> = [
  { value: "immediate", keywords: ["today only", "last chance", "ending soon", "expires today", "hurry", "limited seats", "only x left"] },
  { value: "high",      keywords: ["limited time", "this week", "deadline", "closes", "soon", "offer ends", "book now", "act now"] },
  { value: "medium",    keywords: ["sale", "offer", "grand opening", "launch", "early bird"] },
  { value: "low",       keywords: ["upcoming", "coming soon", "register now", "enroll"] },
];

export function detectUrgency(text: string): UnderstandingField {
  for (const { value, keywords } of URGENCY_PATTERNS) {
    const matched = firstMatch(text, keywords);
    if (matched) return field(value, "high", `Urgency "${value}" detected — keyword "${matched}" signals a time-sensitive or action-driven creative`);
  }
  return field("none", "medium", `Urgency "none" — no deadline, scarcity, or time-pressure keywords found; this is a standard evergreen creative`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Seasonality
// ─────────────────────────────────────────────────────────────────────────────

const SEASONALITY_PATTERNS: Array<{ value: string; keywords: string[] }> = [
  { value: "wedding_season",   keywords: ["wedding", "bridal", "shaadi", "marriage", "engagement", "anniversary"] },
  { value: "festival_season",  keywords: ["diwali", "navratri", "eid", "christmas", "holi", "festival", "festive", "celebration", "puja", "onam", "ugadi"] },
  { value: "academic_season",  keywords: ["admission", "new session", "academic year", "enrollment", "back to school", "semester"] },
  { value: "financial_year",   keywords: ["financial year", "tax saving", "itr", "fy", "march", "investment deadline", "tax filing"] },
  { value: "summer",           keywords: ["summer", "vacation", "holiday offer", "summer camp"] },
  { value: "monsoon",          keywords: ["monsoon", "rainy season", "rain"] },
];

export function detectSeasonality(text: string): UnderstandingField {
  for (const { value, keywords } of SEASONALITY_PATTERNS) {
    const matched = firstMatch(text, keywords);
    if (matched) return field(value, "high", `Keyword matched: "${matched}"`);
  }
  return field("none", "medium", "No seasonal keywords detected");
}

// ─────────────────────────────────────────────────────────────────────────────
// Product context
// ─────────────────────────────────────────────────────────────────────────────

export function detectProductContext(text: string): UnderstandingField {
  if (matchesAny(text, ["event", "grand opening", "festival", "concert", "exhibition", "webinar", "conference"])) {
    return field("event", "high", "Event or occasion keywords detected");
  }
  if (matchesAny(text, ["course", "guide", "tutorial", "information", "tip", "awareness", "knowledge"])) {
    return field("information", "high", "Educational / informational content detected");
  }
  if (matchesAny(text, ["app", "software", "platform", "digital", "online", "website", "saas"])) {
    return field("digital_product", "high", "Digital product keywords detected");
  }
  if (matchesAny(text, ["jewellery", "jewelry", "product", "collection", "item", "gadget", "device", "bag", "shoe"])) {
    return field("physical_product", "high", "Physical product keywords detected");
  }
  // Services are the most common default for most industry types
  if (matchesAny(text, ["clinic", "salon", "hospital", "bank", "school", "restaurant", "agency", "firm", "centre", "center"])) {
    return field("service", "high", "Service business keywords detected");
  }
  return field("service", "low", "Defaulting to service — no specific product type detected");
}

// ─────────────────────────────────────────────────────────────────────────────
// Content type
// ─────────────────────────────────────────────────────────────────────────────

export function detectContentType(text: string, intentValue: string): UnderstandingField {
  if (intentValue === "before_after" || matchesAny(text, ["before after", "before and after", "transformation"])) {
    return field("before_after_split", "high",
      "Before/after split format detected — text contains transformation keywords that signal a side-by-side comparison layout");
  }
  // "infographic" is only returned when the user explicitly requests it.
  // "informative" intent alone does NOT produce infographic — that is a Creative Director decision.
  if (matchesAny(text, ["infographic", "checklist"])) {
    return field("infographic", "high",
      "User explicitly requested infographic format — the keyword 'infographic' or 'checklist' appears in the idea");
  }
  if (matchesAny(text, ["compare", "vs", "versus", "difference", "better", "alternative"])) {
    return field("comparison", "high",
      "Comparison content type detected — keywords signal the user wants a side-by-side or alternative-comparison layout");
  }
  if (matchesAny(text, ["image only", "no text", "photo only", "just image", "visual only"])) {
    return field("image_only", "high",
      "Image-only format detected — user explicitly requested a text-free visual");
  }
  return field("image_with_text", "medium",
    "Standard commercial advertising format — image with text overlays is the neutral default");
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand context
// ─────────────────────────────────────────────────────────────────────────────

export function detectBrandContext(text: string): UnderstandingField {
  if (matchesAny(text, ["since", "years of", "established", "founded", "decade", "legacy", "trusted since"])) {
    return field("established_brand", "high", "Brand history / longevity keywords detected");
  }
  if (matchesAny(text, ["launching", "introducing", "new brand", "starting", "opening soon", "new clinic", "new restaurant", "grand opening"])) {
    return field("new_brand", "high", "Brand launch / new opening keywords detected");
  }
  return field("unknown", "unknown", "No brand maturity signals in idea text");
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-field inference rules
// All "inferred from X" values have confidence "medium" since they're derived,
// not directly detected.
// ─────────────────────────────────────────────────────────────────────────────

interface InferenceContext {
  industry: string;
  subIndustry: string;
  intent: string;
  urgency: string;
  seasonality: string;
  platform: string;
  productContext: string;
}

function inferBusinessCategory(ctx: InferenceContext): UnderstandingField {
  const { industry, subIndustry } = ctx;
  if (["jewellery_luxury", "real_estate"].includes(industry) || subIndustry === "luxury_property") {
    return field("premium_luxury", "medium", `Inferred from industry="${industry}" — premium/luxury positioning`);
  }
  if (["finance"].includes(industry)) {
    return field("financial_service", "medium", `Inferred from industry="finance"`);
  }
  if (["education"].includes(industry)) {
    return field("educational_institution", "medium", `Inferred from industry="education"`);
  }
  if (["food_beverage", "beauty_wellness", "automotive", "healthcare"].includes(industry)) {
    return field("local_service", "medium", `Inferred from industry="${industry}" — typically local service businesses`);
  }
  if (["retail"].includes(industry)) {
    return field("retail", "medium", `Inferred from industry="retail"`);
  }
  return unknownField("businessCategory");
}

function inferAudienceType(ctx: InferenceContext): UnderstandingField {
  const { industry, subIndustry } = ctx;
  const audienceMap: Record<string, string> = {
    dental_clinic: "general_consumers",
    general_hospital: "general_consumers",
    health_clinic: "general_consumers",
    restaurant: "general_consumers",
    cafe: "young_adults",
    mutual_fund: "working_professionals",
    banking: "working_professionals",
    insurance: "families",
    wealth_management: "affluent_individuals",
    school: "parents",
    college_university: "students",
    coaching_institute: "students",
    hair_salon: "young_adults",
    spa_wellness: "general_consumers",
    fine_jewellery: "affluent_individuals",
    car_dealership: "working_professionals",
    luxury_property: "affluent_individuals",
    residential: "families",
    hotel_resort: "general_consumers",
  };
  const value = audienceMap[subIndustry];
  if (value) return field(value, "medium", `Inferred from sub-industry="${subIndustry}"`);
  if (industry === "education") return field("parents", "medium", `Inferred from industry="education" — parents as primary decision makers`);
  return field("general_consumers", "low", "Defaulting to general consumers — no specific audience signal");
}

// audienceConfidence removed (Fix 5) — redundant with audienceType.confidence.
// The Creative Brain reads audienceType.confidence directly.

function inferTrustRequirement(industry: string): UnderstandingField {
  if (["healthcare", "finance"].includes(industry)) {
    return field("critical", "high", `Trust level "critical" inferred from industry "${industry}" — healthcare and finance are regulated, high-stakes categories where credibility is a purchase prerequisite`);
  }
  if (["education", "real_estate", "automotive"].includes(industry)) {
    return field("high", "high", `Trust level "high" inferred from industry "${industry}" — high-consideration purchase where the audience needs strong credibility signals before acting`);
  }
  if (["beauty_wellness", "hospitality", "food_beverage"].includes(industry)) {
    return field("medium", "medium", `Trust level "medium" inferred from industry "${industry}" — moderate trust expectation, quality signals are important but not a purchase blocker`);
  }
  return field("low", "low", `Trust level "low" — no high-stakes industry detected, standard commercial credibility is sufficient`);
}

function inferEducationLevel(industry: string, intent: string, subIndustry: string): UnderstandingField {
  const highEducation = ["mutual_fund", "dental_clinic", "insurance"];
  if (highEducation.includes(subIndustry)) {
    return field("high", "high", `Education level "high" inferred from sub-industry "${subIndustry}" — this category has a complex concept (dental implants, SIP investing, insurance policies) that most consumers don't fully understand; the creative must explain`);
  }
  if (["educational", "informative"].includes(intent)) {
    return field("medium", "high", `Education level "medium" — intent "${intent}" signals the creative exists to explain or inform, not just to sell`);
  }
  if (["finance", "healthcare"].includes(industry)) {
    return field("medium", "medium", `Education level "medium" inferred from industry "${industry}" — these categories typically benefit from some explanation even in commercial creatives`);
  }
  if (intent === "event_announcement") {
    return field("none", "high", `Education level "none" — event announcements communicate a single fact (what, when, where) and require no concept education`);
  }
  return field("low", "medium", `Education level "low" — no complex concept detected; the creative can assume the audience already understands the category`);
}

function inferCommunicationStyle(industry: string, intent: string, urgency: string): UnderstandingField {
  if (["jewellery_luxury", "real_estate"].includes(industry)) {
    return field("luxurious", "high", `Communication style "luxurious" inferred from industry "${industry}" — aspirational category requires refined, unhurried, premium tone`);
  }
  if (urgency === "immediate" || urgency === "high") {
    return field("urgent", "high", `Communication style "urgent" — high urgency signal detected, action-driving tone overrides all other style signals`);
  }
  if (["educational", "informative"].includes(intent)) {
    return field("educational", "high", `Communication style "educational" — intent "${intent}" means the creative must explain clearly, not just persuade`);
  }
  if (["healthcare"].includes(industry)) {
    return field("professional", "high", `Communication style "professional" inferred from healthcare industry — clinical authority combined with human warmth`);
  }
  if (["food_beverage", "beauty_wellness", "hospitality"].includes(industry)) {
    return field("warm_friendly", "medium", `Communication style "warm_friendly" inferred from industry "${industry}" — sensory and experience-led category benefits from inviting, personal tone`);
  }
  if (intent === "brand_building") {
    return field("inspirational", "medium", `Communication style "inspirational" — brand building intent signals a long-form relationship narrative, not a transactional message`);
  }
  return field("professional", "low", `Communication style defaults to "professional" — no industry or intent signal strong enough to override the commercial standard`);
}

function inferEmotion(industry: string, intent: string): UnderstandingField {
  if (intent === "before_after") return field("transformation", "high", `Emotion "transformation" — before/after intent exists to show a change in the viewer's life; transformation is the dominant emotional driver`);
  if (intent === "testimonial") return field("trust", "high", `Emotion "trust" — testimonial content builds credibility through social proof; trust is the primary emotional outcome`);
  if (intent === "promotional" || intent === "event_announcement") return field("excitement", "high", `Emotion "excitement" — ${intent} intent drives urgency and enthusiasm; excitement motivates immediate response`);
  if (["jewellery_luxury", "real_estate"].includes(industry)) return field("aspiration", "high", `Emotion "aspiration" inferred from industry "${industry}" — aspirational emotion sells the lifestyle, not just the product`);
  if (["healthcare"].includes(industry)) return field("trust", "high", `Emotion "trust" inferred from healthcare industry — patients make decisions under anxiety; reassurance and credibility are the dominant emotions`);
  if (["education"].includes(industry)) return field("pride", "medium", `Emotion "pride" inferred from education industry — achievement, belonging, and future potential are the core emotional drivers for students and parents`);
  if (["finance"].includes(industry)) return field("trust", "medium", `Emotion "trust" inferred from finance industry — financial decisions require security; trust is the foundational emotional requirement`);
  if (["beauty_wellness"].includes(industry)) return field("transformation", "medium", `Emotion "transformation" inferred from beauty industry — self-improvement and visible change are the core emotional promises`);
  if (["food_beverage", "hospitality"].includes(industry)) return field("joy", "medium", `Emotion "joy" inferred from industry "${industry}" — sensory pleasure, social connection, and appetite-driven delight are the primary emotional hooks`);
  if (intent === "awareness") return field("curiosity", "medium", `Emotion "curiosity" — awareness campaigns introduce something unfamiliar; curiosity is the emotion that drives discovery`);
  return unknownField("emotion");
}

// visualComplexity and creativeComplexity removed (Fixes 2 & 3).
// These are creative format judgments that belong in the Creative Brain (Phase 4),
// not in User Understanding (Phase 1). The Creative Brain now computes both fields
// from industry, intent, education level, and luxury signals using StrategyField reasoning.

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 Enrichment — Fix 1: Customer Awareness (Eugene Schwartz Model)
// ─────────────────────────────────────────────────────────────────────────────

// Checked in priority order: most_aware → product_aware → solution_aware → problem_aware → unaware

const MOST_AWARE_KEYWORDS = [
  "need appointment", "want appointment", "book appointment", "make appointment",
  "schedule appointment", "fix appointment", "book a consultation", "need consultation",
  "book now", "order now", "buy now", "call now", "contact us now", "call us now",
  "whatsapp now", "get in touch now", "enquire now", "inquire now",
  "register now", "apply now", "enroll now", "sign up now", "claim now",
  "get quote", "get pricing", "request callback",
];

const PRODUCT_AWARE_KEYWORDS = [
  "best dental", "best clinic", "best hospital", "best doctor", "best implant",
  "top rated", "number one", "no 1", "#1 rated", "leading clinic",
  "how much does", "cost of implant", "price of", "rate of", "what is the cost",
  "compare", "versus", "which is better", "alternative to",
  "recommend a", "suggest a", "which clinic", "which hospital",
  "most popular", "highest rated", "best quality",
];

const SOLUTION_AWARE_KEYWORDS = [
  "looking for", "searching for", "seeking", "finding",
  "need a", "need an", "want a", "want an",
  "considering", "thinking about", "planning to get", "exploring options",
  "where to get", "where can i get", "who provides", "find a doctor",
  "find a clinic", "find a hospital", "options for", "services for",
];

const PROBLEM_AWARE_KEYWORDS = [
  "problem", "issue", "pain", "afraid", "fear", "scared", "nervous",
  "anxiety", "worried about", "concern", "suffering from",
  "struggling with", "difficulty", "challenge", "trouble",
  "hurt", "ache", "broken tooth", "missing tooth", "tooth loss",
  "embarrassed", "embarrassing", "self conscious about",
  "unhappy with my", "hate my", "not comfortable with",
  "can't afford", "cannot afford", "delaying treatment",
  "avoiding dentist", "avoiding doctor",
];

export function detectCustomerAwareness(text: string): IntelligenceField<CustomerAwarenessLevel> {
  const mk = firstMatch(text, MOST_AWARE_KEYWORDS);
  if (mk) return {
    value: "most_aware",
    confidence: "high",
    reasoning: `Detected because action keyword "${mk}" signals the target audience is ready to book or act immediately.`,
    source: "user_explicit",
  };

  const pk = firstMatch(text, PRODUCT_AWARE_KEYWORDS);
  if (pk) return {
    value: "product_aware",
    confidence: "medium",
    reasoning: `Detected because keyword "${pk}" signals the audience is comparing or evaluating specific options — they already know what solution they want.`,
    source: "user_explicit",
  };

  const sk = firstMatch(text, SOLUTION_AWARE_KEYWORDS);
  if (sk) return {
    value: "solution_aware",
    confidence: "high",
    reasoning: `Detected because keyword "${sk}" signals the audience is actively searching for a solution but has not chosen a specific provider.`,
    source: "user_explicit",
  };

  const probK = firstMatch(text, PROBLEM_AWARE_KEYWORDS);
  if (probK) return {
    value: "problem_aware",
    confidence: "high",
    reasoning: `Detected because keyword "${probK}" signals the audience knows they have a problem but has not yet started searching for solutions.`,
    source: "user_explicit",
  };

  return {
    value: "unaware",
    confidence: "low",
    reasoning: "No explicit awareness signal found; defaulting to unaware — campaign likely targets a broad audience that may not yet know they have this problem.",
    source: "default",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 Enrichment — Fix 2: Explicit Pain Point Extraction
// ─────────────────────────────────────────────────────────────────────────────

interface PainPointPattern {
  category: PainPointCategory;
  keywords: string[];
}

const PAIN_POINT_PATTERNS: PainPointPattern[] = [
  {
    category: "fear_of_pain",
    keywords: ["fear of pain", "afraid of pain", "painful", "pain free", "painless procedure", "no pain", "won't hurt", "won't feel pain"],
  },
  {
    category: "fear_of_surgery",
    keywords: ["fear of surgery", "afraid of surgery", "scared of surgery", "scared of operation", "scared of procedure", "scared of needles", "fear of needles", "avoid surgery"],
  },
  {
    category: "price_concern",
    keywords: ["too expensive", "very costly", "can't afford", "cannot afford", "worried about fees", "fees concern", "price concern", "financial concern", "cost concern", "cheapest", "most affordable"],
  },
  {
    category: "trust_issue",
    keywords: ["don't trust", "not sure about", "doubt about", "skeptical", "worried about authenticity", "genuine doctor", "real results", "authentic"],
  },
  {
    category: "time_concern",
    keywords: ["takes too long", "long process", "time consuming", "long recovery", "recovery time", "how long does it take", "slow service"],
  },
  {
    category: "complexity_concern",
    keywords: ["complicated", "confusing procedure", "don't understand", "hard to understand", "complex process", "difficult to follow"],
  },
  {
    category: "quality_concern",
    keywords: ["poor quality", "bad results", "bad experience", "not satisfied", "disappointing", "failed before", "previous bad experience"],
  },
  {
    category: "result_doubt",
    keywords: ["does it work", "will it work", "really effective", "actually works", "uncertain results", "will it last", "permanent results"],
  },
  {
    category: "side_effect_fear",
    keywords: ["side effects", "complications", "risky procedure", "safe procedure", "no side effects", "is it safe", "safe for me"],
  },
  {
    category: "embarrassment",
    keywords: ["embarrassed", "embarrassing smile", "self conscious", "confidence issue", "hate my smile", "ashamed of teeth"],
  },
];

export function extractPainPoints(text: string): ExtractedPainPoint[] {
  const results: ExtractedPainPoint[] = [];
  const seen = new Set<PainPointCategory>();

  for (const { category, keywords } of PAIN_POINT_PATTERNS) {
    if (seen.has(category)) continue;
    const matched = firstMatch(text, keywords);
    if (matched) {
      seen.add(category);
      results.push({
        category,
        value: matched.trim(),
        confidence: "high",
        reasoning: `Detected because "${matched}" explicitly appears in the idea, signalling a ${category.replace(/_/g, " ")} concern from the user.`,
        source: "user_explicit",
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 Enrichment — Fix 3: Explicit USP Extraction
// ─────────────────────────────────────────────────────────────────────────────

interface UspPattern {
  category: UspCategory;
  regexPatterns?: RegExp[];
  keywords: string[];
}

const USP_PATTERNS: UspPattern[] = [
  {
    category: "experience",
    regexPatterns: [
      /(\d+)\s*\+?\s*years?\s*(of\s*)?(experience|expertise|practice|in\s+service)/i,
      /since\s*(\d{4})/i,
      /over\s*(\d+)\s*years?\s*(of\s*)?experience/i,
    ],
    keywords: ["years of experience", "decades of experience", "veteran", "pioneering", "established since"],
  },
  {
    category: "technology",
    keywords: ["german technology", "swiss technology", "american technology", "imported technology", "latest technology", "advanced technology", "state of the art", "cutting edge technology", "high tech", "hi-tech equipment"],
  },
  {
    category: "certification",
    keywords: ["ISO", "NABH", "NABL", "FDA approved", "government approved", "government certified", "internationally certified", "internationally accredited", "accredited clinic", "certified clinic"],
  },
  {
    category: "pricing",
    keywords: ["no hidden charges", "transparent pricing", "lowest price guaranteed", "best price guaranteed", "zero cost EMI", "no cost EMI", "most affordable clinic"],
  },
  {
    category: "service",
    keywords: ["24x7", "24/7", "round the clock", "home delivery", "doorstep service", "same day service", "emergency service", "free home visit"],
  },
  {
    category: "warranty",
    keywords: ["lifetime warranty", "money back guarantee", "results guaranteed", "satisfaction guaranteed", "assured results"],
  },
  {
    category: "award",
    keywords: ["award winning", "national award", "state award", "best clinic award", "best hospital award", "excellence award", "ranked #1", "ranked number one"],
  },
  {
    category: "exclusivity",
    keywords: ["only clinic", "only hospital", "first in india", "first in city", "exclusive treatment", "unique treatment", "patented", "one of a kind"],
  },
  {
    category: "speed",
    keywords: ["same day results", "instant results", "24 hour service", "quick recovery", "fast results", "immediate results"],
  },
];

export function extractUsp(text: string): ExtractedUsp[] {
  const results: ExtractedUsp[] = [];
  const seen = new Set<UspCategory>();

  for (const { category, regexPatterns, keywords } of USP_PATTERNS) {
    if (seen.has(category)) continue;

    // Try regex first — extracts the actual value from text
    if (regexPatterns) {
      for (const re of regexPatterns) {
        const match = re.exec(text);
        if (match) {
          seen.add(category);
          results.push({
            category,
            value: match[0].trim(),
            confidence: "high",
            reasoning: `Detected because "${match[0].trim()}" explicitly appears in the idea as a ${category} business differentiator.`,
            source: "user_explicit",
          });
          break;
        }
      }
      if (seen.has(category)) continue;
    }

    // Keyword fallback
    const matched = firstMatch(text, keywords);
    if (matched) {
      seen.add(category);
      results.push({
        category,
        value: matched.trim(),
        confidence: "high",
        reasoning: `Detected because "${matched}" explicitly appears in the idea as a ${category} business differentiator.`,
        source: "user_explicit",
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 Enrichment — Fix 4: Audience Override
// ─────────────────────────────────────────────────────────────────────────────

interface ExplicitAudiencePattern {
  value: string;
  keywords: string[];
}

const EXPLICIT_AUDIENCE_PATTERNS: ExplicitAudiencePattern[] = [
  { value: "women",                 keywords: ["targeting women", "for women", "ladies only", "females", "working women", "housewives"] },
  { value: "senior_citizens",       keywords: ["senior citizens", "elderly", "old age", "retirees", "pensioners", "above 60", "60 plus"] },
  { value: "students",              keywords: ["targeting students", "for students", "student audience", "college students", "school students", "undergraduates", "teenagers"] },
  { value: "parents",               keywords: ["targeting parents", "for parents", "parents of", "mothers and fathers", "guardians"] },
  { value: "business_owners",       keywords: ["business owners", "entrepreneurs", "MSMEs", "SMEs", "startups", "self employed professionals"] },
  { value: "nri",                   keywords: ["NRI", "NRIs", "non resident indian", "overseas indian", "diaspora", "indians abroad", "indians overseas"] },
  { value: "working_professionals", keywords: ["working professionals", "office goers", "salaried employees", "salaried professionals", "corporate employees", "IT professionals"] },
  { value: "hni",                   keywords: ["HNI", "high net worth", "wealthy individuals", "affluent buyers", "UHNI", "ultra high net worth", "luxury buyers"] },
  { value: "doctors",               keywords: ["targeting doctors", "for doctors", "physicians", "surgeons", "medical professionals", "healthcare professionals"] },
  { value: "newlyweds",             keywords: ["newlyweds", "newly married", "brides and grooms", "honeymoon couples", "newly wed couples"] },
  { value: "new_mothers",           keywords: ["new mothers", "new moms", "expecting mothers", "pregnant women", "postpartum", "nursing mothers"] },
  { value: "fitness_enthusiasts",   keywords: ["gym goers", "fitness enthusiasts", "athletes", "sportspersons", "health conscious individuals"] },
];

function detectExplicitAudience(text: string): { value: string; matched: string } | null {
  for (const { value, keywords } of EXPLICIT_AUDIENCE_PATTERNS) {
    const kw = firstMatch(text, keywords);
    if (kw) return { value, matched: kw };
  }
  return null;
}

export function buildAudienceResolution(text: string, inferredAudience: string): AudienceResolution {
  const explicit = detectExplicitAudience(text);

  if (explicit) {
    return {
      explicit: explicit.value,
      inferred: inferredAudience,
      final: explicit.value,
      overridden: true,
      confidence: "high",
      reasoning: `Explicit audience "${explicit.value}" detected because "${explicit.matched}" appears in the idea — this overrides the industry-inferred audience "${inferredAudience}".`,
      source: "user_explicit",
    };
  }

  return {
    explicit: null,
    inferred: inferredAudience,
    final: inferredAudience,
    overridden: false,
    confidence: "medium",
    reasoning: `No explicit audience stated; audience "${inferredAudience}" inferred from industry and sub-industry knowledge.`,
    source: "inferred",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 Enrichment — Fix 5: Offer Detection
// ─────────────────────────────────────────────────────────────────────────────

// Regex patterns for quantified value extraction
const PERCENT_DISCOUNT_RE   = /(\d{1,3})\s*%\s*(off|discount|saving|cashback)/i;
const AMOUNT_DISCOUNT_RE    = /(₹|rs\.?|inr)\s*(\d+[,\d]*)\s*(off|discount|cashback)/i;

interface OfferPattern {
  offerType: OfferType;
  urgency: DetectedOffer["urgency"];
  regexPatterns?: RegExp[];
  keywords: string[];
}

// IMPORTANT: more-specific patterns are checked before generic ones.
// "early bird discount" must match "early_bird" before "discount".
// "limited time" must match before "discount".
const OFFER_PATTERNS: OfferPattern[] = [
  {
    offerType: "limited_time",
    urgency: "immediate",
    keywords: ["limited time offer", "today only", "this week only", "ends soon", "last chance", "offer ends", "till stocks last", "limited period", "limited time only"],
  },
  {
    offerType: "early_bird",
    urgency: "high",
    keywords: ["early bird", "early bird offer", "early bird discount", "founding member", "introductory offer", "inaugural offer"],
  },
  {
    offerType: "pre_booking",
    urgency: "high",
    keywords: ["pre-booking", "pre booking", "pre-order", "pre order", "advance booking", "book early", "pre-launch booking"],
  },
  {
    offerType: "launch_offer",
    urgency: "high",
    keywords: ["launch offer", "grand opening offer", "new launch offer", "opening offer", "inauguration offer"],
  },
  {
    offerType: "free_consultation",
    urgency: "low",
    keywords: ["free consultation", "free checkup", "complimentary consultation", "free assessment", "free evaluation", "no charge consultation"],
  },
  {
    offerType: "free_trial",
    urgency: "low",
    keywords: ["free trial", "try for free", "no cost trial", "free demo", "free sample"],
  },
  {
    offerType: "bogo",
    urgency: "medium",
    keywords: ["buy one get one", "buy 1 get 1", "bogo", "2 for 1", "two for one", "one plus one free"],
  },
  {
    offerType: "cashback",
    urgency: "medium",
    keywords: ["cashback", "cash back"],
  },
  {
    offerType: "bundle",
    urgency: "low",
    keywords: ["combo offer", "bundle offer", "package deal", "all inclusive", "complete package", "value pack"],
  },
  {
    offerType: "emi",
    urgency: "none",
    keywords: ["emi", "easy emi", "no cost emi", "zero cost emi", "zero emi", "easy installment", "monthly installment", "instalment", "pay in installments"],
  },
  {
    offerType: "discount",
    urgency: "medium",
    regexPatterns: [PERCENT_DISCOUNT_RE, AMOUNT_DISCOUNT_RE],
    keywords: ["discount", "sale", "special offer", "flat off", "reduced price", "mega sale", "grand sale", "festive discount"],
  },
];

export function detectOffer(text: string): DetectedOffer {
  for (const { offerType, urgency, regexPatterns, keywords } of OFFER_PATTERNS) {
    // Regex first for value extraction
    if (regexPatterns) {
      for (const re of regexPatterns) {
        const match = re.exec(text);
        if (match) {
          const offerValue = match[1]
            ? match[0].includes("%")
              ? `${match[1]}%`
              : `${match[1]}${match[2] ?? ""}`
            : null;
          return {
            offerType,
            offerValue: offerValue?.trim() ?? null,
            urgency,
            confidence: "high",
            reasoning: `Detected because "${match[0].trim()}" explicitly appears in the idea as a ${offerType.replace(/_/g, " ")} offer.`,
            source: "user_explicit",
          };
        }
      }
    }

    // Keyword fallback
    const matched = firstMatch(text, keywords);
    if (matched) {
      return {
        offerType,
        offerValue: null,
        urgency,
        confidence: "high",
        reasoning: `Detected because "${matched}" explicitly appears in the idea as a ${offerType.replace(/_/g, " ")} commercial offer.`,
        source: "user_explicit",
      };
    }
  }

  return {
    offerType: "none",
    offerValue: null,
    urgency: "none",
    confidence: "high",
    reasoning: "No commercial offer or promotion detected in the user's idea.",
    source: "default",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 Enrichment — Fix 6: Authority Signal Extraction
// ─────────────────────────────────────────────────────────────────────────────

const YEARS_EXP_RE  = /(\d+)\s*\+?\s*years?\s*(of\s*)?(experience|expertise|practice|in\s+business|in\s+service)/i;
const SINCE_YEAR_RE = /since\s*(\d{4})/i;
const RATING_RE     = /(\d\.?\d*)\s*(stars?|star\s*rating|\/5|out\s*of\s*5)(\s*(google|rating)s?)?/i;
const BRANCH_RE     = /(\d+)\s*\+?\s*(branches?|centers?|clinics?|outlets?|locations?)\s*(across|in|pan)?/i;
const TEAM_RE       = /(\d+)\s*\+?\s*(doctors?|physicians?|specialists?|surgeons?|experts?|dentists?|employees?)/i;

interface AuthorityPattern {
  type: AuthoritySignalType;
  regexPatterns?: RegExp[];
  keywords: string[];
}

const AUTHORITY_PATTERNS: AuthorityPattern[] = [
  {
    type: "experience_years",
    regexPatterns: [YEARS_EXP_RE, SINCE_YEAR_RE],
    keywords: ["years of experience", "decades of experience", "veteran doctor", "established since"],
  },
  {
    type: "award",
    keywords: ["award winning", "award winner", "national award", "state award", "best clinic award", "best hospital award", "excellence award", "ranked #1", "ranked number one", "won award"],
  },
  {
    type: "certification",
    keywords: ["ISO 9001", "ISO certified", "NABH accredited", "NABH certified", "NABL certified", "FDA approved", "government certified", "government approved", "internationally certified"],
  },
  {
    type: "rating",
    regexPatterns: [RATING_RE],
    keywords: ["5 star", "highly rated", "top rated", "best rated", "google rating", "excellent rating"],
  },
  {
    type: "team_size",
    regexPatterns: [TEAM_RE],
    keywords: ["team of specialists", "team of doctors", "team of experts"],
  },
  {
    type: "branch_count",
    regexPatterns: [BRANCH_RE],
    keywords: ["multiple branches", "pan india", "all india presence", "nationwide"],
  },
  {
    type: "government_approval",
    keywords: ["government approved", "approved by government", "ministry approved", "health ministry", "FSSAI approved"],
  },
];

export function extractAuthoritySignals(text: string): AuthoritySignal[] {
  const results: AuthoritySignal[] = [];
  const seen = new Set<AuthoritySignalType>();

  for (const { type, regexPatterns, keywords } of AUTHORITY_PATTERNS) {
    if (seen.has(type)) continue;

    if (regexPatterns) {
      for (const re of regexPatterns) {
        const match = re.exec(text);
        if (match) {
          seen.add(type);
          results.push({
            type,
            value: match[0].trim(),
            confidence: "high",
            reasoning: `Detected because "${match[0].trim()}" explicitly appears in the idea as a ${type.replace(/_/g, " ")} authority signal.`,
            source: "user_explicit",
          });
          break;
        }
      }
      if (seen.has(type)) continue;
    }

    const matched = firstMatch(text, keywords);
    if (matched) {
      seen.add(type);
      results.push({
        type,
        value: matched.trim(),
        confidence: "medium",
        reasoning: `Detected because "${matched}" explicitly appears in the idea as a ${type.replace(/_/g, " ")} authority claim.`,
        source: "user_explicit",
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 Enrichment — Fix 7: Social Proof Extraction
// ─────────────────────────────────────────────────────────────────────────────

const CUSTOMER_COUNT_RE = /(\d+[,\d]*)\s*\+?\s*(happy\s+|satisfied\s+|delighted\s+)?(patients?|customers?|clients?|students?|families?|users?|reviews?)/i;
const RATING_SP_RE      = /(\d\.?\d*)\s*(stars?|\/5|out\s*of\s*5)(\s*(google|rating|review)s?)?/i;
const SINCE_SP_RE       = /(?:established|founded|started|serving since|operating since)\s*(?:since|in)?\s*(\d{4})/i;

interface SocialProofPattern {
  type: SocialProofType;
  regexPatterns?: RegExp[];
  keywords: string[];
}

const SOCIAL_PROOF_PATTERNS: SocialProofPattern[] = [
  {
    type: "customer_count",
    regexPatterns: [CUSTOMER_COUNT_RE],
    keywords: ["thousands of patients", "thousands of customers", "lakh customers"],
  },
  {
    type: "rating",
    regexPatterns: [RATING_SP_RE],
    keywords: ["google reviews", "highly rated on google", "5 star google", "top rated on google"],
  },
  {
    type: "testimonial",
    keywords: ["testimonials", "customer reviews", "patient reviews", "success stories", "case studies", "patient feedback", "customer feedback"],
  },
  {
    type: "established_since",
    regexPatterns: [SINCE_SP_RE],
    keywords: ["serving since", "operating since", "founded in", "established in"],
  },
  {
    type: "trusted_by",
    keywords: ["trusted by", "chosen by", "preferred by", "used by thousands", "recommended by doctors", "relied on by"],
  },
  {
    type: "celebrity_endorsement",
    keywords: ["celebrity", "bollywood actor", "cricketer", "famous personality", "brand ambassador", "influencer endorsed", "public figure"],
  },
  {
    type: "media_mention",
    keywords: ["featured in", "as seen in", "press coverage", "media coverage", "tv featured", "news featured", "newspaper featured", "covered by"],
  },
];

export function extractSocialProof(text: string): SocialProofSignal[] {
  const results: SocialProofSignal[] = [];
  const seen = new Set<SocialProofType>();

  for (const { type, regexPatterns, keywords } of SOCIAL_PROOF_PATTERNS) {
    if (seen.has(type)) continue;

    if (regexPatterns) {
      for (const re of regexPatterns) {
        const match = re.exec(text);
        if (match) {
          seen.add(type);
          results.push({
            type,
            value: match[0].trim(),
            confidence: "high",
            reasoning: `Detected because "${match[0].trim()}" explicitly appears in the idea as a ${type.replace(/_/g, " ")} social proof signal.`,
            source: "user_explicit",
          });
          break;
        }
      }
      if (seen.has(type)) continue;
    }

    const matched = firstMatch(text, keywords);
    if (matched) {
      seen.add(type);
      results.push({
        type,
        value: matched.trim(),
        confidence: "medium",
        reasoning: `Detected because "${matched}" explicitly appears in the idea as a ${type.replace(/_/g, " ")} social proof signal.`,
        source: "user_explicit",
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence score
// ─────────────────────────────────────────────────────────────────────────────

function computeConfidenceScore(understanding: Partial<UserUnderstanding>): number {
  // creativeType and audienceConfidence removed (Fixes 4 & 5) — weights redistributed.
  const fieldWeights: Array<{ key: keyof UserUnderstanding; weight: number }> = [
    { key: "industry",       weight: 22 },
    { key: "intent",         weight: 18 },
    { key: "platform",       weight: 12 },
    { key: "businessGoal",   weight: 12 },
    { key: "campaignGoal",   weight: 10 },
    { key: "audienceType",   weight: 8  },
    { key: "emotion",        weight: 6  },
    { key: "urgency",        weight: 5  },
    { key: "subIndustry",    weight: 4  },
    { key: "language",       weight: 3  },
  ];
  const confidenceMultiplier: Record<FieldConfidence, number> = {
    high: 1.0, medium: 0.6, low: 0.3, unknown: 0,
  };
  let total = 0;
  let maxTotal = 0;
  for (const { key, weight } of fieldWeights) {
    maxTotal += weight;
    const f = understanding[key] as UnderstandingField | undefined;
    if (f && typeof f === "object" && "confidence" in f) {
      total += weight * confidenceMultiplier[f.confidence as FieldConfidence];
    }
  }
  return Math.round((total / maxTotal) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 compatibility — kept for backward compat, delegates internally
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeUserIntent(rawIdea: string): UserIntent {
  const result = analyzeUserRequest({ userId: "", rawIdea, requestedAt: new Date() });
  return {
    rawIdea,
    normalizedIdea: rawIdea.trim().replace(/\s+/g, " "),
    detectedLanguage:
      result.language.value === "hindi" ? "HI"
      : result.language.value === "mixed" ? "AUTO"
      : "EN",
    likelyIndustry: result.industry.value !== "unknown" ? result.industry.value : undefined,
    intentType: (result.intent.value as UserIntent["intentType"]) ?? undefined,
    businessGoalType: undefined,
    confidence:
      result.confidenceScore >= 65 ? "high"
      : result.confidenceScore >= 35 ? "medium"
      : "low",
    platformSignal: result.platform.value !== "unknown" ? result.platform.value : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeUserRequest(request: CreativeRequest): UserUnderstanding {
  const text = request.rawIdea.trim();

  // ── Primary detectors ─────────────────────────────────────────────────────
  const language = detectLanguage(text);
  const { industry: industryKey, subIndustry: subIndustryKey, confidence: industryCon } = detectIndustry(text);
  const intent = detectIntent(text);
  const campaignGoal = detectCampaignGoal(text);
  const businessGoal = detectBusinessGoal(text);
  const urgency = detectUrgency(text);
  const seasonality = detectSeasonality(text);
  const productContext = detectProductContext(text);
  const contentType = detectContentType(text, intent.value as string);
  const brandContext = detectBrandContext(text);
  const { platform, outputFormat: outputFormatPreference } = detectPlatform(text, request.kind, request.presetKey);

  // Industry fields
  const industryLabel = INDUSTRIES.find(i => i.key === industryKey)?.label ?? industryKey;
  const subIndustryDef = INDUSTRIES.flatMap(i => i.subIndustries).find(s => s.key === subIndustryKey);
  const subIndustryLabel = subIndustryDef?.label ?? subIndustryKey;

  const industryField: UnderstandingField = industryCon === "unknown"
    ? unknownField("industry")
    : field(industryKey, industryCon, `Keyword matched industry "${industryLabel}"`);

  const subIndustryField: UnderstandingField = industryCon === "unknown"
    ? unknownField("subIndustry")
    : field(subIndustryKey, industryCon, `Sub-industry "${subIndustryLabel}" detected within "${industryLabel}"`);

  // ── Cross-field inference ─────────────────────────────────────────────────
  const ctx: InferenceContext = {
    industry: industryKey,
    subIndustry: subIndustryKey,
    intent: intent.value as string,
    urgency: urgency.value as string,
    seasonality: seasonality.value as string,
    platform: platform.value as string,
    productContext: productContext.value as string,
  };

  const businessCategory = inferBusinessCategory(ctx);
  const inferredAudienceType = inferAudienceType(ctx);
  // audienceConfidence removed (Fix 5) — redundant with audienceType.confidence.
  const trustRequirement = inferTrustRequirement(industryKey);
  const educationLevelRequired = inferEducationLevel(industryKey, intent.value as string, subIndustryKey);
  const communicationStyle = inferCommunicationStyle(industryKey, intent.value as string, urgency.value as string);
  const emotion = inferEmotion(industryKey, intent.value as string);
  // visualComplexity, creativeComplexity, creativeType, audienceConfidence removed — now owned by Creative Brain.

  // ── Phase 2 Enrichment (Fixes 1–7) ────────────────────────────────────────
  // Run BEFORE assembling partial so audienceType can be overridden if explicit.
  const audienceResolution     = buildAudienceResolution(text, inferredAudienceType.value as string);
  const customerAwareness      = detectCustomerAwareness(text);
  const extractedPainPoints    = extractPainPoints(text);
  const extractedUsp           = extractUsp(text);
  const detectedOffer          = detectOffer(text);
  const authoritySignals       = extractAuthoritySignals(text);
  const socialProof            = extractSocialProof(text);

  // Fix 4 — audience override: if user explicitly stated an audience, audienceType
  // reflects the explicit value so all downstream modules get the correct audience.
  const audienceType = audienceResolution.overridden
    ? field(audienceResolution.final, "high",
        `Explicit audience "${audienceResolution.final}" stated by user — overrides inferred "${inferredAudienceType.value}"`)
    : inferredAudienceType;

  // ── Assemble final object ─────────────────────────────────────────────────
  // The runtime values are all valid members of the respective union types;
  // we let TypeScript infer the wide shape here and cast at the return.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partial: Record<string, any> = {
    intent,
    industry: industryField,
    subIndustry: subIndustryField,
    businessCategory,
    campaignGoal,
    businessGoal,
    platform,
    outputFormatPreference,
    audienceType,
    language,
    brandContext,
    productContext,
    educationLevelRequired,
    trustRequirement,
    urgency,
    seasonality,
    contentType,
    communicationStyle,
    emotion,
  };

  // Confidence score uses only the original scalar fields — new enrichment
  // fields (arrays + complex objects) are excluded to preserve stability.
  const confidenceScore = computeConfidenceScore(partial);

  const unknownFields = (Object.entries(partial) as [string, UnderstandingField][])
    .filter(([, f]) => f && typeof f === "object" && "confidence" in f && f.confidence === "unknown")
    .map(([key]) => key);

  return {
    ...partial,
    confidenceScore,
    unknownFields,
    // Phase 2 enrichment fields — additive, never affect existing scalar logic
    customerAwareness,
    extractedPainPoints,
    extractedUsp,
    audienceResolution,
    detectedOffer,
    authoritySignals,
    socialProof,
  } as UserUnderstanding;
}
