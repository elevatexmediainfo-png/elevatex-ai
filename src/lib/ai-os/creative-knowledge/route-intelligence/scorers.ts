// Phase 10.4C — Dynamic Route Intelligence: scorer architecture.
//
// A scorer is a pure function that inspects one RouteCandidate against the
// full RouteEvaluationContext and returns one score dimension (0–100).
//
// Architecture rules:
//   1. Every scorer is STATELESS. No module-level mutable state.
//   2. Every scorer returns a score AND an optional rationale string.
//   3. Every scorer degrades gracefully — returns a NEUTRAL score when its
//      required signals are absent (see NEUTRAL constants below).
//   4. No scorer calls an external API, database, or LLM. Pure computation only.
//   5. The pipeline in engine.ts calls all scorers and assembles the result.
//
// Population schedule:
//   Phase 10.4C (this phase): ScorerFn interface + all 7 stubs.
//   Phase 10.4D: Implement commercialScore + industryMatch (needs archetype registry).
//   Phase 10.4E: Implement psychologyMatch + audienceMatch (needs archetype data).
//   Phase 10.4F: Implement noveltyScore + imageDiversityScore (needs memory data).
//   Phase 10.4G: Implement confidence (needs signal completeness scoring).

import type { RouteCandidate } from "../route-engine/types";
import type {
  RouteEvaluationContext,
  RouteIntelligenceScore,
} from "./types";

// ── Scorer function contract ───────────────────────────────────────────────────

/**
 * Return shape for every scorer function.
 * `score` is always required. `rationale` is optional — populated when the
 * scorer can explain its decision; null when using a neutral default.
 */
export interface ScorerOutput {
  readonly score:     number; // 0–100 integer
  readonly rationale: string | null;
}

/**
 * The universal scorer function contract.
 *
 * Every scorer receives:
 *   candidate — the route candidate being scored (includes route + archetype IDs)
 *   context   — the full evaluation context for this request
 *
 * And returns:
 *   ScorerOutput — score 0–100 + optional rationale
 *
 * Pure function: same inputs always produce the same output.
 * Synchronous: no async, no I/O, no side effects.
 */
export type ScorerFn = (
  candidate: RouteCandidate,
  context:   RouteEvaluationContext,
) => ScorerOutput;

// ── Neutral / fallback constants ───────────────────────────────────────────────

/**
 * Neutral scores returned when required signals are absent.
 * "Neutral" means "we have no information to favour or penalise."
 * These are NOT zeros — a zero would actively penalise unknown routes.
 *
 * The neutral point is 50 for most dimensions (neither good nor bad).
 * Confidence starts at 30 (we bias toward admitting uncertainty).
 * NoveltyScore starts at 60 (we bias toward encouraging novelty).
 */
export const NEUTRAL_SCORE: Record<keyof Omit<RouteIntelligenceScore, "total">, number> = {
  commercialScore:     50,
  noveltyScore:        60,
  confidence:          30,
  psychologyMatch:     50,
  audienceMatch:       50,
  industryMatch:       50,
  imageDiversityScore: 50,
};

// ── 1. Commercial Score ────────────────────────────────────────────────────────

/**
 * Measures how well this route drives the stated commercial goal.
 *
 * Full implementation inputs (Phase 10.4D):
 *   candidate.archetypeId → archetype.commercialPurpose.primaryIntent
 *   context.campaign.goal → match against archetype.commercialPurpose.optimalObjectives
 *   context.campaign.urgency → boost "create_urgency" mechanism routes
 *   context.commercialHistory.successfulRouteIds → positive prior outcome signal
 *   context.commercialHistory.weakRouteIds → penalty signal
 *
 * Phase 10.4C: stub returns NEUTRAL_SCORE.commercialScore.
 */
export function scoreCommercial(
  _candidate: RouteCandidate,
  _context:   RouteEvaluationContext,
): ScorerOutput {
  // Phase 10.4D: implement when archetype registry is populated with CommercialPurpose
  return { score: NEUTRAL_SCORE.commercialScore, rationale: null };
}

// ── 2. Novelty Score ───────────────────────────────────────────────────────────

