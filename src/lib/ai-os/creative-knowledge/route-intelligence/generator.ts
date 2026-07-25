// Phase 10.4C — Dynamic Route Intelligence: candidate generator.
//
// The generator's job: produce a pool of 20–50 CandidateSpecs from the
// available knowledge sources, before scoring begins.
//
// Candidate spec = one unique combination of:
//   routeId       (Phase 8.6 creative-route-engine)
//   archetypeId   (Phase 10.4A universal archetype registry)
//   heroMomentId  (Phase 10.4B industry knowledge graph)
//   sceneTypeId   (Phase 10.4B industry knowledge graph)
//
// Generation strategy (depth-first cross-product, capped at maxCandidates):
//   1. Get all Phase 8.6 routes for the industry.
//   2. Get all campaign types for the industry from the graph.
//   3. For each campaign type: get hero moments.
//   4. For each hero moment: get scene types.
//   5. Cross (route × heroMoment × sceneType) — yielding many unique specs.
//   6. Deduplicate by dedupeKey.
//   7. Cap at maxCandidates.
//
// When sources are empty (Phase 10.4C, graph not yet populated):
//   Falls back to Phase 8.6 routes only, with empty archetypeId / heroMomentId /
//   sceneTypeId — exactly the Phase 10.4 route-engine behaviour, just wrapped
//   in the new type. Scores degrade to neutral; engine still returns a result.
//
// Population schedule:
//   Phase 10.4C: route-only fallback (graph empty).
//   Phase 10.4D: archetypeId populated (archetype registry filled).
//   Phase 10.4E: heroMomentId + sceneTypeId (industry graph populated for restaurant).
//   Phase 10.4F+: remaining industries filled progressively.

import { getRoutesForIndustry } from "../../creative-route-engine/route-registry";
import {
  getCampaignTypesForIndustry,
  getHeroMomentsForCampaignType,
  getSceneTypesForHeroMoment,
} from "../graph/registry";
import type { RouteEvaluationContext, CandidateSpec } from "./types";

// ── Internal helpers ───────────────────────────────────────────────────────────

function makeDedupeKey(routeId: string, heroMomentId: string, sceneTypeId: string): string {
  return `${routeId}|${heroMomentId}|${sceneTypeId}`;
}

function makeSpec(
  routeId:     string,
  archetypeId: string,
  heroMomentId: string,
  sceneTypeId:  string,
): CandidateSpec {
  return {
    routeId,
    archetypeId,
    heroMomentId,
    sceneTypeId,
    dedupeKey: makeDedupeKey(routeId, heroMomentId, sceneTypeId),
  };
}

// ── Primary generation strategy ────────────────────────────────────────────────

/**
 * Generate candidate specs from the graph hierarchy + Phase 8.6 routes.
 *
 * Returns specs before full node resolution — cheap to generate and deduplicate.
 * The engine resolves these to full RouteCandidates in a second pass.
 *
 * @param context       Full evaluation context.
 * @param maxCandidates Hard cap on output size (default: 50).
 */
