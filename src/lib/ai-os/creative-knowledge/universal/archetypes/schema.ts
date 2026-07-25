// Phase 10.4A — Universal Archetype Platform Zod validation schemas.
// Use these to validate archetype entries before registration.
// Catches malformed curations at load time — not at generation time.

import { z } from "zod";

// ── Primitive schemas ──────────────────────────────────────────────────────────

const ArchetypeCategorySchema = z.enum([
  "commercial", "emotional", "human", "luxury", "trust",
  "transformation", "status", "community", "performance", "celebration",
  "journey", "education", "authority", "identity", "belonging",
  "healing", "innovation", "adventure", "recognition", "decision",
]);

const CommercialIntentSchema = z.enum([
  "drive_immediate_action", "build_brand_preference", "establish_authority",
  "create_desire", "reduce_purchase_friction", "generate_social_proof",
  "trigger_emotional_resonance", "educate_and_convert", "celebrate_and_retain",
  "differentiate_from_competition", "reframe_price_value", "create_urgency",
  "inspire_aspiration", "build_community_identity",
]);

const PsychologicalMechanismSchema = z.enum([
  "social_proof", "authority", "scarcity", "reciprocity", "liking", "unity",
  "aspiration", "fear_relief", "identity_reinforcement", "curiosity_gap",
  "loss_aversion", "peak_experience", "belonging_signal", "transformation_promise",
  "recognition_desire", "autonomy", "nostalgia", "status_signalling",
]);

const CampaignGoalSchema = z.enum([
  "awareness", "trust", "education", "engagement", "retention",
  "conversion", "loyalty", "event_attendance", "announcement", "product_discovery",
]);

const ConfidenceLevelSchema = z.enum(["high", "medium", "low"]);

const IncomeGroupSchema = z.enum(["budget", "mid_market", "affluent", "high_net_worth", "all"]);

const AgeGroupSchema = z.enum(["18-24", "25-34", "35-44", "45-54", "55+", "all"]);

const BuyerStageSchema = z.enum([
  "awareness", "consideration", "decision", "retention", "advocacy",
]);

// ── Sub-schemas ────────────────────────────────────────────────────────────────

const CommercialPurposeSchema = z.object({
  primaryIntent:         CommercialIntentSchema,
  secondaryIntent:       CommercialIntentSchema.optional(),
  conversionMechanism:   z.string().min(10),
  expectedOutcome:       z.string().min(10),
  optimalObjectives:     z.array(CampaignGoalSchema).min(1),
  averageConversionLift: z.null(),
});

const PsychologicalPurposeSchema = z.object({
  mechanism:          PsychologicalMechanismSchema,
  emotionalTrigger:   z.string().min(5),
  cognitiveBias:      z.string().optional(),
  motivationalDriver: z.string().min(5),
  audienceState:      z.enum(["before", "during", "after", "all"]),
});

const AudienceProfileSchema = z.object({
  incomeGroups:   z.array(IncomeGroupSchema).min(1),
  ageGroups:      z.array(AgeGroupSchema).min(1),
  buyerStages:    z.array(BuyerStageSchema).min(1),
  psychographics: z.array(z.string()),
  universal:      z.boolean(),
});

const ArchetypeFutureScoreSchema = z.object({
  performanceScore:   z.null(),
  viralityIndex:      z.null(),
  conversionLift:     z.null(),
  brandAffinityScore: z.null(),
  seasonalIndex:      z.null(),
});

const FutureMetadataSchema = z.object({
  embeddingVector: z.null(),
  successRate:     z.null(),
  lastUsedAt:      z.null(),
  userAffinity:    z.null(),
});

// ── Main schema ────────────────────────────────────────────────────────────────

export const UniversalArchetypeSchema = z.object({
  // KnowledgeNode base fields
  id:              z.string().regex(/^[a-z]+:[a-z][a-z0-9-]*$/, {
    message: "id must follow format '{category}:{slug}', e.g. 'trust:patient-discovery'",
  }),
  kind:            z.literal("archetype"),
  tags:            z.array(z.string()),
  priority:        z.number().int().min(1).max(10),
  weight:          z.number().min(0).max(1),
  confidence:      ConfidenceLevelSchema,
  commercialScore: z.number().int().min(0).max(100),
  futureMetadata:  FutureMetadataSchema,

  // UniversalArchetype-specific fields
  name:                  z.string().min(3).max(80),
  description:           z.string().min(20).max(300),
  category:              ArchetypeCategorySchema,
  subcategory:           z.string().optional(),
  commercialPurpose:     CommercialPurposeSchema,
  psychologicalPurpose:  PsychologicalPurposeSchema,
  compatibleIndustries:  z.union([
    z.array(z.string()).min(1), // SceneIndustry[]
    z.literal("all"),
  ]),
  compatibleCampaigns:   z.array(CampaignGoalSchema).min(1),
  compatibleAudience:    AudienceProfileSchema,
  futureScore:           ArchetypeFutureScoreSchema,
  legacyArchetypeId:     z.string().optional(),
});

export type UniversalArchetypeData = z.infer<typeof UniversalArchetypeSchema>;

/**
 * Validate an archetype entry before registration.
 * Throws a ZodError on invalid data so curation mistakes surface at load time.
 */
export function validateArchetype(raw: unknown): UniversalArchetypeData {
  return UniversalArchetypeSchema.parse(raw);
}