/**
 * Measures how different this route is from recent generations for this user.
 * High novelty = this combination has not been used recently.
 *
 * Full implementation inputs (Phase 10.4F):
 *   context.history.recentRouteIds → penalise if candidate.route.id is present
 *   context.history.recentFingerprints → compare against candidate.diversity fingerprint
 *   context.commercialHistory.weakRouteIds → further penalise historically weak routes
 *   DiversityMetadata.fingerprint → compute semantic similarity to recent fingerprints
 *
 * Phase 10.4C: stub returns NEUTRAL_SCORE.noveltyScore.
 * Full novelty scoring requires CreativeMemory to be wired to the engine (Phase 10.4F).
 */
export function scoreNovelty(
  _candidate: RouteCandidate,
  _context:   RouteEvaluationContext,
): ScorerOutput {
  // Phase 10.4F: implement when HistorySignal flows from CreativeMemory DB
  return { score: NEUTRAL_SCORE.noveltyScore, rationale: null };
}

// ── 3. Confidence ──────────────────────────────────────────────────────────────

/**
 * Measures the engine's self-assessed certainty in this candidate's quality.
 *
 * Full implementation logic (Phase 10.4G):
 *   Signal completeness:
 *     All 11 signals present → +40 points base
 *     Each absent signal → -3 points each (floor at 10)
 *   Archetype registry coverage:
 *     Archetype ID populated → +20 points
 *     Archetype confidence = "confirmed" → +10 points extra
 *     Archetype confidence = "emerging" → +5 points
 *   Graph coverage:
 *     Hero moment ID populated → +10 points
 *     Scene type ID populated → +10 points
 *     Behaviour IDs populated → +5 points
 *   Total capped at 100.
 *
 * Phase 10.4C: partial implementation — scores signal completeness only.
 */
export function scoreConfidence(
  candidate: RouteCandidate,
  context:   RouteEvaluationContext,
): ScorerOutput {
  let score = 10; // floor: we always have at least industry + campaign

  // Signal completeness bonus — each present signal adds 4 points
  if (context.business)          score += 4;
  if (context.audience)          score += 4;
  if (context.luxuryTier)        score += 4;
  if (context.psychology)        score += 4;
  if (context.experience)        score += 4;
  if (context.referenceImage)    score += 4;
  if (context.season)            score += 4;
  if (context.history)           score += 4;
  if (context.commercialHistory) score += 4;

  // Archetype graph coverage bonus (Phase 10.4D: non-empty IDs)
  if (candidate.archetypeId)  score += 20;
  if (candidate.heroMomentId) score += 10;
  if (candidate.sceneTypeId)  score += 10;

  score = Math.min(score, 100);

  const rationale = score >= 70
    ? "High signal completeness and graph coverage."
    : score >= 40
    ? "Partial signals — some dimensions scored at neutral."
    : "Low signal completeness — most scores are neutral defaults.";

  return { score, rationale };
}

// ── 4. Psychology Match ────────────────────────────────────────────────────────

/**
 * Alignment between the detected psychology signal and the archetype mechanism.
 *
 * Full implementation inputs (Phase 10.4E):
 *   context.psychology.primaryExperience
 *       → map to PsychologicalMechanism enum value
 *       → compare against archetype.psychologicalPurpose.mechanism
 *   context.psychology.intensity
 *       → "high" → boost routes with high-intensity psychological mechanisms
 *   context.experience.moodKeywords
 *       → compare against archetype.psychologicalPurpose.emotionalTrigger
 *
 * Phase 10.4C: stub returns NEUTRAL_SCORE.psychologyMatch.
 */
export function scorePsychologyMatch(
  _candidate: RouteCandidate,
  _context:   RouteEvaluationContext,
): ScorerOutput {
  // Phase 10.4E: implement when archetype registry has PsychologicalPurpose data
  return { score: NEUTRAL_SCORE.psychologyMatch, rationale: null };
}

// ── 5. Audience Match ──────────────────────────────────────────────────────────

