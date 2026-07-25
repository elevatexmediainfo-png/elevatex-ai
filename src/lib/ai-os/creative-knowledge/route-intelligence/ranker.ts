// Phase 10.4C — Dynamic Route Intelligence: ranker.
//
// The ranker receives a pool of RouteCandidate[] (already scored by scorers.ts)
// and produces a sorted ScoredRouteCandidate[] with a weighted total score.
//
// Ranking responsibilities:
//   1. Apply RouteRankingConfig weights to produce intelligenceScore.total.
//   2. Sort candidates descending by total.
//   3. Compute resultQuality from pool size + top candidate confidence.
//   4. Select the final candidate(s) per the RouteSelectionStrategy.
//
// The ranker does NOT score individual dimensions — that is scorers.ts.
// It only combines existing scores using the weight config.

import type { RouteCandidate } from "../route-engine/types";
import type {
  RouteIntelligenceScore,
  ScoredRouteCandidate,
  RouteRankingConfig,
  RouteSelectionStrategy,
} from "./types";
import { NEUTRAL_SCORE } from "./scorers";
import { ROUTE_SCORERS } from "./scorers";
import type { RouteEvaluationContext } from "./types";
import type { ConfidenceLevel } from "../types";

// ── Score assembly ─────────────────────────────────────────────────────────────

/**
 * Run all ROUTE_SCORERS against a single candidate and assemble
 * the RouteIntelligenceScore (before weighting).
 */
export function scoreCandidate(
  candidate: RouteCandidate,
  context:   RouteEvaluationContext,
): Pick<ScoredRouteCandidate, "intelligenceScore" | "scoreRationale"> {
  const scores: Partial<RouteIntelligenceScore> = {};
  const rationale: ScoredRouteCandidate["scoreRationale"] = {};

  for (const { dimension, fn } of ROUTE_SCORERS) {
    const output = fn(candidate, context);
    scores[dimension] = output.score;
    if (output.rationale) {
      (rationale as Record<string, string>)[dimensionToKey(dimension)] = output.rationale;
    }
  }

  // total is computed separately by applyWeights()
  const intelligenceScore: RouteIntelligenceScore = {
    commercialScore:     scores.commercialScore     ?? NEUTRAL_SCORE.commercialScore,
    noveltyScore:        scores.noveltyScore        ?? NEUTRAL_SCORE.noveltyScore,
    confidence:          scores.confidence          ?? NEUTRAL_SCORE.confidence,
    psychologyMatch:     scores.psychologyMatch     ?? NEUTRAL_SCORE.psychologyMatch,
    audienceMatch:       scores.audienceMatch       ?? NEUTRAL_SCORE.audienceMatch,
    industryMatch:       scores.industryMatch       ?? NEUTRAL_SCORE.industryMatch,
    imageDiversityScore: scores.imageDiversityScore ?? NEUTRAL_SCORE.imageDiversityScore,
    total: 0, // filled below by applyWeights
  };

  return { intelligenceScore, scoreRationale: rationale };
}

/** Map dimension key to score rationale key. */
function dimensionToKey(dim: keyof Omit<RouteIntelligenceScore, "total">): string {
  const map: Record<string, string> = {
    commercialScore:     "commercial",
    noveltyScore:        "novelty",
    confidence:          "confidence",
    psychologyMatch:     "psychology",
    audienceMatch:       "audience",
    industryMatch:       "industry",
    imageDiversityScore: "imageDiversity",
  };
  return map[dim] ?? dim;
}

// ── Weight application ─────────────────────────────────────────────────────────

/**
 * Apply ranking config weights to the dimension scores and compute total.
 * Validates that weights sum to 1.0 (±0.001 tolerance).
 * Returns the total score as 0–100.
 */
