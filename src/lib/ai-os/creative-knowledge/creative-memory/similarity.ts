// Phase 10.4D — Creative Memory Platform: similarity search types.
//
// The similarity system answers one question before every generation:
//   "Is the route we're about to select too similar to what this user
//    saw recently? If so, which route should we recommend instead?"
//
// Similarity dimensions (weighted):
//   hero        — same heroId → very similar visual subject
//   scene       — same sceneId → same environment/backdrop
//   route       — same routeId → same creative direction
//   archetype   — shared archetypeId → same psychological mechanism
//   behaviour   — Jaccard(behaviourIds) → similar on-screen actions
//   relationship — Jaccard(relationshipIds) → same social dynamic
//   layout      — same layoutId → same visual structure
//   psychology  — shared psychologyIds → same emotional register
//   goal        — same campaignGoal → same business intent
//   industry    — same industryId (always 1.0 — only compare same industry)
//
// Recommendation flow:
//   1. Build SimilarityVector from the candidate's fingerprint.
//   2. Compare against recent memory entries via the MemoryStore.
//   3. If maxSimilarity > threshold.hard → recommendation = "reject".
//   4. If maxSimilarity > threshold.soft → recommendation = "diversify".
//   5. Engine receives recommendation + alternativeRouteIds.
//   6. Engine selects next-best candidate from the ranked pool.
//
// No engine logic in this file — pure data types and pure functions only.

import type { MemoryFingerprint } from "./fingerprint";

// ── Similarity dimensions ─────────────────────────────────────────────────────

/**
 * The named dimensions used in similarity calculation.
 * Each dimension corresponds to one or more MemoryFingerprint fields.
 *
 * Phase 10.4I additions: emotion, environment, composition, camera
 *   emotion     — heroCategory from HeroKnowledgeGraphMeta (e.g. "authority", "person")
 *   environment — sceneCategory from HeroKnowledgeGraphMeta (e.g. "clinical", "social")
 *   composition — compositionId from pipeline (Phase 10.4G)
 *   camera      — cameraId from pipeline (Phase 10.4G)
 */
export type SimilarityDimension =
  | "hero"         // heroId comparison (heroMomentId from knowledge graph)
  | "scene"        // sceneId comparison (sceneTypeId from knowledge graph)
  | "emotion"      // emotionId comparison (heroCategory — visual emotional register)
  | "environment"  // environmentId comparison (sceneCategory — visual setting type)
  | "composition"  // compositionId comparison
  | "camera"       // cameraId comparison
  | "route"        // routeId comparison
  | "archetype"    // archetypeIds Jaccard overlap
  | "behaviour"    // behaviourIds Jaccard overlap
  | "relationship" // relationshipIds Jaccard overlap
  | "layout"       // layoutId comparison
  | "psychology"   // psychologyIds Jaccard overlap
  | "goal"         // campaignGoal comparison
  | "industry";    // industryId comparison (gate — only compare same industry)

// ── Dimension weights ─────────────────────────────────────────────────────────

/**
 * Weights for each similarity dimension.
 * Values must sum to 1.0.
 *
 * Design rationale:
 *   hero + scene = 45%: the visual subject and environment are the most
 *                       immediately visible repeating elements.
 *   route + archetype = 30%: the creative strategy repeating is more
 *                             significant than the visual repeating alone.
 *   behaviour + relationship = 10%: secondary visual elements.
 *   layout + psychology = 10%: structural and emotional registers.
 *   goal = 5%: same goal is expected — it's rarely a differentiator.
 *   industry = gating only (not weighted — inter-industry comparisons skipped).
 */
export type DimensionWeights = Record<
  Exclude<SimilarityDimension, "industry">,
  number
>;

