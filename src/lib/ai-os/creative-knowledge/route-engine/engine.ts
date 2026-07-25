// Phase 10.4 — Dynamic Route Engine.
// Wraps Phase 8.6 creative-route-engine with multi-signal evaluation.
//
// Current state: evaluates routes with zero scores — scoring not yet implemented.
// Each scoring dimension is a clearly named stub for future phases to complete:
//   Phase 10.4B: relevance + industryFit (archetype-registry populated)
//   Phase 10.4C: tierMatch (luxury/mass tier signals)
//   Phase 10.4D: diversity (history signal from CreativeMemory)
//   Phase 10.4E: seasonalBoost (cultural calendar signal)
//
// The Phase 8.6 getRoutesForIndustry() remains the route data source.
// This engine adds signal-weighted ranking on top of it.

import { getRoutesForIndustry } from "../../creative-route-engine/route-registry";
import type { ExtendedRouteSignals, RouteCandidate, RouteScore } from "./types";

// ── Default score ──────────────────────────────────────────────────────────

const ZERO_SCORE: RouteScore = {
  relevance:     0,
  diversity:     1,   // default: assume novel until history proves otherwise
  industryFit:   0,
  tierMatch:     0.5, // neutral until tier signal is available
  seasonalBoost: 0,
  total:         0,
};

// ── Scoring stubs (Phase 10.4B–E will implement these) ────────────────────

function scoreRelevance(_signals: ExtendedRouteSignals, _routeId: string): number {
  return 0; // Phase 10.4B: compare archetypeId.compatibleGoals against signals.campaignGoal
}

function scoreDiversity(_signals: ExtendedRouteSignals, _routeId: string): number {
  return 1; // Phase 10.4D: check signals.history.recentRouteIds
}

function scoreIndustryFit(_signals: ExtendedRouteSignals, _routeId: string): number {
  return 0; // Phase 10.4B: use archetype affinity from IndustryNode
}

function scoreTierMatch(_signals: ExtendedRouteSignals, _routeId: string): number {
  return 0.5; // Phase 10.4C: compare signals.luxuryTier against route.bestFor keywords
}

function scoreSeasonalBoost(_signals: ExtendedRouteSignals, _routeId: string): number {
  return 0; // Phase 10.4E: compare signals.season against route.bestFor occasion keywords
}

function computeTotal(score: Omit<RouteScore, "total">): number {
  // Weights are placeholders — Phase 10.4B defines the final weighting model.
  return (
    score.relevance     * 0.35 +
    score.diversity     * 0.25 +
    score.industryFit   * 0.20 +
    score.tierMatch     * 0.15 +
    score.seasonalBoost * 0.05
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluate all available routes for the given signals.
 * Returns scored candidates sorted by total score descending.
 *
 * Falls back to Phase 8.6 getRoutesForIndustry() as the data source.
 */
export function evaluateRoutes(signals: ExtendedRouteSignals): RouteCandidate[] {
  const routes = getRoutesForIndustry(signals.industry as string);
  if (routes.length === 0) return [];

  return routes
    .map(route => {
      const partial = {
        relevance:     scoreRelevance(signals, route.id),
        diversity:     scoreDiversity(signals, route.id),
        industryFit:   scoreIndustryFit(signals, route.id),
        tierMatch:     scoreTierMatch(signals, route.id),
        seasonalBoost: scoreSeasonalBoost(signals, route.id),
      };
      const score: RouteScore = { ...partial, total: computeTotal(partial) };
      return {
        route,
        archetypeId:  "",
        heroMomentId: "",
        sceneTypeId:  "",
        signals,
        score,
      } satisfies RouteCandidate;
    })
    .sort((a, b) => b.score.total - a.score.total);
}

/**
 * Select the single best route from a scored candidate list.
 * Returns undefined if candidates is empty.
 */
export function selectBestRoute(candidates: RouteCandidate[]): RouteCandidate | undefined {
  if (candidates.length === 0) return undefined;
  return candidates[0]; // already sorted descending by evaluateRoutes()
}

/** Get the top N candidates. */
export function getTopCandidates(candidates: RouteCandidate[], n = 3): RouteCandidate[] {
  return candidates.slice(0, n);
}

/**
 * Convenience: evaluate and return the best route in one call.
 * Returns undefined if no routes exist for the industry.
 */
export function getBestRoute(signals: ExtendedRouteSignals): RouteCandidate | undefined {
  return selectBestRoute(evaluateRoutes(signals));
}

export { ZERO_SCORE };
