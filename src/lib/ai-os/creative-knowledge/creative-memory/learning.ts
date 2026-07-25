// Phase 10.4D — Creative Memory Platform: learning and evolution types.
//
// Three layered concepts:
//
//   LearningSignal — extracted from ONE completed memory entry.
//     "This entry was successful/unsuccessful. These IDs were present."
//
//   SuccessWeight — the running weight for ONE creative element across ALL entries.
//     "Route X has a 73% success rate with 42 entries. Current weight: 1.4."
//
//   EvolutionRecord — a snapshot of a pattern's state at a point in time.
//     "Pattern Y had score 0.61 on 2026-07-06. Three new successes raised it to 0.74."
//
// Data flow (Phase 10.5A implements the extractor that runs this pipeline):
//
//   CreativeMemoryEntry (completed)
//       ↓
//   extractLearningSignal()
//       ↓
//   updateSuccessWeights() → SuccessWeight[] updated
//       ↓
//   extractPatterns() → CreativePattern[] updated or created
//       ↓
//   recordEvolution() → EvolutionRecord saved per changed pattern
//       ↓
//   PatternWeight[] emitted → consumed by RouteIntelligenceEngine
//
// No engine logic in this file — pure data types, constants, and config.

import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { CampaignGoal }  from "../types";

// ── LearningSignal ────────────────────────────────────────────────────────────

/**
 * Source of the learning signal — determines its strength multiplier.
 * "combined" = both user feedback AND commercial review present.
 */
export type LearningSignalType =
  | "user_feedback"       // Only user rating/regeneration signal
  | "commercial_review"   // Only creative director review (isOnBrief)
  | "regeneration_signal" // User clicked regenerate — implicit negative signal
  | "combined";           // Both review + feedback — strongest signal

/**
 * The outcome extracted from one memory entry for the learning system.
 * Always binary: success or failure per signal type.
 *
 * Extraction rules:
 *   user_feedback:       rating >= 4 = success; rating <= 2 = failure; no signal = skip
 *   commercial_review:   isOnBrief = true = success; false = failure
 *   regeneration_signal: regenerated = true = failure (implicit)
 *   combined:            both sources agree = strongest signal
 */
export type LearningOutcome = "success" | "failure" | "neutral";

/**
 * A learning signal extracted from one completed memory entry.
 *
 * The signal extraction function in Phase 10.5A reads the entry and
 * produces this struct. The success weight engine then uses the signal
 * to update weights for every ID present in the entry's fingerprint.
 */
export interface LearningSignal {
  /** Source memory entry. */
  readonly entryId:             string;
  /** The user who generated this entry. */
  readonly userId:              string;
  /** The industry context — weights are partly industry-scoped. */
  readonly industryId:          SceneIndustry;

  /** Overall learning outcome for this entry. */
  readonly outcome:             LearningOutcome;

  /** Signal type — shapes strength multiplier. */
  readonly signalType:          LearningSignalType;

  /**
   * Strength of this signal (0.0–1.0).
   * Computed from signal type + magnitude:
   *   "combined" + perfect review + rating 5: 1.0
   *   "combined" + partial:                   0.7–0.9
   *   "commercial_review" only:               0.6
   *   "user_feedback" only:                   0.4–0.6 (proportional to rating)
   *   "regeneration_signal":                  0.5 (negative)
   */
  readonly strengthMultiplier:  number;

  /**
   * IDs that correlated with the success outcome.
   * When outcome = "success": all IDs in the entry's fingerprint.
   * When outcome = "failure": only the high-weight IDs (routeId, heroId, archetypeIds).
   */
  readonly positiveSignalIds:   string[];

  /**
   * IDs that correlated with the failure outcome.
   * When outcome = "failure": all IDs in the entry's fingerprint.
   * When outcome = "success": empty.
   */
  readonly negativeSignalIds:   string[];

