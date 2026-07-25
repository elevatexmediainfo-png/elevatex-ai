// Phase 10.4C — Dynamic Route Intelligence: types.
//
// This module is the SECOND generation of the route evaluation system,
// superseding route-engine/ for new callers. It is NOT a replacement —
// route-engine/ remains the backward-compatible interface for Phase 8.6 callers.
//
// Key architectural upgrades vs. route-engine/:
//   • 11-signal input (vs. 8 in ExtendedRouteSignals)
//   • 7-dimension scoring (vs. 5 in RouteScore)
//   • Generates 20–50 candidates per request (vs. all routes flat)
//   • Pluggable scorer functions (vs. hardcoded stubs)
//   • RouteIntelligenceResult carries full ranked list + selection rationale
//   • Architecture supports future ensemble selection (top-N routes)
//
// Graph hierarchy dependency:
//   RouteEvaluationContext
//       ↓ (fed into)
//   RouteIntelligenceEngine
//       ↓ via generator.ts
//   RouteCandidate[] (20–50 combinations of route × archetype × hero × scene)
//       ↓ via scorers.ts
//   ScoredRouteCandidate[] (each scored on 7 dimensions)
//       ↓ via ranker.ts
//   RouteIntelligenceResult (ranked + selected)

import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { MaterialTier } from "../../prompt-spec/material-engine";
import type {
  ExtendedRouteSignals,
  AudienceSignal,
  PsychologySignal,
  ReferenceImageSignal,
  SeasonSignal,
  HistorySignal,
} from "../route-engine/types";
import type { RouteCandidate } from "../route-engine/types";
import type { CampaignGoal, ConfidenceLevel } from "../types";

// ── 1. Extended Input Context ──────────────────────────────────────────────────

/**
 * Business-level signal — what kind of business is running this campaign.
 * Shapes commercial scoring, industry matching, and audience defaults.
 */
export interface BusinessSignal {
  /** Business trading name as entered by the user. */
  name?:       string;
  /**
   * Business category — more granular than SceneIndustry.
   * Examples: "fine_dining", "cloud_kitchen", "fast_casual" for restaurant.
   */
  category?:   string;
  /** City or region — used for cultural occasion boosting. */
  location?:   string;
  /**
   * Business size tier — shapes audience assumptions.
   * "solo" | "small" | "mid" | "enterprise"
   */
  sizeTier?:   "solo" | "small" | "mid" | "enterprise";
  /**
   * Brand voice keywords as set by the brand kit or user profile.
   * Examples: ["warm", "expert", "aspirational", "playful"]
   */
  brandVoice?: string[];
}

/**
 * Experience profile signal derived from the creative experience engine.
 * Carries the emotional texture the campaign should deliver.
 */
export interface ExperienceSignal {
  /**
   * Primary experience type from experience-engine.ts.
   * Examples: "transformation", "warmth", "authority", "celebration"
   */
  primaryType?:    string;
  /** Secondary experience type when the campaign has a dual emotional register. */
  secondaryType?:  string;
  /** Intensity of the emotional signal. */
  intensity?:      "high" | "medium" | "low";
  /**
   * Specific mood keywords detected from rawIdea or brand context.
   * Used to bias hero moment and scene type selection.
   */
  moodKeywords?:   string[];
}

/**
 * Commercial history signal — outcome data from previous campaigns
 * for the same business. Biases scoring toward routes that have converted.
 */
export interface CommercialHistorySignal {
  /**
   * Route IDs that produced positive business outcomes.
   * Archived from previous CreativeMemoryEntry.review.isOnBrief = true.
   */
  successfulRouteIds?: string[];
  /**
   * Route IDs that produced weak or no outcomes.
   * These receive a penalty in commercialScore.
   */
  weakRouteIds?:       string[];
  /**
   * Archetypes that performed well for this business.
   * Archived from Phase 10.4E memory integration.
   */
  successfulArchetypeIds?: string[];
  /**
   * Average conversion lift recorded for this business across all routes.
   * Null until Phase 10.5 populates from real campaign data.
   */
  averageConversionLift?: number | null;
}

