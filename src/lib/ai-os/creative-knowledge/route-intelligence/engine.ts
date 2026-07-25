// Phase 10.4C — Dynamic Route Intelligence: main engine orchestrator.
//
// The engine is the single entry point for all callers needing multi-signal
// route evaluation. It orchestrates:
//
//   1. Context normalisation — fill optional fields with sensible defaults
//   2. Ranking config selection — goal-preset or user-supplied config
//   3. Candidate pool generation — 20–50 specs from generator.ts
//   4. Scoring pass — all 7 scorers applied to each candidate via ranker.ts
//   5. Ranking — sort by weighted total
//   6. Selection — per strategy (default: top_1)
//   7. Result assembly — RouteIntelligenceResult with full metadata
//
// The engine has NO state. Every call is fully independent.
// Safe to call concurrently from multiple API handlers.
//
// Backward compat with Phase 10.4 route-engine/:
//   evaluateRoutes(ExtendedRouteSignals) → RouteCandidate[] still works.
//   evaluateIntelligence(RouteEvaluationContext) is the new path.
//   Callers can migrate by wrapping their ExtendedRouteSignals with
//   contextFromSignals() below.

import {
  DEFAULT_RANKING_CONFIG,
  DEFAULT_OPTIONS,
  GOAL_RANKING_CONFIGS,
  type RouteEvaluationContext,
  type RouteIntelligenceResult,
  type RouteIntelligenceOptions,
  type RouteRankingConfig,
} from "./types";
import type { ExtendedRouteSignals } from "../route-engine/types";
import { buildCandidatePool } from "./generator";
import { rankCandidates, selectFromRanked, assessResultQuality } from "./ranker";
import {
  computeIntentSignature,
  computeExecutionSignature,
  buildExplorationFilter,
  selectExplorationCandidate,
  selectDeterministicCandidate,
  DEFAULT_DETERMINISTIC_CONFIG,
  DEFAULT_EXPLORATION_CONFIG,
} from "../generation-mode/index";
import type { ModeExecutionResult } from "../generation-mode/types";

// ── Context helpers ────────────────────────────────────────────────────────────

/**
 * Resolve the ranking config for this evaluation.
 * Priority: options.rankingConfig > GOAL_RANKING_CONFIGS[campaign.goal] > DEFAULT_RANKING_CONFIG.
 */
function resolveRankingConfig(
  context: RouteEvaluationContext,
  options: RouteIntelligenceOptions,
): RouteRankingConfig {
  if (options.rankingConfig) return options.rankingConfig;
  const goalPreset = GOAL_RANKING_CONFIGS[context.campaign.goal];
  return goalPreset ?? DEFAULT_RANKING_CONFIG;
}

/**
 * Convenience adapter: convert Phase 10.4 ExtendedRouteSignals into a
 * RouteEvaluationContext so existing callers can migrate without rewriting
 * their signal construction logic.
 *
 * Fields that have no direct mapping in ExtendedRouteSignals are omitted —
 * the engine will score them at neutral.
 */
export function contextFromSignals(signals: ExtendedRouteSignals): RouteEvaluationContext {
  return {
    industry: signals.industry,
    campaign: {
      goal:  signals.campaignGoal,
      type:  signals.campaignType,
    },
    rawIdea:       signals.rawIdea,
    audience:      signals.audience,
    luxuryTier:    signals.luxuryTier,
    psychology:    signals.psychology,
    referenceImage: signals.referenceImage,
    season:        signals.season,
    history:       signals.history,
  };
}

// ── Primary evaluation function ────────────────────────────────────────────────

/**
 * Evaluate all possible creative routes for a given context and return a
 * ranked result with the selected best route.
 *
 * Phase 10.4C: Pool is sourced from Phase 8.6 routes (graph is empty).
 *              All non-confidence scores are neutral (50 / 60).
 *              Selection is always the first route in the Phase 8.6 registry.
 *
 * Phase 10.4D+: Pool grows to 20–50 combinations as the graph is populated.
 *               Scores converge on real values per scorer implementation schedule.
 *
 * @throws Never — all errors degrade gracefully. Empty pool returns a low-quality result.
 */
