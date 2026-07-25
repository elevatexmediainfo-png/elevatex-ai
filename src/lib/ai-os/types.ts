import type { CreativeProjectKind } from "@/generated/prisma/enums";
import type { AssetAnalysisResult } from "@/lib/design-intelligence/schema";

// AI OS — Core type contracts.
// Every type defined here is a boundary contract between modules.
// No module depends on another module's implementation — only on these types.

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — Request + Lightweight types
// ─────────────────────────────────────────────────────────────────────────────

/** Normalised, validated creative request produced by the AI Request Manager. */
export interface CreativeRequest {
  userId: string;
  /** The sanitized idea string — safe to pass into downstream prompts and AI modules.
   *  Prompt-injection sequences have been neutralized.
   *  All downstream modules MUST use this field, never `originalRawIdea`. */
  rawIdea: string;
  /** The user's original, unmodified idea text — preserved for audit, logging,
   *  and debugging only. Never used in AI prompts or downstream reasoning.
   *  Set by the Request Manager; absent when CreativeRequest is constructed
   *  directly in tests or internal pipeline calls. */
  originalRawIdea?: string;
  kind?: CreativeProjectKind;
  presetKey?: string;
  referenceAssetId?: string;
  logoAssetId?: string;
  requestedAt: Date;
}

/** Phase 1 lightweight intent signals — kept for backward compatibility. */
export interface UserIntent {
  rawIdea: string;
  normalizedIdea: string;
  detectedLanguage: "EN" | "HI" | "AUTO";
  likelyIndustry?: string;
  intentType?: "informative" | "promotional" | "educational" | "awareness" | "event" | "unknown";
  businessGoalType?: "lead_gen" | "brand_awareness" | "sale" | "event_attendance" | "announcement" | "unknown";
  confidence: "high" | "medium" | "low";
  platformSignal?: string;
}

/** Brand context extracted from the user's persisted BrandKit record. */
export interface BrandContext {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontFamily?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — User Understanding types
// ─────────────────────────────────────────────────────────────────────────────

export type FieldConfidence = "high" | "medium" | "low" | "unknown";

/** A single detected field with value, confidence, and reason. Used by the
 *  User Understanding Engine (Phase 2). */
export interface UnderstandingField<T extends string = string> {
  value: T | "unknown";
  confidence: FieldConfidence;
  reason: string;
}

/** A single Creative Brain strategy decision with value, confidence, and the
 *  explicit reasoning chain that produced it. Uses `reasoning` (not `reason`)
 *  to signal the richer, multi-step inference chain in the Creative Brain vs.
 *  the single-signal detection in the User Understanding Engine. */
export interface StrategyField<T extends string = string> {
  value: T | "unknown";
  confidence: FieldConfidence;
  /** The explicit chain of reasoning: what signals were observed and how they
   *  led to this conclusion. Always human-readable, never a placeholder. */
  reasoning: string;
}

/** Structured 25-field business intelligence from the User Understanding Engine. */
export interface UserUnderstanding {
  intent: UnderstandingField<
    "informative" | "promotional" | "educational" | "awareness" | "event_announcement" |
    "lead_generation" | "brand_building" | "product_showcase" | "before_after" | "testimonial"
  >;
  industry: UnderstandingField<
    "healthcare" | "food_beverage" | "real_estate" | "finance" | "education" |
    "beauty_wellness" | "jewellery_luxury" | "automotive" | "retail" | "technology" |
    "entertainment" | "hospitality" | "fitness" | "legal" | "general"
  >;
  subIndustry: UnderstandingField;
  businessCategory: UnderstandingField<
    "local_service" | "national_brand" | "premium_luxury" | "mass_market" |
    "professional_service" | "retail" | "ecommerce" | "financial_service" | "educational_institution"
  >;
  campaignGoal: UnderstandingField<
    "awareness" | "consideration" | "conversion" | "retention" | "event_attendance" | "lead_capture"
  >;
  businessGoal: UnderstandingField<
    "build_trust" | "drive_sales" | "generate_leads" | "increase_awareness" |
    "announce_launch" | "promote_offer" | "build_community" | "educate_audience"
  >;
  platform: UnderstandingField<
    "instagram" | "facebook" | "linkedin" | "pinterest" | "twitter" |
    "poster" | "flyer" | "billboard" | "story" | "general"
  >;
  outputFormatPreference: UnderstandingField<
    "square" | "portrait" | "landscape" | "story_vertical" | "poster_portrait"
  >;
  audienceType: UnderstandingField<
    // Inferred from industry (original values — backward compatible)
    | "general_consumers" | "working_professionals" | "students" | "parents"
    | "seniors" | "young_adults" | "families" | "business_owners" | "affluent_individuals"
    // Explicitly stated by user (Fix 4 — audience override)
    | "women" | "senior_citizens" | "nri" | "hni" | "doctors"
    | "newlyweds" | "new_mothers" | "fitness_enthusiasts"
  >;
  language: UnderstandingField<"english" | "hindi" | "mixed">;
  brandContext: UnderstandingField<"established_brand" | "new_brand" | "unknown">;
  productContext: UnderstandingField<"service" | "physical_product" | "digital_product" | "event" | "information">;
  educationLevelRequired: UnderstandingField<"none" | "low" | "medium" | "high">;
  trustRequirement: UnderstandingField<"low" | "medium" | "high" | "critical">;
  urgency: UnderstandingField<"none" | "low" | "medium" | "high" | "immediate">;
  seasonality: UnderstandingField<"none" | "wedding_season" | "festival_season" | "academic_season" | "financial_year" | "summer" | "monsoon">;
  /** Neutral content structure category detected from the user's request.
   *  The Creative Brain and Creative Director decide final format (poster, infographic, explainer etc.).
   *  Never returns "infographic" purely because of intent — only when the user explicitly requests it. */
  contentType: UnderstandingField<"image_only" | "image_with_text" | "infographic" | "comparison" | "before_after_split">;
  communicationStyle: UnderstandingField<"professional" | "warm_friendly" | "luxurious" | "urgent" | "educational" | "inspirational" | "playful">;
  emotion: UnderstandingField<"trust" | "aspiration" | "excitement" | "comfort" | "urgency" | "joy" | "pride" | "curiosity" | "transformation">;
  confidenceScore: number;
  unknownFields: string[];

