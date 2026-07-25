// Phase 10.4 / 10.4.0 — Creative Knowledge Platform public API.
// Import from this index; never import sub-module paths directly.

// ── Shared types ──────────────────────────────────────────────────────────────
export type {
  ArchetypeId,
  HeroMomentId,
  CampaignTypeId,
  SceneTypeId,
  HumanBehaviourId,
  RelationshipId,
  CommercialPatternId,
  CampaignGoal,
  ConfidenceLevel,
} from "./types";

// ── Archetype Registry (Phase 10.4 — superseded by Phase 10.4A below) ────────
// Types aliased to "Legacy*" to avoid conflict with Phase 10.4A exports.
export type {
  ArchetypeCategory    as LegacyArchetypeCategory,
  CommercialPurpose    as LegacyCommercialPurpose,
  EmotionalPurpose,
  UniversalArchetype   as LegacyUniversalArchetype,
  ArchetypeAffinity,
} from "./archetype-registry/types";

export {
  getArchetypeById,
  getArchetypesByIndustry,
  getArchetypesByGoal,
  getArchetypesForContext,
  registrySize,
} from "./archetype-registry/registry";

// ── Knowledge Graph ───────────────────────────────────────────────────────────
export type {
  IndustryNode,
  CampaignTypeNode,
  HeroMomentNode,
  SceneTypeNode,
  HumanBehaviourNode,
  RelationshipNode,
  CommercialPatternNode,
} from "./knowledge-graph/types";

export {
  getIndustryNode,
  getCampaignTypes,
  getCampaignTypeById,
  getHeroMoments,
  getHeroMomentById,
  getSceneTypes,
  getBehaviours,
  getRelationships,
  getCommercialPatterns,
  graphSize as legacyGraphSize,
} from "./knowledge-graph/graph";

// ── Dynamic Route Engine ──────────────────────────────────────────────────────
export type {
  AudienceSignal,
  PsychologySignal,
  ReferenceImageSignal,
  SeasonSignal,
  HistorySignal,
  ExtendedRouteSignals,
  RouteScore,
  RouteCandidate,
} from "./route-engine/types";

export {
  evaluateRoutes,
  selectBestRoute,
  getTopCandidates,
  getBestRoute,
} from "./route-engine/engine";

// ── Creative Memory (Phase 10.4) ──────────────────────────────────────────────
export type {
  MemoryInput,
  MemoryBlueprint,
  MemoryHero,
  MemoryScene,
  MemoryPrompt,
  MemoryOutputMetadata,
  MemoryCommercialReview,
  MemoryUserFeedback,
  CreativeMemoryEntry,
} from "./creative-memory/types";

export {
  CreativeMemoryEntrySchema,
} from "./creative-memory/schema";
export type { CreativeMemoryEntryData } from "./creative-memory/schema";

// ── Creative Memory Platform (Phase 10.4D) ────────────────────────────────────
export type {
  MemoryFingerprint,
  PatternType,
  PatternRankingScore,
  PatternWeight,
  CreativePattern,
  PatternFilter,
  LearningSignalType,
  LearningOutcome,
  LearningSignal,
  WeightedElementKind,
  SuccessWeight,
  DecayConfig,
  EvolutionTrigger,
  EvolutionRecord,
  TrendDirection,
  SimilarityDimension,
  DimensionWeights,
  SimilarityThreshold,
  SimilarityVector,
  SimilarityRecommendation,
  SimilarityResult,
  SearchScope,
  SimilaritySearchQuery,
  SimilaritySearchResult,
  MemoryFilter,
  CommercialHistoryFilter,
  CommercialSuccessHistory,
  MemoryStore,
} from "./creative-memory/index";

export {
  buildFingerprint,
  buildEmptyFingerprint,
  fingerprintsAreIdentical,
  PATTERN_RANKING_WEIGHTS,
  applyPatternRankingWeights,
  EMPTY_PATTERN_RANKING_SCORE,
  DEFAULT_DECAY_CONFIG,
  TEST_DECAY_CONFIG,
  computeTrendDirection,
  DEFAULT_DIMENSION_WEIGHTS,
  DEFAULT_SIMILARITY_THRESHOLD,
  LENIENT_SIMILARITY_THRESHOLD,
  jaccardSimilarity,
  computeDimensionScores,
  applyDimensionWeights,
  compareFingerprints,
  NullMemoryStore,
  InMemoryStore,
  buildMemoryEntry,
} from "./creative-memory/index";

