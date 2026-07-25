// Phase 4 — Creative Brain knowledge banks.
// Industry-specific marketing intelligence: every senior strategist knows
// these truths about each category before they write a single brief.
// Pure data — no functions, no I/O, no LLM calls.

export interface IndustryKnowledge {
  /** Core frustrations the audience has that this category must address. */
  painPoints: string;
  /** What the audience genuinely hopes to gain, feel, or become. */
  desires: string;
  /** Common hesitations that prevent purchase or action. */
  objections: string;
  /** Typical differentiators that define a strong USP in this category. */
  usp: string;
  /** How prominently people should appear in creatives for this industry. */
  humanPresence: "none" | "incidental" | "supporting" | "hero";
  /** The photography treatment that performs best in this category. */
  photographyStyle: string;
  /** Most common competitive stance in this category. */
  competitivePosition: string;
  /** Typical primary audience descriptor for this industry. */
  audienceProfile: string;
  /** Dominant age range of the primary audience. */
  ageGroup: "18-24" | "25-34" | "35-44" | "45-54" | "55+" | "all_ages";
  /** Income positioning of the typical buyer. */
  incomeGroup: "budget" | "mid_market" | "affluent" | "high_net_worth";
  /** Primary psychological driver that moves this audience. */
  motivation: string;
  /** Where the typical prospect sits in the purchase funnel. */
  defaultBuyerStage: "awareness" | "consideration" | "decision" | "retention";
}

const DENTAL: IndustryKnowledge = {
  painPoints: "dental anxiety, fear of pain, uncertainty about cost, lack of time, distrust of past experiences",
  desires: "natural-looking results, pain-free treatment, renewed confidence, lasting solution",
  objections: "too expensive, afraid of pain, uncertain about recovery, don't know if I need it",
  usp: "certified expertise, advanced technology, patient comfort, proven results, lasting outcomes",
  humanPresence: "hero",
  photographyStyle: "before_after",
  competitivePosition: "niche",
  audienceProfile: "adults considering dental restoration, concerned about aesthetics and function",
  ageGroup: "35-44",
  incomeGroup: "mid_market",
  motivation: "self-confidence and quality of life restoration",
  defaultBuyerStage: "consideration",
};

const HEALTHCARE: IndustryKnowledge = {
  painPoints: "fear of illness, cost of care, lack of access, uncertainty about diagnosis, neglecting health",
  desires: "peace of mind, early detection, expert care, a healthy future for the family",
  objections: "too busy, too expensive, don't feel sick, prefer to wait",
  usp: "experienced doctors, advanced diagnostics, affordable packages, compassionate care",
  humanPresence: "hero",
  photographyStyle: "documentary",
  competitivePosition: "leader",
  audienceProfile: "health-conscious adults and families aged 25–55",
  ageGroup: "35-44",
  incomeGroup: "mid_market",
  motivation: "protecting family health and avoiding future complications",
  defaultBuyerStage: "awareness",
};

const RESTAURANT: IndustryKnowledge = {
  painPoints: "decision fatigue about where to eat, inconsistent food quality, uninspiring dining experiences",
  desires: "memorable experience, exceptional food, warm atmosphere, a reason to celebrate",
  objections: "too expensive, not sure about the cuisine, hard to make a reservation, unknown quality",
  usp: "signature dishes, unique ambiance, chef credentials, local ingredients, occasion-worthy setting",
  humanPresence: "supporting",
  photographyStyle: "lifestyle",
  competitivePosition: "niche",
  audienceProfile: "food lovers and occasion-seekers aged 22–45",
  ageGroup: "25-34",
  incomeGroup: "mid_market",
  motivation: "creating memorable moments and experiencing something new",
  defaultBuyerStage: "awareness",
};

const REAL_ESTATE: IndustryKnowledge = {
  painPoints: "high prices, complex purchase process, uncertainty about location, fear of bad investment",
  desires: "dream home, financial security, prestige, privacy, a lifestyle upgrade",
  objections: "too expensive, wrong location, long process, uncertain investment return",
  usp: "prime location, build quality, lifestyle amenities, appreciation potential, developer credibility",
  humanPresence: "incidental",
  photographyStyle: "editorial",
  competitivePosition: "leader",
  audienceProfile: "affluent buyers and investors aged 35–55",
  ageGroup: "35-44",
  incomeGroup: "affluent",
  motivation: "investment security and aspirational lifestyle",
  defaultBuyerStage: "consideration",
};