  // ── Phase 2 enrichment fields (Fix 1–7) ───────────────────────────────────
  /** Eugene Schwartz customer awareness level — the most important variable in
   *  commercial advertising. Determines the creative strategy the ad must use. */
  customerAwareness: IntelligenceField<CustomerAwarenessLevel>;
  /** Pain points explicitly stated by the user. Empty array if none stated.
   *  Creative Brain uses KB fallback when this is empty. */
  extractedPainPoints: ExtractedPainPoint[];
  /** Business differentiators explicitly stated by the user. Empty array if none.
   *  Never invent USPs — only preserve what the user wrote. */
  extractedUsp: ExtractedUsp[];
  /** Full audience resolution — explicit override + inferred + final winner. */
  audienceResolution: AudienceResolution;
  /** Commercial offer detected in the user's idea. offerType = "none" when absent. */
  detectedOffer: DetectedOffer;
  /** Authority signals explicitly stated (certifications, years, awards, team). */
  authoritySignals: AuthoritySignal[];
  /** Social proof signals explicitly stated (customer count, ratings, testimonials). */
  socialProof: SocialProofSignal[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 Enrichment Sub-types (Fixes 1–8)
// ─────────────────────────────────────────────────────────────────────────────

/** Fix 8 — Source tracking for all Phase 2 enrichment fields. */
export type IntelligenceSource = "user_explicit" | "inferred" | "knowledge_base" | "default";

/** Fix 8 — Structured field for Phase 2 enrichment.
 *  Uses `reasoning` (not `reason`) to align with StrategyField naming. */
export interface IntelligenceField<T extends string = string> {
  value: T | "unknown";
  confidence: FieldConfidence;
  /** One-sentence explanation following Fix 9 reasoning format. */
  reasoning: string;
  source: IntelligenceSource;
}

// ── Fix 1: Customer Awareness (Eugene Schwartz 5-Level Model) ────────────────

export type CustomerAwarenessLevel =
  | "most_aware"      // Ready to act — signals: book, appointment, call now
  | "product_aware"   // Knows the specific solution, comparing options — signals: best, compare, how much
  | "solution_aware"  // Knows solutions exist, not committed yet — signals: looking for, searching
  | "problem_aware"   // Knows they have a problem, unaware of solutions — signals: pain, fear, worried
  | "unaware";        // No awareness signal — default for broad awareness campaigns

// ── Fix 2: Extracted Pain Points ────────────────────────────────────────────

export type PainPointCategory =
  | "fear_of_pain" | "fear_of_surgery" | "price_concern" | "trust_issue"
  | "time_concern" | "complexity_concern" | "quality_concern" | "result_doubt"
  | "side_effect_fear" | "embarrassment" | "other";

export interface ExtractedPainPoint {
  category: PainPointCategory;
  /** The raw matching phrase from the user's idea — exactly as written. */
  value: string;
  confidence: FieldConfidence;
  reasoning: string;
  source: "user_explicit";
}

// ── Fix 3: Extracted USP ────────────────────────────────────────────────────

export type UspCategory =
  | "experience" | "technology" | "certification" | "pricing"
  | "service" | "warranty" | "award" | "exclusivity" | "speed" | "other";

export interface ExtractedUsp {
  category: UspCategory;
  /** The raw matching phrase from the user's idea — exactly as written. */
  value: string;
  confidence: FieldConfidence;
  reasoning: string;
  source: "user_explicit";
}

// ── Fix 4: Audience Resolution ──────────────────────────────────────────────

export interface AudienceResolution {
  /** Explicitly stated audience from user text. Null if not mentioned. */
  explicit: string | null;
  /** Audience inferred from industry and sub-industry knowledge. */
  inferred: string;
  /** The winning audience — explicit takes priority over inferred. */
  final: string;
  /** True when the explicit audience overrode the industry inference. */
  overridden: boolean;
  confidence: FieldConfidence;
  reasoning: string;
  source: IntelligenceSource;
}

// ── Fix 5: Detected Offer ───────────────────────────────────────────────────

export type OfferType =
  | "none" | "discount" | "emi" | "cashback" | "free_consultation"
  | "free_trial" | "bundle" | "bogo" | "limited_time" | "early_bird"
  | "pre_booking" | "launch_offer";

export interface DetectedOffer {
  offerType: OfferType;
  /** Quantified offer value if extractable (e.g. "20%", "₹500"). Null if not quantified. */
  offerValue: string | null;
  urgency: "none" | "low" | "medium" | "high" | "immediate";
  confidence: FieldConfidence;
  reasoning: string;
  source: IntelligenceSource;
}

// ── Fix 6: Authority Signals ────────────────────────────────────────────────

export type AuthoritySignalType =
  | "experience_years" | "award" | "certification" | "rating"
  | "team_size" | "branch_count" | "government_approval";

export interface AuthoritySignal {
  type: AuthoritySignalType;
  /** The raw extracted phrase (e.g. "15 years experience", "ISO 9001 certified"). */
  value: string;
  confidence: FieldConfidence;
  reasoning: string;
  source: "user_explicit";
}

// ── Fix 7: Social Proof Signals ─────────────────────────────────────────────

export type SocialProofType =
  | "customer_count" | "rating" | "testimonial" | "established_since"
  | "trusted_by" | "celebrity_endorsement" | "media_mention";

export interface SocialProofSignal {
  type: SocialProofType;
  /** The raw extracted phrase (e.g. "500+ happy patients", "4.9 Google rating"). */
  value: string;
  confidence: FieldConfidence;
  reasoning: string;
  source: "user_explicit";
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — Asset Understanding types
// ─────────────────────────────────────────────────────────────────────────────

/** A single extracted asset intelligence field.
 *  Adds `source` to UnderstandingField to track WHERE the value came from —
 *  critical for distinguishing LLM inference from DB-cached results. */
export interface AssetIntelligenceField<T extends string = string> {
  /** The extracted or inferred value. "unknown" = no signal found. */
  value: T | "unknown";
  /** How confident the engine is in this value. */
  confidence: FieldConfidence;
  /** Where the value originated. */
  source: "llm_vision" | "db_cache" | "brand_kit_db" | "inferred" | "default" | "user_provided";
  /** Human-readable explanation of how the value was determined. */
  reason: string;
}

/** Full structured intelligence extracted from a reference image.
 *  50+ fields covering everything the creative pipeline might need to
 *  replicate or be inspired by the visual language of the reference. */
export interface ReferenceImageIntelligence {
  // Industry signals
  industry: AssetIntelligenceField;
  subIndustry: AssetIntelligenceField;

  // Visual classification
  visualStyle: AssetIntelligenceField<"photographic" | "illustrative" | "typographic" | "mixed" | "digital_art" | "3d_render" | "flat_design">;
  creativeType: AssetIntelligenceField;
  layoutType: AssetIntelligenceField<"editorial" | "split_screen" | "hero_centric" | "grid" | "magazine" | "minimal" | "infographic" | "poster" | "carousel" | "story">;
  layoutArchetype: AssetIntelligenceField;
  gridType: AssetIntelligenceField<"12_column" | "3_column" | "2_column" | "asymmetric" | "free_form" | "golden_ratio" | "rule_of_thirds" | "centered">;

  // Composition
  composition: AssetIntelligenceField;
  readingFlow: AssetIntelligenceField<"left_to_right" | "top_to_bottom" | "z_pattern" | "f_pattern" | "centered" | "radial">;

  // Subject
  heroSubject: AssetIntelligenceField;
  supportingSubjects: AssetIntelligenceField;
  objects: AssetIntelligenceField;

  // Visual environment
  backgroundStyle: AssetIntelligenceField;
  foregroundStyle: AssetIntelligenceField;
  lightingStyle: AssetIntelligenceField;
  cameraAngle: AssetIntelligenceField<"eye_level" | "high_angle" | "low_angle" | "bird_eye" | "overhead" | "dutch_tilt" | "close_up" | "macro">;
  cameraLens: AssetIntelligenceField;
  depthOfField: AssetIntelligenceField<"deep" | "shallow" | "medium" | "extreme_shallow" | "blurred_background">;

  // Mood and emotion
  mood: AssetIntelligenceField;
  emotion: AssetIntelligenceField<"trust" | "aspiration" | "excitement" | "comfort" | "urgency" | "joy" | "pride" | "curiosity" | "transformation" | "nostalgia" | "luxury">;
  luxuryLevel: AssetIntelligenceField<"none" | "low" | "medium" | "high" | "ultra_luxury">;

  // Density
  visualDensity: AssetIntelligenceField<"minimal" | "moderate" | "rich" | "very_rich">;
  informationDensity: AssetIntelligenceField<"single_message" | "two_elements" | "multi_element" | "complex_infographic">;

  // Typography
  typographyStyle: AssetIntelligenceField;
  typographyPlacement: AssetIntelligenceField;
  fontStyle: AssetIntelligenceField<"serif" | "sans_serif" | "script" | "display" | "monospace" | "mixed" | "none">;
  alignment: AssetIntelligenceField<"left" | "center" | "right" | "mixed">;
  whitespaceUsage: AssetIntelligenceField<"minimal" | "balanced" | "generous" | "extreme">;

  // Zones (where content lives)
  safeAreas: AssetIntelligenceField;
  headlineZone: AssetIntelligenceField;
  ctaZone: AssetIntelligenceField;
  logoZone: AssetIntelligenceField;
  bodyCopyZone: AssetIntelligenceField;

  // Visual elements
  iconUsage: AssetIntelligenceField<"none" | "minimal" | "moderate" | "heavy">;
  illustrationStyle: AssetIntelligenceField;
  photographyStyle: AssetIntelligenceField;

  // Color
  colorPalette: AssetIntelligenceField;
  accentColors: AssetIntelligenceField;
  brandFeeling: AssetIntelligenceField;

  // Marketing signals
  trustElements: AssetIntelligenceField;
  visualHierarchy: AssetIntelligenceField;
  marketingFeel: AssetIntelligenceField;
  advertisementCategory: AssetIntelligenceField;
  platformGuess: AssetIntelligenceField<"instagram" | "facebook" | "poster" | "billboard" | "flyer" | "website" | "story" | "linkedin" | "general">;

  // Creative DNA — the high-level essence of this creative's visual language
  creativeDNA: AssetIntelligenceField;

  // Meta
  confidenceScore: number;
  unknownFields: string[];
}

/** Structured intelligence extracted from a product image. */
export interface ProductImageIntelligence {
  productCategory: AssetIntelligenceField;
  primaryProduct: AssetIntelligenceField;
  secondaryObjects: AssetIntelligenceField;
  material: AssetIntelligenceField;
  texture: AssetIntelligenceField;
  packaging: AssetIntelligenceField<"none" | "box" | "bottle" | "bag" | "tube" | "pouch" | "jar" | "can" | "blister" | "other">;
  reflection: AssetIntelligenceField<"none" | "subtle" | "moderate" | "strong">;
  shadow: AssetIntelligenceField<"none" | "soft" | "hard" | "cast" | "drop_shadow">;
  surface: AssetIntelligenceField;
  scale: AssetIntelligenceField<"macro" | "close_up" | "medium" | "full_product" | "in_context">;
  heroAngle: AssetIntelligenceField;
  suitableCameraAngle: AssetIntelligenceField;
  suitableLighting: AssetIntelligenceField;
  backgroundRecommendation: AssetIntelligenceField;
  bestPresentationStyle: AssetIntelligenceField;
  marketingSuitability: AssetIntelligenceField;
  confidenceScore: number;
  unknownFields: string[];
}

/** Structured intelligence extracted from a logo image. */
export interface LogoIntelligence {
  brandColors: AssetIntelligenceField;
  typography: AssetIntelligenceField;
  logoType: AssetIntelligenceField<"wordmark" | "lettermark" | "brandmark" | "combination_mark" | "emblem" | "abstract" | "mascot">;
  luxuryLevel: AssetIntelligenceField<"none" | "low" | "medium" | "high" | "ultra">;
  visualStyle: AssetIntelligenceField;
  brandPersonality: AssetIntelligenceField;
  preferredPlacement: AssetIntelligenceField<"top_left" | "top_right" | "top_center" | "bottom_left" | "bottom_right" | "bottom_center" | "center">;
  safeArea: AssetIntelligenceField;
  confidenceScore: number;
  unknownFields: string[];
}

/** Structured intelligence derived from the user's persisted BrandKit record. */
export interface BrandKitIntelligence {
  brandColors: AssetIntelligenceField;
  primaryFont: AssetIntelligenceField;
  secondaryFont: AssetIntelligenceField;
  brandVoice: AssetIntelligenceField<"professional" | "friendly" | "luxurious" | "playful" | "authoritative" | "inspirational" | "minimal">;
  visualRules: AssetIntelligenceField;
  spacingRules: AssetIntelligenceField;
  iconStyle: AssetIntelligenceField<"line" | "filled" | "duotone" | "3d" | "flat" | "custom" | "none">;
  photographyRules: AssetIntelligenceField;
  brandPersonality: AssetIntelligenceField;
  confidenceScore: number;
  unknownFields: string[];
}

/** Unified asset intelligence object produced by the Asset Understanding Engine.
 *  Phase 1 backward-compat fields are preserved; Phase 3 adds rich typed sub-objects. */
export interface AssetIntelligence {
  // ── Phase 1 backward-compat ─────────────────────────────────────────────
  /** Lightweight AssetAnalysisResult used by the Creative Brain/Director pipeline.
   *  Kept alongside the richer `reference` type so nothing breaks in the existing
   *  LLM calls that receive `referenceAnalysis` as their context input. */
  referenceAnalysis?: AssetAnalysisResult;
  /** Thin brand kit snapshot for Creative Brain context. */
  brandContext?: BrandContext;
  logoAssetId?: string;

  // ── Phase 3 rich intelligence ────────────────────────────────────────────
  /** Full 50-field reference image intelligence. Available when `referenceAssetId`
   *  was provided and the LLM analysis succeeded. */
  reference?: ReferenceImageIntelligence;
  /** Product image intelligence. Populated when `productImageAssetId` is set
   *  (wired in a future phase; stub available now). */
  product?: ProductImageIntelligence;
  /** Logo intelligence. Populated when `logoAssetId` is set and logo analysis runs. */
  logo?: LogoIntelligence;
  /** Structured brand kit intelligence derived from the user's BrandKit DB row. */
  brandKit?: BrandKitIntelligence;
}