/**
 * Fit between detected audience profile and archetype's optimal audience.
 *
 * Full implementation inputs (Phase 10.4E):
 *   context.audience.tier → MaterialTier → map to AudienceTier in graph
 *   context.audience.ageRange → compare against archetype.audienceProfile.ageGroups
 *   context.luxuryTier → align with route's assumed production tier
 *   context.business.sizeTier → "enterprise" routes shouldn't be default for "solo"
 *
 * Phase 10.4C: stub returns NEUTRAL_SCORE.audienceMatch.
 */
export function scoreAudienceMatch(
  _candidate: RouteCandidate,
  _context:   RouteEvaluationContext,
): ScorerOutput {
  // Phase 10.4E: implement when archetype registry has AudienceProfile data
  return { score: NEUTRAL_SCORE.audienceMatch, rationale: null };
}

// ── 6. Industry Match ──────────────────────────────────────────────────────────

/**
 * How native this route is to the detected industry.
 *
 * Full implementation inputs (Phase 10.4D):
 *   context.industry → IndustryGraphNode from graph registry
 *   IndustryGraphNode.archetypeAffinities → find affinity score for candidate.archetypeId
 *   candidate.route.bestFor → keyword match against context.industry
 *   context.campaign.type → match against CampaignTypeGraphNode for this industry
 *
 * Phase 10.4C: stub returns NEUTRAL_SCORE.industryMatch.
 */
export function scoreIndustryMatch(
  _candidate: RouteCandidate,
  _context:   RouteEvaluationContext,
): ScorerOutput {
  // Phase 10.4D: implement when industry graph is populated with affinities
  return { score: NEUTRAL_SCORE.industryMatch, rationale: null };
}

// ── 7. Image Diversity Score ───────────────────────────────────────────────────

/**
 * How visually different this route is from the reference image.
 *
 * Strategy options:
 *   "contrast"    — route should be maximally different (hero type, orientation, mood)
 *   "complement"  — route should work alongside the reference (same mood, different angle)
 *   "replicate"   — route should closely follow the reference style (for consistency)
 *
 * Full implementation inputs (Phase 10.4F):
 *   context.referenceImage.detectedHeroType → compare against route's typical hero type
 *   context.referenceImage.orientation → compare against route's scene character
 *   context.referenceImage.detectedComposition → compare against scene type's composition
 *   candidate.diversity.fingerprint → measure Hamming distance against referenceImage fingerprint
 *
 * Phase 10.4C: stub returns NEUTRAL_SCORE.imageDiversityScore.
 * When referenceImage signal is absent → returns NEUTRAL_SCORE (no image = no diversity concern).
 */
export function scoreImageDiversity(
  _candidate: RouteCandidate,
  context:    RouteEvaluationContext,
): ScorerOutput {
  // No reference image = no diversity requirement = neutral
  if (!context.referenceImage) {
    return { score: NEUTRAL_SCORE.imageDiversityScore, rationale: "No reference image signal." };
  }
  // Phase 10.4F: implement when referenceImage analysis carries richer visual signatures
  return { score: NEUTRAL_SCORE.imageDiversityScore, rationale: null };
}

// ── Scorer registry ────────────────────────────────────────────────────────────

/**
 * The canonical set of scorers for the Route Intelligence Engine.
 * The engine iterates this array to score each candidate.
 *
 * To add a new scorer:
 *   1. Write a ScorerFn above.
 *   2. Add a NamedScorer entry below.
 *   3. Add the corresponding dimension to RouteIntelligenceScore.
 *   4. Add the weight to RouteRankingConfig.
 *   No other files need to change.
 */
export interface NamedScorer {
  readonly dimension: keyof Omit<RouteIntelligenceScore, "total">;
  readonly fn:        ScorerFn;
}

export const ROUTE_SCORERS: readonly NamedScorer[] = [
  { dimension: "commercialScore",     fn: scoreCommercial      },
  { dimension: "noveltyScore",        fn: scoreNovelty         },
  { dimension: "confidence",          fn: scoreConfidence      },
  { dimension: "psychologyMatch",     fn: scorePsychologyMatch },
  { dimension: "audienceMatch",       fn: scoreAudienceMatch   },
  { dimension: "industryMatch",       fn: scoreIndustryMatch   },
  { dimension: "imageDiversityScore", fn: scoreImageDiversity  },
];
