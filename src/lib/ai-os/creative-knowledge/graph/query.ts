// Phase 10.4B — Industry Knowledge Graph: query types.
//
// GraphFilter extends KnowledgeFilter with four new metadata dimensions:
//   season, audience, luxury, psychology.
//
// The registry.ts implements GraphFilter. Engines that previously used
// KnowledgeFilter can pass GraphFilter to any registry or store method
// that accepts KnowledgeFilter — it is a strict superset.

import type { KnowledgeFilter } from "../store";
import type { CampaignGoal } from "../types";
import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type {
  SeasonName,
  AudienceTier,
  AudienceAge,
  LuxuryLevel,
  FunnelStage,
} from "./metadata";
import type { PsychologicalMechanism } from "../universal/archetypes/types";
import type { Month } from "../route-engine/types";
import type { CulturalOccasion } from "./metadata";

// ── GraphFilter ────────────────────────────────────────────────────────────────

/**
 * Full-spectrum filter for graph node queries.
 * Extends KnowledgeFilter with the four Phase 10.4B metadata dimensions.
 *
 * All fields are optional — pass only the dimensions you need.
 * The registry applies each present filter as an AND condition.
 * Multiple values within a single field are treated as OR.
 *
 * Example — find luxury hero moments for autumn in the dental industry:
 * ```ts
 * const results = registry.queryNodes({
 *   kind:        "hero_moment",
 *   industry:    "dental",
 *   luxuryLevel: ["luxury", "ultra_luxury"],
 *   season:      "autumn",
 *   sortBy:      "commercialScore",
 *   limit:       5,
 * });
 * ```
 */
export interface GraphFilter extends KnowledgeFilter {
  // ── Season dimension ────────────────────────────────────────────────────────
  /**
   * Return only nodes active in this season.
   * Nodes with YEAR_ROUND_SEASON always match.
   */
  season?:         SeasonName;
  /**
   * Return only nodes active in this calendar month.
   * Nodes with empty months[] (year-round) always match.
   */
  month?:          Month;
  /**
   * Return only nodes tagged for this cultural occasion.
   * Nodes with "generic" occasion always match.
   */
  occasion?:       CulturalOccasion;

  // ── Audience dimension ──────────────────────────────────────────────────────
  /** Return only nodes that target these audience tiers (OR). */
  audienceTiers?:  AudienceTier[];
  /** Return only nodes relevant to this age group. */
  audienceAge?:    AudienceAge;
  /** Return only nodes relevant to this specific industry (AND). */
  audienceIndustry?: SceneIndustry;

  // ── Luxury dimension ────────────────────────────────────────────────────────
  /**
   * Return only nodes at or above this luxury level.
   * Nodes without a luxury field default to "accessible" for matching.
   */
  minLuxuryLevel?: LuxuryLevel;
  /**
   * Return only nodes at or below this luxury level.
   * Useful for value-segment targeting.
   */
  maxLuxuryLevel?: LuxuryLevel;
  /** Return nodes at exactly these luxury levels (OR). */
  luxuryLevels?:   LuxuryLevel[];

  // ── Psychology dimension ────────────────────────────────────────────────────
  /** Return only nodes that activate this psychological mechanism (primary OR secondary). */
  psychology?:     PsychologicalMechanism;
  /** Return only nodes effective at this funnel stage. Nodes with "all" always match. */
  funnelStage?:    FunnelStage;

  // ── Campaign goal ───────────────────────────────────────────────────────────
  /** Alias for KnowledgeFilter.campaignGoal — provided here for discoverability. */
  goal?:           CampaignGoal;
}

// ── GraphTraversalQuery ────────────────────────────────────────────────────────

/**
 * A traversal query — starts at a known node ID and walks the graph.
 * Returns the typed children at the next level.
 *
 * Used when the caller knows the specific entry point and wants
 * to walk the hierarchy rather than filtering across all nodes.
 */
export interface GraphTraversalQuery {
  /** Starting node ID. */
  readonly fromId:    string;
  /**
   * Maximum traversal depth from the starting node.
   * 1 = direct children only; 2 = children and grandchildren; etc.
   * Default: 1.
   */
  readonly depth?:    number;
  /** Optional filter applied to each level of returned nodes. */
  readonly filter?:   GraphFilter;
}

// ── GraphSizeReport ────────────────────────────────────────────────────────────

/** Node counts at each level of the graph hierarchy. */
export interface GraphSizeReport {
  readonly industries:           number;
  readonly campaignTypes:        number;
  readonly heroMoments:          number;
  readonly sceneTypes:           number;
  readonly behaviours:           number;
  readonly relationships:        number;
  readonly emotionalMoments:     number;
  readonly commercialSituations: number;
  readonly commercialPatterns:   number;
  readonly totalNodes:           number;
}

// ── LuxuryLevelOrder ──────────────────────────────────────────────────────────

/**
 * Numeric rank for luxury level comparison.
 * Used by registry.ts to implement minLuxuryLevel / maxLuxuryLevel filtering.
 */
export const LUXURY_LEVEL_RANK: Record<LuxuryLevel, number> = {
  mass:         0,
  accessible:   1,
  premium:      2,
  luxury:       3,
  ultra_luxury: 4,
};