  /** ISO 8601 timestamp of signal extraction. */
  readonly extractedAt:         string;
}

// ── SuccessWeight ─────────────────────────────────────────────────────────────

/**
 * Kind of creative element tracked by the weight system.
 * Maps directly to knowledge graph node kinds + pipeline subsystem IDs.
 */
export type WeightedElementKind =
  | "route"          // Phase 8.6 creative route ID
  | "archetype"      // Universal archetype ID
  | "hero_moment"    // Knowledge graph hero moment ID
  | "scene_type"     // Knowledge graph scene type ID
  | "behaviour"      // Knowledge graph behaviour ID
  | "relationship"   // Knowledge graph relationship ID
  | "layout"         // Visual layout family ID
  | "camera"         // Camera configuration ID
  | "lighting"       // Lighting setup ID
  | "composition"    // Composition pattern ID
  | "psychology";    // Psychological mechanism ID

/**
 * Running success weight for one creative element, aggregated across all
 * memory entries where that element was present.
 *
 * Weight interpretation:
 *   0.0–0.5: Underperforming — penalise in route selection
 *   0.5–0.8: Below average — slight suppression
 *   0.8–1.2: Average — neutral (treated as 1.0)
 *   1.2–1.6: Above average — moderate boost
 *   1.6–2.0: Excellent — strong boost
 *
 * Weight formula (Phase 10.5A):
 *   weight = 1.0 + (weightedSuccessRate - 0.5) * WEIGHT_SCALE
 *   Where weightedSuccessRate is time-decayed (recent successes count more).
 *   Clamped to [MIN_WEIGHT, MAX_WEIGHT].
 */
export interface SuccessWeight {
  /** The creative element's stable ID. */
  readonly elementId:          string;
  /** The kind of element. */
  readonly elementKind:        WeightedElementKind;

  /** Cumulative count of memory entries where this element was present. */
  readonly useCount:           number;
  /** Count of entries where this element was present and outcome = "success". */
  readonly successCount:       number;
  /** Count of entries where this element was present and outcome = "failure". */
  readonly failureCount:       number;

  /**
   * Raw success rate: successCount / (successCount + failureCount).
   * Null when useCount = 0 (no data yet).
   */
  readonly rawSuccessRate:     number | null;

  /**
   * Time-decayed success rate — recent successes weighted more than old ones.
   * Computed by the decay engine using DecayConfig.halfLifeDays.
   * Null until Phase 10.5D implements the decay engine.
   */
  readonly decayedSuccessRate: number | null;

  /**
   * The current weight applied when this element is selected.
   * Derived from decayedSuccessRate when available; raw rate otherwise.
   * Default: 1.0 (neutral).
   */
  readonly weight:             number;

  /**
   * Whether this weight is scoped to a specific industry.
   * True = weight only applies when industry matches industryScope.
   * False = weight applies globally across all industries.
   */
  readonly industryScoped:     boolean;

  /**
   * Industries this weight applies to.
   * Empty = global weight (industryScoped = false).
   */
  readonly industryScope:      SceneIndustry[];

  /**
   * Campaign goals this weight applies to.
   * Empty = all campaign goals.
   */
  readonly goalScope:          CampaignGoal[];

  /** ISO 8601 timestamp of last weight recalculation. */
  readonly lastUpdatedAt:      string;
}

// ── DecayConfig ───────────────────────────────────────────────────────────────

/**
 * Configuration for time-based success weight decay.
 * Prevents the system from over-fitting to historical patterns that are
 * no longer valid (seasonal changes, brand evolution, industry trends).
 */
export interface DecayConfig {
  /**
   * Half-life in days: after this many days, an old success is worth 50%
   * of a new success of equal quality.
   * Default: 90 days.
   */
  readonly halfLifeDays:    number;

  /**
   * Minimum weight floor — no element can be weighted below this.
   * Prevents any element from being fully blacklisted by bad luck alone.
   * Default: 0.2.
   */
  readonly minimumWeight:   number;