/**
 * Campaign-level signal — the specific brief for this generation.
 * Captures intent ABOVE the raw idea string.
 */
export interface CampaignSignal {
  /** The business objective this campaign must serve. */
  goal:             CampaignGoal;
  /**
   * Named campaign type — more specific than CampaignGoal.
   * Examples: "grand_opening", "date_night", "festive_menu", "invisalign_launch"
   */
  type?:            string;
  /**
   * Urgency level — shapes commercial scoring weight.
   * "high" (time-limited offer) boosts routes that trigger urgency.
   */
  urgency?:         "high" | "medium" | "low";
  /** Key messages the campaign must communicate. Plain language list. */
  keyMessages?:     string[];
  /** Budget or production tier signal — shapes luxury/material scoring. */
  productionTier?:  MaterialTier;
}

/**
 * Full evaluation context for the Route Intelligence Engine.
 * Superset of ExtendedRouteSignals (Phase 10.4) with 3 additional signals.
 *
 * Backward-compatible: all fields are optional except industry and campaign.
 * The engine degrades gracefully when signals are missing.
 */
export interface RouteEvaluationContext {
  // ── Required ─────────────────────────────────────────────────────────────
  /** Industry — drives candidate generation and industry scoring. */
  industry:          SceneIndustry;
  /** Campaign brief — goal, type, urgency, key messages. */
  campaign:          CampaignSignal;
  /** Raw idea text as entered by the user. */
  rawIdea:           string;

  // ── Phase 10.4 signals (all optional) ────────────────────────────────────
  /** Business context — shapes commercial and audience scoring. */
  business?:         BusinessSignal;
  /** Audience targeting — shapes audienceMatch scoring. */
  audience?:         AudienceSignal;
  /** Luxury tier — shapes luxury-segment route preference. */
  luxuryTier?:       MaterialTier;
  /**
   * Psychological campaign intent — shapes psychologyMatch scoring.
   * Derived from PsychologySignal in route-engine/types.ts.
   */
  psychology?:       PsychologySignal;
  /** Emotional experience profile — shapes hero moment and scene type bias. */
  experience?:       ExperienceSignal;
  /** Reference image signals — shapes imageDiversityScore and composition bias. */
  referenceImage?:   ReferenceImageSignal;
  /** Seasonal calendar signal — shapes seasonal boost scoring. */
  season?:           SeasonSignal;
  /** Generation history — shapes noveltyScore. */
  history?:          HistorySignal;
  /** Commercial outcome history — shapes commercialScore. */
  commercialHistory?: CommercialHistorySignal;
}

// ── 2. Score Model ─────────────────────────────────────────────────────────────

/**
 * Seven-dimension intelligence score for one route candidate.
 * All sub-scores are 0–100 (integer, not 0.0–1.0).
 * Total is a weighted composite defined by RouteRankingConfig.
 *
 * Extends the five-dimension RouteScore from Phase 10.4 route-engine/types.ts.
 * Backward compat: RouteScore is still used by RouteCandidate — this score
 * is attached ALONGSIDE it as intelligenceScore on ScoredRouteCandidate.
 */
export interface RouteIntelligenceScore {
  /**
   * How well this route drives the stated commercial goal.
   * Considers: archetype.commercialPurpose.primaryIntent, campaign.goal,
   *            commercialHistory.successfulRouteIds, campaign.urgency.
   * Phase 10.4D: implemented when archetype registry is populated.
   */
  commercialScore:     number; // 0–100

  /**
   * How different this route is from recent generations.
   * 100 = never seen before; 0 = identical to last generation.
   * Considers: history.recentRouteIds, fingerprint similarity,
   *            commercialHistory.weakRouteIds.
   * Phase 10.4D: implemented when history signal is piped from CreativeMemory.
   */
  noveltyScore:        number; // 0–100

