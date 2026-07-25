// Generation Mode System: exploration candidate selection.
//
// This module owns the diversity walk — the pass that runs AFTER ranking
// in exploration mode. It walks the ranked candidate pool from best to
// worst, applying the exploration filter constraints, and returns the
// first candidate that passes.
//
// Walk logic:
//
//   For each candidate in ranked pool (best first):
//     1. Is heroMomentId in avoidHeroIds?          → reject("hero_recently_used")
//     2. Is sceneTypeId  in avoidSceneIds?          → reject("scene_recently_used")
//     3. Is noveltyScore < minNoveltyScore?         → reject("novelty_too_low")
//     4. Is fingerprint hash in avoidHashes?        → reject("similarity_gate")
//     5. All checks pass                            → SELECT this candidate
//
//   If pool exhausted with no selection:
//     exhaustionStrategy = "fall_back_to_top_ranked" → return ranked[0] (fallback)
//     exhaustionStrategy = "relax_and_retry"         → relax scene constraint first,
//                                                       then hero, retry walk
//     exhaustionStrategy = "error"                   → throw
//
// Pattern boost pass (runs BEFORE the diversity walk):
//   If patternBoostEnabled = true and patternWeights is non-empty:
//     Re-score each candidate's intelligenceScore.total by the weight of its
//     route/archetype. Candidates with a PatternWeight > 1 rise; those < 1 fall.
//     Re-sort ranked list. Then run the diversity walk on the re-sorted list.
//
// This file is pure — no I/O, no async. All inputs come in, result comes out.

import type { ScoredRouteCandidate }      from "../route-intelligence/types";
import type { PatternWeight }             from "../creative-memory/pattern";
import type {
  ExplorationFilter,
  ExplorationConfig,
  CandidateRejection,
  RejectionReason,
  ExplorationSelectionResult,
} from "./types";

// ── ExplorationFilter builder ──────────────────────────────────────────────────

/**
 * Compile an ExplorationFilter from an ExplorationConfig and an optional
 * set of fingerprint hashes from recent memory entries.
 *
 * Called once per evaluation run, before the diversity walk.
 * Converts arrays to Sets for O(1) lookups during the walk.
 */
export function buildExplorationFilter(
  config:             ExplorationConfig,
  recentHashes:       string[] = [],
): ExplorationFilter {
  return {
    avoidHeroIds:           new Set(config.avoidHeroIds.filter(Boolean)),
    avoidSceneIds:          new Set(config.avoidSceneIds.filter(Boolean)),
    avoidFingerprintHashes: new Set(recentHashes.filter(Boolean)),
    minNoveltyScore:        config.minNoveltyScore,
    patternWeights:         config.patternWeights,
    diversityStrategy:      config.diversityStrategy,
    exhaustionStrategy:     config.exhaustionStrategy,
  };
}

// ── Pattern boost pass ─────────────────────────────────────────────────────────

/**
 * Find the PatternWeight for a candidate's routeId, if one exists.
 * Checks routeId first; archetypeId second.
 * Returns 1.0 (neutral) when no matching weight is found.
 */
function findPatternBoost(
  candidate: ScoredRouteCandidate,
  weights:   PatternWeight[],
): number {
  for (const pw of weights) {
    if (pw.elementId === candidate.route.id)     return pw.weight;
    if (pw.elementId === candidate.archetypeId)  return pw.weight;
  }
  return 1.0;
}

/**
 * Apply pattern weights to re-sort a ranked list.
 *
 * New effective score = intelligenceScore.total * patternBoost
 * The sort is stable for candidates with no pattern weight (neutral 1.0).
 * Candidates suppressed below weight 0.5 sink to the bottom.
 *
 * The intelligenceScore.total on each candidate is NOT mutated —
 * sorting is based on a computed effective score only.
 */
export function applyPatternBoosts(
  ranked:  ScoredRouteCandidate[],
  weights: PatternWeight[],
): ScoredRouteCandidate[] {
  if (weights.length === 0) return ranked; // fast path — no weights

  return [...ranked].sort((a, b) => {
    const scoreA = a.intelligenceScore.total * findPatternBoost(a, weights);
    const scoreB = b.intelligenceScore.total * findPatternBoost(b, weights);
    return scoreB - scoreA;
  });
}

