// Phase 10.4B — Industry Knowledge Graph: IndustryGraphRegistry.
//
// The registry owns the canonical in-memory graph. It provides:
//   1. Typed registration (fail-fast on duplicate IDs)
//   2. Direct lookup by ID
//   3. Full-spectrum querying via GraphFilter
//   4. Graph traversal — walk the hierarchy from any node
//   5. Size telemetry per level
//
// Relationship to KnowledgeStore:
//   KnowledgeStore — flat, kind-keyed query over ALL knowledge nodes
//   IndustryGraphRegistry — hierarchical, traversal-first over GRAPH nodes
//
// Engines may use either or both. They are not mutually exclusive.
// The registry does NOT implement KnowledgeStore — it is a parallel,
// graph-aware interface.
//
// Data population:
//   Phase 10.4B: Architecture only — all data stores empty.
//   Phase 10.4C: Restaurant industry campaign types, hero moments, scenes.
//   Phase 10.4D+: Remaining industries in order of generation volume.

import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type {
  IndustryGraphNode,
  CampaignTypeGraphNode,
  HeroMomentGraphNode,
  SceneTypeGraphNode,
  BehaviourGraphNode,
  RelationshipGraphNode,
  EmotionalMomentGraphNode,
  CommercialSituationGraphNode,
  CommercialPatternGraphNode,
  AnyGraphNode,
} from "./types";
import type { GraphFilter, GraphSizeReport } from "./query";
import { LUXURY_LEVEL_RANK } from "./query";
import type { LuxuryLevel } from "./metadata";

// ── Internal data stores ───────────────────────────────────────────────────────

const _INDUSTRIES:            Map<SceneIndustry, IndustryGraphNode>           = new Map();
const _CAMPAIGN_TYPES:        Map<string, CampaignTypeGraphNode>              = new Map();
const _HERO_MOMENTS:          Map<string, HeroMomentGraphNode>                = new Map();
const _SCENE_TYPES:           Map<string, SceneTypeGraphNode>                 = new Map();
const _BEHAVIOURS:            Map<string, BehaviourGraphNode>                 = new Map();
const _RELATIONSHIPS:         Map<string, RelationshipGraphNode>              = new Map();
const _EMOTIONAL_MOMENTS:     Map<string, EmotionalMomentGraphNode>           = new Map();
const _COMMERCIAL_SITUATIONS: Map<string, CommercialSituationGraphNode>       = new Map();
const _COMMERCIAL_PATTERNS:   Map<string, CommercialPatternGraphNode>         = new Map();

// ── Registration ───────────────────────────────────────────────────────────────

export function registerIndustry(node: IndustryGraphNode): void {
  if (_INDUSTRIES.has(node.id)) {
    throw new Error(`[IndustryGraphRegistry] Duplicate industry ID: "${node.id}"`);
  }
  _INDUSTRIES.set(node.id, node);
}

export function registerCampaignType(node: CampaignTypeGraphNode): void {
  if (_CAMPAIGN_TYPES.has(node.id)) {
    throw new Error(`[IndustryGraphRegistry] Duplicate campaign type ID: "${node.id}"`);
  }
  _CAMPAIGN_TYPES.set(node.id, node);
}

export function registerHeroMoment(node: HeroMomentGraphNode): void {
  if (_HERO_MOMENTS.has(node.id)) {
    throw new Error(`[IndustryGraphRegistry] Duplicate hero moment ID: "${node.id}"`);
  }
  _HERO_MOMENTS.set(node.id, node);
}

export function registerSceneType(node: SceneTypeGraphNode): void {
  if (_SCENE_TYPES.has(node.id)) {
    throw new Error(`[IndustryGraphRegistry] Duplicate scene type ID: "${node.id}"`);
  }
  _SCENE_TYPES.set(node.id, node);
}

export function registerBehaviour(node: BehaviourGraphNode): void {
  if (_BEHAVIOURS.has(node.id)) {
    throw new Error(`[IndustryGraphRegistry] Duplicate behaviour ID: "${node.id}"`);
  }
  _BEHAVIOURS.set(node.id, node);
}