export function applyWeights(
  score:  RouteIntelligenceScore,
  config: RouteRankingConfig,
): number {
  const weightSum = Object.values(config).reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1.0) > 0.001) {
    // Non-fatal — normalise instead of throwing.
    // This prevents a misconfigured weight set from crashing the engine.
    const scale = 1 / weightSum;
    return Math.round(
      score.commercialScore     * (config.commercialScore     * scale) * 100 / 100 +
      score.noveltyScore        * (config.noveltyScore        * scale) * 100 / 100 +
      score.confidence          * (config.confidence          * scale) * 100 / 100 +
      score.psychologyMatch     * (config.psychologyMatch     * scale) * 100 / 100 +
      score.audienceMatch       * (config.audienceMatch       * scale) * 100 / 100 +
      score.industryMatch       * (config.industryMatch       * scale) * 100 / 100 +
      score.imageDiversityScore * (config.imageDiversityScore * scale) * 100 / 100
    );
  }

  return Math.round(
    score.commercialScore     * config.commercialScore     +
    score.noveltyScore        * config.noveltyScore        +
    score.confidence          * config.confidence          +
    score.psychologyMatch     * config.psychologyMatch     +
    score.audienceMatch       * config.audienceMatch       +
    score.industryMatch       * config.industryMatch       +
    score.imageDiversityScore * config.imageDiversityScore
  );
}

// ── Pool ranking ───────────────────────────────────────────────────────────────

/**
 * Score and rank the full candidate pool.
 *
 * 1. Run all scorers against each candidate.
 * 2. Apply weights to produce intelligenceScore.total.
 * 3. Sort descending by total.
 *
 * @param candidates Raw pool from generator.ts (unscored RouteCandidate[]).
 * @param context    Full evaluation context.
 * @param config     Ranking weights.
 * @returns          ScoredRouteCandidate[] sorted best-first.
 */
export function rankCandidates(
  candidates: RouteCandidate[],
  context:    RouteEvaluationContext,
  config:     RouteRankingConfig,
): ScoredRouteCandidate[] {
  return candidates
    .map((candidate, index) => {
      const { intelligenceScore, scoreRationale } = scoreCandidate(candidate, context);
      const total = applyWeights(intelligenceScore, config);
      return {
        ...candidate,
        intelligenceScore: { ...intelligenceScore, total },
        scoreRationale,
        generationIndex: index,
      } satisfies ScoredRouteCandidate;
    })
    .sort((a, b) => b.intelligenceScore.total - a.intelligenceScore.total);
}

// ── Result quality assessment ─────────────────────────────────────────────────

/**
 * Assess the quality of the ranked result.
 * Used to set RouteIntelligenceResult.resultQuality.
 *
 * "high"   — pool >= 20 candidates AND top candidate.confidence >= 70
 * "medium" — pool 10–19 OR top candidate.confidence 40–69
 * "low"    — pool < 10 OR top candidate.confidence < 40
 */
export function assessResultQuality(
  ranked:    ScoredRouteCandidate[],
  minTarget: number = 20,
): ConfidenceLevel {
  if (ranked.length === 0) return "low";

  const topConfidence = ranked[0].intelligenceScore.confidence;
  const poolSize      = ranked.length;

  if (poolSize >= minTarget && topConfidence >= 70) return "high";
  if (poolSize >= 10        && topConfidence >= 40) return "medium";
  return "low";
}

// ── Selection ──────────────────────────────────────────────────────────────────

/**
 * Select from a ranked pool based on the strategy.
 *
 * "top_1":    returns ranked[0] — the single best candidate.
 * "top_3":    returns ranked[0] — the engine still returns one ScoredRouteCandidate,
 *             but the caller can access the full rankedCandidates list for top-3 use.
 * "ensemble": Phase 10.5 — returns ranked[0] as a placeholder.
 *
 * The RouteIntelligenceResult.rankedCandidates contains the full list regardless.
 */
export function selectFromRanked(
  ranked:   ScoredRouteCandidate[],
  strategy: RouteSelectionStrategy,
): ScoredRouteCandidate {
  if (ranked.length === 0) {
    throw new Error("[RouteIntelligenceEngine] No candidates available for selection.");
  }

  // All strategies currently return ranked[0].
  // "ensemble" will synthesise across top-N in Phase 10.5.
  switch (strategy) {
    case "top_1":
    case "top_3":
    case "ensemble":
      return ranked[0];
  }
}