  /**
   * Engine's self-assessed certainty in this candidate's quality.
   * Based on: signal completeness (how many of 11 signals are present),
   *           archetype.confidence, graph coverage for this industry.
   * High = all 11 signals present + archetype fully rated for this industry.
   * Phase 10.4C: implemented in confidence.ts scorer.
   */
  confidence:          number; // 0–100

  /**
   * Alignment between detected psychology signal and archetype mechanism.
   * Considers: signals.psychology.primaryExperience vs.
   *            archetype.psychologicalPurpose.mechanism.
   * Phase 10.4D: implemented when archetype registry is populated.
   */
  psychologyMatch:     number; // 0–100

  /**
   * Fit between detected audience and archetype's optimal audience.
   * Considers: audience.tier vs. archetype's audience profile,
   *            audience.ageRange vs. archetype's buyer stage.
   * Phase 10.4D: implemented when archetype registry is populated.
   */
  audienceMatch:       number; // 0–100

  /**
   * How native this route is to the detected industry.
   * Considers: IndustryGraphNode.archetypeAffinities,
   *            route.bestFor industry keywords.
   * Phase 10.4D: implemented when industry graph is populated.
   */
  industryMatch:       number; // 0–100

  /**
   * How visually different this route is from the reference image.
   * 100 = maximally different composition/mood (creative contrast strategy).
   * 50  = complementary (common default when no specific strategy is set).
   * 0   = would produce the same visual as the reference.
   * Considers: referenceImage.detectedHeroType vs. this route's hero type,
   *            referenceImage.orientation vs. route's scene character,
   *            diversity fingerprint overlap.
   * Phase 10.4D: implemented when reference image signals are richer.
   */
  imageDiversityScore: number; // 0–100

  /**
   * Weighted composite of all 7 dimensions.
   * Computed by ranker.ts using RouteRankingConfig weights.
   * This is the sort key for the ranked candidate list.
   */
  total:               number; // 0–100
}

// ── 3. Scored Candidate ────────────────────────────────────────────────────────

/**
 * A route candidate with its full Phase 10.4C intelligence score.
 * Extends RouteCandidate (Phase 10.4) without breaking backward compat.
 *
 * The original RouteScore (5 dimensions) is retained on the base candidate
 * for any callers that still read it. The new score is attached alongside.
 */
export interface ScoredRouteCandidate extends RouteCandidate {
  /** Phase 10.4C 7-dimension intelligence score. */
  intelligenceScore:  RouteIntelligenceScore;
  /**
   * Textual rationale for why this candidate scored as it did.
   * Used for debug logging and future UI "why this route?" transparency.
   * One sentence per dimension — empty in architecture phase.
   */
  scoreRationale:     ScoreRationale;
  /**
   * The generation index of this candidate (0 = first generated).
   * Used to detect whether more candidates should be generated.
   */
  generationIndex:    number;
}

/**
 * Per-dimension explanation of the score.
 * All strings null in Phase 10.4C architecture — populated by scorer stubs.
 */
export interface ScoreRationale {
  commercial?:     string;
  novelty?:        string;
  confidence?:     string;
  psychology?:     string;
  audience?:       string;
  industry?:       string;
  imageDiversity?: string;
}

// ── 4. Ranking Config ──────────────────────────────────────────────────────────

/**
 * Dimension weights for computing RouteIntelligenceScore.total.
 * Weights must sum to 1.0 (validated at runtime by ranker.ts).
 *
 * Default weights reflect commercial-first priorities.
 * Override per-campaign via RouteEvaluationContext.campaign.goal:
 *   "brand_awareness"    → increase psychologyMatch, reduce commercialScore
 *   "engagement"         → increase noveltyScore, imageDiversityScore
 *   "lead_generation"    → increase commercialScore, audienceMatch
 *   "retention"          → increase noveltyScore, reduce industryMatch
 */
export interface RouteRankingConfig {
  commercialScore:     number; // Default 0.30
  industryMatch:       number; // Default 0.20
  psychologyMatch:     number; // Default 0.15
  audienceMatch:       number; // Default 0.15
  noveltyScore:        number; // Default 0.10
  imageDiversityScore: number; // Default 0.05
  confidence:          number; // Default 0.05
}