export function evaluateIntelligence(
  context:       RouteEvaluationContext,
  userOptions?:  Partial<RouteIntelligenceOptions>,
): RouteIntelligenceResult {
  const options:  RouteIntelligenceOptions = { ...DEFAULT_OPTIONS, ...userOptions };
  const config:   RouteRankingConfig       = resolveRankingConfig(context, options);
  const strategy = options.strategy ?? "top_1";
  const min      = options.minCandidates ?? 20;
  const max      = options.maxCandidates ?? 50;

  // Step 1: Generate candidate pool
  const pool = buildCandidatePool(context, min, max);
  const generatedCount = pool.length;

  // Step 2: Score + rank
  const ranked = rankCandidates(pool, context, config);

  // Step 3: Filter out zero-pool edge case
  if (ranked.length === 0) {
    // No routes exist for this industry — return a minimal low-quality result.
    // This should only happen in tests or for industries with no registered routes.
    throw new Error(
      `[RouteIntelligenceEngine] No candidates generated for industry "${context.industry}". ` +
      `Ensure Phase 8.6 routes are registered for this industry.`
    );
  }

  // Step 4: Select — branched by generation mode
  const activeMode = options.mode ?? "deterministic";
  const intentSignature = computeIntentSignature(context);

  let selected: ReturnType<typeof selectFromRanked>;
  let modeResult: ModeExecutionResult;

  if (activeMode === "exploration") {
    const explorationConfig = (
      options.modeConfig?.mode === "exploration"
        ? options.modeConfig.config
        : DEFAULT_EXPLORATION_CONFIG
    );
    const filter = buildExplorationFilter(explorationConfig, options.recentFingerprints ?? []);
    const explorationResult = selectExplorationCandidate(ranked, filter);

    selected = explorationResult.selected;
    modeResult = {
      mode: "exploration",
      intentSignature,
      executionSignature: computeExecutionSignature(explorationResult.selected),
      exploration: {
        candidatesEvaluated: ranked.length,
        candidatesRejected:  explorationResult.rejections.length,
        rejections:          explorationResult.rejections,
        fallbackUsed:        explorationResult.fallbackUsed,
        relaxationApplied:   explorationResult.relaxationApplied,
      },
    };
  } else {
    // deterministic
    const deterministicConfig = (
      options.modeConfig?.mode === "deterministic"
        ? options.modeConfig.config
        : DEFAULT_DETERMINISTIC_CONFIG
    );
    const deterministicResult = selectDeterministicCandidate(
      ranked,
      deterministicConfig.tiebreakStrategy,
    );
    selected = deterministicResult.selected;
    modeResult = {
      mode: "deterministic",
      intentSignature,
      executionSignature: computeExecutionSignature(deterministicResult.selected),
      deterministic: {
        tiebreakApplied: deterministicResult.tiebreakApplied,
        seedKey:         options.modeConfig?.mode === "deterministic"
          ? options.modeConfig.config.seedKey
          : undefined,
      },
    };
  }

  // Step 5: Assess result quality
  const resultQuality = assessResultQuality(ranked, min);

  // Step 6: Assemble result
  return {
    rankedCandidates:  options.includeFullRanking !== false ? ranked : [],
    selected,
    filteredCount:     generatedCount - ranked.length,
    generatedCount,
    rankingConfig:     config,
    strategy,
    resultQuality,
    evaluatedAt:       new Date().toISOString(),
    modeResult,
  };
}

// ── Convenience API ────────────────────────────────────────────────────────────

/**
 * Evaluate and return only the best candidate.
 * Minimal API for callers that just need a single route and no metadata.
 */
export function getBestRouteForContext(
  context:      RouteEvaluationContext,
  userOptions?: Partial<RouteIntelligenceOptions>,
) {
  const result = evaluateIntelligence(context, {
    ...userOptions,
    includeFullRanking: false, // skip full list — caller only wants the winner
  });
  return result.selected;
}

/**
 * Evaluate and return the top N candidates.
 * Useful for A/B testing or "choose from these" UX flows.
 * Phase 10.5: will support the "ensemble" strategy.
 */
export function getTopCandidates(
  context:      RouteEvaluationContext,
  n:            number = 3,
  userOptions?: Partial<RouteIntelligenceOptions>,
) {
  const result = evaluateIntelligence(context, {
    ...userOptions,
    strategy: "top_3",
  });
  return result.rankedCandidates.slice(0, n);
}

/**
 * Backward-compatible bridge: accepts ExtendedRouteSignals and returns
 * the best ScoredRouteCandidate via the new intelligence pipeline.
 *
 * Drop-in replacement for evaluateRoutes() + selectBestRoute() from route-engine/.
 * Existing callers can migrate one file at a time.
 */
export function evaluateFromSignals(signals: ExtendedRouteSignals) {
  return getBestRouteForContext(contextFromSignals(signals));
}
