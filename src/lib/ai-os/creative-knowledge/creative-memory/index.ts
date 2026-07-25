// Phase 10.4D — Creative Memory Platform: public API.
//
// Single import point for the entire creative-memory sub-module.
// Combines the original Phase 10.4 types (types.ts, schema.ts) with
// the Phase 10.4D architecture additions.

// ── Phase 10.4 — Original memory entry types ──────────────────────────────────
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
} from "./types";

export {
  CreativeMemoryEntrySchema,
} from "./schema";
export type { CreativeMemoryEntryData } from "./schema";

// ── Phase 10.4D — Fingerprint ─────────────────────────────────────────────────
export type { MemoryFingerprint } from "./fingerprint";

export {
  computeHash,
  buildFingerprint,
  buildEmptyFingerprint,
  fingerprintsAreIdentical,
  sameRouteAndIndustry,
} from "./fingerprint";

// ── Phase 10.4D — Patterns ────────────────────────────────────────────────────
export type {
  PatternType,
  PatternRankingScore,
  PatternWeight,
  CreativePattern,
  PatternFilter,
} from "./pattern";

export {
  PATTERN_RANKING_WEIGHTS,
  applyPatternRankingWeights,
  EMPTY_PATTERN_RANKING_SCORE,
} from "./pattern";

// ── Phase 10.4D — Learning and evolution ─────────────────────────────────────
export type {
  LearningSignalType,
  LearningOutcome,
  LearningSignal,
  WeightedElementKind,
  SuccessWeight,
  DecayConfig,
  EvolutionTrigger,
  EvolutionRecord,
  TrendDirection,
} from "./learning";

export {
  DEFAULT_DECAY_CONFIG,
  TEST_DECAY_CONFIG,
  computeTrendDirection,
} from "./learning";

// ── Phase 10.4D — Similarity search ──────────────────────────────────────────
export type {
  SimilarityDimension,
  DimensionWeights,
  SimilarityThreshold,
  SimilarityVector,
  SimilarityRecommendation,
  SimilarityResult,
  SearchScope,
  SimilaritySearchQuery,
  SimilaritySearchResult,
} from "./similarity";

export {
  DEFAULT_DIMENSION_WEIGHTS,
  DEFAULT_SIMILARITY_THRESHOLD,
  LENIENT_SIMILARITY_THRESHOLD,
  jaccardSimilarity,
  computeDimensionScores,
  applyDimensionWeights,
  compareFingerprints,
} from "./similarity";

// ── Phase 10.4D — Memory store interface ─────────────────────────────────────
export type {
  MemoryFilter,
  CommercialHistoryFilter,
  CommercialSuccessHistory,
  MemoryStore,
} from "./store";

export { NullMemoryStore } from "./store";

// ── Phase 10.4D — In-memory store implementation ──────────────────────────────
export { InMemoryStore } from "./in-memory-store";

// ── Phase 10.4D — Memory entry builder ───────────────────────────────────────
export type { MemoryEntryParams } from "./entry-builder";
export { buildMemoryEntry } from "./entry-builder";
