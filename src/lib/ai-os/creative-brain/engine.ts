import type {
  StrategyField,
  FieldConfidence,
  UserUnderstanding,
  AssetIntelligence,
  CustomerAwarenessLevel,
  PainPointCategory,
  AuthoritySignalType,
  SocialProofType,
  IntelligenceSource,
} from "../types";
import type { CreativeContext } from "../creative-context";
import type {
  CreativeStrategy,
  MarketingIntelligence,
  AudienceIntelligence,
  CommunicationIntelligence,
  CreativeIntelligence,
  BusinessIntelligence,
  PlatformIntelligence,
  VisualReasoning,
  CampaignIntelligence,
  TrustAssets,
  TrustAsset,
  OfferDetailsField,
  StoryFlowId,
  StoryGraphNode,
  LuxuryProfile,
  HeroDecision,
  HeroType,
  CreativeMatrixResult,
} from "./types";
import { STORY_FLOW_NODES } from "./types";
import { getKnowledge, PLATFORM_BEHAVIOUR, PLATFORM_SAFE_AREAS } from "./knowledge";
import { buildExperienceProfile } from "./experience-engine";
import { buildLuxuryProfile } from "./luxury-engine";
import { computeSemanticWeights } from "./semantic-weight-engine";
import { resolveCreativeMatrix } from "./creative-matrix";
import { resolveHeroDecision } from "./hero-decision-engine";

// Phase 4 — Creative Brain Engine.
// Single responsibility: convert a CreativeContext into a CreativeStrategy.
// Pure function — no LLM calls, no I/O, no side effects. Entirely testable.
//
// STRICT RULES:
//   ✗ Never generates prompts
//   ✗ Never generates layouts
//   ✗ Never generates headlines / copy / CTA
//   ✗ Never calls providers
//   ✗ Never generates images or videos
//   ✓ Only reasons, classifies, and infers

// ─────────────────────────────────────────────────────────────────────────────
// Field construction helpers
// ─────────────────────────────────────────────────────────────────────────────

function sf<T extends string = string>(
  value: T | "unknown",
  confidence: FieldConfidence,
  reasoning: string
): StrategyField<T> {
  return { value, confidence, reasoning } as StrategyField<T>;
}

function unknownSf(fieldName: string): StrategyField {
  return {
    value: "unknown",
    confidence: "unknown",
    reasoning: `No signal found for "${fieldName}" in the provided context`,
  };
}

/** Derives a StrategyField from a UserUnderstanding field, upgrading its
 *  `reason` to the richer `reasoning` format the Creative Brain uses.
 *  The generic parameter T should be the TARGET enum (Creative Brain side),
 *  which may differ from the source field's enum. A valueMapper can translate
 *  mismatched enum values; omit it when both enums share the same values. */