// Phase 10.4I weights — hero+scene now carry real IDs so their weight is
// meaningful. emotion+environment+composition+camera are new dimensions.
// All 13 non-industry dimensions sum to 1.0.
//
//   hero(0.20) + scene(0.15) + emotion(0.12) + environment(0.10)
//   + composition(0.08) + camera(0.07) + route(0.10) + archetype(0.08)
//   + behaviour(0.04) + relationship(0.02) + layout(0.02)
//   + psychology(0.01) + goal(0.01) = 1.00
export const DEFAULT_DIMENSION_WEIGHTS: DimensionWeights = {
  hero:         0.20,
  scene:        0.15,
  emotion:      0.12,
  environment:  0.10,
  composition:  0.08,
  camera:       0.07,
  route:        0.10,
  archetype:    0.08,
  behaviour:    0.04,
  relationship: 0.02,
  layout:       0.02,
  psychology:   0.01,
  goal:         0.01,
};

// ── Threshold configuration ───────────────────────────────────────────────────

/**
 * Three-tier similarity threshold.
 *
 * When compositeScore crosses `hard`: generation is blocked, route engine
 *   must select a different candidate (recommendation = "reject").
 * When compositeScore crosses `soft`: a warning is issued and the engine
 *   prefers an alternative (recommendation = "diversify").
 * `identical` catches exact hash matches before the full vector comparison.
 */
export interface SimilarityThreshold {
  /**
   * Exact duplicate detection threshold.
   * 1.0 = only triggers on hash-identical fingerprints.
   * Always checked first (fast path — string equality on hash).
   */
  readonly identical: number; // Default: 1.0

  /**
   * Hard block threshold.
   * compositeScore >= hard → recommendation = "reject"
   * Engine MUST select a different route.
   * Default: 0.80
   */
  readonly hard:      number; // Default: 0.80

  /**
   * Soft warning threshold.
   * soft <= compositeScore < hard → recommendation = "diversify"
   * Engine SHOULD prefer an alternative but may proceed if no alternative exists.
   * Default: 0.60
   */
  readonly soft:      number; // Default: 0.60
}

export const DEFAULT_SIMILARITY_THRESHOLD: SimilarityThreshold = {
  identical: 1.0,
  hard:      0.80,
  soft:      0.60,
};

/** Thresholds for users generating their first few creatives — more permissive. */
export const LENIENT_SIMILARITY_THRESHOLD: SimilarityThreshold = {
  identical: 1.0,
  hard:      0.90,
  soft:      0.75,
};

// ── SimilarityVector ──────────────────────────────────────────────────────────

/**
 * A numeric vector representation of a MemoryFingerprint for comparison.
 *
 * Each dimension contains the raw score BEFORE weighting.
 * The composite score applies dimension weights.
 *
 * Phase 10.4D: built from field comparisons (string equality + Jaccard).
 * Phase 10.5F: will include an embeddingVector dimension (cosine similarity)
 *              for semantic comparison of hero subjects and scene descriptions.
 */
export interface SimilarityVector {
  /** Hash of the fingerprint this vector was computed from. */
  readonly fingerprintHash:     string;

  /** Raw dimension scores (0.0–1.0 per dimension, before weighting). */
  readonly dimensionScores:     DimensionWeights;

  /**
   * Weighted composite similarity score.
   * Applied using DEFAULT_DIMENSION_WEIGHTS or the query-specified weights.
   * 0.0 = completely different; 1.0 = identical.
   */
  readonly compositeScore:      number;
}

// ── Comparison result ─────────────────────────────────────────────────────────

/**
 * The action recommendation produced by a similarity comparison.
 *
 * "proceed"    — compositeScore < threshold.soft: proceed with this route.
 * "diversify"  — soft <= compositeScore < hard: prefer an alternative if available.
 * "reject"     — compositeScore >= hard: must select a different route.
 */
export type SimilarityRecommendation = "proceed" | "diversify" | "reject";

/**
 * Full result of comparing two fingerprints across all dimensions.
 */
export interface SimilarityResult {
  /** Hash of the candidate fingerprint (the one being evaluated). */
  readonly candidateHash:      string;
  /** Hash of the reference fingerprint (from a past memory entry). */
  readonly referenceHash:      string;
  /** Reference entry ID — for tracing which past generation triggered this. */
  readonly referenceEntryId:   string;

  /** Dimension-by-dimension breakdown (before weighting). */
  readonly dimensionScores:    DimensionWeights;
  /** Weighted composite similarity score (0.0–1.0). */
  readonly compositeScore:     number;

