// Phase 10.4 — Industry Knowledge Graph API.
// The graph is intentionally empty — future phases populate the data stores.
// All callers must use the typed API; never access data stores directly.
//
// Population plan:
//   Phase 10.4B: Restaurant industry — all campaign types from Phase 10.3E audit
//   Phase 10.4C+: Remaining industries in order of generation volume

import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type {
  IndustryNode,
  CampaignTypeNode,
  HeroMomentNode,
  SceneTypeNode,
  HumanBehaviourNode,
  RelationshipNode,
  CommercialPatternNode,
} from "./types";
import type {
  CampaignTypeId,
  HeroMomentId,
  SceneTypeId,
  HumanBehaviourId,
  RelationshipId,
  CommercialPatternId,
} from "../types";

// ── Data stores ───────────────────────────────────────────────────────────────

const _INDUSTRIES:        Partial<Record<SceneIndustry, IndustryNode>>          = {};
const _CAMPAIGN_TYPES:    Record<CampaignTypeId,    CampaignTypeNode>           = {};
const _HERO_MOMENTS:      Record<HeroMomentId,      HeroMomentNode>             = {};
const _SCENE_TYPES:       Record<SceneTypeId,       SceneTypeNode>              = {};
const _BEHAVIOURS:        Record<HumanBehaviourId,  HumanBehaviourNode>         = {};
const _RELATIONSHIPS:     Record<RelationshipId,    RelationshipNode>           = {};
const _COMMERCIAL_PATTERNS: Record<CommercialPatternId, CommercialPatternNode>  = {};

// ── Traversal API ─────────────────────────────────────────────────────────────

export function getIndustryNode(industry: SceneIndustry): IndustryNode | undefined {
  return _INDUSTRIES[industry];
}

export function getCampaignTypes(industry: SceneIndustry): CampaignTypeNode[] {
  const node = _INDUSTRIES[industry];
  if (!node) return [];
  return node.campaignTypeIds
    .map(id => _CAMPAIGN_TYPES[id])
    .filter((n): n is CampaignTypeNode => n !== undefined);
}

export function getCampaignTypeById(id: CampaignTypeId): CampaignTypeNode | undefined {
  return _CAMPAIGN_TYPES[id];
}

export function getHeroMoments(
  industry:       SceneIndustry,
  campaignTypeId: CampaignTypeId,
): HeroMomentNode[] {
  const node = _CAMPAIGN_TYPES[campaignTypeId];
  if (!node) return [];
  return node.heroMomentIds
    .map(id => _HERO_MOMENTS[id])
    .filter((n): n is HeroMomentNode => n !== undefined);
}

export function getHeroMomentById(id: HeroMomentId): HeroMomentNode | undefined {
  return _HERO_MOMENTS[id];
}

export function getSceneTypes(heroMomentId: HeroMomentId): SceneTypeNode[] {
  const node = _HERO_MOMENTS[heroMomentId];
  if (!node) return [];
  return node.sceneTypeIds
    .map(id => _SCENE_TYPES[id])
    .filter((n): n is SceneTypeNode => n !== undefined);
}

export function getBehaviours(sceneTypeId: SceneTypeId): HumanBehaviourNode[] {
  const node = _SCENE_TYPES[sceneTypeId];
  if (!node) return [];
  return node.behaviourIds
    .map(id => _BEHAVIOURS[id])
    .filter((n): n is HumanBehaviourNode => n !== undefined);
}

export function getRelationships(behaviourId: HumanBehaviourId): RelationshipNode[] {
  const node = _BEHAVIOURS[behaviourId];
  if (!node) return [];
  return node.relationshipIds
    .map(id => _RELATIONSHIPS[id])
    .filter((n): n is RelationshipNode => n !== undefined);
}

export function getCommercialPatterns(behaviourId: HumanBehaviourId): CommercialPatternNode[] {
  const node = _BEHAVIOURS[behaviourId];
  if (!node) return [];
  return node.commercialPatternIds
    .map(id => _COMMERCIAL_PATTERNS[id])
    .filter((n): n is CommercialPatternNode => n !== undefined);
}

// ── Size telemetry ────────────────────────────────────────────────────────────

export function graphSize(): {
  industries:        number;
  campaignTypes:     number;
  heroMoments:       number;
  sceneTypes:        number;
  behaviours:        number;
  relationships:     number;
  commercialPatterns: number;
} {
  return {
    industries:         Object.keys(_INDUSTRIES).length,
    campaignTypes:      Object.keys(_CAMPAIGN_TYPES).length,
    heroMoments:        Object.keys(_HERO_MOMENTS).length,
    sceneTypes:         Object.keys(_SCENE_TYPES).length,
    behaviours:         Object.keys(_BEHAVIOURS).length,
    relationships:      Object.keys(_RELATIONSHIPS).length,
    commercialPatterns: Object.keys(_COMMERCIAL_PATTERNS).length,
  };
}