const FINANCE: IndustryKnowledge = {
  painPoints: "complexity of investing, fear of loss, distrust of advisors, inflation eroding savings, not knowing where to start",
  desires: "financial security, passive income, early retirement, wealth for family",
  objections: "too risky, don't have enough to start, don't understand it, have been burned before",
  usp: "simplicity, transparency, track record, expert guidance, compounding returns",
  humanPresence: "supporting",
  photographyStyle: "lifestyle",
  competitivePosition: "challenger",
  audienceProfile: "working professionals and first-time investors aged 25–45",
  ageGroup: "25-34",
  incomeGroup: "mid_market",
  motivation: "building wealth and reducing financial anxiety",
  defaultBuyerStage: "consideration",
};

const EDUCATION: IndustryKnowledge = {
  painPoints: "uncertain future, academic competition, finding the right school, fear of wasted years",
  desires: "bright career, quality environment, holistic development, respected credentials",
  objections: "too expensive, too far, not the right fit, unsure about outcomes",
  usp: "qualified faculty, proven outcomes, modern facilities, strong community, scholarships",
  humanPresence: "hero",
  photographyStyle: "documentary",
  competitivePosition: "niche",
  audienceProfile: "parents of school-age children and students aged 16–22",
  ageGroup: "35-44",
  incomeGroup: "mid_market",
  motivation: "securing the best possible future for their child",
  defaultBuyerStage: "consideration",
};

const BEAUTY_WELLNESS: IndustryKnowledge = {
  painPoints: "lack of confidence, bad hair days, feeling unattractive, poor self-image, need for relaxation",
  desires: "transformation, renewed confidence, self-care as luxury, feeling pampered and seen",
  objections: "too expensive, results won't last, afraid of looking different, never tried it",
  usp: "skilled stylists, premium products, welcoming atmosphere, visible transformation, expertise",
  humanPresence: "hero",
  photographyStyle: "before_after",
  competitivePosition: "niche",
  audienceProfile: "women and men aged 18–40 investing in personal appearance",
  ageGroup: "25-34",
  incomeGroup: "mid_market",
  motivation: "boosting self-confidence through visible transformation",
  defaultBuyerStage: "consideration",
};

const JEWELLERY_LUXURY: IndustryKnowledge = {
  painPoints: "finding a meaningful gift, generic options that lack emotion, fear of overpaying, uncertainty about quality",
  desires: "timeless elegance, emotional significance, craftsmanship, exclusivity, something that lasts forever",
  objections: "too expensive, can't tell real quality, concerned about authenticity, impersonal",
  usp: "handcrafted precision, ethically sourced materials, unique designs, heritage, certification",
  humanPresence: "incidental",
  photographyStyle: "macro_detail",
  competitivePosition: "niche",
  audienceProfile: "affluent consumers celebrating milestones, aged 25–50",
  ageGroup: "25-34",
  incomeGroup: "affluent",
  motivation: "expressing love, achievement, or identity through a lasting object",
  defaultBuyerStage: "decision",
};

const AUTOMOTIVE: IndustryKnowledge = {
  painPoints: "high purchase cost, depreciation concerns, reliability uncertainty, long buying process",
  desires: "freedom, status, performance, a car that reflects who I am",
  objections: "too expensive, high maintenance, not sure about the model, can wait",
  usp: "performance credentials, safety ratings, technology, design, after-sales support",
  humanPresence: "incidental",
  photographyStyle: "editorial",
  competitivePosition: "challenger",
  audienceProfile: "professionals and enthusiasts aged 30–50",
  ageGroup: "35-44",
  incomeGroup: "affluent",
  motivation: "self-expression and the experience of driving",
  defaultBuyerStage: "consideration",
};

const HOSPITALITY: IndustryKnowledge = {
  painPoints: "holiday planning stress, fear of disappointing stay, paying too much for mediocre experience",
  desires: "relaxation, adventure, creating memories, feeling special and taken care of",
  objections: "too expensive, not the right season, unsure about quality",
  usp: "location, exclusive experiences, service quality, unique character, value",
  humanPresence: "supporting",
  photographyStyle: "lifestyle",
  competitivePosition: "niche",
  audienceProfile: "travellers and experience-seekers aged 25–50",
  ageGroup: "25-34",
  incomeGroup: "mid_market",
  motivation: "escape from routine and creating lasting memories",
  defaultBuyerStage: "awareness",
};

const RETAIL: IndustryKnowledge = {
  painPoints: "choice paralysis, quality uncertainty, poor value, generic brands",
  desires: "style, quality, self-expression, belonging to a trend or movement",
  objections: "too expensive, not sure about sizing, might not suit me",
  usp: "design quality, trend leadership, value, sustainability, brand story",
  humanPresence: "hero",
  photographyStyle: "editorial",
  competitivePosition: "challenger",
  audienceProfile: "style-conscious consumers aged 18–35",
  ageGroup: "18-24",
  incomeGroup: "mid_market",
  motivation: "self-expression and belonging through style",
  defaultBuyerStage: "awareness",
};

