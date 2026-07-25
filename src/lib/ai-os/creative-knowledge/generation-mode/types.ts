// Generation Mode System: types.
//
// Two generation modes govern how the route intelligence engine selects
// a creative route from its ranked candidate pool.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  DETERMINISTIC                                                          │
// │  Same input → same output. Always.                                      │
// │  • Similarity gate: SKIPPED.                                            │
// │  • Selection: top-ranked candidate, tiebreak by generation index.       │
// │  • Use cases: previews, admin review, A/B control arm, API idempotency  │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  EXPLORATION                                                            │
// │  Same brief → different creative execution. Every time.                 │
// │  • Pool: top-20 ranked candidates.                                      │
// │  • Filter: avoid recently used hero moments.                            │
// │            avoid recently used scene types.                             │
// │            prefer candidates with high commercial success patterns.     │
// │            skip candidates below minNoveltyScore.                       │
// │  • Intent preserved: industry + goal + audience + tier stay fixed.      │
// │  • Execution varies: hero + scene + route change on each call.          │
// │  • Use cases: regeneration, daily social content, A/B creative variants │
// └─────────────────────────────────────────────────────────────────────────┘
//
// Integration point:
//   RouteIntelligenceOptions.mode → selects the mode.
//   RouteIntelligenceOptions.modeConfig → optional per-mode config.
//   RouteIntelligenceResult.modeResult → records what the mode did.
//
// The mode system does NOT own route ranking. It only decides WHICH
// candidate from the ranked pool is selected. Ranking is always the same.

import type { PatternWeight } from "../creative-memory/pattern";
import type { ScoredRouteCandidate } from "../route-intelligence/types";

// ── GenerationMode ─────────────────────────────────────────────────────────────

export type GenerationMode = "deterministic" | "exploration";

// ── DeterministicConfig ────────────────────────────────────────────────────────

/**
 * Configuration for deterministic mode.
 *
 * The deterministic guarantee is: given identical RouteEvaluationContext,
 * the engine will always produce the same selected ScoredRouteCandidate.
 *
 * Sources of non-determinism that are neutralised:
 *   - Tiebreaks: when two candidates have equal total score, tiebreakStrategy
 *     defines the canonical winner (first generated, not random).
 *   - Similarity gate: skipped entirely — the gate introduces MemoryStore I/O
 *     which could produce different results on different calls.
 *   - Date-based scoring: any scorer that uses "now" uses a fixed reference
 *     date (provided in seedKey or falls back to the context's evaluatedAt).
 */
export interface DeterministicConfig {
  /**
   * How to break ties when two candidates have equal intelligenceScore.total.
   * "first_generated"    — lower generationIndex wins (stable across calls).
   * "alphabetical_route" — route ID sorted lexicographically (stable, predictable).
   * Default: "first_generated".
   */
  tiebreakStrategy:   "first_generated" | "alphabetical_route";

  /**
   * Whether to skip the similarity gate (MemoryStore.searchSimilar).
   * True by default in deterministic mode — the gate is I/O dependent.
   * Set to false only when you want idempotent output AND similarity data.
   */
  skipSimilarityGate: boolean;

  /**
   * Optional seed key used to fix any date-relative scoring.
   * Format: ISO 8601 string.
   * If absent: engine uses context.evaluatedAt as the fixed reference.
   * Callers that replay the same context with the same seedKey will get
   * the same output even days later.
   */
  seedKey?:           string;
}

export const DEFAULT_DETERMINISTIC_CONFIG: DeterministicConfig = {
  tiebreakStrategy:   "first_generated",
  skipSimilarityGate: true,
};

// ── ExplorationConfig ──────────────────────────────────────────────────────────

/**
 * Configuration for creative exploration mode.
 *
 * The exploration guarantee is: the selected candidate's execution signature
 * (hero + scene + route) will differ from the most recent generation for
 * this user in this industry.
 *
 * "Campaign intent" is defined as: industry + campaignGoal + audience.tier +
 * luxuryTier + campaign.type. These fields are locked in exploration —
 * the creative pipeline may vary EVERYTHING else.
 */
export interface ExplorationConfig {
  /**
   * Number of ranked candidates to walk before triggering exhaustionStrategy.
   * Default: 20. Max enforced: 50.
   * Must be ≤ RouteIntelligenceOptions.maxCandidates.
   */
  poolSize:              number;

