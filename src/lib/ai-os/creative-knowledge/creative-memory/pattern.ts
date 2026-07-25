// Phase 10.4D — Creative Memory Platform: creative patterns and ranking.
//
// A CreativePattern is an abstraction extracted from multiple similar memory
// entries. Where a MemoryFingerprint represents ONE generation, a pattern
// represents a RECURRING successful combination across many generations.
//
// Pattern extraction pipeline (Phase 10.5A implements the extractor):
//   1. Cluster memory entries by a subset of fingerprint IDs (the "core IDs").
//   2. For each cluster of 3+ entries with > 60% success rate: extract a pattern.
//   3. Assign PatternRankingScore based on success metrics.
//   4. Emit PatternWeight to the route intelligence engine.
//
// Pattern types and their core IDs:
//   "hero_scene"          → heroId + sceneId
//   "archetype_route"     → archetypeIds[0] + routeId
//   "psychology_hero"     → psychologyIds[0] + heroId
//   "commercial_sequence" → routeId + campaignGoal + conversionMoment
//   "seasonal_pattern"    → industryId + month + heroId
//
// No engine logic in this file — pure data types and constants.

import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { CampaignGoal }  from "../types";

// ── Pattern type ─────────────────────────────────────────────────────────────

/**
 * The category of creative combination this pattern captures.
 * Each type has a distinct extraction algorithm in Phase 10.5A.
 */
export type PatternType =
  | "hero_scene"           // Recurring hero moment + scene type combination
  | "archetype_route"      // Recurring archetype + route pairing
  | "psychology_hero"      // Psychological mechanism + hero moment
  | "commercial_sequence"  // Route + campaign goal + commercial outcome sequence
  | "seasonal_pattern";    // Industry + seasonal timing + hero moment

// ── PatternRankingScore ───────────────────────────────────────────────────────

/**
 * Multi-dimensional ranking score for one CreativePattern.
 * All sub-scores are 0.0–1.0 (float normalised).
 * `total` is a weighted composite defined by PATTERN_RANKING_WEIGHTS.
 *
 * Population schedule:
 *   Phase 10.4D: all fields 0.0 (architecture — no entries to aggregate yet).
 *   Phase 10.5A: successRate + useCount filled from memory entry aggregation.
 *   Phase 10.5B: averageUserRating filled from user feedback aggregation.
 *   Phase 10.5C: conversionLift filled from A/B campaign outcome data.
 *   Phase 10.5D: noveltyDecay + recencyScore updated on each new entry.
 *   Phase 10.5E: crossIndustryScore updated as multi-industry entries accumulate.
 */
export interface PatternRankingScore {
  /**
   * Fraction of matching entries where commercial review passed (isOnBrief = true).
   * 0.0 = never on brief; 1.0 = always on brief.
   */
  successRate:         number;

  /**
   * Mean user rating across all rated entries matching this pattern, normalised to 0–1.
   * (rating – 1) / 4 maps 1–5 → 0.0–1.0.
   * Null ratings are excluded from the mean.
   */
  averageUserRating:   number;

  /** Total number of generations that match this pattern. Raw count. */
  useCount:            number;

  /**
   * Commercial conversion lift vs. the industry-wide baseline.
   * null until Phase 10.5C populates from real campaign outcome data.
   */
  conversionLift:      number | null;

  /**
   * Staleness signal. Rises as useCount grows without new successes.
   * 0.0 = fresh (recently successful, rarely repeated);
   * 1.0 = stale (repeated many times without fresh successes).
   * Computed: min(1, useCount / (successCount * NOVELTY_SCALE_FACTOR)).
   */
  noveltyDecay:        number;

  /**
   * Recency — how recently this pattern was used.
   * 1.0 = used in the last 7 days; 0.0 = not used in 90+ days.
   * Computed by the evolution engine on each cycle; decays exponentially.
   */
  recencyScore:        number;

  /**
   * How universally this pattern works across different industries.
   * 0.0 = only worked in one industry; 1.0 = works equally well in 3+ industries.
   * Cross-industry patterns are promoted in mixed-industry accounts.
   */
  crossIndustryScore:  number;

  /**
   * Weighted composite of all dimensions.
   * Computed by applyPatternRankingWeights() using PATTERN_RANKING_WEIGHTS.
   */
  total:               number;
}

/** Default ranking weights for PatternRankingScore.total. */
export const PATTERN_RANKING_WEIGHTS: Record<
  keyof Omit<PatternRankingScore, "total" | "useCount">,
  number
> = {
  successRate:        0.40, // Commercial success is the primary signal
  averageUserRating:  0.20, // User satisfaction is the secondary signal
  conversionLift:     0.15, // Outcome data when available
  noveltyDecay:       0.10, // Penalise stale patterns (inverted — lower decay = higher score)
  recencyScore:       0.10, // Favour recently confirmed patterns
  crossIndustryScore: 0.05, // Small bonus for universally applicable patterns
};

/**
 * Compute PatternRankingScore.total from individual dimensions.
 * conversionLift: null is treated as 0.5 (neutral — no outcome data).
 * noveltyDecay is inverted (1 - decay) so higher decay = lower total.
 */