  /** Whether the hash-equality (identical) check fired. */
  readonly isIdentical:        boolean;
  /** Whether compositeScore crossed the hard threshold. */
  readonly isAboveHard:        boolean;
  /** Whether compositeScore crossed the soft threshold. */
  readonly isAboveSoft:        boolean;

  /** Action recommendation for the route engine. */
  readonly recommendation:     SimilarityRecommendation;
}

// ── Similarity search query ───────────────────────────────────────────────────

/**
 * How many recent entries to compare against.
 * "last_5"    — compare against the 5 most recent entries (default).
 * "last_10"   — compare against the 10 most recent entries.
 * "last_30"   — compare against the last 30 days of entries.
 * "all"       — compare against all historical entries (expensive — use sparingly).
 */
export type SearchScope = "last_5" | "last_10" | "last_30" | "all";

/**
 * Query for the MemoryStore.searchSimilar() method.
 * The store executes this and returns a SimilaritySearchResult.
 */
export interface SimilaritySearchQuery {
  /** The fingerprint to compare against history. */
  readonly targetFingerprint:  MemoryFingerprint;
  /** Which historical entries to compare against. */
  readonly scope:              SearchScope;
  /** Thresholds for recommendation classification. Default: DEFAULT_SIMILARITY_THRESHOLD. */
  readonly threshold?:         SimilarityThreshold;
  /** Dimension weights. Default: DEFAULT_DIMENSION_WEIGHTS. */
  readonly weights?:           DimensionWeights;
  /** Maximum number of SimilarityResult entries to return. Default: 5. */
  readonly maxResults?:        number;
}

// ── Similarity search result ──────────────────────────────────────────────────

/**
 * Full result of a similarity search.
 * Returned by MemoryStore.searchSimilar().
 * Consumed by the RouteIntelligenceEngine to gate route selection.
 */
export interface SimilaritySearchResult {
  /** The query that produced this result. */
  readonly query:              SimilaritySearchQuery;

  /**
   * All comparison results, sorted descending by compositeScore.
   * The most similar past generation is at index 0.
   */
  readonly matches:            SimilarityResult[];

  /** The highest compositeScore found (0.0 if no history). */
  readonly maxSimilarity:      number;

  /**
   * Overall recommendation based on maxSimilarity.
   * "proceed"   — maxSimilarity < threshold.soft
   * "diversify" — soft <= maxSimilarity < hard
   * "reject"    — maxSimilarity >= hard
   */
  readonly recommendation:     SimilarityRecommendation;

  /**
   * Route IDs from the comparison set that are dissimilar enough to proceed.
   * These are the routes from rejected/diversify entries' routeIds that the
   * engine can use as forced alternatives when the original candidate is rejected.
   *
   * Empty when recommendation = "proceed" (no action needed).
   */
  readonly avoidRouteIds:      string[];

  /**
   * Route IDs that have historically been used for this industry + goal
   * with a compositeScore < threshold.soft — safe to use.
   * Empty in Phase 10.4D (populated when memory has entries).
   */
  readonly safeAlternativeRouteIds: string[];
}

// ── Pure comparison functions ─────────────────────────────────────────────────

/**
 * Compute Jaccard similarity between two string arrays.
 * Jaccard = |A ∩ B| / |A ∪ B|
 * Returns 1.0 when both arrays are empty (both have "nothing" — not different).
 */