  /**
   * Hero moment IDs to avoid. Populated from MemoryStore.getRecent() by the
   * caller before constructing the config; or from context.history.
   */
  avoidHeroIds:          string[];

  /**
   * Scene type IDs to avoid. Same population rule as avoidHeroIds.
   */
  avoidSceneIds:         string[];

  /**
   * Whether to apply PatternWeight boosts before walking the ranked list.
   * When true: candidates whose route/archetype has a high PatternWeight are
   * promoted; candidates with suppressed weights are demoted.
   * This re-sorts the ranked list BEFORE the diversity walk.
   */
  patternBoostEnabled:   boolean;

  /**
   * Pattern weights to apply when patternBoostEnabled = true.
   * Sourced from MemoryStore.getSuccessWeights() for this industry.
   * Empty = no boost applied even if patternBoostEnabled = true.
   */
  patternWeights:        PatternWeight[];

  /**
   * Minimum intelligenceScore.noveltyScore (0–100) for a candidate to pass.
   * Candidates below this score are skipped during the diversity walk.
   * Default: 30. Set to 0 to disable novelty filtering.
   */
  minNoveltyScore:       number;

  /**
   * What to do when all candidates in the pool fail the exploration filter.
   *
   * "fall_back_to_top_ranked" — return the top-ranked candidate regardless
   *   of diversity constraints. Guarantees a result. Campaign intent preserved.
   *   Logs that all candidates were similar — future memory will improve diversity.
   *
   * "relax_and_retry" — relax the filter (drop scene constraint first, then
   *   hero constraint), retry the walk. Returns the first candidate that passes
   *   the relaxed constraints.
   *
   * "error" — throw. Use only in tests where exhaustion indicates a problem.
   *
   * Default: "fall_back_to_top_ranked".
   */
  exhaustionStrategy:    "fall_back_to_top_ranked" | "relax_and_retry" | "error";

  /**
   * How aggressively to enforce diversity constraints.
   *
   * "strict"  — candidate MUST have a different hero AND different scene.
   *             Both constraints must pass. Harder to satisfy.
   *
   * "prefer"  — candidate SHOULD have a different hero AND different scene.
   *             If none found: accepts candidates with only one changed.
   *             Falls back to exhaustionStrategy if still no match.
   *
   * Default: "prefer".
   */
  diversityStrategy:     "strict" | "prefer";
}

export const DEFAULT_EXPLORATION_CONFIG: ExplorationConfig = {
  poolSize:              20,
  avoidHeroIds:          [],
  avoidSceneIds:         [],
  patternBoostEnabled:   true,
  patternWeights:        [],
  minNoveltyScore:       30,
  exhaustionStrategy:    "fall_back_to_top_ranked",
  diversityStrategy:     "prefer",
};

// ── GenerationModeConfig ───────────────────────────────────────────────────────

/**
 * Mode-specific configuration, discriminated by mode.
 * The engine reads this to configure selection for the active mode.
 */
export type GenerationModeConfig =
  | { readonly mode: "deterministic"; readonly config: DeterministicConfig }
  | { readonly mode: "exploration";   readonly config: ExplorationConfig   };

// ── IntentSignature ────────────────────────────────────────────────────────────

/**
 * A stable hash of the intent-defining signals.
 *
 * Intent is PRESERVED across exploration generations for the same brief.
 * The same brief always produces the same intentHash, regardless of which
 * creative execution was selected.
 *
 * Intent-defining fields (locked):
 *   industry, campaignGoal, audience.tier, luxuryTier, campaign.type
 *
 * Why preserve intent:
 *   The client asked for "a dental implant awareness campaign targeting
 *   mid-market adults." That brief is the intent. The hero subject, scene
 *   environment, and creative route can all vary — the intent cannot.
 *   Preserving the intent signature ensures the regeneration engine knows
 *   it is varying the execution of THE SAME brief, not running a new brief.
 */
export interface IntentSignature {
  /**
   * Pipe-delimited hash of intent fields.
   * Format: "{industry}|{campaignGoal}|{audienceTier}|{luxuryTier}|{campaignType}"
   * Absent optional fields use "any" as placeholder.
   */
  readonly hash:         string;

  /** The 5 fields that compose this signature. */
  readonly industry:     string;
  readonly campaignGoal: string;
  readonly audienceTier: string;  // "any" when not specified
  readonly luxuryTier:   string;  // "any" when not specified
  readonly campaignType: string;  // "any" when not specified
}