export type { MemoryEntryParams } from "./creative-memory/index";

// ── Diversity Metadata ────────────────────────────────────────────────────────
export type {
  DiversityMetadata,
  DiversityCheckResult,
} from "./diversity-metadata/types";

export {
  computeFingerprint,
  checkDiversity,
  buildEmptyDiversityMetadata,
} from "./diversity-metadata/extractor";

// ── Phase 10.4.0 / 10.4A — Universal Knowledge Node contract ─────────────────
export type {
  FutureMetadata,
  KnowledgeNodeKind,
  KnowledgeNode,
  ArchetypeKnowledgeNode,
  BehaviourKnowledgeNode,
  RelationshipKnowledgeNode,
  EmotionKnowledgeNode,
  PsychologyKnowledgeNode,
  CompositionKnowledgeNode,
  HeroMomentKnowledgeNode,
  SceneTypeKnowledgeNode,
  EmotionalMomentKnowledgeNode,
  CommercialSituationKnowledgeNode,
  RouteKnowledgeNode,
  PatternKnowledgeNode,
  CampaignTypeKnowledgeNode,
  ExperienceMapKnowledgeNode,
  ValidationRuleKnowledgeNode,
} from "./node";
export { EMPTY_FUTURE_METADATA } from "./node";

// ── Phase 10.4.0 — KnowledgeStore query interface ────────────────────────────
export type { KnowledgeFilter, KnowledgeStore } from "./store";

// ── Phase 10.4A — Universal Archetype Platform ───────────────────────────────
// Supersedes archetype-registry/ exports above for new code.
// Both coexist; archetype-registry/ is retained for backward compat only.
export type {
  ArchetypeCategory,
  CommercialIntent,
  CommercialPurpose,
  PsychologicalMechanism,
  PsychologicalPurpose,
  IncomeGroup,
  AgeGroup,
  BuyerStage,
  AudienceProfile,
  ArchetypeFutureScore,
  ArchetypeFilter,
} from "./universal/archetypes/index";

// UniversalArchetype re-exported under a distinct name to coexist with
// the legacy export from archetype-registry/types.ts above.
export type { UniversalArchetype as StrategicArchetype } from "./universal/archetypes/index";

export {
  EMPTY_ARCHETYPE_FUTURE_SCORE,
  register       as registerArchetype,
  registerAll    as registerAllArchetypes,
  getById        as getArchetypeById2,
  getByCategory  as getArchetypesByCategory,
  getForIndustry as getArchetypesForIndustry,
  getForCampaign as getArchetypesForCampaign,
  getForContext  as getArchetypesForContext2,
  getForBuyerStage,
  query          as queryArchetypes,
  size           as archetypePlatformSize,
  categories     as archetypeCategories,
  coverageReport as archetypeCoverageReport,
  UniversalArchetypeSchema,
  validateArchetype,
} from "./universal/archetypes/index";
export type { UniversalArchetypeData } from "./universal/archetypes/index";

// ── Phase 10.4.0 — Universal knowledge ───────────────────────────────────────
export {
  UNIVERSAL_BEHAVIOURS,
  UNIVERSAL_RELATIONSHIPS,
  UNIVERSAL_EMOTIONS,
  UNIVERSAL_PSYCHOLOGY,
  EXPERIENCE_MAPS,
  UNIVERSAL_COMPOSITIONS,
} from "./universal/index";

