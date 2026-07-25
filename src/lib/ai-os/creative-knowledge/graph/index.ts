// Phase 10.4B — Industry Knowledge Graph: public API.
//
// Single import point for all graph-layer types, constants, and the registry.
//
// Consumers:
//   import type { GraphNode, AnyGraphNode } from ".../graph";
//   import { queryNodes, registerIndustry, graphSize } from ".../graph";
//
// The registry is stateful (module-level Maps). Importing this file is
// sufficient to access the singleton registry — there is no constructor.

// ── Metadata types ─────────────────────────────────────────────────────────────
export type {
  SeasonName,
  CulturalOccasion,
  SeasonWindow,
  AudienceTier,
  AudienceAge,
  AudienceGender,
  BuyerJourneyStage,
  NodeAudience,
  LuxuryLevel,
  NodeLuxury,
  FunnelStage,
  NodePsychology,
  FutureLearningMetadata,
  NodeMetadata,
} from "./metadata";

export {
  YEAR_ROUND_SEASON,
  UNIVERSAL_AUDIENCE,
  DEFAULT_LUXURY,
  EMPTY_FUTURE_LEARNING,
} from "./metadata";

// Re-export PsychologicalMechanism for graph consumers that shouldn't need to
// reach into universal/archetypes/types directly.
export type { PsychologicalMechanism } from "./metadata";

// ── Graph node types ───────────────────────────────────────────────────────────
export type {
  GraphNode,
  IndustryExpansionTargets,
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

export {
  STANDARD_EXPANSION_TARGETS,
  GRAPH_NODE_KINDS,
} from "./types";

// ── Query types ────────────────────────────────────────────────────────────────
export type {
  GraphFilter,
  GraphTraversalQuery,
  GraphSizeReport,
} from "./query";

export { LUXURY_LEVEL_RANK } from "./query";

// ── Registry — registration ────────────────────────────────────────────────────
export {
  registerIndustry,
  registerCampaignType,
  registerHeroMoment,
  registerSceneType,
  registerBehaviour,
  registerRelationship,
  registerEmotionalMoment,
  registerCommercialSituation,
  registerCommercialPattern,
  registerGraphNodes,
} from "./registry";

// ── Registry — lookup ──────────────────────────────────────────────────────────
export {
  getIndustry,
  getCampaignType,
  getHeroMoment,
  getSceneType,
  getBehaviour,
  getRelationship,
  getEmotionalMoment,
  getCommercialSituation,
  getCommercialPattern,
} from "./registry";

// ── Registry — traversal ───────────────────────────────────────────────────────
export {
  getCampaignTypesForIndustry,
  getHeroMomentsForCampaignType,
  getSceneTypesForHeroMoment,
  getBehavioursForSceneType,
  getRelationshipsForBehaviour,
  getEmotionalMomentsForHeroMoment,
  getCommercialSituationsForBehaviour,
} from "./registry";

// ── Registry — query + telemetry ───────────────────────────────────────────────
export {
  queryNodes,
  graphSize,
  registeredIndustries,
} from "./registry";