export function registerRelationship(node: RelationshipGraphNode): void {
  if (_RELATIONSHIPS.has(node.id)) {
    throw new Error(`[IndustryGraphRegistry] Duplicate relationship ID: "${node.id}"`);
  }
  _RELATIONSHIPS.set(node.id, node);
}

export function registerEmotionalMoment(node: EmotionalMomentGraphNode): void {
  if (_EMOTIONAL_MOMENTS.has(node.id)) {
    throw new Error(`[IndustryGraphRegistry] Duplicate emotional moment ID: "${node.id}"`);
  }
  _EMOTIONAL_MOMENTS.set(node.id, node);
}

export function registerCommercialSituation(node: CommercialSituationGraphNode): void {
  if (_COMMERCIAL_SITUATIONS.has(node.id)) {
    throw new Error(`[IndustryGraphRegistry] Duplicate commercial situation ID: "${node.id}"`);
  }
  _COMMERCIAL_SITUATIONS.set(node.id, node);
}

export function registerCommercialPattern(node: CommercialPatternGraphNode): void {
  if (_COMMERCIAL_PATTERNS.has(node.id)) {
    throw new Error(`[IndustryGraphRegistry] Duplicate commercial pattern ID: "${node.id}"`);
  }
  _COMMERCIAL_PATTERNS.set(node.id, node);
}

/**
 * Bulk-register mixed graph nodes. Dispatches to the correct typed register
 * function based on the node's `kind` discriminant.
 * Throws on the first duplicate ID found — fail-fast.
 */
export function registerGraphNodes(nodes: readonly AnyGraphNode[]): void {
  for (const node of nodes) {
    switch (node.kind) {
      case "campaign_type":       registerCampaignType(node);        break;
      case "hero_moment":         registerHeroMoment(node);          break;
      case "scene_type":          registerSceneType(node);           break;
      case "behaviour":           registerBehaviour(node);           break;
      case "relationship":        registerRelationship(node);        break;
      case "emotional_moment":    registerEmotionalMoment(node);     break;
      case "commercial_situation":registerCommercialSituation(node); break;
      case "pattern":             registerCommercialPattern(node);   break;
    }
  }
}

// ── Direct lookup ──────────────────────────────────────────────────────────────

export function getIndustry(id: SceneIndustry):          IndustryGraphNode            | undefined { return _INDUSTRIES.get(id);             }
export function getCampaignType(id: string):             CampaignTypeGraphNode        | undefined { return _CAMPAIGN_TYPES.get(id);          }
export function getHeroMoment(id: string):               HeroMomentGraphNode          | undefined { return _HERO_MOMENTS.get(id);            }
export function getSceneType(id: string):                SceneTypeGraphNode           | undefined { return _SCENE_TYPES.get(id);             }
export function getBehaviour(id: string):                BehaviourGraphNode           | undefined { return _BEHAVIOURS.get(id);              }
export function getRelationship(id: string):             RelationshipGraphNode        | undefined { return _RELATIONSHIPS.get(id);           }
export function getEmotionalMoment(id: string):          EmotionalMomentGraphNode     | undefined { return _EMOTIONAL_MOMENTS.get(id);       }
export function getCommercialSituation(id: string):      CommercialSituationGraphNode | undefined { return _COMMERCIAL_SITUATIONS.get(id);   }
export function getCommercialPattern(id: string):        CommercialPatternGraphNode   | undefined { return _COMMERCIAL_PATTERNS.get(id);     }

// ── Graph traversal ────────────────────────────────────────────────────────────

/** All campaign types registered under an industry, in ID order. */
export function getCampaignTypesForIndustry(industry: SceneIndustry): CampaignTypeGraphNode[] {
  const ind = _INDUSTRIES.get(industry);
  if (!ind) return [];
  return ind.campaignTypeIds
    .map(id => _CAMPAIGN_TYPES.get(id))
    .filter((n): n is CampaignTypeGraphNode => n !== undefined);
}