function fromUU<T extends string = string>(
  uuField: { value: string | "unknown"; confidence: FieldConfidence; reason?: string; reasoning?: string },
  label: string,
  valueMapper?: (v: string) => T | "unknown"
): StrategyField<T> {
  if (uuField.value === "unknown") return unknownSf(label) as StrategyField<T>;
  const mappedValue = valueMapper ? valueMapper(uuField.value) : (uuField.value as T | "unknown");
  if (mappedValue === "unknown") return unknownSf(label) as StrategyField<T>;
  return sf<T>(
    mappedValue,
    uuField.confidence,
    `Inherited from User Understanding: ${uuField.reason ?? uuField.reasoning ?? "directly mapped"}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 1 — Marketing Intelligence
// ─────────────────────────────────────────────────────────────────────────────

function buildMarketingIntelligence(uu: UserUnderstanding): MarketingIntelligence {
  // campaignGoal: map business goal → marketing goal taxonomy
  const campaignGoal = (() => {
    const bg = uu.businessGoal.value;
    const intent = uu.intent.value;
    if (bg === "educate_audience" || intent === "educational" || intent === "informative") {
      return sf("education", "high", `Intent="${intent}" and business goal="${bg}" both signal an educational campaign`);
    }
    if (bg === "build_trust") {
      return sf("trust", "high", `Business goal is explicitly "build_trust" — campaign must prioritize credibility`);
    }
    if (bg === "generate_leads" || intent === "lead_generation") {
      return sf("lead_generation", "high", `Business goal="${bg}" and intent="${intent}" converge on lead generation`);
    }
    if (bg === "drive_sales" || bg === "promote_offer" || intent === "promotional") {
      return sf("sales", "high", `Business goal="${bg}" and intent="${intent}" signal a sales conversion campaign`);
    }
    if (bg === "announce_launch" || bg === "increase_awareness" || intent === "event_announcement" || intent === "awareness") {
      return sf("awareness", "high", `Business goal="${bg}" and intent="${intent}" indicate an awareness campaign`);
    }
    if (intent === "brand_building") {
      return sf("engagement", "medium", `Brand-building intent suggests engagement and relationship focus`);
    }
    if (uu.urgency.value === "none" && uu.campaignGoal.value !== "unknown") {
      return sf("awareness", "medium", `No urgency signals detected — defaulting to awareness as the safest campaign goal`);
    }
    return unknownSf("campaignGoal") as StrategyField<"awareness" | "lead_generation" | "sales" | "trust" | "education" | "engagement" | "retention">;
  })();

  // marketingObjective: synthesize a specific objective from industry + campaign goal
  const marketingObjective = (() => {
    const industry = uu.industry.value;
    const goal = campaignGoal.value;
    if (goal === "unknown") return unknownSf("marketingObjective");
    const objectiveMap: Record<string, Record<string, string>> = {
      healthcare:      { lead_generation: "Drive qualified consultation bookings from targeted adults", awareness: "Raise awareness of health checkup packages among local families", trust: "Build institutional credibility and patient confidence", education: "Educate potential patients on procedures and outcomes" },
      food_beverage:   { awareness: "Maximise foot traffic and social sharing for the opening event", sales: "Drive reservation bookings and repeat visits", engagement: "Build a local following and brand affinity" },
      real_estate:     { lead_generation: "Generate qualified inquiry calls from property buyers and investors", awareness: "Position the development as the premium choice in the market" },
      finance:         { education: "Demystify investment options and lower the barrier to starting", lead_generation: "Drive sign-ups and consultation bookings for financial products", awareness: "Raise brand credibility among first-time investors" },
      education:       { lead_generation: "Generate application inquiries and open-day bookings", awareness: "Build school brand reputation among prospective families" },
      beauty_wellness: { lead_generation: "Drive appointment bookings via social media", awareness: "Showcase transformation results to attract new clients" },
      jewellery_luxury: { sales: "Convert high-intent buyers at emotional purchase occasions", awareness: "Build aspirational brand positioning in the luxury segment" },
      automotive:      { lead_generation: "Drive test drive bookings and showroom visits", awareness: "Introduce new model with aspirational positioning" },
    };
    const industryMap = objectiveMap[industry ?? ""] ?? {};
    const specific = industryMap[goal ?? ""];
    if (specific) return sf(specific, "high", `${industry} × ${goal} → specific marketing objective from knowledge bank`);
    return sf(`${goal?.replace(/_/g, " ")} objective for ${industry ?? "this business"}`, "medium", `Generic objective synthesized from campaign goal and industry`);
  })();

  // conversionPriority: from urgency + buyer stage
  const conversionPriority = (() => {
    const urgency = uu.urgency.value;
    const stage = uu.campaignGoal.value;
    if (urgency === "immediate" || urgency === "high") {
      return sf("immediate", "high", `Urgency="${urgency}" requires the creative to drive action right now`);
    }
    if (stage === "conversion" || stage === "lead_capture") {
      return sf("short_term", "medium", `Campaign goal="${stage}" suggests conversion within days to weeks`);
    }
    if (uu.intent.value === "brand_building" || uu.intent.value === "awareness") {
      return sf("long_term", "medium", `Brand building and awareness campaigns operate on a multi-month timeline`);
    }
    return sf("short_term", "low", `No strong conversion-timing signal — defaulting to short-term`);
  })();

  return { campaignGoal, marketingObjective, conversionPriority };
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 2 — Audience Intelligence
// ─────────────────────────────────────────────────────────────────────────────

function buildAudienceIntelligence(uu: UserUnderstanding, ai: AssetIntelligence, kb: ReturnType<typeof getKnowledge>): AudienceIntelligence {
  const primaryAudience = uu.audienceType.value !== "unknown"
    ? sf(uu.audienceType.value, uu.audienceType.confidence, `From User Understanding: ${uu.audienceType.reason}`)
    : sf(kb.audienceProfile, "medium", `Industry knowledge default for "${uu.industry.value}"`);

  const secondaryAudience = (() => {
    const industry = uu.industry.value;
    const secondary: Record<string, string> = {
      education:       "influencers and peer groups of prospective students",
      real_estate:     "investment advisors, family members influencing the purchase",
      healthcare:      "family members who drive loved ones to seek care",
      finance:         "spouses and family partners who share financial decisions",
      automotive:      "family members and close friends who influence the purchase",
    };
    const val = secondary[industry ?? ""];
    if (val) return sf(val, "medium", `Industry-standard secondary influencer audience for "${industry}"`);
    return unknownSf("secondaryAudience");
  })();

  const ageGroup = sf(kb.ageGroup, "medium", `Age profile inferred from industry knowledge bank for "${uu.industry.value}"`);

  const incomeGroup = (() => {
    const luxuryLevel = (ai.reference?.luxuryLevel?.value ?? ai.brandKit?.brandColors?.value) ? "medium" : undefined;
    const industry = uu.industry.value;
    if (industry === "jewellery_luxury" || industry === "real_estate") {
      return sf("affluent", "high", `Industry="${industry}" targets affluent buyers by nature`);
    }
    if (industry === "automotive") {
      return sf("affluent", "medium", `Automotive industry skews toward mid-to-high income buyers`);
    }
    void luxuryLevel;
    return sf(kb.incomeGroup, "medium", `Income profile inferred from industry knowledge bank`);
  })();

  const profession = (() => {
    const industry = uu.industry.value;
    const profMap: Record<string, string> = {
      finance:         "working professionals, salaried employees, business owners",
      education:       "parents, guardians, students preparing for higher studies",
      healthcare:      "general adults, patients, caregivers",
      real_estate:     "business owners, senior professionals, investors",
      automotive:      "professionals and enthusiasts with disposable income",
      jewellery_luxury: "affluent professionals and couples celebrating milestones",
    };
    const val = profMap[industry ?? ""];
    if (val) return sf(val, "medium", `Profession profile from knowledge bank for "${industry}"`);
    return unknownSf("profession");
  })();

  const knowledgeLevel = (() => {
    const edu = uu.educationLevelRequired.value;
    if (edu === "high") return sf("novice", "high", `High education requirement detected — audience is unfamiliar with this concept`);
    if (edu === "medium") return sf("intermediate", "medium", `Medium education requirement — audience has basic awareness`);
    if (edu === "none" || edu === "low") return sf("intermediate", "medium", `Low education need — audience already understands the basics`);
    return sf("novice", "low", `Defaulting to novice knowledge level — safer assumption for mass campaigns`);
  })();

  const buyerStage = (() => {
    const intent = uu.intent.value;
    const stageMap: Record<string, "awareness" | "consideration" | "decision" | "retention"> = {
      informative:       "awareness",
      educational:       "awareness",
      awareness:         "awareness",
      brand_building:    "awareness",
      product_showcase:  "consideration",
      testimonial:       "consideration",
      comparison:        "consideration",
      lead_generation:   "decision",
      promotional:       "decision",
      event_announcement:"awareness",
      before_after:      "consideration",
    };
    const stage = stageMap[intent ?? ""];
    if (stage) return sf(stage, "high", `Intent="${intent}" reliably maps to the "${stage}" buyer stage`);
    return sf(kb.defaultBuyerStage, "medium", `Industry default buyer stage from knowledge bank`);
  })();

  // painPoints: Phase 2 extractedPainPoints override KB fallback
  const painPoints = (() => {
    if (uu.extractedPainPoints.length > 0) {
      const stated = uu.extractedPainPoints.map(p => p.value).join("; ");
      const extra = uu.extractedPainPoints.length > 1 ? ` + ${uu.extractedPainPoints.length - 1} more` : "";
      return sf(stated, "high", `Pain points from user-stated input: "${uu.extractedPainPoints[0].value}"${extra}. KB fallback suppressed.`);
    }
    return sf(kb.painPoints, "medium", `Industry-specific pain points from knowledge bank for "${uu.industry.value}"`);
  })();

  const desires = sf(kb.desires, "medium", `Industry-specific desires from knowledge bank for "${uu.industry.value}"`);
  const objections = sf(kb.objections, "medium", `Industry-specific objections from knowledge bank for "${uu.industry.value}"`);
  const trustRequirement = fromUU<"low" | "medium" | "high" | "critical">(uu.trustRequirement, "trustRequirement");
  const motivation = sf(kb.motivation, "medium", `Core motivation from industry knowledge bank for "${uu.industry.value}"`);

  const buyingIntent = (() => {
    const urgency = uu.urgency.value;
    const intent = uu.intent.value;
    if (urgency === "immediate") return sf("immediate", "high", `Urgency="immediate" signals active ready-to-buy audience`);
    if (urgency === "high" || intent === "lead_generation" || intent === "promotional") return sf("high", "high", `High urgency or direct conversion intent signals strong buying intent`);
    if (intent === "educational" || intent === "informative") return sf("low", "medium", `Educational/informative content targets early-stage explorers, not ready buyers`);
    if (intent === "awareness") return sf("none", "medium", `Pure awareness campaigns reach audiences with no immediate purchase intent`);
    return sf("medium", "low", `No strong buying intent signal — defaulting to medium`);
  })();

  // awarenessLevel: consumed from Phase 2 customerAwareness (Eugene Schwartz model)
  const awarenessLevel: StrategyField<CustomerAwarenessLevel> = uu.customerAwareness.value !== "unknown"
    ? sf<CustomerAwarenessLevel>(
        uu.customerAwareness.value as CustomerAwarenessLevel,
        uu.customerAwareness.confidence,
        `Awareness level from Phase 2 detection: "${uu.customerAwareness.value}" (source: ${uu.customerAwareness.source})`
      )
    : sf<CustomerAwarenessLevel>("unaware", "low", `No explicit awareness signal — defaulting to "unaware" for broad campaigns`);

  // dominantFear: Phase 2 extractedPainPoints > industry KB
  const kbKeyLocal = uu.subIndustry.value !== "unknown" ? uu.subIndustry.value : uu.industry.value;
  const dominantFear: StrategyField<PainPointCategory | "none"> = (() => {
    if (uu.extractedPainPoints.length > 0) {
      const topPain = uu.extractedPainPoints[0];
      return sf<PainPointCategory | "none">(
        topPain.category,
        "high",
        `Dominant fear from user-stated pain point: "${topPain.value}" — category: ${topPain.category}`
      );
    }
    const fearByIndustry: Record<string, PainPointCategory> = {
      healthcare: "fear_of_pain",      dental: "fear_of_pain",   dental_clinic: "fear_of_pain",
      finance:    "price_concern",     real_estate: "price_concern",
      education:  "result_doubt",      beauty_wellness: "result_doubt",
      jewellery_luxury: "price_concern", automotive: "price_concern",
      food_beverage: "quality_concern",
    };
    const kbFear = fearByIndustry[kbKeyLocal ?? ""];
    if (kbFear) return sf<PainPointCategory | "none">(kbFear, "medium", `Dominant fear inferred from industry KB for "${uu.industry.value}"`);
    return sf<PainPointCategory | "none">("none", "low", `No pain point signal detected`);
  })();

  return { primaryAudience, secondaryAudience, ageGroup, incomeGroup, profession, knowledgeLevel, buyerStage, painPoints, desires, objections, trustRequirement, motivation, buyingIntent, awarenessLevel, dominantFear };
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 3 — Communication Intelligence
// ─────────────────────────────────────────────────────────────────────────────

function buildCommunicationIntelligence(uu: UserUnderstanding): CommunicationIntelligence {
  // UU uses "warm_friendly"/"luxurious"/"inspirational"/"playful" —
  // Creative Brain normalises to its own richer communication style vocabulary.
  const commStyleMap: Record<string, "luxury" | "premium" | "professional" | "friendly" | "minimal" | "educational" | "emotional" | "authority"> = {
    warm_friendly: "friendly",
    friendly:      "friendly",
    luxurious:     "luxury",
    luxury:        "luxury",
    professional:  "professional",
    educational:   "educational",
    urgent:        "authority",
    inspirational: "emotional",
    playful:       "friendly",
    minimal:       "minimal",
    authority:     "authority",
    premium:       "premium",
    emotional:     "emotional",
  };
  const communicationStyle = fromUU<"luxury" | "premium" | "professional" | "friendly" | "minimal" | "educational" | "emotional" | "authority">(
    uu.communicationStyle,
    "communicationStyle",
    (v) => commStyleMap[v] ?? "unknown"
  );

  const confidenceLevel = (() => {
    const industry = uu.industry.value;
    const trust = uu.trustRequirement.value;
    if (trust === "critical") return sf("reassuring", "high", `Critical trust requirement (${industry}) demands reassurance above confidence`);
    if (industry === "jewellery_luxury" || industry === "real_estate") return sf("aspirational", "high", `Luxury/aspirational industry demands aspiration-first communication`);
    if (communicationStyle.value === "authority") return sf("authoritative", "high", `Authority communication style requires projecting certainty`);
    if (trust === "high") return sf("confident", "medium", `High trust requirement balanced with confident delivery`);
    return sf("confident", "low", `Default confidence level — no specific signal`);
  })();

  const urgency = fromUU<"none" | "low" | "medium" | "high" | "immediate">(uu.urgency, "urgency");

  const tone = (() => {
    const style = uu.communicationStyle.value;
    const intent = uu.intent.value;
    const toneMap: Record<string, "formal" | "conversational" | "inspirational" | "urgent" | "educational" | "emotional" | "minimal"> = {
      luxury:       "minimal",
      premium:      "inspirational",
      professional: "formal",
      friendly:     "conversational",
      minimal:      "minimal",
      educational:  "educational",
      emotional:    "emotional",
      authority:    "formal",
    };
    const fromStyle = toneMap[style ?? ""];
    if (intent === "promotional" && uu.urgency.value !== "none") return sf("urgent", "high", `Promotional intent with urgency signal → urgent tone`);
    if (intent === "educational" || intent === "informative") return sf("educational", "high", `Informative/educational intent → educational tone`);
    if (intent === "brand_building") return sf("inspirational", "medium", `Brand building intent → inspirational tone`);
    if (fromStyle) return sf(fromStyle, "medium", `Tone inferred from communication style="${style}"`);
    return sf("conversational", "low", `No specific tone signal — defaulting to conversational`);
  })();

  // persuasionApproach: from Phase 2 authority/social proof signals + campaign context
  const persuasionApproach = (() => {
    const hasAuthority = uu.authoritySignals.length > 0;
    const hasSocialProof = uu.socialProof.length > 0;
    const trust = uu.trustRequirement.value;
    const intent = uu.intent.value;
    const urgencyVal = uu.urgency.value;
    if (hasAuthority && (trust === "critical" || trust === "high")) {
      return sf<"authority_led" | "social_proof_led" | "scarcity_led" | "education_led" | "emotion_led" | "liking_led">(
        "authority_led", "high", `Authority signals detected + high trust requirement → authority-led persuasion`
      );
    }
    if (hasSocialProof && (intent === "lead_generation" || intent === "promotional")) {
      return sf<"authority_led" | "social_proof_led" | "scarcity_led" | "education_led" | "emotion_led" | "liking_led">(
        "social_proof_led", "high", `Social proof signals detected + conversion intent → social-proof-led persuasion`
      );
    }
    if (urgencyVal === "high" || urgencyVal === "immediate") {
      return sf<"authority_led" | "social_proof_led" | "scarcity_led" | "education_led" | "emotion_led" | "liking_led">(
        "scarcity_led", "medium", `High urgency → scarcity/urgency-led persuasion`
      );
    }
    if (intent === "educational" || intent === "informative") {
      return sf<"authority_led" | "social_proof_led" | "scarcity_led" | "education_led" | "emotion_led" | "liking_led">(
        "education_led", "high", `Educational intent → education-led persuasion`
      );
    }
    if (intent === "brand_building" || intent === "awareness") {
      return sf<"authority_led" | "social_proof_led" | "scarcity_led" | "education_led" | "emotion_led" | "liking_led">(
        "emotion_led", "medium", `Awareness/brand-building → emotion-led persuasion`
      );
    }
    return sf<"authority_led" | "social_proof_led" | "scarcity_led" | "education_led" | "emotion_led" | "liking_led">(
      "emotion_led", "low", `No specific persuasion signal — defaulting to emotion-led`
    );
  })();

  // languageRegister: from Phase 2 language detection
  const languageRegister = (() => {
    const lang = uu.language.value;
    if (lang === "hindi") return sf<"english_standard" | "bilingual_en_hi" | "hindi_primary" | "regional">("hindi_primary", "high", `Hindi language detected → hindi_primary register`);
    if (lang === "mixed") return sf<"english_standard" | "bilingual_en_hi" | "hindi_primary" | "regional">("bilingual_en_hi", "high", `Mixed language detected → bilingual_en_hi register`);
    return sf<"english_standard" | "bilingual_en_hi" | "hindi_primary" | "regional">("english_standard", "medium", `English language → english_standard register`);
  })();

  return { communicationStyle, confidenceLevel, urgency, tone, persuasionApproach, languageRegister };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.2B — Visual directive conflict resolution maps
// heroDecision.heroType is the authoritative signal. These maps drive the
// overrides in buildCreativeIntelligence() and buildVisualReasoning() so that
// focusPriority and humanPresence are always coherent with the hero decision.
// ─────────────────────────────────────────────────────────────────────────────

type FocusPriorityValue = "product" | "person" | "emotion" | "information" | "brand" | "transformation" | "moment" | "environment";

const HERO_TYPE_TO_FOCUS: Record<HeroType, FocusPriorityValue> = {
  person:         "person",
  authority:      "person",         // authority is a person-dominant archetype
  lifestyle:      "person",         // lifestyle is anchored on a person in a scene
  transformation: "transformation",
  moment:         "moment",
  environment:    "environment",
  product:        "product",
  data:           "information",
};

const HERO_TYPE_TO_HUMAN_PRESENCE: Record<HeroType, "none" | "incidental" | "supporting" | "hero"> = {
  person:         "hero",           // person IS the visual message
  authority:      "hero",           // authority figure IS the visual message
  transformation: "hero",           // person showing the transformation IS the message
  lifestyle:      "hero",           // person living the lifestyle IS the anchor
  moment:         "supporting",     // humans appear in the moment but the moment is the anchor
  environment:    "incidental",     // space is the anchor; people are ambient props
  product:        "incidental",     // product is the anchor; human may appear but is not the focus
  data:           "none",           // data visualization requires no human presence
};

/** Safety net — throws if the conflict resolution layer produced an impossible combination. */
function validateVisualCoherence(focusPriority: string, humanPresence: string, heroType: HeroType): void {
  const impossibles: Array<{ fp?: string; hp?: string; heroType: HeroType; reason: string }> = [
    { fp: "person", heroType: "moment",      reason: "A 'moment' hero cannot have focusPriority='person'" },
    { fp: "person", heroType: "environment", reason: "An 'environment' hero cannot have focusPriority='person'" },
    { fp: "person", heroType: "product",     reason: "A 'product' hero cannot have focusPriority='person'" },
    { hp: "hero",   heroType: "product",     reason: "A 'product' hero cannot have humanPresence='hero'" },
    { hp: "hero",   heroType: "environment", reason: "An 'environment' hero cannot have humanPresence='hero'" },
    { hp: "hero",   heroType: "moment",      reason: "A 'moment' hero cannot have humanPresence='hero'" },
    { hp: "none",   heroType: "person",      reason: "A 'person' hero cannot have humanPresence='none'" },
    { hp: "none",   heroType: "authority",   reason: "An 'authority' hero cannot have humanPresence='none'" },
  ];
  for (const c of impossibles) {
    if (
      (!c.fp || focusPriority === c.fp) &&
      (!c.hp || humanPresence === c.hp) &&
      c.heroType === heroType
    ) {
      throw new Error(
        `[Creative Brain 10.2B] Impossible visual directive combination: ${c.reason}. ` +
        `focusPriority="${focusPriority}", humanPresence="${humanPresence}", heroType="${heroType}"`
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 4 — Creative Intelligence
// ─────────────────────────────────────────────────────────────────────────────

function buildCreativeIntelligence(
  uu:          UserUnderstanding,
  ai:          AssetIntelligence,
  kb:          ReturnType<typeof getKnowledge>,
  heroDecision: HeroDecision,
  matrix:      CreativeMatrixResult,
): CreativeIntelligence {
  void ai; void matrix; // reserved for future enrichment

  const creativeCategory = (() => {
    const platform = uu.platform.value;
    const kind = uu.outputFormatPreference.value;
    const intent = uu.intent.value;
    if (platform === "instagram" || platform === "facebook" || kind === "square") return sf("social_post", "high", `Platform="${platform}" maps directly to social post format`);
    if (kind === "poster_portrait" || platform === "poster" || platform === "flyer") return sf("poster", "high", `Output format="${kind}" or platform="${platform}" maps to poster`);
    if (kind === "landscape") return sf("banner", "high", `Landscape output format maps to banner category`);
    if (intent === "educational" || intent === "informative") return sf("infographic", "medium", `Educational/informative intent suggests infographic format`);
    if (intent === "promotional") return sf("advertisement", "medium", `Promotional intent maps to advertisement creative category`);
    if (intent === "event_announcement") return sf("advertisement", "medium", `Event announcement maps to advertisement`);
    return sf("advertisement", "low", `Defaulting to advertisement — most general commercial category`);
  })();

  // Phase 10: heroSubject now comes from the Hero Decision Engine (5-signal selection)
  const heroSubject = sf(heroDecision.subject, heroDecision.confidence, heroDecision.reasoning);

  // supportingSubjects: from industry knowledge bank
  const supportingSubjects = (() => {
    const industry = uu.industry.value;
    const supportMap: Record<string, string> = {
      dental:           "trust badge, certification icon, subtle equipment detail, testimonial quote",
      healthcare:       "accreditation badge, before/after icon, family group, service icons",
      food_beverage:    "ingredient detail shot, ambient restaurant scene, event date graphic",
      real_estate:      "architectural detail, lifestyle scene, amenity icons, map element",
      finance:          "growth chart, trust statistics, regulatory certification badge",
      education:        "campus activity, faculty portrait, program highlights, student testimonials",
      beauty_wellness:  "product detail, stylist in action, testimonial quote, before/after strip",
      jewellery_luxury: "brand mark, close-up material detail, packaging, editorial lifestyle",
      automotive:       "interior craftsmanship detail, brand badge, technical specification card",
    };
    const val = supportMap[industry ?? ""];
    if (val) return sf(val, "medium", `Supporting elements from knowledge bank for "${industry}"`);
    return unknownSf("supportingSubjects");
  })();

  // informationDensity: from the user's explicit contentType signal (UU still provides this).
  const infoDensityMap: Record<string, "single_message" | "two_elements" | "multi_element" | "complex_infographic"> = {
    image_only:        "single_message",
    image_with_text:   "multi_element",
    infographic:       "complex_infographic",
    comparison:        "complex_infographic",
    before_after_split:"two_elements",
  };
  const informationDensity = fromUU<"single_message" | "two_elements" | "multi_element" | "complex_infographic">(
    uu.contentType,
    "informationDensity",
    (v) => infoDensityMap[v] ?? "unknown"
  );

  // visualDensity — Creative Brain owns this decision now (moved from UU Fix 2).
  // Determines how visually busy the layout should be based on industry + luxury + intent signals.
  const visualDensity = (() => {
    const industry = uu.industry.value;
    const subInd   = uu.subIndustry.value;
    const intent   = uu.intent.value;
    if (["jewellery_luxury", "real_estate"].includes(industry) || subInd === "luxury_property") {
      return sf<"minimal" | "moderate" | "rich" | "very_rich">("minimal", "high", `Visual density "minimal" — luxury industry "${industry}" requires premium whitespace; less is more`);
    }
    if (intent === "educational" || intent === "informative" || intent === "before_after") {
      return sf<"minimal" | "moderate" | "rich" | "very_rich">("rich", "high", `Visual density "rich" — intent "${intent}" requires multiple simultaneous visual elements to communicate effectively`);
    }
    if (uu.trustRequirement.value === "critical" || uu.trustRequirement.value === "high") {
      return sf<"minimal" | "moderate" | "rich" | "very_rich">("moderate", "medium", `Visual density "moderate" — critical trust requirement benefits from structured, credible layout: not too busy, not too sparse`);
    }
    return sf<"minimal" | "moderate" | "rich" | "very_rich">("moderate", "low", `Visual density defaults to "moderate" — no strong signal for minimal or rich layout`);
  })();

  // visualComplexity — Creative Brain owns this decision now (moved from UU Fix 3).
  // Determines how many compositional layers / how complex the creative structure should be.
  const visualComplexity = (() => {
    const intent = uu.intent.value;
    const eduLevel = uu.educationLevelRequired.value;
    if (intent === "event_announcement") {
      return sf<"simple" | "medium" | "complex">("simple", "high", `Visual complexity "simple" — event announcements communicate one clear message: what, when, where`);
    }
    if (eduLevel === "high" || intent === "educational" || intent === "informative") {
      return sf<"simple" | "medium" | "complex">("complex", "high", `Visual complexity "complex" — education level "${eduLevel}" + intent "${intent}" requires a multi-element layout to explain clearly`);
    }
    if (intent === "promotional") {
      return sf<"simple" | "medium" | "complex">("medium", "medium", `Visual complexity "medium" — promotional creatives need offer + benefits + CTA but should stay scannable`);
    }
    return sf<"simple" | "medium" | "complex">("medium", "low", `Visual complexity defaults to "medium" — no strong signal for simple or complex layout`);
  })();

  const focusPriority = (() => {
    const intent = uu.intent.value;
    const product = uu.productContext.value;
    if (intent === "before_after") return sf("transformation", "high", `Before/after intent → focus must show transformation, not product`);
    if (intent === "product_showcase" || product === "physical_product") return sf("product", "high", `Product showcase intent → product must be the visual hero`);
    if (intent === "lead_generation") return sf("emotion", "high", `Lead generation → emotional connection to the outcome drives response`);
    if (intent === "educational" || intent === "informative") {
      // Visual/experiential industries teach through human interaction and demonstration, not text layout
      const visualIndustries = ["dental", "dental_clinic", "healthcare", "beauty_wellness", "food_beverage", "restaurant", "hospitality"];
      const kbKeyLocal = uu.subIndustry.value !== "unknown" ? uu.subIndustry.value : uu.industry.value;
      if (visualIndustries.includes(kbKeyLocal ?? "")) {
        return sf("person", "high", `${kbKeyLocal} educational content → education through human demonstration and expertise, not text hierarchy`);
      }
      return sf("information", "high", `Educational intent → information hierarchy is the focus`);
    }
    if (intent === "brand_building") return sf("brand", "medium", `Brand building → brand identity drives the creative`);
    return sf("person", "medium", `Default — human presence is the most universally effective anchor in commercial advertising`);
  })();

  // Phase 10.2B: heroDecision.heroType is the authority — override focusPriority when they conflict
  const requiredFocus = HERO_TYPE_TO_FOCUS[heroDecision.heroType];
  const resolvedFocusPriority = requiredFocus !== focusPriority.value
    ? sf<FocusPriorityValue>(requiredFocus, "high", `[10.2B] heroType="${heroDecision.heroType}" overrides intent-derived focusPriority="${focusPriority.value}" — hero decision is the authoritative visual anchor`)
    : focusPriority as StrategyField<FocusPriorityValue>;

  return { creativeCategory, heroSubject, supportingSubjects, informationDensity, visualDensity, visualComplexity, focusPriority: resolvedFocusPriority };
}

// ─────────────────────────────────────────────────────────────────────────────
// Trust asset builder (private helper for Domain 5)
// ─────────────────────────────────────────────────────────────────────────────

const TRUST_STRATEGY_BY_INDUSTRY: Record<string, TrustAssets["trustStrategy"]> = {
  healthcare: "authority_first",     dental:          "authority_first",
  dental_clinic: "authority_first",  finance:         "authority_first",
  education:  "authority_first",     food_beverage:   "social_proof_first",
  beauty_wellness: "social_proof_first", hospitality: "social_proof_first",
  retail:     "social_proof_first",  jewellery_luxury: "environmental",
  real_estate:"environmental",       automotive:      "both",
};

function buildTrustAssets(uu: UserUnderstanding, industryKey: string | undefined): TrustAssets {
  const authority = uu.authoritySignals;
  const social    = uu.socialProof;

  const hasExperienceYears    = authority.some(a => a.type === "experience_years");
  const experienceYears       = authority.find(a => a.type === "experience_years")?.value ?? null;
  const hasCertification      = authority.some(a => a.type === "certification");
  const certifications        = authority.filter(a => a.type === "certification").map(a => a.value);
  const hasAward              = authority.some(a => a.type === "award");
  const awards                = authority.filter(a => a.type === "award").map(a => a.value);
  const hasGovernmentApproval = authority.some(a => a.type === "government_approval");
  const teamSize              = authority.find(a => a.type === "team_size")?.value ?? null;
  const branchCount           = authority.find(a => a.type === "branch_count")?.value ?? null;

  const hasCustomerCount = social.some(s => s.type === "customer_count");
  const customerCount    = social.find(s => s.type === "customer_count")?.value ?? null;
  const hasRating        = social.some(s => s.type === "rating") || authority.some(a => a.type === "rating");
  const rating           = (social.find(s => s.type === "rating") ?? authority.find(a => a.type === "rating"))?.value ?? null;
  const hasTestimonials  = social.some(s => s.type === "testimonial" || s.type === "trusted_by");
  const hasCelebrity     = social.some(s => s.type === "celebrity_endorsement");
  const establishedSince = social.find(s => s.type === "established_since")?.value ?? null;

  const provenCount  = [hasCertification, hasRating, hasCustomerCount].filter(Boolean).length;
  const claimedCount = [hasExperienceYears, hasAward, hasGovernmentApproval].filter(Boolean).length;
  const overallTrustStrength: TrustAssets["overallTrustStrength"] =
    provenCount >= 2             ? "proven"   :
    provenCount === 1            ? "claimed"  :
    claimedCount >= 1            ? "claimed"  :
    authority.length + social.length > 0 ? "implicit" : "none";

  const trustStrategy = TRUST_STRATEGY_BY_INDUSTRY[industryKey ?? ""] ?? "both";

  const assets: TrustAsset[] = [
    ...authority.map(a => ({
      type:         a.type as AuthoritySignalType,
      value:        a.value,
      source:       "user_explicit" as const,
      confidence:   a.confidence,
      evidenceType: (a.type === "government_approval" ? "government" :
                     a.type === "certification"        ? "third_party" : "user_claim") as TrustAsset["evidenceType"],
    })),
    ...social.map(s => ({
      type:         s.type as SocialProofType,
      value:        s.value,
      source:       "user_explicit" as const,
      confidence:   s.confidence,
      evidenceType: (s.type === "testimonial"          ? "customer" :
                     s.type === "celebrity_endorsement" ? "media"    :
                     s.type === "media_mention"         ? "media"    : "brand") as TrustAsset["evidenceType"],
    })),
  ];

  const totalSignals = authority.length + social.length;
  const confidence: FieldConfidence = totalSignals >= 3 ? "high" : totalSignals >= 1 ? "medium" : "low";
  const source: IntelligenceSource  = totalSignals > 0 ? "user_explicit" : "default";

  return {
    hasExperienceYears, experienceYears, hasCertification, certifications,
    hasAward, awards, hasGovernmentApproval, teamSize, branchCount,
    hasCustomerCount, customerCount, hasRating, rating,
    hasTestimonials, hasCelebrity, establishedSince,
    overallTrustStrength, trustStrategy, assets, confidence, source,
    reasoning: totalSignals > 0
      ? `${totalSignals} trust signal(s) from user: ${assets.map(a => a.value).slice(0, 3).join(", ")}${totalSignals > 3 ? ` + ${totalSignals - 3} more` : ""}`
      : `No explicit trust signals — Creative Director will use industry-standard trust conventions`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 5 — Business Intelligence
// ─────────────────────────────────────────────────────────────────────────────

function buildBusinessIntelligence(uu: UserUnderstanding, ai: AssetIntelligence, kb: ReturnType<typeof getKnowledge>): BusinessIntelligence {
  const industry = fromUU(uu.industry, "industry");
  const subIndustry = fromUU(uu.subIndustry, "subIndustry");
  const businessType = fromUU<"local_service" | "national_brand" | "premium_luxury" | "mass_market" | "professional_service" | "retail" | "ecommerce" | "financial_service" | "educational_institution">(
    uu.businessCategory, "businessType"
  );
  const businessGoal = fromUU(uu.businessGoal, "businessGoal");

  // usp: Phase 2 extractedUsp always overrides KB
  const usp = (() => {
    if (uu.extractedUsp.length > 0) {
      const primary = uu.extractedUsp[0];
      const rest = uu.extractedUsp.slice(1).map(u => u.value).join("; ");
      const combined = rest ? `${primary.value}; ${rest}` : primary.value;
      const extra = uu.extractedUsp.length > 1 ? ` + ${uu.extractedUsp.length - 1} more` : "";
      return sf(combined, "high", `USP from user-stated differentiators: "${primary.value}"${extra}. KB fallback suppressed.`);
    }
    const brand = ai.brandKit?.brandColors?.value;
    const hasIndustry = uu.industry.value !== "unknown" || uu.subIndustry.value !== "unknown";
    if (brand && brand !== "unknown") return sf(kb.usp, "medium", `USP from knowledge bank (brand kit present, no explicit USP stated)`);
    if (hasIndustry) return sf(kb.usp, "medium", `USP inferred from industry knowledge bank`);
    return unknownSf("usp");
  })();

  // offerType: Phase 2 detectedOffer overrides keyword inference
  const offerType = (() => {
    if (uu.detectedOffer.offerType !== "none") {
      const detected = uu.detectedOffer.offerType;
      const mapToEnum: Record<string, "none" | "discount" | "free_trial" | "free_consultation" | "service_package" | "event" | "product_launch" | "information"> = {
        discount: "discount", emi: "discount", cashback: "discount",
        free_consultation: "free_consultation", free_trial: "free_trial",
        bundle: "service_package", bogo: "discount", limited_time: "discount",
        early_bird: "discount", pre_booking: "event", launch_offer: "product_launch",
      };
      const mapped = mapToEnum[detected] ?? "discount";
      return sf(mapped, "high", `Offer type from Phase 2 detection: "${detected}" → mapped to "${mapped}"`);
    }
    const intent = uu.intent.value;
    const goal = uu.businessGoal.value;
    if (intent === "event_announcement" || goal === "announce_launch") return sf("event", "high", `Event/launch intent → event offer type`);
    if (intent === "lead_generation" || goal === "generate_leads") return sf("free_consultation", "high", `Lead generation → free consultation`);
    if (intent === "educational" || intent === "informative") return sf("information", "medium", `Educational intent → information offer`);
    if (intent === "product_showcase") return sf("product_launch", "medium", `Product showcase intent → product introduction`);
    if (intent === "promotional" || goal === "promote_offer" || goal === "drive_sales") return sf("discount", "medium", `Promotional intent → likely a discount or special offer`);
    return sf("none", "medium", `No offer signal detected`);
  })();

  const seasonality = fromUU(uu.seasonality, "seasonality");

  const competitivePosition = (() => {
    const trust = uu.trustRequirement.value;
    const brand = ai.brandKit?.brandColors?.value;
    if (uu.brandContext.value === "established_brand") return sf("leader", "medium", `Brand shows longevity signals suggesting established market position`);
    if (uu.brandContext.value === "new_brand") return sf("emerging", "high", `New brand / grand opening signals → emerging competitive position`);
    if (trust === "critical" && brand && brand !== "unknown") return sf("leader", "medium", `High trust requirement + existing brand kit suggests an established player`);
    return sf(kb.competitivePosition as "challenger" | "leader" | "niche" | "emerging" | "unknown", "low", `Default competitive position from industry knowledge bank`);
  })();

  // Phase 4 — new fields consuming Phase 2 enrichment
  const industryKey = uu.subIndustry.value !== "unknown" ? uu.subIndustry.value : uu.industry.value !== "unknown" ? uu.industry.value : undefined;

  const offerDetails: OfferDetailsField = uu.detectedOffer.offerType !== "none"
    ? {
        offerType:  uu.detectedOffer.offerType,
        offerValue: uu.detectedOffer.offerValue ?? null,
        urgency:    uu.detectedOffer.urgency,
        source:     "user_explicit",
        confidence: uu.detectedOffer.confidence,
        reasoning:  `Offer from user input: "${uu.detectedOffer.offerType}"${uu.detectedOffer.offerValue ? ` valued at "${uu.detectedOffer.offerValue}"` : ""}`,
      }
    : {
        offerType:  "none",
        offerValue: null,
        urgency:    "none",
        source:     "default",
        confidence: "high",
        reasoning:  "No commercial offer detected in user idea",
      };

  const specificDifferentiators: StrategyField = uu.extractedUsp.length > 0
    ? sf(
        uu.extractedUsp.map(u => u.value).join(", "),
        "high",
        `${uu.extractedUsp.length} differentiator(s) from user input: "${uu.extractedUsp[0].value}"`
      )
    : sf("unknown", "unknown", `No specific differentiators stated — Creative Director will use industry conventions`);

  const trustAssets = buildTrustAssets(uu, industryKey);

  return { industry, subIndustry, businessType, businessGoal, usp, offerType, seasonality, competitivePosition, offerDetails, specificDifferentiators, trustAssets };
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 6 — Platform Intelligence
// ─────────────────────────────────────────────────────────────────────────────

function buildPlatformIntelligence(uu: UserUnderstanding): PlatformIntelligence {
  const primaryPlatformValue = (() => {
    const p = uu.platform.value;
    const platformMap: Record<string, "instagram" | "facebook" | "linkedin" | "youtube" | "google_display" | "website_banner" | "print" | "outdoor" | "general"> = {
      instagram: "instagram", facebook: "facebook", linkedin: "linkedin",
      twitter: "general", pinterest: "general", story: "instagram",
      poster: "print", flyer: "print", billboard: "outdoor", general: "general",
    };
    return platformMap[p ?? ""] ?? "general";
  })();

  const primaryPlatform = primaryPlatformValue !== "general"
    ? sf(primaryPlatformValue, uu.platform.confidence, `Mapped from User Understanding platform: ${uu.platform.reason}`)
    : sf("general", "low", `No specific platform detected — targeting general cross-context format`);

  const platformBehaviour = (() => {
    const behaviour = PLATFORM_BEHAVIOUR[primaryPlatformValue] ?? PLATFORM_BEHAVIOUR.general;
    return sf(behaviour, "high", `Platform behaviour from knowledge bank for "${primaryPlatformValue}"`);
  })();

  const safeAreaPriority = (() => {
    const safeArea = PLATFORM_SAFE_AREAS[primaryPlatformValue] ?? "none";
    return sf(safeArea as "none" | "top" | "bottom" | "sides" | "all", "high", `Safe area requirement from platform knowledge for "${primaryPlatformValue}"`);
  })();

  return { primaryPlatform, platformBehaviour, safeAreaPriority };
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 7 — Visual Reasoning
// ─────────────────────────────────────────────────────────────────────────────

function buildVisualReasoning(
  uu:            UserUnderstanding,
  ai:            AssetIntelligence,
  kb:            ReturnType<typeof getKnowledge>,
  luxuryProfile: LuxuryProfile,
  heroDecision:  HeroDecision,
): VisualReasoning {
  // Phase 10: luxuryLevel and premiumFeel now come from the Luxury Engine
  const luxuryLevel = sf(
    luxuryProfile.level,
    luxuryProfile.confidence,
    luxuryProfile.reasoning,
  );

  const premiumFeel = sf(
    luxuryProfile.premiumFeel,
    luxuryProfile.confidence,
    `Premium feel "${luxuryProfile.premiumFeel}" derived from luxury level "${luxuryProfile.level}"`,
  );

  const modernStyle = (() => {
    const refStyle = ai.reference?.visualStyle?.value;
    if (refStyle && refStyle !== "unknown") {
      if (refStyle.includes("3d") || refStyle.includes("digital_art")) return sf("cutting_edge", "high", `Reference image shows cutting-edge visual style`);
      if (refStyle.includes("flat") || refStyle.includes("minimal")) return sf("modern", "high", `Reference image shows modern flat/minimal style`);
    }
    const industry = uu.industry.value;
    if (industry === "finance" || industry === "healthcare") return sf("contemporary", "medium", `Finance/healthcare sectors prefer contemporary over trendy`);
    return sf("modern", "low", `No reference signal — defaulting to modern`);
  })();

  const minimalismLevel = (() => {
    const lux = luxuryProfile.level;
    const intent = uu.intent.value;
    const industry = uu.industry.value;
    if (lux === "ultra_luxury" || lux === "high") return sf("high", "high", `Minimalism "high" — luxury level "${lux}" demands high whitespace; premium brands use restraint as a signal`);
    if (["jewellery_luxury", "real_estate"].includes(industry)) return sf("high", "medium", `Minimalism "high" inferred from industry "${industry}" — luxury/aspirational categories use space as a design element`);
    if (intent === "educational" || intent === "informative" || intent === "before_after") return sf("none", "high", `Minimalism "none" — intent "${intent}" requires multiple visible elements; minimalism would prevent the information from fitting`);
    if (intent === "promotional") return sf("low", "medium", `Minimalism "low" — promotional intent needs visible offer + benefits + CTA; some content density is required`);
    return sf("low", "low", `Minimalism defaults to "low" — most commercial advertising needs visible content to communicate`);
  })();

  const photographyStyle = (() => {
    const refStyle = ai.reference?.photographyStyle?.value;
    if (refStyle && refStyle !== "unknown") return sf(refStyle as "studio_product" | "lifestyle" | "documentary" | "aerial" | "macro_detail" | "editorial" | "before_after" | "none", "high", `Photography style extracted directly from reference image analysis`);
    return sf(kb.photographyStyle as "studio_product" | "lifestyle" | "documentary" | "aerial" | "macro_detail" | "editorial" | "before_after" | "none", "medium", `Photography style from industry knowledge bank for "${uu.industry.value}"`);
  })();

  const illustrationPreference = (() => {
    const intent = uu.intent.value;
    const content = uu.contentType.value;
    if (content === "infographic" || content === "comparison" || intent === "educational") return sf("infographic_elements", "high", `Infographic/educational content requires illustrative elements`);
    if (uu.industry.value === "finance") return sf("minimal_icons", "medium", `Finance industry benefits from clean icon-driven data visualization`);
    return sf("none", "medium", `No illustration need detected — photography-primary approach`);
  })();

  // Phase 10.2B: heroDecision.heroType is the authority — align humanPresence with the hero decision
  const requiredPresence = HERO_TYPE_TO_HUMAN_PRESENCE[heroDecision.heroType];
  const humanPresence = sf(
    requiredPresence,
    "high",
    `[10.2B] heroType="${heroDecision.heroType}" → humanPresence="${requiredPresence}" — hero decision overrides kb default "${kb.humanPresence}" to ensure coherent visual directives`
  );

  const productPriority = (() => {
    const product = uu.productContext.value;
    const intent = uu.intent.value;
    if (product === "physical_product" || intent === "product_showcase") return sf("hero", "high", `Physical product + showcase intent → product must be the visual hero`);
    if (kb.humanPresence === "hero") return sf("supporting", "medium", `Human is the visual hero for this industry — product supports`);
    if (product === "service") return sf("none", "medium", `Service businesses rarely feature the service itself visually`);
    return sf("supporting", "low", `Defaulting to supporting product role`);
  })();

  const environmentPriority = (() => {
    const industry = uu.industry.value;
    const envMap: Record<string, "none" | "minimal" | "supporting" | "immersive"> = {
      real_estate:     "immersive",
      food_beverage:   "supporting",
      hospitality:     "immersive",
      beauty_wellness: "supporting",
      healthcare:      "supporting",
      automotive:      "supporting",
      jewellery_luxury:"minimal",
      finance:         "none",
    };
    const val = envMap[industry ?? ""] ?? "minimal";
    return sf(val, "medium", `Environment role inferred from industry="${industry}" — affects how much the setting contributes to the story`);
  })();

  const storytellingRequirement = (() => {
    const intent = uu.intent.value;
    if (intent === "before_after") return sf("high", "high", `Before/after intent demands a strong transformation narrative`);
    if (intent === "brand_building") return sf("high", "high", `Brand building requires emotional storytelling to create connection`);
    if (intent === "informative" || intent === "educational") return sf("medium", "medium", `Informative content needs a clear narrative thread but not deep emotion`);
    if (intent === "promotional") return sf("low", "medium", `Promotional/offer creatives focus on the deal, not a narrative`);
    if (intent === "event_announcement") return sf("low", "high", `Event announcements are single-message, not story-driven`);
    return sf("medium", "low", `No specific storytelling signal — defaulting to medium`);
  })();

  return { luxuryLevel, premiumFeel, modernStyle, minimalismLevel, photographyStyle, illustrationPreference, humanPresence, productPriority, environmentPriority, storytellingRequirement };
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 8 — Campaign Intelligence
// ─────────────────────────────────────────────────────────────────────────────

function buildCampaignIntelligence(uu: UserUnderstanding, marketing: MarketingIntelligence): CampaignIntelligence {
  const campaignCategory = (() => {
    const intent = uu.intent.value;
    const season = uu.seasonality.value;
    const goal = uu.businessGoal.value;
    if (season === "festival_season") return sf("festival", "high", `Seasonal keyword detected — campaign category is festival`);
    if (intent === "promotional" || goal === "promote_offer") return sf("promotion", "high", `Promotional intent → promotion campaign category`);
    if (intent === "event_announcement" || goal === "announce_launch") return sf("launch", "high", `Launch/announcement intent → launch campaign category`);
    if (intent === "educational" || intent === "informative") return sf("educational", "high", `Educational intent → educational campaign category`);
    if (intent === "awareness") return sf("awareness", "high", `Awareness intent → awareness campaign category`);
    if (intent === "brand_building") return sf("branding", "high", `Brand building intent → branding campaign category`);
    if (goal === "build_trust") return sf("corporate", "medium", `Trust-building goal often maps to a corporate credibility campaign`);
    return sf("awareness", "low", `Defaulting to awareness campaign category`);
  })();

  // storyFlow: awarenessLevel × campaignGoal with conflict resolution
  const storyFlowResult = (() => {
    const awarenessLevel = uu.customerAwareness.value !== "unknown" ? uu.customerAwareness.value : "unaware";
    const campaignGoalValue = marketing.campaignGoal.value;
    const hasOffer = uu.detectedOffer.offerType !== "none";
    const intent = uu.intent.value;

    // AWARENESS_SALES conflict: problem_aware + sales/lead_gen → bridged_conversion
    if (awarenessLevel === "problem_aware" && (campaignGoalValue === "sales" || campaignGoalValue === "lead_generation")) {
      const flowId: StoryFlowId = "bridged_conversion";
      return { flowId, nodes: STORY_FLOW_NODES[flowId], reasoning: `AWARENESS_SALES: problem_aware audience needs education bridge before conversion — arc: "${flowId}"`, confidence: "high" as FieldConfidence };
    }
    // EDU_PROMO conflict: educational intent + offer detected → education_offer_reward
    if ((intent === "educational" || intent === "informative") && hasOffer) {
      const flowId: StoryFlowId = "education_offer_reward";
      return { flowId, nodes: STORY_FLOW_NODES[flowId], reasoning: `EDU_PROMO: education is the frame, detected offer is the reward — arc: "${flowId}"`, confidence: "high" as FieldConfidence };
    }
    // most_aware → single_message
    if (awarenessLevel === "most_aware") {
      const flowId: StoryFlowId = "single_message";
      return { flowId, nodes: STORY_FLOW_NODES[flowId], reasoning: `most_aware audience: no warm-up needed — single clear message arc: "${flowId}"`, confidence: "high" as FieldConfidence };
    }
    // Lookup table
    const lookup: Partial<Record<string, Partial<Record<string, StoryFlowId>>>> = {
      unaware:        { awareness: "emotion_first", sales: "aspirational_desire", education: "problem_solution", lead_generation: "bridged_conversion" },
      problem_aware:  { awareness: "problem_solution", education: "problem_solution", trust: "reassurance_arc" },
      solution_aware: { lead_generation: "differentiation_proof", sales: "value_confirmation", trust: "value_confirmation" },
      product_aware:  { sales: "value_confirmation", lead_generation: "value_confirmation" },
    };
    const flowId: StoryFlowId = (lookup[awarenessLevel]?.[campaignGoalValue ?? ""] ?? "emotion_proof_action") as StoryFlowId;
    const awarenessConf = uu.customerAwareness.value !== "unknown" ? uu.customerAwareness.confidence : "low" as FieldConfidence;
    return { flowId, nodes: STORY_FLOW_NODES[flowId] ?? [], reasoning: `Story arc "${flowId}" from awarenessLevel="${awarenessLevel}" × campaignGoal="${campaignGoalValue}"`, confidence: awarenessConf };
  })();

  const storyFlow = sf<StoryFlowId>(storyFlowResult.flowId, storyFlowResult.confidence, storyFlowResult.reasoning);
  const storyFlowNodes: StoryGraphNode[] = storyFlowResult.nodes;

  return { campaignCategory, storyFlow, storyFlowNodes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence score + unknown field collector
// ─────────────────────────────────────────────────────────────────────────────

function flattenFields(obj: Record<string, unknown>, prefix = ""): Record<string, StrategyField> {
  const result: Record<string, StrategyField> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && "value" in v && "confidence" in v && "reasoning" in v) {
      result[key] = v as StrategyField;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(result, flattenFields(v as Record<string, unknown>, key));
    }
  }
  return result;
}

function computeStrategyConfidenceScore(domains: Record<string, unknown>): number {
  const weights: Record<FieldConfidence, number> = { high: 1, medium: 0.6, low: 0.3, unknown: 0 };
  const fields = Object.values(flattenFields(domains));
  if (!fields.length) return 0;
  const total = fields.reduce((sum, f) => sum + weights[f.confidence], 0);
  return Math.round((total / fields.length) * 100);
}

function collectUnknownStrategyFields(domains: Record<string, unknown>): string[] {
  return Object.entries(flattenFields(domains))
    .filter(([, f]) => f.value === "unknown" || f.confidence === "unknown")
    .map(([k]) => k);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

/** Converts a CreativeContext into a structured CreativeStrategy.
 *  Pure function — no LLM calls, no I/O, no side effects. */
export function buildCreativeStrategy(context: CreativeContext): CreativeStrategy {
  const { userUnderstanding: uu, assetIntelligence: ai } = context;
  // Prefer subIndustry (more specific) for knowledge bank lookup — "dental_clinic"
  // gives more precise pain points / USP than the broader "healthcare" parent.
  const kbKey =
    uu.subIndustry.value !== "unknown" ? uu.subIndustry.value :
    uu.industry.value !== "unknown" ? uu.industry.value :
    undefined;
  const kb = getKnowledge(kbKey);

  // Build the 5 base domains first (upstream of Phase 10 engines)
  const marketing     = buildMarketingIntelligence(uu);
  const audience      = buildAudienceIntelligence(uu, ai, kb);
  const communication = buildCommunicationIntelligence(uu);
  const business      = buildBusinessIntelligence(uu, ai, kb);
  const platform      = buildPlatformIntelligence(uu);

  // Phase 10 — run the 5 new semantic hero selection engines
  const rawIdea        = context.request.rawIdea.toLowerCase();
  const luxuryProfile  = buildLuxuryProfile(uu, ai, kb, business, rawIdea);
  const experience     = buildExperienceProfile(uu, marketing, audience, communication);
  const weights        = computeSemanticWeights(uu, ai, experience);
  const creativeMatrix = resolveCreativeMatrix(uu, experience, luxuryProfile, marketing, audience);
  const heroDecision   = resolveHeroDecision(uu, ai, kb, experience, luxuryProfile, creativeMatrix, weights);

  // Build the enriched domains using Phase 10 outputs
  const creative = buildCreativeIntelligence(uu, ai, kb, heroDecision, creativeMatrix);
  const visual   = buildVisualReasoning(uu, ai, kb, luxuryProfile, heroDecision);
  const campaign = buildCampaignIntelligence(uu, marketing);

  // Phase 10.2B: verify no impossible cross-field combinations slipped through
  validateVisualCoherence(creative.focusPriority.value, visual.humanPresence.value, heroDecision.heroType);

  const domains = { marketing, audience, communication, creative, business, platform, visual, campaign };
  const confidenceScore = computeStrategyConfidenceScore(domains);
  const unknownFields = collectUnknownStrategyFields(domains);

  return {
    ...domains,
    confidenceScore,
    unknownFields,
    // Phase 10 enrichment layers (additive — does not affect scoring)
    experienceProfile: experience,
    semanticWeights:   weights,
    luxuryProfile,
    heroDecision,
    creativeMatrix,
  };
}
