// Phase 10.4 — Industry Knowledge Graph node interfaces.
//
// Models a six-level creative knowledge hierarchy:
//
//   IndustryNode
//       ↓ campaignTypeIds[]
//   CampaignTypeNode
//       ↓ heroMomentIds[]
//   HeroMomentNode
//       ↓ sceneTypeIds[]
//   SceneTypeNode
//       ↓ behaviourIds[]
//   HumanBehaviourNode
//       ↓ relationshipIds[]
//   RelationshipNode
//       ↓ commercialPatternIds[]
//   CommercialPatternNode
//
// Every node is independently extendable.
// Adding a new CampaignTypeNode for an existing industry requires only:
//   1. Create the node
//   2. Add its ID to the parent IndustryNode.campaignTypeIds[]
// No engine logic changes.
//
// Integration bridges to Phase 8 systems:
//   - CampaignTypeNode.cklCampaignType  → creative-knowledge-library campaign type
//   - CampaignTypeNode.crdeBestForKeywords → creative-route-engine bestFor tags
//   - HeroMomentNode.heroDecisionKey    → creative-brain/hero-decision-engine entry

import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type {
  ArchetypeId,
  HeroMomentId,
  CampaignTypeId,
  SceneTypeId,
  HumanBehaviourId,
  RelationshipId,
  CommercialPatternId,
  CampaignGoal,
} from "../types";
import type { ArchetypeAffinity } from "../archetype-registry/types";

// ── Nodes ────────────────────────────────────────────────────────────────────

/** Top-level industry node. One per SceneIndustry value. */
export interface IndustryNode {
  id:                  SceneIndustry;
  displayName:         string;
  campaignTypeIds:     CampaignTypeId[];
  /**
   * Industry-level archetype preferences.
   * These boost specific archetypes when routing for this industry.
   */
  archetypeAffinities: ArchetypeAffinity[];
}

/**
 * One distinct campaign category within an industry.
 * More granular than "awareness" or "trust" — captures the commercial scenario.
 *
 * Examples: "grand_opening", "date_night", "chef_story", "signature_dish",
 *           "family_dining", "delivery_night", "wedding_buffet".
 *
 * This is the primary mechanism for restaurant (and all industry) hero diversity:
 * by naming campaign types explicitly, the Route Engine can select a distinct
 * HeroMomentNode for each instead of collapsing them into the same hero.
 */
export interface CampaignTypeNode {
  id:              CampaignTypeId;
  displayName:     string;
  industryIds:     SceneIndustry[];
  heroMomentIds:   HeroMomentId[];
  primaryGoal:     CampaignGoal;
  secondaryGoals:  CampaignGoal[];
  archetypeIds:    ArchetypeId[];
  /**
   * Integration: maps to CampaignKnowledge.type in creative-knowledge-library.
   * When set, getCampaignResolution(industry, rawIdea) can retrieve gold-standard
   * execution detail for this campaign type.
   */
  cklCampaignType?: string;
  /**
   * Integration: maps to CreativeRoute.bestFor in creative-route-engine.
   * Routes whose bestFor keywords overlap with these are promoted during scoring.
   */
  crdeBestForKeywords?: string[];
}

/**
 * A specific, nameable commercial hero moment within a campaign type.
 * More granular than campaign type — one campaign type can have multiple
 * distinct hero moments.
 *
 * Example: "date_night" CampaignTypeNode could have three HeroMomentNodes:
 *   - "couple_at_table"    (the intimate connection moment)
 *   - "dish_arrival"       (the signature dish arriving at the table)
 *   - "restaurant_romance" (the lit room before the couple arrives)
 *
 * This is the fix for the audit finding: instead of collapsing all awareness
 * campaigns to the same generic lifestyle hero, each named hero moment has
 * its own subject text, archetype, and scene types.
 */
export interface HeroMomentNode {
  id:              HeroMomentId;
  displayName:     string;
  /** Physically observable description of the hero moment. */
  description:     string;
  archetypeId:     ArchetypeId;
  industryIds:     SceneIndustry[];
  campaignTypeIds: CampaignTypeId[];
  sceneTypeIds:    SceneTypeId[];
  behaviourIds:    HumanBehaviourId[];
  /**
   * Integration: maps to HERO_SUBJECTS[heroType][industryKey] in
   * creative-brain/hero-decision-engine.ts.
   * Format: "heroType:industryKey" e.g. "person:restaurant".
   * When set, the existing hero decision engine is the authoritative
   * source for the actual subject text.
   */
  heroDecisionKey?: string;
}

/** The physical-spatial context in which a hero moment occurs. */
export interface SceneTypeNode {
  id:              SceneTypeId;
  displayName:     string;
  /** Specific, observable physical description. */
  physicalContext: string;
  heroMomentIds:   HeroMomentId[];
  behaviourIds:    HumanBehaviourId[];
}

/** A specific, observable human action or gesture within a scene. */
export interface HumanBehaviourNode {
  id:                   HumanBehaviourId;
  /** Physically specific — what can be seen in the frame. */
  description:          string;
  sceneTypeIds:         SceneTypeId[];
  relationshipIds:      RelationshipId[];
  commercialPatternIds: CommercialPatternId[];
}

/** The social dynamic between people in a scene. */
export interface RelationshipNode {
  id:   RelationshipId;
  type: "solo" | "couple" | "family" | "friends" | "professional" | "professional_client";
  description: string;
}

/** The mechanism by which a commercial pattern converts a viewer. */
export interface CommercialPatternNode {
  id:                     CommercialPatternId;
  pattern:                string;
  psychologicalMechanism: string;
  callToAction?:          string;
}