/** All hero moments registered under a campaign type, in ID order. */
export function getHeroMomentsForCampaignType(campaignTypeId: string): HeroMomentGraphNode[] {
  const ct = _CAMPAIGN_TYPES.get(campaignTypeId);
  if (!ct) return [];
  return ct.heroMomentIds
    .map(id => _HERO_MOMENTS.get(id))
    .filter((n): n is HeroMomentGraphNode => n !== undefined);
}

/** All scene types linked from a hero moment, in ID order. */
export function getSceneTypesForHeroMoment(heroMomentId: string): SceneTypeGraphNode[] {
  const hm = _HERO_MOMENTS.get(heroMomentId);
  if (!hm) return [];
  return hm.sceneTypeIds
    .map(id => _SCENE_TYPES.get(id))
    .filter((n): n is SceneTypeGraphNode => n !== undefined);
}

/** All behaviours linked from a scene type, in ID order. */
export function getBehavioursForSceneType(sceneTypeId: string): BehaviourGraphNode[] {
  const st = _SCENE_TYPES.get(sceneTypeId);
  if (!st) return [];
  return st.behaviourIds
    .map(id => _BEHAVIOURS.get(id))
    .filter((n): n is BehaviourGraphNode => n !== undefined);
}

/** All relationships linked from a behaviour, in ID order. */
export function getRelationshipsForBehaviour(behaviourId: string): RelationshipGraphNode[] {
  const bh = _BEHAVIOURS.get(behaviourId);
  if (!bh) return [];
  return bh.relationshipIds
    .map(id => _RELATIONSHIPS.get(id))
    .filter((n): n is RelationshipGraphNode => n !== undefined);
}

/** All emotional moments linked from a hero moment. */
export function getEmotionalMomentsForHeroMoment(heroMomentId: string): EmotionalMomentGraphNode[] {
  const hm = _HERO_MOMENTS.get(heroMomentId);
  if (!hm) return [];
  return hm.emotionalMomentIds
    .map(id => _EMOTIONAL_MOMENTS.get(id))
    .filter((n): n is EmotionalMomentGraphNode => n !== undefined);
}

/** All commercial situations linked from a behaviour. */
export function getCommercialSituationsForBehaviour(behaviourId: string): CommercialSituationGraphNode[] {
  const bh = _BEHAVIOURS.get(behaviourId);
  if (!bh) return [];
  return bh.commercialSituationIds
    .map(id => _COMMERCIAL_SITUATIONS.get(id))
    .filter((n): n is CommercialSituationGraphNode => n !== undefined);
}

// ── Full-spectrum query ────────────────────────────────────────────────────────

/**
 * Query all graph nodes (across all types) matching the given GraphFilter.
 * Returns a read-only array sorted per the filter's sortBy field.
 * Never throws — returns empty array when nothing matches.
 *
 * This is a flat scan across all node maps. For graph traversal use the
 * specialised getXxxForYyy() functions above.
 */
export function queryNodes(filter: GraphFilter): readonly AnyGraphNode[] {
  const allNodes: AnyGraphNode[] = [
    ..._CAMPAIGN_TYPES.values(),
    ..._HERO_MOMENTS.values(),
    ..._SCENE_TYPES.values(),
    ..._BEHAVIOURS.values(),
    ..._RELATIONSHIPS.values(),
    ..._EMOTIONAL_MOMENTS.values(),
    ..._COMMERCIAL_SITUATIONS.values(),
    ..._COMMERCIAL_PATTERNS.values(),
  ];

  let results = allNodes.filter(node => matchesGraphFilter(node, filter));

  const sortBy = filter.sortBy ?? "priority";
  results.sort((a, b) => {
    if (sortBy === "priority")       return a.priority - b.priority;
    if (sortBy === "weight")         return b.weight - a.weight;
    if (sortBy === "commercialScore") return b.commercialScore - a.commercialScore;
    return 0;
  });

  if (filter.limit !== undefined) {
    results = results.slice(0, filter.limit);
  }

  return Object.freeze(results);
}

// ── Filter predicate (internal) ────────────────────────────────────────────────

