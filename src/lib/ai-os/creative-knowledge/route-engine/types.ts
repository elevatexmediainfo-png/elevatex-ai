// Phase 10.4 — Dynamic Route Engine types.
// Extends the Phase 8.6 CRDE (creative-route-engine) with richer signals
// and multi-dimensional scoring.
//
// Backward-compatible: all added fields beyond the Phase 8.6 CRDEInput
// core are optional, so existing callers do not need to change.

import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { MaterialTier } from "../../prompt-spec/material-engine";
import type { CreativeRoute } from "../../creative-route-engine/types";
import type { DiversityMetadata } from "../diversity-metadata/types";
import type { ArchetypeId, HeroMomentId, SceneTypeId, CampaignGoal } from "../types";

// ── Extended input signals ─────────────────────────────────────────────────

/** Demographic and tier signals about the target audience. */
export interface AudienceSignal {
  description?: string;
  tier?:        MaterialTier;
  ageRange?:    [number, number];
}

/**
 * Psychological campaign signals derived from ExperienceProfile
 * (creative-brain/experience-engine.ts).
 */
export interface PsychologySignal {
  primaryExperience?:   string;
  secondaryExperience?: string;
  intensity?:           "high" | "medium" | "low";
}

/**
 * Signals derived from reference image analysis
 * (asset-understanding/analyzers/reference-image.ts).
 */
export interface ReferenceImageSignal {
  detectedHeroType?:    string;
  detectedComposition?: string;
  orientation?:         "lifestyle" | "product" | "environment" | "mixed";
}

/** Month number 1–12 for seasonal routing. */
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * Seasonal and cultural calendar signal.
 * Future phases use this to boost occasion-relevant routes
 * (e.g., boost food_celebration_lifestyle during festive months).
 */
export interface SeasonSignal {
  month:             Month;
  culturalOccasion?: string; // "diwali" | "wedding_season" | "valentine" | "summer" etc.
}

/**
 * Generation history signal for diversity checking.
 * Supplied from CreativeMemory entries for the same user + industry.
 */
export interface HistorySignal {
  recentRouteIds:     string[];
  recentFingerprints: string[];
}

/**
 * Full extended signal set for the Dynamic Route Engine.
 * A superset of Phase 8.6 CRDEInput:
 *   { industryId, campaignType, rawIdea, campaignGoal?, audience? }
 */
export interface ExtendedRouteSignals {
  // ── Phase 8.6 core (always required) ──────────────────────────────────────
  industry:     SceneIndustry;
  campaignGoal: CampaignGoal;
  rawIdea:      string;
  campaignType?: string;

  // ── Phase 10.4 extended (optional) ────────────────────────────────────────
  audience?:       AudienceSignal;
  psychology?:     PsychologySignal;
  luxuryTier?:     MaterialTier;
  referenceImage?: ReferenceImageSignal;
  season?:         SeasonSignal;
  history?:        HistorySignal;
}

// ── Scoring ────────────────────────────────────────────────────────────────────

/**
 * Multi-dimensional score for one route candidate.
 * All sub-scores are 0.0–1.0 normalised.
 * Total is a weighted composite; weights are defined in the engine config
 * (not yet implemented in Phase 10.4).
 */
export interface RouteScore {
  /** How closely the route's archetype matches the campaign goal (0–1). */
  relevance:     number;
  /**
   * How different this route is from the most recent generation.
   * 1.0 = never used; 0.0 = identical fingerprint. Requires HistorySignal.
   */
  diversity:     number;
  /** Route's archetype confidence rating for this industry (0–1). */
  industryFit:   number;
  /** Alignment between route's tier assumptions and detected brand tier (0–1). */
  tierMatch:     number;
  /** Additive boost from seasonal/cultural signal match (0–1). */
  seasonalBoost: number;
  /** Weighted composite across all dimensions (0–1). */
  total:         number;
}

// ── Candidate ─────────────────────────────────────────────────────────────────

/**
 * One scored route candidate from the Dynamic Route Engine.
 * Wraps the Phase 8.6 CreativeRoute with Phase 10.4 scoring and graph metadata.
 */
export interface RouteCandidate {
  route:        CreativeRoute;
  /**
   * Archetype this route instantiates.
   * Empty string until archetype-registry is populated (Phase 10.4B).
   */
  archetypeId:  ArchetypeId;
  /**
   * Hero moment from the knowledge graph.
   * Empty string until knowledge-graph is populated (Phase 10.4B).
   */
  heroMomentId: HeroMomentId;
  sceneTypeId:  SceneTypeId;
  signals:      ExtendedRouteSignals;
  score:        RouteScore;
  /**
   * Diversity metadata for this candidate.
   * Populated by extractor.ts once knowledge graph has real IDs.
   */
  diversity?:   DiversityMetadata;
}