const GENERIC: IndustryKnowledge = {
  painPoints: "unmet need, time or money constraints, fear of making the wrong choice",
  desires: "value, quality, reliability, ease of use, a solution that works",
  objections: "too expensive, not sure it will work, never heard of the brand",
  usp: "quality, value, expertise, trusted results",
  humanPresence: "supporting",
  photographyStyle: "lifestyle",
  competitivePosition: "unknown",
  audienceProfile: "general consumers across demographics",
  ageGroup: "all_ages",
  incomeGroup: "mid_market",
  motivation: "solving a specific problem or fulfilling a genuine need",
  defaultBuyerStage: "awareness",
};

export const KNOWLEDGE_BY_INDUSTRY: Record<string, IndustryKnowledge> = {
  // Top-level industries
  healthcare: HEALTHCARE,
  food_beverage: RESTAURANT,
  real_estate: REAL_ESTATE,
  finance: FINANCE,
  education: EDUCATION,
  beauty_wellness: BEAUTY_WELLNESS,
  jewellery_luxury: JEWELLERY_LUXURY,
  automotive: AUTOMOTIVE,
  hospitality: HOSPITALITY,
  retail: RETAIL,
  general: GENERIC,
  technology: GENERIC,
  entertainment: GENERIC,
  fitness: HEALTHCARE,
  legal: GENERIC,

  // Sub-industry aliases — same knowledge bank as parent, more specific key
  dental: DENTAL,
  dental_clinic: DENTAL,
  general_hospital: HEALTHCARE,
  health_clinic: HEALTHCARE,
  restaurant: RESTAURANT,
  cafe: RESTAURANT,
  catering: RESTAURANT,
  luxury_property: REAL_ESTATE,
  residential: REAL_ESTATE,
  commercial: REAL_ESTATE,
  mutual_fund: FINANCE,
  banking: FINANCE,
  insurance: FINANCE,
  wealth_management: FINANCE,
  school: EDUCATION,
  college_university: EDUCATION,
  coaching_institute: EDUCATION,
  hair_salon: BEAUTY_WELLNESS,
  spa_wellness: BEAUTY_WELLNESS,
  skincare: BEAUTY_WELLNESS,
  fine_jewellery: JEWELLERY_LUXURY,
  luxury_goods: JEWELLERY_LUXURY,
  jewellery: JEWELLERY_LUXURY,
  car_dealership: AUTOMOTIVE,
  automobile: AUTOMOTIVE,
  auto_service: AUTOMOTIVE,
  hotel_resort: HOSPITALITY,
  travel_agency: HOSPITALITY,
  fashion_clothing: RETAIL,
  retail_store: RETAIL,
  fashion: RETAIL,
};

export function getKnowledge(industryKey: string | undefined): IndustryKnowledge {
  if (!industryKey || industryKey === "unknown") return GENERIC;
  return KNOWLEDGE_BY_INDUSTRY[industryKey] ?? GENERIC;
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform behaviour lookup
// ─────────────────────────────────────────────────────────────────────────────

export const PLATFORM_BEHAVIOUR: Record<string, string> = {
  instagram:      "Fast-scrolling visual feed — 0.3-second stop-scroll window; visual impact must precede text; square/portrait performs best; high engagement with emotion and transformation",
  facebook:       "Mixed age demographic; longer attention span than Instagram; works for detailed offers and events; boosted posts favour clear headline + single benefit + strong CTA",
  linkedin:       "Professional context; audience is results-focused; data, credibility, and authority outperform emotion; B2B and career content perform best",
  youtube:        "Intent-driven viewing; thumbnail is the decisive click factor; bold contrast + human face + number performs strongly",
  google_display: "Low attention, banner-blind audience; maximum 3 elements; logo + benefit + CTA in the first glance; animation outperforms static",
  website_banner: "Contextual placement; user has intent; less interruption-resistant; clear offer + CTA critical; consistent with surrounding page",
  print:          "Uninterrupted attention; viewed at reading distance; full visual hierarchy possible; no animation; text must be legible at natural reading distance",
  outdoor:        "3-second rule at 60km/h; maximum 7 words of headline copy; single dominant visual; no body text; brand + one message only",
  general:        "No platform-specific behaviour detected; design for legibility and clarity across contexts",
};

export const PLATFORM_SAFE_AREAS: Record<string, string> = {
  instagram:      "bottom",   // UI chrome and captions sit at bottom
  facebook:       "bottom",
  linkedin:       "bottom",
  youtube:        "bottom",
  google_display: "none",
  website_banner: "sides",
  print:          "all",
  outdoor:        "all",
  story:          "all",      // top + bottom UI bars on Story format
  general:        "none",
};
