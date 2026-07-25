import type { StrategyField } from "../types";

// Phase 11 — Prompt Specification Engine types.
// PromptSpecification is the provider-agnostic structured contract between
// the AI OS intelligence layer and every future Provider Translator.
// Each Provider Translator (OpenAI, Gemini, Flux, Ideogram) reads this
// specification and formats it for its own specific API.
//
// STRICT RULES:
//   ✗ No provider-specific language (no "style: vivid", no "quality: hd")
//   ✗ No actual copy, headlines, or CTAs
//   ✗ No font names or pixel dimensions
//   ✗ No provider API parameters
//   ✓ Only structured, provider-agnostic visual specification

// ─────────────────────────────────────────────────────────────────────────────
// 1. Generation Mission
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerationMission {
  /** What must be generated — the executive brief for this image. */
  whatToGenerate: StrategyField;
  /** Why this specific image — the marketing purpose driving every decision. */
  whyItMatters: StrategyField;
  /** The three criteria a Provider Translator can use to validate success. */
  primarySuccessCriteria: StrategyField;
  /** The single most important element — if only one thing is right, it must be this. */
  nonNegotiableElement: StrategyField;
  /** The overarching creative theme that ties all campaign elements together. */
  campaignTheme?: StrategyField;
  /** The complete story in a single decisive moment — what makes this image unforgettable. */
  storyNarrative?: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Hero Specification
// ─────────────────────────────────────────────────────────────────────────────

export interface HeroSpecification {
  /** Exact description of the primary visual subject. */
  heroSubject: StrategyField;
  /** How critical the hero is: does the message survive without it? */
  heroImportance: StrategyField<"absolute_mandatory" | "primary_anchor" | "strong_supporting">;
  /** Where in the frame the hero sits. */
  heroPosition: StrategyField;
  /** How much of the frame the hero dominates. */
  heroScale: StrategyField;
  /** Specific details the hero must exhibit (pose, expression, texture, etc.). */
  heroDetails: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Supporting Elements
// ─────────────────────────────────────────────────────────────────────────────

export interface SupportingElements {
  /** Supporting subjects that appear alongside the hero. */
  supportingSubjects: StrategyField;
  /** How subjects relate to each other spatially and narratively. */
  relationships: StrategyField;
  /** How supporting subjects relate to the hero — spatial and narrative relationship type. */
  subjectRelationships?: StrategyField;
  /** How large supporting subjects are relative to the hero. */
  relativeScale?: StrategyField;
  /** Required physical objects that must be visible in the scene. */
  requiredObjects: StrategyField;
  /** Optional objects that add richness without being mandatory. */
  optionalObjects: StrategyField;
  /** Decorative elements that add visual quality without informational role. */
  decorativeElements: StrategyField;
  /** Objects that establish credibility: badges, certifications, equipment. */
  trustObjects?: StrategyField;
  /** Objects that explain or educate: models, diagrams, process elements. */
  educationalObjects?: StrategyField;
  /** Brand identity objects: logo placement, branded packaging, brand colours. */
  brandObjects?: StrategyField;
  /** Icon elements to include in the visual (if applicable). */
  iconElements?: StrategyField;
  /** Infographic or data-visualization elements. */
  infographicElements?: StrategyField;
  /** Product/service features display section. */
  featuresSection?: StrategyField;
  /** Key statistics or numbers to show visually. */
  statisticsSection?: StrategyField;
  /** Promotional offer visual treatment. */
  offerSection?: StrategyField;
  /** Complete advertisement layer structure — the spatial narrative of ALL visual zones
   *  (benefit strip, trust badge, process steps, social proof) translated from
   *  AdvertisementStructure into generation-ready positioned descriptions. */
  advertisementLayers: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Composition
// ─────────────────────────────────────────────────────────────────────────────

export interface CompositionSpec {
  /** The governing compositional principle. */
  primaryComposition: StrategyField;
  /** A secondary compositional device that adds depth or dynamism. */
  secondaryComposition?: StrategyField;
  /** How visual mass is distributed across the frame. */
  visualBalance: StrategyField;
  /** The type of symmetry (or deliberate asymmetry) in the scene. */
  symmetry?: StrategyField;
  /** The role of empty space in the image. */
  negativeSpace: StrategyField;
  /** The intended eye movement direction across the frame. */
  eyeFlow?: StrategyField;
  /** What exists in the near depth plane. */
  foreground: StrategyField;
  /** What exists in the middle depth plane (usually the hero). */
  midground: StrategyField;
  /** What exists in the far depth plane (usually blurred). */
  background: StrategyField;
  /** The depth of field treatment across these layers. */
  depthTreatment: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Camera
// ─────────────────────────────────────────────────────────────────────────────

export interface CameraSpec {
  /** The camera's position in space relative to the subject. */
  cameraPosition: StrategyField;
  /** The vertical height of the camera. */
  cameraHeight: StrategyField;
  /** The angle from which the subject is viewed. */
  viewingAngle: StrategyField;
  /** The intended lens character and optical treatment. */
  lensIntent: StrategyField;
  /** The conceptual distance between camera and subject. */
  distance: StrategyField;
  /** What the perspective communicates about the subject. */
  perspectiveIntent: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Lighting
// ─────────────────────────────────────────────────────────────────────────────

export interface LightingSpec {
  /** Key light description — direction, quality, what it communicates. */
  primaryLighting: StrategyField;
  /** Fill or accent light description. */
  secondaryLighting: StrategyField;
  /** Overall lighting mood and emotional quality. */
  moodLighting: StrategyField;
  /** Shadow character across the scene. */
  shadowStyle: StrategyField;
  /** Surface reflection treatment. */
  reflectionStyle: StrategyField;
  /** The overall photographic mood and camera feel. */
  cameraMood?: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Environment
// ─────────────────────────────────────────────────────────────────────────────

export interface EnvironmentSpec {
  /** The physical type of environment. */
  environmentType: StrategyField;
  /** What the environment communicates before any text is read. */
  storyContext: StrategyField;
  /** Specific details that communicate quality and brand credibility. */
  premiumDetails: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Marketing Context
// ─────────────────────────────────────────────────────────────────────────────

export interface MarketingContext {
  /** The marketing objective this image must serve. */
  campaignGoal: StrategyField;
  /** The primary emotion this image must create. */
  emotionalGoal: StrategyField;
  /** The specific marketing message this image embodies. */
  marketingGoal: StrategyField;
  /** Who this image is for — primary target audience. */
  targetAudience: StrategyField;
  /** How this image builds credibility — trust signals to include. */
  trustStrategy: StrategyField;
  /** The action the image should make the viewer feel compelled to take. */
  conversionIntent: StrategyField;
  /** Experience Engine: exact emotion the viewer must feel — first-class directive, preserve verbatim. */
  experienceEmotionalCore?: StrategyField;
  /** Experience Engine: what the visual must evoke — first-class directive, preserve verbatim. */
  experienceVisualImplication?: StrategyField;
  /** Experience Engine: primary experience type this creative must deliver. */
  experienceType?: StrategyField;
  /** The single most important campaign message this image must communicate. */
  coreMessage?: StrategyField;
  /** The explicit promise the brand makes to the customer in this campaign. */
  customerPromise?: StrategyField;
  /** Why the audience should choose this over any alternative — the value proposition. */
  valueProposition?: StrategyField;
  /** Time pressure or urgency signal — how immediate the campaign call-to-action is. */
  urgencySignal?: StrategyField;
  /** The visual communication register — the tonal quality the image should project. */
  visualTone?: StrategyField;
  /** Core audience frustrations this image must address emotionally. */
  audiencePainPoints?: StrategyField;
  /** What the audience aspires to — the desire state the image should activate. */
  audienceDesires?: StrategyField;
  /** The unique selling proposition to communicate visually. */
  uniqueSellingPoint?: StrategyField;
  /** How the image should stop the scroll — the attention mechanism. */
  attentionStrategy?: StrategyField;
  /** Secondary messages that reinforce the primary visual story. */
  supportingMessages?: StrategyField;
  /** Core emotional motivation driving the purchase — the psychological driver. */
  emotionalDriver?: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Typography Planning (zone reservations ONLY — no text content)
// ─────────────────────────────────────────────────────────────────────────────

export interface TypographyZones {
  /** Where headline text will be placed in post-production — zone must be clear. */
  reservedHeadlineArea: StrategyField;
  /** Where body copy will be placed — zone must have sufficient contrast and space. */
  reservedBodyArea: StrategyField;
  /** Where the CTA button/action text will be placed. */
  reservedCtaArea: StrategyField;
  /** Where the brand logo will be placed — clear exclusion zone. */
  reservedLogoArea: StrategyField;
  /** Where legal/disclaimer text will be placed — always the smallest zone. */
  reservedDisclaimerArea: StrategyField;
  /** Platform-specific note about text placement safety. */
  platformTextSafetyNote: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Brand Rules
// ─────────────────────────────────────────────────────────────────────────────

export interface BrandRules {
  /** The brand safety level required for this campaign. */
  brandSafety: StrategyField;
  /** Legal and ethical restrictions specific to this industry. */
  industryRestrictions: StrategyField;
  /** Elements that MUST always appear in this creative. */
  mandatoryElements: StrategyField;
  /** Elements that must NEVER appear — brand-level prohibition. */
  forbiddenElements: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Negative Constraints
// ─────────────────────────────────────────────────────────────────────────────

export interface NegativeConstraints {
  /** Consolidated list of all scene elements that must not appear. */
  forbiddenSceneElements: StrategyField;
  /** AI generation artifacts to actively prevent. */
  forbiddenAiArtifacts: StrategyField;
  /** Technical quality failures to avoid. */
  qualityAntiPatterns: StrategyField;
  /** Brand and marketing elements that would undermine the message. */
  brandAntiPatterns: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Rendering Intent
// ─────────────────────────────────────────────────────────────────────────────

export interface RenderingSpec {
  /** Photorealism level on a spectrum from stylised to hyperreal. */
  photorealismLevel: StrategyField<"hyperrealistic" | "photorealistic" | "photo_quality" | "stylized_realism" | "editorial_realism">;
  /** The advertising/commercial production standard. */
  commercialQuality: StrategyField<"regional_commercial" | "national_commercial" | "global_campaign" | "award_winning_creative">;
  /** The editorial photographic quality standard. */
  editorialQuality: StrategyField<"trade_editorial" | "consumer_magazine" | "luxury_editorial" | "art_direction">;
  /** How premium the final rendering must feel. */
  luxuryLevel: StrategyField<"utility_functional" | "professional_quality" | "premium_polished" | "luxury_refined" | "ultra_prestige_perfect">;
  /** What category of real-world media this image should resemble. */
  realismTarget: StrategyField<"premium_stock_photo" | "commercial_campaign_shoot" | "editorial_magazine_shoot" | "product_studio_shoot" | "architectural_photography">;
  /** Specific AI generation artifacts that must be actively prevented. */
  artifactPrevention: StrategyField;
  /** The overall design style direction — editorial, commercial, minimal, premium. */
  overallDesignStyle?: StrategyField;
  /** The visual archetype pattern for this creative. */
  visualArchetype?: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// PromptSpecification — complete output of the Prompt Specification Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface PromptSpecificationMeta {
  /** Unique ID for this specification instance. */
  specId: string;
  /** ISO timestamp when the specification was assembled. */
  createdAt: string;
  /** Version of the PromptSpecification schema. */
  schemaVersion: string;
  /** The blueprintId this specification was derived from. */
  sourceBlueprintId: string;
  /** 0–100 overall confidence across all sections. */
  confidenceScore: number;
  /** Validation status of this specification. */
  validationStatus: "ready" | "ready_with_warnings" | "incomplete";
  /** Non-fatal issues detected during specification assembly. */
  warnings: string[];
  /** Phase 10.4I — Hero Knowledge Graph metadata for memory and similarity tracking. */
  heroGraph?: import("../creative-brain/types").HeroKnowledgeGraphMeta;
}

// ─────────────────────────────────────────────────────────────────────────────
// GPT Narrative types (Phase 5.1 — Creative Director Consumption)
// These are populated by gpt-narrative.ts when a GPTCampaignDirection is
// available; the OpenAI translator bypasses section-based assembly when
// quality.status !== "failed".
// ─────────────────────────────────────────────────────────────────────────────

export interface PromptQualityCheck {
  name:   string;
  passed: boolean;
  reason: string;
}

export interface PromptQualityResult {
  /** "valid" = 7/7 checks passed; "partial" = 5–6; "failed" = <5 */
  status:       "valid" | "partial" | "failed";
  /** 0–100 weighted pass score. */
  score:        number;
  checks:       PromptQualityCheck[];
  failedChecks: string[];
}

export interface GPTNarrativeSection {
  /** Single coherent natural-language narrative built from all 22 GPT-CD fields.
   *  This becomes the OpenAI finalPrompt when quality.status !== "failed". */
  narrativePrompt: string;
  quality:         PromptQualityResult;
  /** GPT-CD field keys that had content and were included in the narrative. */
  fieldsConsumed:  string[];
  /** GPT-CD field keys that were missing or empty. */
  fieldsMissing:   string[];
}

export interface PromptSpecification {
  meta:               PromptSpecificationMeta;
  /** Phase 10.4J — Advertisement Intelligence: specific visual storytelling directives. */
  advertisementNarrative?: import("../advertisement-intelligence/types").AdvertisementNarrative;
  mission:            GenerationMission;
  hero:               HeroSpecification;
  supporting:         SupportingElements;
  composition:        CompositionSpec;
  camera:             CameraSpec;
  lighting:           LightingSpec;
  environment:        EnvironmentSpec;
  marketing:          MarketingContext;
  typography:         TypographyZones;
  brandRules:         BrandRules;
  negativeConstraints:NegativeConstraints;
  rendering:          RenderingSpec;
  /** Aggregated unknown fields across all sections. */
  unknownFields: string[];
  /** Phase 5.1 — GPT narrative mode: one coherent natural-language prompt
   *  derived from GPTCampaignDirection. When quality.status !== "failed",
   *  the OpenAI translator uses this instead of section-based assembly. */
  gptNarrative?: GPTNarrativeSection;
}