/** Default commercial-first ranking weights. */
export const DEFAULT_RANKING_CONFIG: RouteRankingConfig = {
  commercialScore:     0.30,
  industryMatch:       0.20,
  psychologyMatch:     0.15,
  audienceMatch:       0.15,
  noveltyScore:        0.10,
  imageDiversityScore: 0.05,
  confidence:          0.05,
};

/**
 * Goal-adjusted weight presets.
 * Engine selects the appropriate preset from campaign.goal when no
 * custom config is provided.
 */
export const GOAL_RANKING_CONFIGS: Partial<Record<CampaignGoal, RouteRankingConfig>> = {
  // "awareness" maps to brand awareness campaigns — psychology and audience weigh more.
  awareness: {
    commercialScore:     0.20,
    industryMatch:       0.15,
    psychologyMatch:     0.25,
    audienceMatch:       0.20,
    noveltyScore:        0.10,
    imageDiversityScore: 0.05,
    confidence:          0.05,
  },
  // "engagement" favours novelty and image diversity — content must feel fresh.
  engagement: {
    commercialScore:     0.20,
    industryMatch:       0.15,
    psychologyMatch:     0.15,
    audienceMatch:       0.10,
    noveltyScore:        0.20,
    imageDiversityScore: 0.15,
    confidence:          0.05,
  },
  // "conversion" is the closest to lead-generation — commercial score is dominant.
  conversion: {
    commercialScore:     0.35,
    industryMatch:       0.20,
    psychologyMatch:     0.10,
    audienceMatch:       0.20,
    noveltyScore:        0.05,
    imageDiversityScore: 0.05,
    confidence:          0.05,
  },
  // "loyalty" favours novelty (keep it fresh for existing customers) and psychology.
  loyalty: {
    commercialScore:     0.15,
    industryMatch:       0.15,
    psychologyMatch:     0.20,
    audienceMatch:       0.20,
    noveltyScore:        0.20,
    imageDiversityScore: 0.05,
    confidence:          0.05,
  },
};

// ── 5. Selection Strategy ──────────────────────────────────────────────────────

/**
 * How the engine selects from its ranked candidate list.
 * Architecture supports future ensemble strategies.
 */
export type RouteSelectionStrategy =
  | "top_1"        // Phase 10.4C default: single best candidate
  | "top_3"        // Return top-3; let the caller choose or ensemble
  | "ensemble";    // Future Phase 10.5: synthesise a route from top-N

// Imported here to avoid circular deps — generation-mode imports from here.
// Forward-declared as opaque types; generation-mode/types.ts owns the definitions.
import type { GenerationMode, GenerationModeConfig, ModeExecutionResult } from "../generation-mode/types";
export type { GenerationMode, GenerationModeConfig, ModeExecutionResult };

/**
 * Engine options for one evaluation run.
 */
export interface RouteIntelligenceOptions {
  /**
   * Minimum number of candidates to generate before ranking.
   * Engine will attempt to fill this pool from the graph.
   * Default: 20. Maximum: 50.
   */
  minCandidates?:     number;
  /**
   * Maximum candidates to generate.
   * Default: 50. Hard cap enforced by generator.
   */
  maxCandidates?:     number;
  /** Custom ranking weights. Defaults to goal-preset or DEFAULT_RANKING_CONFIG. */
  rankingConfig?:     RouteRankingConfig;
  /** Selection strategy. Default: "top_1". */
  strategy?:          RouteSelectionStrategy;
  /**
   * Whether to include the full ranked list in the result.
   * False = return only the selection (smaller response payload).
   * Default: true.
   */
  includeFullRanking?: boolean;

  /**
   * Generation mode governing candidate selection.
   *
   * "deterministic" — same input → same output.
   *   Similarity gate is skipped. Tiebreaking is stable.
   *   Use for previews, admin review, A/B control arms.
   *
   * "exploration" — same brief → different creative execution.
   *   Diversity walk avoids recently used heroes/scenes.
   *   Use for regeneration, daily content, A/B creative variants.
   *
   * Default: "deterministic" (preserves backward-compatible behavior).
   */
  mode?:              GenerationMode;