// ── Phase 10.4.0 / 10.4.1 — Industry knowledge ───────────────────────────────
export {
  RESTAURANT_HERO_MOMENTS,
  RESTAURANT_SCENE_TYPES,
  RESTAURANT_BEHAVIOURS,
  RESTAURANT_RELATIONSHIPS,
  RESTAURANT_EMOTIONAL_MOMENTS,
  RESTAURANT_COMMERCIAL_SITUATIONS,
  RESTAURANT_CAMPAIGN_TYPES,
  RESTAURANT_ROUTES,
  DENTAL_HERO_MOMENTS,
  DENTAL_SCENE_TYPES,
  DENTAL_BEHAVIOURS,
  DENTAL_RELATIONSHIPS,
  DENTAL_EMOTIONAL_MOMENTS,
  DENTAL_COMMERCIAL_SITUATIONS,
  DENTAL_CAMPAIGN_TYPES,
  DENTAL_ROUTES,
  SALON_HERO_MOMENTS,
  SALON_SCENE_TYPES,
  SALON_BEHAVIOURS,
  SALON_RELATIONSHIPS,
  SALON_EMOTIONAL_MOMENTS,
  SALON_COMMERCIAL_SITUATIONS,
  SALON_CAMPAIGN_TYPES,
  SALON_ROUTES,
  JEWELLERY_HERO_MOMENTS,
  JEWELLERY_SCENE_TYPES,
  JEWELLERY_BEHAVIOURS,
  JEWELLERY_RELATIONSHIPS,
  JEWELLERY_EMOTIONAL_MOMENTS,
  JEWELLERY_COMMERCIAL_SITUATIONS,
  JEWELLERY_CAMPAIGN_TYPES,
  JEWELLERY_ROUTES,
  FURNITURE_HERO_MOMENTS,
  FURNITURE_SCENE_TYPES,
  FURNITURE_BEHAVIOURS,
  FURNITURE_RELATIONSHIPS,
  FURNITURE_EMOTIONAL_MOMENTS,
  FURNITURE_COMMERCIAL_SITUATIONS,
  FURNITURE_CAMPAIGN_TYPES,
  FURNITURE_ROUTES,
  HOSPITAL_HERO_MOMENTS,
  HOSPITAL_SCENE_TYPES,
  HOSPITAL_BEHAVIOURS,
  HOSPITAL_RELATIONSHIPS,
  HOSPITAL_EMOTIONAL_MOMENTS,
  HOSPITAL_COMMERCIAL_SITUATIONS,
  HOSPITAL_CAMPAIGN_TYPES,
  HOSPITAL_ROUTES,
  REAL_ESTATE_HERO_MOMENTS,
  REAL_ESTATE_SCENE_TYPES,
  REAL_ESTATE_BEHAVIOURS,
  REAL_ESTATE_RELATIONSHIPS,
  REAL_ESTATE_EMOTIONAL_MOMENTS,
  REAL_ESTATE_COMMERCIAL_SITUATIONS,
  REAL_ESTATE_CAMPAIGN_TYPES,
  REAL_ESTATE_ROUTES,
  SCHOOL_HERO_MOMENTS,
  SCHOOL_SCENE_TYPES,
  SCHOOL_BEHAVIOURS,
  SCHOOL_RELATIONSHIPS,
  SCHOOL_EMOTIONAL_MOMENTS,
  SCHOOL_COMMERCIAL_SITUATIONS,
  SCHOOL_CAMPAIGN_TYPES,
  SCHOOL_ROUTES,
  RETAIL_HERO_MOMENTS,
  RETAIL_SCENE_TYPES,
  RETAIL_BEHAVIOURS,
  RETAIL_RELATIONSHIPS,
  RETAIL_EMOTIONAL_MOMENTS,
  RETAIL_COMMERCIAL_SITUATIONS,
  RETAIL_CAMPAIGN_TYPES,
  RETAIL_ROUTES,
  INTERIOR_DESIGN_HERO_MOMENTS,
  INTERIOR_DESIGN_SCENE_TYPES,
  INTERIOR_DESIGN_BEHAVIOURS,
  INTERIOR_DESIGN_RELATIONSHIPS,
  INTERIOR_DESIGN_EMOTIONAL_MOMENTS,
  INTERIOR_DESIGN_COMMERCIAL_SITUATIONS,
  INTERIOR_DESIGN_CAMPAIGN_TYPES,
  INTERIOR_DESIGN_ROUTES,
  GENERIC_HERO_MOMENTS,
  GENERIC_SCENE_TYPES,
  GENERIC_BEHAVIOURS,
  GENERIC_RELATIONSHIPS,
  GENERIC_EMOTIONAL_MOMENTS,
  GENERIC_COMMERCIAL_SITUATIONS,
  GENERIC_CAMPAIGN_TYPES,
  GENERIC_ROUTES,
} from "./industries/index";