export function applyPatternRankingWeights(score: Omit<PatternRankingScore, "total">): number {
  const w = PATTERN_RANKING_WEIGHTS;
  const cl = score.conversionLift ?? 0.5;
  return Math.min(1.0,
    score.successRate        * w.successRate       +
    score.averageUserRating  * w.averageUserRating  +
    cl                       * w.conversionLift     +
    (1 - score.noveltyDecay) * w.noveltyDecay       + // inverted
    score.recencyScore       * w.recencyScore       +
    score.crossIndustryScore * w.crossIndustryScore
  );
}

/** Empty ranking score for a newly extracted pattern with no data. */
export const EMPTY_PATTERN_RANKING_SCORE: PatternRankingScore = {
  successRate:        0,
  averageUserRating:  0,
  useCount:           0,
  conversionLift:     null,
  noveltyDecay:       0,
  recencyScore:       0,
  crossIndustryScore: 0,
  total:              0,
};

// ── PatternWeight ─────────────────────────────────────────────────────────────

/**
 * A boost or suppression weight applied to a creative element.
 * Emitted by the pattern engine; consumed by the route intelligence scorer.
 *
 * Weight scale:
 *   0.0   — fully suppressed (blacklisted for this context)
 *   0.5   — soft suppression (prefer alternatives)
 *   1.0   — neutral (no adjustment)
 *   1.5   — soft boost (prefer this element)
 *   2.0   — strong boost (prioritise this element)
 */
export interface PatternWeight {
  /** Pattern that produced this weight. */
  readonly patternId:   string;
  /** The ID of the creative element being weighted. */
  readonly elementId:   string;
  /** The kind of element: "route" | "archetype" | "hero_moment" | "scene_type" etc. */
  readonly elementKind: string;
  /** 0.0–2.0. 1.0 = neutral. */
  readonly weight:      number;
  /** One sentence explaining why this weight was assigned. */
  readonly reason:      string;
  /**
   * ISO 8601 expiry. Null = this weight is permanent until overridden.
   * Seasonal boosts expire after the season; event boosts expire after the event.
   */
  readonly expiresAt:   string | null;
}

// ── CreativePattern ───────────────────────────────────────────────────────────

/**
 * A recurring creative combination extracted from multiple memory entries.
 *
 * Patterns are the learning layer's primary output. They answer:
 *   "When we use hero X + scene Y for industry Z, what is the success rate?"
 *
 * The pattern engine in Phase 10.5A builds and updates these.
 * Engines in Phase 10.5B+ consume patterns to bias route selection.
 */
export interface CreativePattern {
  /**
   * Stable unique ID. Format: "pattern:{type}:{slug}"
   * Example: "pattern:hero_scene:restaurant-food-arrival-dining-room"
   */
  readonly patternId:          string;

  /** Human-readable name for logging and UI. */
  readonly name:               string;

  /** The structural type of this pattern — drives extraction algorithm. */
  readonly type:               PatternType;

  /**
   * The invariant IDs — the combination that defines this pattern.
   * Every entry that matches this pattern shares ALL of these IDs.
   */
  readonly coreIds:            Record<string, string>;

  /**
   * IDs that vary across entries that match this pattern.
   * Used to understand what "dresses up" the core combination differently.
   */
  readonly variableIds:        Record<string, string[]>;

  /**
   * Representative fingerprint for this pattern.
   * Built from the median entry in the cluster.
   * Used as the reference for similarity search comparisons.
   */
  readonly representativeHash: string;

  /** Number of memory entries that match this pattern. */
  readonly entryCount:         number;

  /** Number of matching entries where isOnBrief = true. */
  readonly successCount:       number;

  /** Multi-dimensional ranking score. */
  readonly rankingScore:       PatternRankingScore;

  /**
   * Weight adjustments this pattern has emitted for the route intelligence engine.
   * Applied to the corresponding creative elements when this pattern's industry
   * and campaign goal match the current request.
   */
  readonly weights:            PatternWeight[];

  /** Industries this pattern has appeared in. Populated as entries accumulate. */
  readonly industryIds:        SceneIndustry[];

  /** Campaign goals this pattern has served. */
  readonly campaignGoals:      CampaignGoal[];

  /** ISO 8601 timestamp of first matching entry. */
  readonly firstSeenAt:        string;

  /** ISO 8601 timestamp of most recent matching entry. */
  readonly lastSeenAt:         string;

  /**
   * Whether this pattern is active (being used by the engine).
   * Inactive patterns have decayed below the minimum score threshold
   * or have been superseded by a better-performing variant.
   */
  readonly isActive:           boolean;
}

// ── Pattern filter ────────────────────────────────────────────────────────────

/** Filter for querying patterns from the MemoryStore. */
export interface PatternFilter {
  /** Match patterns that include this industry. */
  industry?:      SceneIndustry;
  /** Match patterns that served this campaign goal. */
  campaignGoal?:  CampaignGoal;
  /** Pattern type filter. */
  type?:          PatternType;
  /** Only return active patterns. Default: true. */
  activeOnly?:    boolean;
  /** Minimum total ranking score. */
  minScore?:      number; // 0.0–1.0
  /** Minimum number of matching entries. */
  minEntryCount?: number;
  /** Maximum results. */
  limit?:         number;
  /** Sort order. Default: "score". */
  sortBy?:        "score" | "entryCount" | "recency";
}
