// Phase 10.4 — Creative Memory Zod validation schemas.
// Mirrors creative-memory/types.ts for runtime validation.
// No storage implementation — schema contract only.
//
// Future Phase 10.4E: use CreativeMemoryEntrySchema to validate entries
// before DB upsert and to parse entries returned from the DB.

import { z } from "zod";

// ── Primitive schemas ──────────────────────────────────────────────────────

const SceneIndustrySchema = z.enum([
  "restaurant", "dental", "salon", "jewellery", "hospital",
  "interior", "real-estate", "furniture", "school", "retail", "generic",
]);

const MaterialTierSchema = z.enum(["luxury", "mid", "mass"]);

const CampaignGoalSchema = z.enum([
  "awareness", "trust", "education", "engagement", "retention",
  "conversion", "loyalty", "event_attendance", "announcement", "product_discovery",
]);

const RouteScoreSchema = z.object({
  relevance:     z.number().min(0).max(1),
  diversity:     z.number().min(0).max(1),
  industryFit:   z.number().min(0).max(1),
  tierMatch:     z.number().min(0).max(1),
  seasonalBoost: z.number().min(0).max(1),
  total:         z.number().min(0).max(1),
});

// ── Sub-schemas ────────────────────────────────────────────────────────────

const MemoryInputSchema = z.object({
  rawIdea:      z.string(),
  industry:     SceneIndustrySchema,
  campaignGoal: CampaignGoalSchema,
  luxuryTier:   MaterialTierSchema,
  signals:      z.record(z.string(), z.unknown()),
});

const MemoryBlueprintSchema = z.object({
  selectedRouteId: z.string(),
  archetypeId:     z.string(),
  heroMomentId:    z.string(),
  sceneTypeId:     z.string(),
  score:           RouteScoreSchema,
});

const MemoryHeroSchema = z.object({
  subject: z.string(),
  source:  z.enum([
    "gpt_creative_director",
    "hero_decision_engine",
    "knowledge_bank",
    "knowledge_graph",
  ]),
});

const MemorySceneSchema = z.object({
  environment:  z.string(),
  lighting:     z.string(),
  composition:  z.string(),
});

const MemoryPromptSchema = z.object({
  finalPrompt:    z.string(),
  providerTarget: z.string(),
  blocksPresent:  z.array(z.string()),
  realismApplied: z.boolean(),
  materialTier:   MaterialTierSchema,
});

const MemoryOutputMetadataSchema = z.object({
  generatedAt: z.date(),
  projectId:   z.string().optional(),
  assetId:     z.string().optional(),
  fingerprint: z.string(),
});

const MemoryCommercialReviewSchema = z.object({
  reviewedAt:  z.date(),
  isOnBrief:   z.boolean(),
  heroScore:   z.number().min(0).max(100).optional(),
  sceneScore:  z.number().min(0).max(100).optional(),
  notes:       z.string().optional(),
});

const MemoryUserFeedbackSchema = z.object({
  rating: z.union([
    z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  ]).optional(),
  regenerated:  z.boolean(),
  feedbackText: z.string().optional(),
  timestamp:    z.date(),
});

// DiversityMetadata is validated loosely here to avoid circular import;
// its own schema lives in diversity-metadata/extractor.ts.
const DiversityMetadataSchema = z.object({
  heroId:          z.string(),
  archetypeId:     z.string(),
  sceneId:         z.string(),
  behaviourIds:    z.array(z.string()),
  relationshipIds: z.array(z.string()),
  layoutId:        z.string(),
  cameraId:        z.string(),
  lightingId:      z.string(),
  compositionId:   z.string(),
  fingerprint:     z.string(),
});

// ── Main schema ────────────────────────────────────────────────────────────

export const CreativeMemoryEntrySchema = z.object({
  id:        z.string().uuid(),
  userId:    z.string(),
  timestamp: z.date(),
  input:     MemoryInputSchema,
  blueprint: MemoryBlueprintSchema,
  hero:      MemoryHeroSchema,
  scene:     MemorySceneSchema,
  prompt:    MemoryPromptSchema,
  output:    MemoryOutputMetadataSchema,
  diversity: DiversityMetadataSchema,
  review:    MemoryCommercialReviewSchema.optional(),
  feedback:  MemoryUserFeedbackSchema.optional(),
});

export type CreativeMemoryEntryData = z.infer<typeof CreativeMemoryEntrySchema>;