export function generateCandidateSpecs(
  context:       RouteEvaluationContext,
  maxCandidates: number = 50,
): CandidateSpec[] {
  const seen  = new Set<string>();
  const specs: CandidateSpec[] = [];

  // ── Strategy 1: Graph-based candidates ────────────────────────────────────
  //
  // Campaign types from Phase 10.4B graph → hero moments → scene types.
  // These are the highest-quality candidates when the graph is populated.

  const campaignTypes = getCampaignTypesForIndustry(context.industry);

  for (const ct of campaignTypes) {
    if (specs.length >= maxCandidates) break;

    const heroMoments = getHeroMomentsForCampaignType(ct.id);

    for (const hm of heroMoments) {
      if (specs.length >= maxCandidates) break;

      const sceneTypes = getSceneTypesForHeroMoment(hm.id);

      if (sceneTypes.length === 0) {
        // Hero moment with no scene types — create a spec with empty sceneTypeId
        const spec = makeSpec("", ct.archetypeIds[0] ?? "", hm.id, "");
        if (!seen.has(spec.dedupeKey)) {
          seen.add(spec.dedupeKey);
          specs.push(spec);
        }
        continue;
      }

      for (const st of sceneTypes) {
        if (specs.length >= maxCandidates) break;
        const spec = makeSpec("", ct.archetypeIds[0] ?? "", hm.id, st.id);
        if (!seen.has(spec.dedupeKey)) {
          seen.add(spec.dedupeKey);
          specs.push(spec);
        }
      }
    }
  }

  // ── Strategy 2: Phase 8.6 route fallback ──────────────────────────────────
  //
  // When graph is empty (Phase 10.4C), these are the only candidates.
  // When graph has partial data, these fill the pool to minCandidates.

  const routes = getRoutesForIndustry(context.industry as string);

  for (const route of routes) {
    if (specs.length >= maxCandidates) break;

    // Cross routes with existing graph specs to add route context
    // to graph-derived candidates.
    if (specs.length > 0 && campaignTypes.length > 0) {
      // Graph already has candidates — bind routes to graph specs where possible.
      // This fills the spec's routeId which was left empty in Strategy 1.
      for (const spec of specs) {
        if (spec.routeId === "" && specs.length < maxCandidates) {
          // Mutate is not ideal — reconstruct instead.
          const filledSpec = makeSpec(route.id, spec.archetypeId, spec.heroMomentId, spec.sceneTypeId);
          if (!seen.has(filledSpec.dedupeKey)) {
            seen.add(filledSpec.dedupeKey);
            specs.push(filledSpec);
          }
        }
      }
    } else {
      // Graph is empty — create a route-only spec.
      const spec = makeSpec(route.id, "", "", "");
      if (!seen.has(spec.dedupeKey)) {
        seen.add(spec.dedupeKey);
        specs.push(spec);
      }
    }
  }

  return specs.slice(0, maxCandidates);
}

// ── Spec → RouteCandidate resolution ──────────────────────────────────────────

import type { RouteCandidate } from "../route-engine/types";
import { ZERO_SCORE } from "../route-engine/engine";

/**
 * Resolve a CandidateSpec to a full RouteCandidate.
 *
 * Phase 10.4C: uses Phase 8.6 route registry for the route object.
 * Missing hero/scene/archetype IDs are left as empty strings — the scorers
 * degrade gracefully to neutral scores for these dimensions.
 *
 * Phase 10.4E: this function will resolve heroMomentId → HeroMomentGraphNode
 * and sceneTypeId → SceneTypeGraphNode from the graph registry, then populate
 * the RouteCandidate.diversity.heroId and .sceneId fields.
 *
 * @returns RouteCandidate or null if the routeId cannot be resolved.
 */
export function resolveCandidate(
  spec:    CandidateSpec,
  context: RouteEvaluationContext,
): RouteCandidate | null {
  const routes = getRoutesForIndustry(context.industry as string);
  const route  = spec.routeId
    ? routes.find(r => r.id === spec.routeId)
    : routes[0]; // fallback to first route when routeId is empty (graph-only spec)

  if (!route) return null;

  return {
    route,
    archetypeId:  spec.archetypeId,
    heroMomentId: spec.heroMomentId,
    sceneTypeId:  spec.sceneTypeId,
    signals: {
      industry:     context.industry,
      campaignGoal: context.campaign.goal,
      rawIdea:      context.rawIdea,
      campaignType: context.campaign.type,
      audience:     context.audience,
      psychology:   context.psychology,
      luxuryTier:   context.luxuryTier,
      referenceImage: context.referenceImage,
      season:       context.season,
      history:      context.history,
    },
    score: { ...ZERO_SCORE },
  } satisfies RouteCandidate;
}

// ── Pool builder ───────────────────────────────────────────────────────────────

/**
 * Build the full candidate pool for one evaluation run.
 *
 * 1. Generate specs (cheap, deduplicated).
 * 2. Resolve each spec to a RouteCandidate (may return null — skip those).
 * 3. Return resolved candidates with their generation index.
 *
 * Called by engine.ts before the scoring pass begins.
 */
export function buildCandidatePool(
  context:       RouteEvaluationContext,
  minCandidates: number = 20,
  maxCandidates: number = 50,
): RouteCandidate[] {
  const specs      = generateCandidateSpecs(context, maxCandidates);
  const candidates: RouteCandidate[] = [];

  for (const spec of specs) {
    const candidate = resolveCandidate(spec, context);
    if (candidate !== null) {
      candidates.push(candidate);
    }
    if (candidates.length >= maxCandidates) break;
  }

  // If we generated fewer than minCandidates, that is acceptable —
  // the engine will flag resultQuality as "low" in its result metadata.
  // We never pad with garbage candidates to hit the minimum.

  return candidates;
}