// ── Candidate filter predicate ─────────────────────────────────────────────────

/**
 * Test one candidate against the exploration filter.
 * Returns the rejection reason if the candidate fails, or null if it passes.
 *
 * Checks are applied in order of cheapest-first:
 *   1. Hero ID lookup (O(1) Set)
 *   2. Scene ID lookup (O(1) Set)
 *   3. Novelty score comparison (O(1) number compare)
 *   4. Fingerprint hash lookup (O(1) Set)
 */
export function findRejectionReason(
  candidate: ScoredRouteCandidate,
  filter:    ExplorationFilter,
): RejectionReason | null {
  if (
    candidate.heroMomentId !== "" &&
    filter.avoidHeroIds.has(candidate.heroMomentId)
  ) {
    return "hero_recently_used";
  }

  if (
    candidate.sceneTypeId !== "" &&
    filter.avoidSceneIds.has(candidate.sceneTypeId)
  ) {
    return "scene_recently_used";
  }

  if (candidate.intelligenceScore.noveltyScore < filter.minNoveltyScore) {
    return "novelty_too_low";
  }

  // Fingerprint hash check — compares the candidate's route.id + heroMomentId
  // composite against known recent hashes.
  // Phase 10.4D: route.id is the primary discriminator (heroMomentId empty).
  const candidateHash = `${candidate.heroMomentId || "none"}|${candidate.sceneTypeId || "none"}|${candidate.route.id}`;
  if (filter.avoidFingerprintHashes.has(candidateHash)) {
    return "similarity_gate";
  }

  return null; // passes all constraints
}

// ── Constraint relaxation ──────────────────────────────────────────────────────

/**
 * Relax the exploration filter one step.
 *
 * Relaxation order (least to most permissive):
 *   Step 1: Remove scene constraint (keep hero constraint)
 *   Step 2: Remove hero constraint (keep novelty only)
 *   Step 3: Remove novelty constraint (hash only)
 *   Step 4: No constraints (fully relaxed — same as deterministic)
 *
 * Returns the relaxed filter. Does NOT mutate the original.
 */
export function relaxFilter(filter: ExplorationFilter): ExplorationFilter {
  if (filter.avoidSceneIds.size > 0) {
    // Step 1: drop scene constraint
    return { ...filter, avoidSceneIds: new Set() };
  }
  if (filter.avoidHeroIds.size > 0) {
    // Step 2: drop hero constraint
    return { ...filter, avoidHeroIds: new Set() };
  }
  if (filter.minNoveltyScore > 0) {
    // Step 3: drop novelty constraint
    return { ...filter, minNoveltyScore: 0 };
  }
  // Step 4: fully relaxed — no constraints remain
  return { ...filter, avoidFingerprintHashes: new Set() };
}

/**
 * True when a filter has no remaining constraints that can be relaxed.
 */
export function filterIsFullyRelaxed(filter: ExplorationFilter): boolean {
  return (
    filter.avoidHeroIds.size           === 0 &&
    filter.avoidSceneIds.size          === 0 &&
    filter.minNoveltyScore             === 0 &&
    filter.avoidFingerprintHashes.size === 0
  );
}

// ── Core diversity walk ────────────────────────────────────────────────────────

/**
 * Walk a ranked candidate list and return the first candidate that passes
 * the exploration filter. Records rejection reasons for diagnostics.
 *
 * @returns { candidate, rejections } — candidate is null when no match found.
 */
function walkCandidates(
  ranked: ScoredRouteCandidate[],
  filter: ExplorationFilter,
  limit:  number,
): { candidate: ScoredRouteCandidate | null; rejections: CandidateRejection[] } {
  const rejections: CandidateRejection[] = [];
  const cap = Math.min(limit, ranked.length);

  for (let i = 0; i < cap; i++) {
    const candidate = ranked[i];
    const reason    = findRejectionReason(candidate, filter);

    if (reason === null) {
      return { candidate, rejections };
    }

    rejections.push({
      candidateIndex: i,
      routeId:        candidate.route.id,
      heroMomentId:   candidate.heroMomentId,
      sceneTypeId:    candidate.sceneTypeId,
      reason,
    });
  }

  return { candidate: null, rejections };
}

// ── Primary selection function ─────────────────────────────────────────────────

