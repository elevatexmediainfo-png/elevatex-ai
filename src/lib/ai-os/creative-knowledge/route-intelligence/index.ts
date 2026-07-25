// Phase 10.4C — Dynamic Route Intelligence: public API.
//
// Single import point for all route-intelligence types and functions.
//
// Primary entry points for engine callers:
//   evaluateIntelligence(context, options?) — full evaluation + ranked result
//   getBestRouteForContext(context)         — just the best candidate
//   getTopCandidates(context, n)            — top-N candidates
//   evaluateFromSignals(signals)            — Phase 10.4 backward-compat bridge
//
// Type imports:
//   RouteEvaluationContext  — the 11-signal input bundle
//   RouteIntelligenceResult — the full ranked output
//   ScoredRouteCandidate    — one candidate with 7-dimension score
//   RouteIntelligenceScore  — the scoring struct
//   RouteRankingConfig      — dimension weights

// ── Types ──────────────────────────────────────────────────────────────────────
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
} from "./types";

export {
  DEFAULT_RANKING_CONFIG,
  GOAL_RANKING_CONFIGS,
  DEFAULT_OPTIONS,
} from "./types";

// ── Scorer architecture ────────────────────────────────────────────────────────
export type { ScorerOutput, ScorerFn, NamedScorer } from "./scorers";

export {
  NEUTRAL_SCORE,
  ROUTE_SCORERS,
  scoreCommercial,
  scoreNovelty,
  scoreConfidence,
  scorePsychologyMatch,
  scoreAudienceMatch,
  scoreIndustryMatch,
  scoreImageDiversity,
} from "./scorers";

// ── Generator ──────────────────────────────────────────────────────────────────
export {
  generateCandidateSpecs,
  resolveCandidate,
  buildCandidatePool,
} from "./generator";

// ── Ranker ─────────────────────────────────────────────────────────────────────
export {
  scoreCandidate,
  applyWeights,
  rankCandidates,
  assessResultQuality,
  selectFromRanked,
} from "./ranker";

// ── Engine ─────────────────────────────────────────────────────────────────────
export {
  contextFromSignals,
  evaluateIntelligence,
  getBestRouteForContext,
  getTopCandidates,
  evaluateFromSignals,
} from "./engine";

// ── Phase 10.4C — Production wiring helpers ────────────────────────────────────
// buildRouteContext: Phase 4–5 outputs → RouteEvaluationContext
// applyRouteToScene: selected route → enriched VisualScenePlan (before Phase 11)
export { buildRouteContext } from "./context-builder";
export { applyRouteToScene } from "./route-scene-adapter";