// ── ExecutionSignature ─────────────────────────────────────────────────────────

/**
 * A stable hash of the execution-defining fields.
 *
 * Execution VARIES across exploration generations.
 * The engine checks that the new execution differs from the most recent one
 * for this user in this industry.
 *
 * Execution-defining fields (varied):
 *   heroMomentId, sceneTypeId, routeId, archetypeId
 *
 * Empty IDs (Phase 10.4D — graph not populated) use "none" as a placeholder.
 */
export interface ExecutionSignature {
  /**
   * Pipe-delimited hash of execution fields.
   * Format: "{heroMomentId}|{sceneTypeId}|{routeId}|{archetypeId}"
   */
  readonly hash:          string;

  readonly heroMomentId:  string;
  readonly sceneTypeId:   string;
  readonly routeId:       string;
  readonly archetypeId:   string;
}

// ── RejectionReason ────────────────────────────────────────────────────────────

/**
 * Why a candidate was skipped during the exploration walk.
 * Recorded in ModeExecutionResult for diagnostics and future learning.
 */
export type RejectionReason =
  | "hero_recently_used"   // candidate.heroMomentId is in avoidHeroIds
  | "scene_recently_used"  // candidate.sceneTypeId is in avoidSceneIds
  | "novelty_too_low"      // intelligenceScore.noveltyScore < minNoveltyScore
  | "similarity_gate";     // MemoryStore.searchSimilar returned "reject"

/** One candidate rejection record. */
export interface CandidateRejection {
  readonly candidateIndex: number;
  readonly routeId:        string;
  readonly heroMomentId:   string;
  readonly sceneTypeId:    string;
  readonly reason:         RejectionReason;
}

// ── ModeExecutionResult ────────────────────────────────────────────────────────

/**
 * Appended to RouteIntelligenceResult — documents what the mode system did.
 * Both modes populate the common fields; mode-specific fields are optional.
 */
export interface ModeExecutionResult {
  /** Which mode was active for this evaluation. */
  readonly mode:               GenerationMode;

  /** Stable hash of the brief (preserved across explorations). */
  readonly intentSignature:    IntentSignature;

  /** Hash of the selected execution (varies in exploration). */
  readonly executionSignature: ExecutionSignature;

  /** Exploration-mode diagnostics. Absent in deterministic mode. */
  readonly exploration?: {
    /** How many candidates from the pool were evaluated before selection. */
    readonly candidatesEvaluated:  number;
    /** How many candidates were rejected by the diversity filter. */
    readonly candidatesRejected:   number;
    /** Per-candidate rejection reasons. */
    readonly rejections:           CandidateRejection[];
    /**
     * Whether the fallback strategy was used (no candidate passed the filter).
     * True = returned top-ranked regardless of diversity constraints.
     */
    readonly fallbackUsed:         boolean;
    /**
     * Whether constraint relaxation was applied.
     * True = "relax_and_retry" strategy fired at least once.
     */
    readonly relaxationApplied:    boolean;
  };

  /** Deterministic-mode diagnostics. Absent in exploration mode. */
  readonly deterministic?: {
    /** Whether a tiebreak was applied (two or more candidates had equal total). */
    readonly tiebreakApplied: boolean;
    /** The seedKey used, if any. */
    readonly seedKey?:        string;
  };
}

// ── Active exploration filter ──────────────────────────────────────────────────

/**
 * The compiled filter used during the exploration candidate walk.
 * Built from ExplorationConfig + recent history before the walk begins.
 *
 * Uses Set<string> for O(1) membership checks during the walk.
 */
export interface ExplorationFilter {
  readonly avoidHeroIds:            Set<string>;
  readonly avoidSceneIds:           Set<string>;
  readonly avoidFingerprintHashes:  Set<string>;
  readonly minNoveltyScore:         number;
  readonly patternWeights:          PatternWeight[];
  readonly diversityStrategy:       "strict" | "prefer";
  readonly exhaustionStrategy:      ExplorationConfig["exhaustionStrategy"];
}

// ── Exploration candidate result ──────────────────────────────────────────────

/**
 * The output of the exploration candidate selection pass.
 */
export interface ExplorationSelectionResult {
  readonly selected:           ScoredRouteCandidate;
  readonly rejections:         CandidateRejection[];
  readonly fallbackUsed:       boolean;
  readonly relaxationApplied:  boolean;
}