  /**
   * Mode-specific configuration.
   * Must match the active mode. Ignored if mode is undefined.
   * Defaults are applied per mode when omitted.
   */
  modeConfig?:        GenerationModeConfig;

  /**
   * Recent fingerprint hashes from creative memory, in exploration-avoidance format:
   *   "{heroMomentId||"none"}|{sceneTypeId||"none"}|{routeId}"
   *
   * Passed to buildExplorationFilter() so the diversity walk avoids
   * routes the user has seen recently. Empty array = no history (Phase 10.4D default).
   *
   * Populated by enhance-prompt/route.ts from MemoryStore.getRecentFingerprints().
   */
  recentFingerprints?: string[];
}

/** Default engine options. */
export const DEFAULT_OPTIONS: RouteIntelligenceOptions = {
  minCandidates:      20,
  maxCandidates:      50,
  strategy:           "top_1",
  includeFullRanking: true,
  mode:               "deterministic",
};

// ── 6. Result ──────────────────────────────────────────────────────────────────

/**
 * The full result of one Route Intelligence evaluation run.
 *
 * The selected candidate continues to the prompt assembly pipeline.
 * The full ranked list is available for diagnostics, A/B testing, and
 * future ensemble strategies.
 */
export interface RouteIntelligenceResult {
  /**
   * All candidates generated and scored in this run.
   * Sorted descending by intelligenceScore.total.
   * Only present when includeFullRanking = true.
   */
  rankedCandidates:   ScoredRouteCandidate[];

  /**
   * The selected candidate per the strategy.
   * For "top_1": rankedCandidates[0].
   * For "top_3": rankedCandidates slice [0..2].
   * For "ensemble": a synthesised candidate (Phase 10.5).
   */
  selected:           ScoredRouteCandidate;

  /**
   * Candidates that were generated but filtered before ranking.
   * Reasons: duplicate fingerprint, missing required fields, below minScore.
   * Useful for diagnosing why the pool was smaller than expected.
   */
  filteredCount:      number;

  /** Total candidates generated (before filtering). */
  generatedCount:     number;

  /** Ranking config used for this evaluation. */
  rankingConfig:      RouteRankingConfig;

  /** Selection strategy used. */
  strategy:           RouteSelectionStrategy;

  /**
   * Engine's assessment of the result quality.
   * "high"   = pool >= 20 candidates + selected.confidence >= 70
   * "medium" = pool 10–19 OR confidence 40–69
   * "low"    = pool < 10 OR confidence < 40
   */
  resultQuality:      ConfidenceLevel;

  /**
   * ISO 8601 timestamp of evaluation start.
   * Used to measure route-intelligence evaluation latency.
   */
  evaluatedAt:        string;

  /**
   * Generation mode execution record.
   * Documents which mode was active, what the intent/execution signatures are,
   * and (for exploration) which candidates were rejected and why.
   * Present on all results — even deterministic mode records its signatures.
   */
  modeResult?:        ModeExecutionResult;
}

// ── 7. Candidate Generation Spec ───────────────────────────────────────────────

/**
 * One candidate generation spec — the combination of IDs that the
 * generator will attempt to resolve into a ScoredRouteCandidate.
 *
 * The generator produces these specs before resolving full node objects.
 * This makes it easy to de-duplicate and cap the pool before expensive resolution.
 */
export interface CandidateSpec {
  /** Phase 8.6 route ID from creative-route-engine. */
  routeId:         string;
  /** Archetype ID from archetype-registry (empty until Phase 10.4D). */
  archetypeId:     string;
  /** Hero moment ID from industry knowledge graph (empty until Phase 10.4D). */
  heroMomentId:    string;
  /** Scene type ID from industry knowledge graph (empty until Phase 10.4D). */
  sceneTypeId:     string;
  /** Pre-computed deduplication key: `"{routeId}|{heroMomentId}|{sceneTypeId}"`. */
  dedupeKey:       string;
}
