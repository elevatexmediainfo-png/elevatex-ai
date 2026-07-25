// Phase 10.4.1 — Restaurant industry knowledge.
// All 6 knowledge arrays: hero moments, scene types, behaviours,
// relationships, emotional moments, commercial situations.
//
// Campaign types and routes are inherited from the Phase 10.4.0 scaffold
// and will be populated in Phase 10.4.2.

export { RESTAURANT_HERO_MOMENTS } from "./hero-moments";
export { RESTAURANT_SCENE_TYPES } from "./scene-types";
export { RESTAURANT_BEHAVIOURS } from "./behaviours";
export { RESTAURANT_RELATIONSHIPS } from "./relationships";
export { RESTAURANT_EMOTIONAL_MOMENTS } from "./emotional-moments";
export { RESTAURANT_COMMERCIAL_SITUATIONS } from "./commercial-situations";

import type {
  CampaignTypeKnowledgeNode,
  RouteKnowledgeNode,
} from "../../node";

/** Campaign types — to be populated in Phase 10.4.2. */
export const RESTAURANT_CAMPAIGN_TYPES: CampaignTypeKnowledgeNode[] = [];

/** Routes bridged from Phase 8.6 — to be populated in Phase 10.4.2. */
export const RESTAURANT_ROUTES: RouteKnowledgeNode[] = [];