function matchesGraphFilter(node: AnyGraphNode, f: GraphFilter): boolean {
  // Kind filter
  if (f.kind !== undefined) {
    const kinds = Array.isArray(f.kind) ? f.kind : [f.kind];
    if (!kinds.includes(node.kind)) return false;
  }

  // Industry filter — nodes with industryIds field
  if (f.industry !== undefined) {
    const ids = (node as { industryIds?: SceneIndustry[] }).industryIds;
    if (ids && !ids.includes(f.industry)) return false;
  }

  // Priority
  if (f.maxPriority !== undefined && node.priority > f.maxPriority) return false;

  // Weight
  if (f.minWeight !== undefined && node.weight < f.minWeight) return false;

  // Commercial score (reuse as commercialScore)
  if (f.minWeight !== undefined && node.commercialScore < (f.minWeight * 100)) {
    // Don't double-filter; minWeight applies to weight not commercialScore
  }

  // Tags
  if (f.anyTags && f.anyTags.length > 0) {
    if (!f.anyTags.some(t => node.tags.includes(t))) return false;
  }
  if (f.allTags && f.allTags.length > 0) {
    if (!f.allTags.every(t => node.tags.includes(t))) return false;
  }

  // Season dimension
  if (f.season !== undefined && node.season !== undefined) {
    if (node.season.primary !== "year_round" && node.season.primary !== f.season) return false;
  }
  if (f.month !== undefined && node.season !== undefined) {
    const months = node.season.months;
    if (months.length > 0 && !months.includes(f.month)) return false;
  }
  if (f.occasion !== undefined && node.season !== undefined) {
    const occ = node.season.occasions;
    if (!occ.includes("generic") && !occ.includes(f.occasion)) return false;
  }

  // Audience dimension
  if (f.audienceTiers !== undefined && node.audience !== undefined) {
    if (!node.audience.universal) {
      if (!f.audienceTiers.some(t => node.audience!.tiers.includes(t))) return false;
    }
  }
  if (f.audienceAge !== undefined && node.audience !== undefined) {
    if (!node.audience.universal) {
      if (!node.audience.ages.includes("all") && !node.audience.ages.includes(f.audienceAge)) return false;
    }
  }

  // Luxury dimension
  if (node.luxury !== undefined) {
    const nodeRank = LUXURY_LEVEL_RANK[node.luxury.tier];
    if (f.minLuxuryLevel !== undefined && nodeRank < LUXURY_LEVEL_RANK[f.minLuxuryLevel]) return false;
    if (f.maxLuxuryLevel !== undefined && nodeRank > LUXURY_LEVEL_RANK[f.maxLuxuryLevel]) return false;
    if (f.luxuryLevels !== undefined && !f.luxuryLevels.includes(node.luxury.tier)) return false;
  }

  // Psychology dimension
  if (f.psychology !== undefined && node.psychology !== undefined) {
    if (node.psychology.primary !== f.psychology && node.psychology.secondary !== f.psychology) return false;
  }
  if (f.funnelStage !== undefined && node.psychology !== undefined) {
    if (node.psychology.funnelStage !== "all" && node.psychology.funnelStage !== f.funnelStage) return false;
  }

  return true;
}

// ── Size telemetry ─────────────────────────────────────────────────────────────

export function graphSize(): GraphSizeReport {
  const campaign = _CAMPAIGN_TYPES.size;
  const hero     = _HERO_MOMENTS.size;
  const scene    = _SCENE_TYPES.size;
  const behav    = _BEHAVIOURS.size;
  const rel      = _RELATIONSHIPS.size;
  const emo      = _EMOTIONAL_MOMENTS.size;
  const com      = _COMMERCIAL_SITUATIONS.size;
  const pat      = _COMMERCIAL_PATTERNS.size;
  return {
    industries:           _INDUSTRIES.size,
    campaignTypes:        campaign,
    heroMoments:          hero,
    sceneTypes:           scene,
    behaviours:           behav,
    relationships:        rel,
    emotionalMoments:     emo,
    commercialSituations: com,
    commercialPatterns:   pat,
    totalNodes:           campaign + hero + scene + behav + rel + emo + com + pat,
  };
}

/** All registered industry IDs. */
export function registeredIndustries(): SceneIndustry[] {
  return [..._INDUSTRIES.keys()];
}