/**
 * Select one candidate from the ranked pool using the exploration filter.
 *
 * Runs the diversity walk. Handles pool exhaustion per exhaustionStrategy.
 * Returns a complete ExplorationSelectionResult with diagnostics.
 *
 * @param ranked  Ranked pool from the route intelligence ranker.
 * @param filter  Compiled exploration filter from buildExplorationFilter().
 * @throws        Only when exhaustionStrategy = "error" and pool is exhausted.
 */
export function selectExplorationCandidate(
  ranked: ScoredRouteCandidate[],
  filter: ExplorationFilter,
): ExplorationSelectionResult {
  if (ranked.length === 0) {
    throw new Error("[ExplorationEngine] Ranked candidate pool is empty.");
  }

  // Step 1: Apply pattern boosts (re-sorts ranked list)
  const boosted = filter.patternWeights.length > 0
    ? applyPatternBoosts(ranked, filter.patternWeights)
    : ranked;

  // Step 2: First walk — with full constraints
  const { candidate, rejections } = walkCandidates(boosted, filter, filter.avoidHeroIds.size > 0 || filter.avoidSceneIds.size > 0 ? boosted.length : boosted.length);

  if (candidate !== null) {
    return {
      selected:          candidate,
      rejections,
      fallbackUsed:      false,
      relaxationApplied: false,
    };
  }

  // Step 3: Pool exhausted — apply exhaustionStrategy
  switch (filter.exhaustionStrategy) {

    case "fall_back_to_top_ranked":
      // Return the top-ranked candidate regardless of diversity.
      // Campaign intent is preserved; execution may repeat.
      return {
        selected:          boosted[0],
        rejections,
        fallbackUsed:      true,
        relaxationApplied: false,
      };

    case "relax_and_retry": {
      // Walk through relaxation steps until a candidate passes or fully relaxed.
      let relaxed = relaxFilter(filter);
      let allRejections = [...rejections];
      let relaxationApplied = false;

      while (!filterIsFullyRelaxed(relaxed)) {
        const { candidate: relaxedCandidate, rejections: relaxedRejections } =
          walkCandidates(boosted, relaxed, boosted.length);

        allRejections = [...allRejections, ...relaxedRejections];
        relaxationApplied = true;

        if (relaxedCandidate !== null) {
          return {
            selected:          relaxedCandidate,
            rejections:        allRejections,
            fallbackUsed:      false,
            relaxationApplied: true,
          };
        }
        relaxed = relaxFilter(relaxed);
      }

      // Fully relaxed and still no candidate — fall back to top
      return {
        selected:          boosted[0],
        rejections:        allRejections,
        fallbackUsed:      true,
        relaxationApplied,
      };
    }

    case "error":
      throw new Error(
        `[ExplorationEngine] All ${ranked.length} candidates rejected by exploration filter. ` +
        `Rejections: ${JSON.stringify(rejections.map(r => r.reason))}`
      );
  }
}

// ── Deterministic selection ────────────────────────────────────────────────────

/**
 * Select the best candidate in deterministic mode.
 *
 * Returns ranked[0] after applying the tiebreak strategy.
 * Tiebreaking is only relevant when two candidates have exactly equal total.
 *
 * Note: the ranked list is already sorted by total descending (from ranker.ts).
 * This function only applies the secondary tiebreak key when totals are equal.
 */
export function selectDeterministicCandidate(
  ranked:           ScoredRouteCandidate[],
  tiebreakStrategy: "first_generated" | "alphabetical_route",
): { selected: ScoredRouteCandidate; tiebreakApplied: boolean } {
  if (ranked.length === 0) {
    throw new Error("[DeterministicEngine] Ranked candidate pool is empty.");
  }

  const topTotal = ranked[0].intelligenceScore.total;
  const tied     = ranked.filter(c => c.intelligenceScore.total === topTotal);

  if (tied.length === 1) {
    return { selected: tied[0], tiebreakApplied: false };
  }

  // Tiebreak needed
  let winner: ScoredRouteCandidate;
  if (tiebreakStrategy === "first_generated") {
    winner = tied.reduce((a, b) =>
      a.generationIndex <= b.generationIndex ? a : b
    );
  } else {
    winner = tied.reduce((a, b) =>
      a.route.id <= b.route.id ? a : b
    );
  }

  return { selected: winner, tiebreakApplied: true };
}