  /**
   * Maximum weight ceiling — no element can be weighted above this.
   * Prevents monopoly by one very successful element.
   * Default: 2.0.
   */
  readonly maximumWeight:   number;

  /**
   * Minimum entries required before weight diverges from 1.0.
   * Below this threshold: weight stays at 1.0 (neutral) regardless of signals.
   * Prevents single-entry over-fitting.
   * Default: 3.
   */
  readonly minEntriesForWeight: number;

  /**
   * Whether decay is applied during weight calculation.
   * False in testing / development environments.
   */
  readonly decayEnabled:    boolean;
}

/** Production defaults for DecayConfig. */
export const DEFAULT_DECAY_CONFIG: DecayConfig = {
  halfLifeDays:         90,
  minimumWeight:        0.2,
  maximumWeight:        2.0,
  minEntriesForWeight:  3,
  decayEnabled:         true,
};

/** Testing defaults — no decay, no minimum entry requirement. */
export const TEST_DECAY_CONFIG: DecayConfig = {
  halfLifeDays:         999,
  minimumWeight:        0.0,
  maximumWeight:        2.0,
  minEntriesForWeight:  1,
  decayEnabled:         false,
};

// ── EvolutionRecord ────────────────────────────────────────────────────────────

/**
 * What triggered an evolution snapshot for a pattern.
 * Recorded alongside the snapshot for audit and debugging.
 */
export type EvolutionTrigger =
  | "new_entry"         // A new memory entry matched this pattern
  | "decay_cycle"       // The periodic decay recalculation ran
  | "feedback_batch"    // A batch of user ratings was processed
  | "review_batch"      // A batch of commercial reviews was processed
  | "manual_reset";     // An admin manually reset this pattern's scores

/**
 * A point-in-time snapshot of a CreativePattern's ranking score.
 * Stored by the pattern evolution engine to enable trend analysis.
 *
 * Future Phase 10.6:
 *   Query EvolutionRecord[] for a patternId to build a score trend chart.
 *   Use trend direction ("improving" | "stable" | "declining") to bias selection.
 */
export interface EvolutionRecord {
  /** The pattern whose state is being recorded. */
  readonly patternId:              string;

  /** Snapshot of the ranking score at this moment. */
  readonly rankingScoreSnapshot:   {
    successRate:        number;
    averageUserRating:  number;
    useCount:           number;
    conversionLift:     number | null;
    noveltyDecay:       number;
    recencyScore:       number;
    crossIndustryScore: number;
    total:              number;
  };

  /** Total entries matching this pattern at time of snapshot. */
  readonly entryCount:             number;

  /** What triggered this snapshot. */
  readonly trigger:                EvolutionTrigger;

  /** ISO 8601 timestamp. */
  readonly recordedAt:             string;

  /**
   * Change in total score vs. the previous snapshot.
   * Positive = improving; negative = declining; zero = stable.
   * Null for the first snapshot (no previous to compare against).
   */
  readonly scoreDelta:             number | null;
}

// ── Trend analysis ────────────────────────────────────────────────────────────

/**
 * Trend direction for a pattern or weight.
 * Computed from the last 3–5 EvolutionRecords.
 * Used to bias selection toward improving patterns.
 */
export type TrendDirection = "improving" | "stable" | "declining" | "unknown";

/**
 * Compute trend direction from a series of total scores.
 * Phase 10.4D: pure function, no data needed — returns "unknown" when
 * fewer than 2 snapshots exist.
 */
export function computeTrendDirection(recentTotals: number[]): TrendDirection {
  if (recentTotals.length < 2) return "unknown";

  const first = recentTotals[0];
  const last  = recentTotals[recentTotals.length - 1];
  const delta = last - first;

  if (delta > 0.05)  return "improving";
  if (delta < -0.05) return "declining";
  return "stable";
}