export function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1.0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const v of setA) {
    if (setB.has(v)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1.0 : intersection / union;
}

/**
 * Compute the dimension scores between two MemoryFingerprints.
 * Returns raw scores (0.0–1.0) before weighting.
 * Industry dimension is excluded — inter-industry comparisons are blocked upstream.
 */
export function computeDimensionScores(
  candidate:  MemoryFingerprint,
  reference:  MemoryFingerprint,
): DimensionWeights {
  return {
    hero:         candidate.heroId        === reference.heroId        && candidate.heroId        !== "" ? 1.0 : 0.0,
    scene:        candidate.sceneId       === reference.sceneId       && candidate.sceneId       !== "" ? 1.0 : 0.0,
    emotion:      candidate.emotionId     === reference.emotionId     && candidate.emotionId     !== "" ? 1.0 : 0.0,
    environment:  candidate.environmentId === reference.environmentId && candidate.environmentId !== "" ? 1.0 : 0.0,
    composition:  candidate.compositionId === reference.compositionId && candidate.compositionId !== "" ? 1.0 : 0.0,
    camera:       candidate.cameraId      === reference.cameraId      && candidate.cameraId      !== "" ? 1.0 : 0.0,
    route:        candidate.routeId       === reference.routeId       && candidate.routeId       !== "" ? 1.0 : 0.0,
    archetype:    jaccardSimilarity(candidate.archetypeIds,    reference.archetypeIds),
    behaviour:    jaccardSimilarity(candidate.behaviourIds,    reference.behaviourIds),
    relationship: jaccardSimilarity(candidate.relationshipIds, reference.relationshipIds),
    layout:       candidate.layoutId      === reference.layoutId      && candidate.layoutId      !== "" ? 1.0 : 0.0,
    psychology:   jaccardSimilarity(candidate.psychologyIds,   reference.psychologyIds),
    goal:         candidate.campaignGoal === reference.campaignGoal ? 1.0 : 0.0,
  };
}

/**
 * Apply dimension weights to produce a composite similarity score.
 */
export function applyDimensionWeights(
  scores:  DimensionWeights,
  weights: DimensionWeights = DEFAULT_DIMENSION_WEIGHTS,
): number {
  return (
    scores.hero         * weights.hero         +
    scores.scene        * weights.scene        +
    scores.emotion      * weights.emotion      +
    scores.environment  * weights.environment  +
    scores.composition  * weights.composition  +
    scores.camera       * weights.camera       +
    scores.route        * weights.route        +
    scores.archetype    * weights.archetype    +
    scores.behaviour    * weights.behaviour    +
    scores.relationship * weights.relationship +
    scores.layout       * weights.layout       +
    scores.psychology   * weights.psychology   +
    scores.goal         * weights.goal
  );
}

/**
 * Compare two MemoryFingerprints and produce a SimilarityResult.
 * Pure function — no side effects, no I/O.
 *
 * @param candidateHash     Hash of the candidate fingerprint.
 * @param candidate         Full candidate fingerprint.
 * @param reference         Full reference fingerprint (from history).
 * @param referenceEntryId  Memory entry ID for the reference.
 * @param threshold         Threshold config for recommendation.
 * @param weights           Dimension weight config.
 */
export function compareFingerprints(
  candidateHash:    string,
  candidate:        MemoryFingerprint,
  reference:        MemoryFingerprint,
  referenceEntryId: string,
  threshold:        SimilarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
  weights:          DimensionWeights    = DEFAULT_DIMENSION_WEIGHTS,
): SimilarityResult {
  // Fast path — exact hash match
  const isIdentical = candidate.hash === reference.hash;
  if (isIdentical) {
    const perfect = makeAllOnes();
    return {
      candidateHash,
      referenceHash:    reference.hash,
      referenceEntryId,
      dimensionScores:  perfect,
      compositeScore:   1.0,
      isIdentical:      true,
      isAboveHard:      true,
      isAboveSoft:      true,
      recommendation:   "reject",
    };
  }

  // Full dimension comparison
  const dimensionScores = computeDimensionScores(candidate, reference);
  const compositeScore  = applyDimensionWeights(dimensionScores, weights);

  const isAboveHard = compositeScore >= threshold.hard;
  const isAboveSoft = compositeScore >= threshold.soft;

  const recommendation: SimilarityRecommendation =
    isAboveHard ? "reject" :
    isAboveSoft ? "diversify" :
                  "proceed";

  return {
    candidateHash,
    referenceHash:    reference.hash,
    referenceEntryId,
    dimensionScores,
    compositeScore,
    isIdentical:      false,
    isAboveHard,
    isAboveSoft,
    recommendation,
  };
}

function makeAllOnes(): DimensionWeights {
  return {
    hero:         1, scene:       1, emotion:      1, environment: 1,
    composition:  1, camera:      1, route:        1, archetype:   1,
    behaviour:    1, relationship: 1, layout:       1, psychology:  1,
    goal:         1,
  };
}
