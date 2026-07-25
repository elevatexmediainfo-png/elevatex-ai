import type {
  StrategyField,
  FieldConfidence,
  CustomerAwarenessLevel,
  PainPointCategory,
  AuthoritySignalType,
  SocialProofType,
  IntelligenceSource,
} from "../types";

// Phase 4 — Creative Brain types.
// CreativeStrategy is the output contract of the Creative Brain. It is a
// strongly typed, field-by-field breakdown of every strategic decision the
// Brain makes about a creative request. Every field carries:
//   value      — the decided value (or "unknown" if no signal was found)
//   confidence — how sure the Brain is (high/medium/low/unknown)
//   reasoning  — the explicit chain of evidence that produced the decision
//
// NO generation happens here. No prompts, no layouts, no copy, no images.
// Only intelligence.

// ─────────────────────────────────────────────────────────────────────────────
// Domain 1 — Marketing Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketingIntelligence {
  /** What the campaign is ultimately trying to achieve in the market. */
  campaignGoal: StrategyField<"awareness" | "lead_generation" | "sales" | "trust" | "education" | "engagement" | "retention">;
  /** The specific measurable marketing objective stated or inferred. */
  marketingObjective: StrategyField;
  /** How immediately the campaign should drive action vs. build relationship. */
  conversionPriority: StrategyField<"immediate" | "short_term" | "long_term" | "relationship_building">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 2 — Audience Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface AudienceIntelligence {
  /** The primary decision-making audience this creative targets. */
  primaryAudience: StrategyField;
  /** A secondary audience that may also be influenced. */
  secondaryAudience: StrategyField;
  /** Dominant age band of the primary audience. */
  ageGroup: StrategyField<"18-24" | "25-34" | "35-44" | "45-54" | "55+" | "all_ages">;
  /** Approximate income positioning of the primary audience. */
  incomeGroup: StrategyField<"budget" | "mid_market" | "affluent" | "high_net_worth">;
  /** Likely profession or occupation of the target. */
  profession: StrategyField;
  /** How much does this audience already know about the product/category? */
  knowledgeLevel: StrategyField<"novice" | "intermediate" | "expert">;
  /** Where is the audience in the purchase funnel right now? */
  buyerStage: StrategyField<"awareness" | "consideration" | "decision" | "retention">;
  /** Core frustrations this campaign must address. */
  painPoints: StrategyField;
  /** What the audience hopes to gain or feel. */
  desires: StrategyField;
  /** Common hesitations that could prevent action. */
  objections: StrategyField;
  /** How much credibility-building does this category require? */
  trustRequirement: StrategyField<"low" | "medium" | "high" | "critical">;
  /** Primary psychological driver behind the purchase decision. */
  motivation: StrategyField;
  /** Likelihood the audience is actively ready to buy/act. */
  buyingIntent: StrategyField<"none" | "low" | "medium" | "high" | "immediate">;
  /** Eugene Schwartz awareness level — consumed from Phase 2 customerAwareness signal. */
  awarenessLevel: StrategyField<CustomerAwarenessLevel>;
  /** Primary fear/pain driving the campaign narrative — from Phase 2 extractedPainPoints or KB. */
  dominantFear: StrategyField<PainPointCategory | "none">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 3 — Communication Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface CommunicationIntelligence {
  /** The overall style register the brand should use to reach this audience. */
  communicationStyle: StrategyField<"luxury" | "premium" | "professional" | "friendly" | "minimal" | "educational" | "emotional" | "authority">;
  /** How the brand should project itself in this creative. */
  confidenceLevel: StrategyField<"reassuring" | "confident" | "authoritative" | "aspirational">;
  /** Time pressure or deadline signalling in the message. */
  urgency: StrategyField<"none" | "low" | "medium" | "high" | "immediate">;
  /** Specific voice/tone flavour for headlines and messaging. */
  tone: StrategyField<"formal" | "conversational" | "inspirational" | "urgent" | "educational" | "emotional" | "minimal">;
  /** Dominant Cialdini persuasion mechanism for this campaign — consumed by Creative Director copy builders. */
  persuasionApproach: StrategyField<"authority_led" | "social_proof_led" | "scarcity_led" | "education_led" | "emotion_led" | "liking_led">;
  /** Language and cultural register — from Phase 2 language detection; consumed by copy and headline builders. */
  languageRegister: StrategyField<"english_standard" | "bilingual_en_hi" | "hindi_primary" | "regional">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 4 — Creative Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface CreativeIntelligence {
  /** What type of creative asset this should be. */
  creativeCategory: StrategyField<"poster" | "banner" | "carousel" | "thumbnail" | "infographic" | "social_post" | "advertisement" | "campaign">;
  /** The single most powerful visual marketing element for this idea. */
  heroSubject: StrategyField;
  /** Secondary visual elements that support the hero. */
  supportingSubjects: StrategyField;
  /** How many concepts or information units must the creative communicate? */
  informationDensity: StrategyField<"single_message" | "two_elements" | "multi_element" | "complex_infographic">;
  /** How visually busy or minimal should the layout be? */
  visualDensity: StrategyField<"minimal" | "moderate" | "rich" | "very_rich">;
  /** How many compositional layers / visual complexity is appropriate? */
  visualComplexity: StrategyField<"simple" | "medium" | "complex">;
  /** What the viewer's eye should land on first. */
  focusPriority: StrategyField<"product" | "person" | "emotion" | "information" | "brand" | "transformation" | "moment" | "environment">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 5 — Business Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface BusinessIntelligence {
  industry: StrategyField;
  subIndustry: StrategyField;
  businessType: StrategyField<"local_service" | "national_brand" | "premium_luxury" | "mass_market" | "professional_service" | "retail" | "ecommerce" | "financial_service" | "educational_institution">;
  businessGoal: StrategyField;
  /** The unique selling proposition inferred from industry + intent. */
  usp: StrategyField;
  /** What kind of offer (if any) is central to this creative. */
  offerType: StrategyField<"none" | "discount" | "free_trial" | "free_consultation" | "service_package" | "event" | "product_launch" | "information">;
  seasonality: StrategyField;
  /** How this business likely positions itself vs. competitors. */
  competitivePosition: StrategyField<"challenger" | "leader" | "niche" | "emerging" | "unknown">;
  /** Structured offer details — preserves offerType + specific value ("20%") + urgency from Phase 2 detection.
   *  Consumed by: Creative Director (copy builder, CTA builder), Prompt Spec (offer injection). */
  offerDetails: OfferDetailsField;
  /** User-stated business differentiators — from Phase 2 extractedUsp. Never generated from KB.
   *  Consumed by: Creative Director (headline builder, USP builder), Prompt Spec (differentiator injection). */
  specificDifferentiators: StrategyField;
  /** Consolidated trust intelligence — authority + social proof combined.
   *  Consumed by: Creative Director (trust module builder), Scene Planner (trust element placement). */
  trustAssets: TrustAssets;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 6 — Platform Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface PlatformIntelligence {
  primaryPlatform: StrategyField<"instagram" | "facebook" | "linkedin" | "youtube" | "google_display" | "website_banner" | "print" | "outdoor" | "general">;
  /** How this audience behaves on this platform — scroll speed, attention span. */
  platformBehaviour: StrategyField;
  /** Where safe zones must be preserved in this format. */
  safeAreaPriority: StrategyField<"none" | "top" | "bottom" | "sides" | "all">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 7 — Visual Reasoning
// ─────────────────────────────────────────────────────────────────────────────

export interface VisualReasoning {
  luxuryLevel: StrategyField<"none" | "low" | "medium" | "high" | "ultra_luxury">;
  /** @deprecated Production technique — will move to Creative Director in Phase 5. Still computed for backward compat. */
  premiumFeel: StrategyField<"basic" | "standard" | "premium" | "luxury">;
  /** @deprecated Production technique — will move to Creative Director in Phase 5. Still computed for backward compat. */
  modernStyle: StrategyField<"classic" | "contemporary" | "modern" | "cutting_edge">;
  minimalismLevel: StrategyField<"none" | "low" | "moderate" | "high" | "extreme">;
  /** @deprecated Production technique — will move to Creative Director in Phase 5. Still computed for backward compat. */
  photographyStyle: StrategyField<"studio_product" | "lifestyle" | "documentary" | "aerial" | "macro_detail" | "editorial" | "before_after" | "none">;
  /** @deprecated Production technique — will move to Creative Director in Phase 5. Still computed for backward compat. */
  illustrationPreference: StrategyField<"none" | "minimal_icons" | "infographic_elements" | "flat_design" | "3d_render" | "hand_drawn">;
  /** How prominently people should appear in this creative. */
  humanPresence: StrategyField<"none" | "incidental" | "supporting" | "hero">;
  /** Whether a product shot should dominate the frame. */
  productPriority: StrategyField<"none" | "supporting" | "equal" | "hero">;
  /** How much the setting/environment contributes to the story. */
  environmentPriority: StrategyField<"none" | "minimal" | "supporting" | "immersive">;
  /** Does this idea benefit from a before→after or transformation narrative? */
  storytellingRequirement: StrategyField<"none" | "low" | "medium" | "high">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 8 — Campaign Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface CampaignIntelligence {
  /** The primary campaign category this creative belongs to. */
  campaignCategory: StrategyField<"promotion" | "awareness" | "launch" | "offer" | "educational" | "festival" | "corporate" | "branding" | "long_term_campaign">;
  /** Narrative arc driven by awarenessLevel × campaignGoal.
   *  Consumed by: Creative Director (story arc builder), Prompt Spec (narrative framing). */
  storyFlow: StrategyField<StoryFlowId>;
  /** Ordered story graph nodes for this campaign arc — consumed by Creative Director to sequence copy blocks. */
  storyFlowNodes: StoryGraphNode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CreativeStrategy — the complete output of the Creative Brain
// ─────────────────────────────────────────────────────────────────────────────

export interface CreativeStrategy {
  marketing:     MarketingIntelligence;
  audience:      AudienceIntelligence;
  communication: CommunicationIntelligence;
  creative:      CreativeIntelligence;
  business:      BusinessIntelligence;
  platform:      PlatformIntelligence;
  visual:        VisualReasoning;
  campaign:      CampaignIntelligence;

  /** 0–100 overall confidence weighted across all domains.
   *  Below 40 means the input idea was too vague for reliable strategy. */
  confidenceScore: number;
  /** Names of every field where confidence === "unknown". */
  unknownFields: string[];

  // Phase 10 — v2 semantic intelligence layers (additive, no breaking change)
  experienceProfile: ExperienceProfile;
  semanticWeights:   SemanticWeights;
  luxuryProfile:     LuxuryProfile;
  heroDecision:      HeroDecision;
  creativeMatrix:    CreativeMatrixResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10 — New engine types
// ─────────────────────────────────────────────────────────────────────────────

/** The experiential layer: what emotional/sensory journey is being sold. */
export type ExperienceType =
  | "transformation"  // Before/after, dramatic change
  | "aspiration"      // Desired future state or status
  | "trust"           // Safety, reliability, expertise
  | "luxury"          // Premium feel, exclusivity, craft
  | "belonging"       // Community, family, social connection
  | "education"       // Knowledge, clarity, empowerment
  | "convenience"     // Ease, speed, effortlessness
  | "celebration"     // Joy, occasion, festivity
  | "discovery"       // New, innovative, revealed
  | "healing";        // Recovery, relief, restoration

/** The visual hero archetype — what kind of subject dominates the frame. */
export type HeroType =
  | "person"          // A human subject (professional, customer, lifestyle)
  | "product"         // The product itself is the visual hero
  | "environment"     // The space, location, or setting
  | "transformation"  // Split/before-after visual
  | "data"            // Information visualization, chart, diagram
  | "lifestyle"       // Scene depicting the aspirational life
  | "authority"       // Expert/professional in their domain
  | "moment";         // A specific peak emotional moment

/** Industry cluster classification — determines hero type affinity. */
export type IndustryCluster = "authority" | "social_proof" | "environmental" | "balanced";

export interface ExperienceProfile {
  primary:           ExperienceType;
  secondary:         ExperienceType | "none";
  intensity:         "low" | "medium" | "high";
  emotionalCore:     string;
  visualImplication: string;
  confidence:        FieldConfidence;
  reasoning:         string;
}

export interface SemanticWeights {
  industryWeight: number;     // 0–1: how much industry KB should drive decisions
  campaignWeight: number;     // 0–1: how much campaign type should drive decisions
  audienceWeight: number;     // 0–1: how much explicit audience signal should drive decisions
  intentWeight:   number;     // 0–1: how much user's stated intent should drive decisions
  assetWeight:    number;     // 0–1: how much reference image intelligence should drive decisions
  dominantSignal: "industry" | "campaign" | "audience" | "intent" | "asset";
  reasoning:      string;
}

export interface LuxuryProfile {
  level:           "none" | "low" | "medium" | "high" | "ultra_luxury";
  signals:         string[];
  minimalismLevel: "none" | "low" | "moderate" | "high" | "extreme";
  premiumFeel:     "basic" | "standard" | "premium" | "luxury";
  confidence:      FieldConfidence;
  reasoning:       string;
}

// Phase 10.4I — Hero Knowledge Graph metadata.
// Produced by resolveHeroGraphMeta() for every generation.
// Carries deterministic IDs that survive the full pipeline and power
// similarity search, variation memory, and diversity enforcement.
export interface HeroKnowledgeGraphMeta {
  /** Unique ID for this hero moment: "{heroType}:{industryKey}:{campaignType}" */
  heroMomentId:      string;
  /** Hero archetype family: e.g. "authority_professional", "human_connection" */
  heroFamilyId:      string;
  /** Hero archetype category — equals heroType for clean similarity grouping */
  heroCategory:      string;
  /** Scene type ID: "{resolvedSceneType}:{industryKey}" */
  sceneTypeId:       string;
  /** Scene environment family: e.g. "professional_environment", "social_environment" */
  sceneFamily:       string;
  /** Scene environment category: e.g. "clinical", "social", "architectural" */
  sceneCategory:     string;
  /** The resolved industry key used for this generation */
  industryKey:       string;
  /** The campaign goal/type used for this generation */
  campaignType:      string;
  /** Compound visual fingerprint: "{heroFamilyId}:{resolvedSceneType}:{campaignType}" */
  visualFingerprint: string;
}

export interface HeroDecision {
  subject:        string;
  heroType:       HeroType;
  primarySignals: string[];
  confidence:     FieldConfidence;
  reasoning:      string;
  /** Phase 10.4I — Knowledge graph metadata; always set when heroType is resolved. */
  heroGraph?:     HeroKnowledgeGraphMeta;
}

export interface CreativeMatrixResult {
  visualArchetype:     string;
  emotionalDriver:     string;
  heroType:            HeroType;
  industryCluster:     IndustryCluster;
  compositionPriority: "subject" | "atmosphere" | "information" | "emotion";
  confidence:          FieldConfidence;
  reasoning:           string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — Supplementary types
// ─────────────────────────────────────────────────────────────────────────────

export type StoryFlowId =
  | "single_message" | "value_confirmation" | "differentiation_proof"
  | "problem_solution" | "bridged_conversion" | "education_offer_reward"
  | "reassurance_arc" | "emotion_first" | "aspirational_desire"
  | "trust_building" | "emotion_proof_action";

export type StoryGraphNode = "hook" | "problem" | "emotion" | "education" | "trust" | "transformation" | "offer" | "cta";

export const STORY_FLOW_NODES: Record<StoryFlowId, StoryGraphNode[]> = {
  single_message:           ["hook", "cta"],
  value_confirmation:       ["hook", "trust", "offer", "cta"],
  differentiation_proof:    ["hook", "education", "trust", "cta"],
  problem_solution:         ["problem", "emotion", "education", "trust", "cta"],
  bridged_conversion:       ["problem", "emotion", "education", "trust", "offer", "cta"],
  education_offer_reward:   ["hook", "education", "transformation", "offer", "cta"],
  reassurance_arc:          ["problem", "emotion", "trust", "transformation", "cta"],
  emotion_first:            ["emotion", "hook", "trust", "cta"],
  aspirational_desire:      ["emotion", "transformation", "hook", "offer", "cta"],
  trust_building:           ["trust", "education", "transformation", "cta"],
  emotion_proof_action:     ["emotion", "trust", "offer", "cta"],
};

export interface OfferDetailsField {
  offerType:  string;
  offerValue: string | null;
  urgency:    string;
  source:     IntelligenceSource;
  confidence: FieldConfidence;
  reasoning:  string;
}

export interface TrustAsset {
  type:         AuthoritySignalType | SocialProofType;
  value:        string;
  source:       "user_explicit";
  confidence:   FieldConfidence;
  evidenceType: "user_claim" | "third_party" | "government" | "media" | "customer" | "brand";
}

export interface TrustAssets {
  // Authority signals
  hasExperienceYears:    boolean;
  experienceYears:       string | null;
  hasCertification:      boolean;
  certifications:        string[];
  hasAward:              boolean;
  awards:                string[];
  hasGovernmentApproval: boolean;
  teamSize:              string | null;
  branchCount:           string | null;
  // Social proof signals
  hasCustomerCount:      boolean;
  customerCount:         string | null;
  hasRating:             boolean;
  rating:                string | null;
  hasTestimonials:       boolean;
  hasCelebrity:          boolean;
  establishedSince:      string | null;
  // Synthesized
  overallTrustStrength:  "none" | "implicit" | "claimed" | "proven";
  trustStrategy:         "authority_first" | "social_proof_first" | "both" | "environmental";
  assets:                TrustAsset[];
  confidence:            FieldConfidence;
  reasoning:             string;
  source:                IntelligenceSource;
}