// ── Phase 10.4C — Dynamic Route Intelligence ─────────────────────────────────
export type {
  BusinessSignal,
  ExperienceSignal,
  CommercialHistorySignal,
  CampaignSignal,
  RouteEvaluationContext,
  RouteIntelligenceScore,
  ScoreRationale,
  ScoredRouteCandidate,
  RouteRankingConfig,
  RouteSelectionStrategy,
  RouteIntelligenceOptions,
  RouteIntelligenceResult,
  CandidateSpec,
} from "./route-intelligence/index";

export {
  DEFAULT_RANKING_CONFIG,
  GOAL_RANKING_CONFIGS,
  DEFAULT_OPTIONS,
  NEUTRAL_SCORE,
  ROUTE_SCORERS,
  generateCandidateSpecs,
  buildCandidatePool,
  rankCandidates,
  assessResultQuality,
  contextFromSignals,
  evaluateIntelligence,
  getBestRouteForContext,
  getTopCandidates      as getTopIntelligenceCandidates,
  evaluateFromSignals,
  // Phase 10.4C production wiring helpers
  buildRouteContext,
  applyRouteToScene,
} from "./route-intelligence/index";

// ── Generation Mode System ────────────────────────────────────────────────────
export type {
  GenerationMode,
  DeterministicConfig,
  ExplorationConfig,
  GenerationModeConfig,
  IntentSignature,
  ExecutionSignature,
  RejectionReason,
  CandidateRejection,
  ModeExecutionResult,
  ExplorationFilter,
  ExplorationSelectionResult,
} from "./generation-mode/index";

export {
  DEFAULT_DETERMINISTIC_CONFIG,
  DEFAULT_EXPLORATION_CONFIG,
  computeIntentSignature,
  intentSignaturesMatch,
  computeExecutionSignature,
  executionSignaturesMatch,
  shareHeroMoment,
  shareSceneType,
  buildExplorationFilter,
  applyPatternBoosts,
  findRejectionReason,
  relaxFilter,
  selectExplorationCandidate,
  selectDeterministicCandidate,
} from "./generation-mode/index";

// ── Phase 10.4B — Industry Knowledge Graph ────────────────────────────────────
export type {
  SeasonName,
  CulturalOccasion,
  SeasonWindow,
  AudienceTier,
  AudienceAge,
  AudienceGender,
  BuyerJourneyStage,
  NodeAudience,
  LuxuryLevel,
  NodeLuxury,
  FunnelStage,
  NodePsychology,
  FutureLearningMetadata,
  NodeMetadata,
  GraphNode,
  IndustryExpansionTargets,
  IndustryGraphNode,
  CampaignTypeGraphNode,
  HeroMomentGraphNode,
  SceneTypeGraphNode,
  BehaviourGraphNode,
  RelationshipGraphNode,
  EmotionalMomentGraphNode,
  CommercialSituationGraphNode,
  CommercialPatternGraphNode,
  AnyGraphNode,
  GraphFilter,
  GraphTraversalQuery,
  GraphSizeReport,
} from "./graph/index";

export {
  YEAR_ROUND_SEASON,
  UNIVERSAL_AUDIENCE,
  DEFAULT_LUXURY,
  EMPTY_FUTURE_LEARNING,
  STANDARD_EXPANSION_TARGETS,
  GRAPH_NODE_KINDS,
  LUXURY_LEVEL_RANK,
  registerIndustry,
  registerCampaignType,
  registerHeroMoment,
  registerSceneType,
  registerBehaviour      as registerBehaviourNode,
  registerRelationship   as registerRelationshipNode,
  registerEmotionalMoment,
  registerCommercialSituation,
  registerCommercialPattern,
  registerGraphNodes,
  getIndustry,
  getCampaignType,
  getHeroMoment,
  getSceneType,
  getBehaviour,
  getRelationship,
  getEmotionalMoment,
  getCommercialSituation,
  getCommercialPattern,
  getCampaignTypesForIndustry,
  getHeroMomentsForCampaignType,
  getSceneTypesForHeroMoment,
  getBehavioursForSceneType,
  getRelationshipsForBehaviour,
  getEmotionalMomentsForHeroMoment,
  getCommercialSituationsForBehaviour,
  queryNodes,
  graphSize,
  registeredIndustries,
} from "./graph/index";
