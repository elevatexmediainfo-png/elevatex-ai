// Phase 10.4.0 — Route Engine interface contract.
// Wraps and supersedes creative-knowledge/route-engine/engine.ts (Phase 10.4).
// Replaces static getRoutesForIndustry() with fully scored route selection.
//
// Migration plan (Phase 10.4.0F):
//   creative-route-engine/route-registry.ts entries  →  RouteKnowledgeNode per industry
//   evaluateRoutes() stub scorers                     →  implemented as store queries
//   getRoutesForIndustry()                            →  store.query({ kind: "route", industry })
//
// After migration: creative-route-engine/ delegates to run() here.
// Phase 10.4D: diversityEngine feeds diversity scores into route selection.
// Phase 10.4E: seasonal scorer activated (scoreSeasonalBoost).

import type { KnowledgeStore } from "../../creative-knowledge/store";
import type { PipelineContext, KnowledgeTrace } from "../types";
import type { DiversityMetadata } from "../../creative-knowledge/diversity-metadata/types";

export interface RouteEngineInput extends PipelineContext {
  /** Archetype ID from Archetype Selector — used to filter compatible routes. */
  archetypeId:         string;
  /** Hero moment ID from Hero Generator — used for route-hero alignment scoring. */
  heroMomentId:        string;
  /** Primary experience type string. */
  primaryExperience:   string;
  /** Resolved campaign type. */
  campaignType?:       string;
  /** Recent generation fingerprints for diversity scoring. */
  recentFingerprints:  string[];
}

/** Breakdown of how a route was scored — one number per dimension. */
export interface RouteScore {
  /** 0–1: campaign goal × route bestFor keyword match. */
  relevance:     number;
  /** 0–1: 1.0 if fingerprint absent from recentFingerprints; lower if similar. */
  diversity:     number;
  /** 0–1: route.industryIds includes the requested industry. */
  industryFit:   number;
  /** 0–1: luxury/mass material tier aligns with route emotional register. */
  tierMatch:     number;
  /** 0–1: seasonal relevance (stub in Phase 10.4.0; activated Phase 10.4E). */
  seasonalBoost: number;
  /** Weighted composite — the number engines rank by. */
  total:         number;
}

export interface RouteCandidate {
  /** Matches RouteKnowledgeNode.id (and legacyRouteId for Phase 8 bridge). */
  routeId:     string;
  score:       RouteScore;
  diversity?:  DiversityMetadata;
  trace:       KnowledgeTrace;
}

export interface RouteEngineOutput {
  selected:     RouteCandidate;
  /** Next-best candidates for diversity fallback or multi-concept generation. */
  alternatives: RouteCandidate[];
  trace:        KnowledgeTrace;
}

export type RouteEngineRunner = (
  input: RouteEngineInput,
  store: KnowledgeStore,
) => RouteEngineOutput;
