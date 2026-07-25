// Phase 10.4B — Industry Knowledge Graph: typed node hierarchy.
//
// This file defines the GRAPH LAYER — the typed node types for each level
// of the Industry Knowledge Graph hierarchy. It is distinct from:
//
//   creative-knowledge/node.ts          (flat KnowledgeNode base)
//   creative-knowledge/knowledge-graph/ (Phase 10.4 stub — superseded here)
//
// Graph hierarchy (7 levels):
//
//   IndustryGraphNode
//       ↓ campaignTypeIds[]
//   CampaignTypeGraphNode
//       ↓ heroMomentIds[]
//   HeroMomentGraphNode
//       ↓ sceneTypeIds[]
//   SceneTypeGraphNode
//       ↓ behaviourIds[]
//   BehaviourGraphNode
//       ↓ relationshipIds[]
//   RelationshipGraphNode
//       ↓ commercialPatternIds[]
//   CommercialPatternGraphNode
//
// Additionally, EmotionalMomentGraphNode and CommercialSituationGraphNode
// are cross-linked from HeroMomentGraphNode — they sit at the same
// conceptual depth as SceneTypeGraphNode but serve different creative functions.
//
// Design rules:
//   1. Every graph node is independently queryable (via KnowledgeStore).
//   2. Cross-level links are always by ID (never by object reference).
//   3. No engine logic inside graph node types.
//   4. Metadata families (season, audience, luxury, psychology) are optional
//      on ALL graph nodes — curators add them progressively.
//   5. Expansion targets per industry are declared but never enforced at
//      compile time — they guide curators, not the type system.

import type { KnowledgeNode, KnowledgeNodeKind } from "../node";
import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { CampaignGoal } from "../types";
import type { ArchetypeAffinity } from "../archetype-registry/types";
import type {
  SeasonWindow,
  NodeAudience,
  NodeLuxury,
  NodePsychology,
  FutureLearningMetadata,
} from "./metadata";

// ── GraphNode base ─────────────────────────────────────────────────────────────

/**
 * Base for all graph nodes. Extends KnowledgeNode with the four Phase 10.4B
 * metadata families. All metadata fields are optional — existing KnowledgeNode
 * subtypes remain fully compatible without changes.
 *
 * Engines receiving a GraphNode can read base KnowledgeNode fields immediately;
 * they guard on the optional metadata fields before using them.
 */
export interface GraphNode extends KnowledgeNode {
  /**
   * Seasonal relevance window.
   * Absent = treat as year-round (no seasonal boost applied).
   */
  readonly season?:          SeasonWindow;
  /**
   * Audience targeting metadata.
   * Absent = universal audience (no audience-dimension filtering applied).
   */
  readonly audience?:        NodeAudience;
  /**
   * Luxury positioning tier.
   * Absent = default to "accessible" for matching purposes.
   */
  readonly luxury?:          NodeLuxury;
  /**
   * Psychological mechanism this node activates.
   * Absent = no psychology-dimension filtering applied.
   */
  readonly psychology?:      NodePsychology;
  /**
   * Expanded learning metadata (8 slots vs. base KnowledgeNode's 4).
   * Absent = engine falls back to base futureMetadata.
   */
  readonly futureLearning?:  FutureLearningMetadata;
}

// ── Industry graph node ────────────────────────────────────────────────────────

/**
 * Target node counts per industry.
 * Guides curators on what each industry needs.
 * NEVER enforced at compile time — it is documentary, not contractual.
 */
export interface IndustryExpansionTargets {
  readonly heroMoments:          number;
  readonly sceneTypes:           number;
  readonly humanBehaviours:      number;
  readonly relationships:        number;
  readonly emotionalMoments:     number;
  readonly commercialSituations: number;
}

/** The standard Phase 10.4B targets for all industries. */
export const STANDARD_EXPANSION_TARGETS: IndustryExpansionTargets = {
  heroMoments:          100,
  sceneTypes:           100,
  humanBehaviours:      100,
  relationships:         50,
  emotionalMoments:      50,
  commercialSituations:  50,
};

/**
 * Top-level industry node. One per SceneIndustry value.
 * Not a KnowledgeNode — it is the graph root above the node hierarchy.
 *
 * Stores IDs only. The registry resolves IDs to typed nodes on traversal.
 */
export interface IndustryGraphNode {
  /** Stable identifier — matches a SceneIndustry value exactly. */
  readonly id:                  SceneIndustry;
  /** Human-readable name. Examples: "Restaurant", "Interior Design". */
  readonly displayName:         string;
  /** One sentence — what creative situations this industry covers. */
  readonly description:         string;
  /** Ordered campaign type IDs. First = most commercially important. */
  readonly campaignTypeIds:     string[];
  /**
   * Industry-level archetype preferences.
   * These boost specific archetypes when routing for this industry.
   * Carries forward from Phase 10.4 IndustryNode.archetypeAffinities.
   */
  readonly archetypeAffinities: ArchetypeAffinity[];
  /**
   * Expansion targets for this industry.
   * Default: STANDARD_EXPANSION_TARGETS for all industries.
   * Override for industries with different structural needs.
   */
  readonly expansionTargets:    IndustryExpansionTargets;
}

// ── Campaign type graph node ───────────────────────────────────────────────────

/**
 * One commercial campaign category within an industry.
 * More granular than CampaignGoal — captures the specific creative scenario.
 *
 * Examples (restaurant): "grand_opening", "date_night", "chef_story",
 *                         "family_dining", "delivery_night", "festive_menu"
 * Examples (dental):     "implant_awareness", "invisalign_consult",
 *                         "smile_transformation", "children_first_visit"
 *
 * Extends GraphNode so it participates in KnowledgeStore.query().
 */
export interface CampaignTypeGraphNode extends GraphNode {
  readonly kind:               "campaign_type";
  /** Display name for UI and prompt assembly. */
  readonly displayName:        string;
  /** Industries this campaign type applies to. */
  readonly industryIds:        SceneIndustry[];
  /** The primary business goal this campaign type pursues. */
  readonly primaryGoal:        CampaignGoal;
  /** Secondary goals that benefit as byproducts. */
  readonly secondaryGoals:     CampaignGoal[];
  /** Ordered hero moment IDs. First = default selection. */
  readonly heroMomentIds:      string[];
  /** Archetype IDs that perform best for this campaign type. */
  readonly archetypeIds:       string[];
  /**
   * Bridge to CampaignKnowledge.type in creative-knowledge-library.
   * Set for campaign types migrated from Phase 10.3E audit.
   */
  readonly cklCampaignType?:   string;
  /**
   * Bridge to CreativeRoute.bestFor in creative-route-engine.
   * Routes whose bestFor tags overlap with these are promoted.
   */
  readonly crdeKeywords?:      string[];
}

// ── Hero moment graph node ─────────────────────────────────────────────────────

/**
 * A specific, nameable commercial hero moment within a campaign type.
 *
 * This is the most consequential node in the graph: it defines WHAT the
 * camera is literally capturing. A campaign type can yield multiple hero
 * moments with distinct visual, emotional, and commercial character.
 *
 * Example: "date_night" → ["couple_at_table", "dish_arrival", "lit_room_before"]
 *
 * Extends GraphNode so it participates in KnowledgeStore.query().
 */
export interface HeroMomentGraphNode extends GraphNode {
  readonly kind:             "hero_moment";
  /** Plain-language subject — what is physically in the frame. */
  readonly subject:          string;
  /** Hero type: person / product / environment / moment / lifestyle / authority */
  readonly heroType:         string;
  /** Industries this hero moment natively belongs to. */
  readonly industryIds:      SceneIndustry[];
  /** Campaign types that typically produce this hero moment. */
  readonly campaignTypeIds:  string[];
  /** Compatible scene type IDs — the environments this hero moment works within. */
  readonly sceneTypeIds:     string[];
  /** Behaviour IDs typically co-present with this hero moment. */
  readonly behaviourIds:     string[];
  /** Emotional moment IDs that can augment this hero moment. */
  readonly emotionalMomentIds: string[];
  /**
   * Bridge to HERO_SUBJECTS[heroType][industryKey] in hero-decision-engine.ts.
   * Format: "heroType:industryKey" e.g. "person:restaurant"
   */
  readonly heroDecisionKey?: string;
}

// ── Scene type graph node ──────────────────────────────────────────────────────

/**
 * A specific physical-spatial environment in which a hero moment occurs.
 * More than a backdrop — scene type determines lighting character, spatial
 * relationships, and the set of behaviours that can plausibly appear.
 *
 * Extends GraphNode so it participates in KnowledgeStore.query().
 */
export interface SceneTypeGraphNode extends GraphNode {
  readonly kind:                "scene_type";
  /** Specific, observable description of the physical space. */
  readonly environment:         string;
  /** Quality, colour temperature, and character of the dominant light source. */
  readonly lightingCharacter:   string;
  /** Atmospheric and emotional quality of the space. */
  readonly mood:                string;
  /** Industries this scene type is native to. */
  readonly industryIds:         SceneIndustry[];
  /** Hero types this scene type naturally accommodates. */
  readonly compatibleHeroTypes: string[];
  /** Behaviour IDs that are plausible in this scene type. */
  readonly behaviourIds:        string[];
  /** Hero moment IDs this scene type is linked from. */
  readonly heroMomentIds:       string[];
}

// ── Behaviour graph node ───────────────────────────────────────────────────────

/**
 * A specific, observable human action or gesture within a scene.
 * Not an emotional state — a physically visible behaviour: gesture, posture,
 * micro-expression, physical interaction with object or person.
 *
 * Extends GraphNode so it participates in KnowledgeStore.query().
 */
export interface BehaviourGraphNode extends GraphNode {
  readonly kind:              "behaviour";
  /** What can be seen in the frame — physically specific. */
  readonly description:       string;
  /** The emotional signal this behaviour communicates to a viewer. */
  readonly emotionalSignal:   string;
  /** Hero types this behaviour can appear alongside. */
  readonly compatibleHeroes:  string[];
  /** Industries this behaviour is native to. Absent = universal. */
  readonly industryIds?:      SceneIndustry[];
  /** Relationship IDs that involve this behaviour. */
  readonly relationshipIds:   string[];
  /** Commercial situation IDs this behaviour is associated with. */
  readonly commercialSituationIds: string[];
}

// ── Relationship graph node ────────────────────────────────────────────────────

/**
 * The social dynamic between people in a scene.
 * Relationships shape composition, distance, body language and emotional register.
 *
 * Extends GraphNode so it participates in KnowledgeStore.query().
 */
export interface RelationshipGraphNode extends GraphNode {
  readonly kind:         "relationship";
  /** Plain-language description of the dynamic. */
  readonly description:  string;
  /**
   * The named roles in the scene.
   * Examples: ["chef", "guest"], ["dentist", "patient"], ["mother", "daughter"]
   */
  readonly sceneRoles:   string[];
  /** Industries this relationship is native to. Absent = universal. */
  readonly industryIds?: SceneIndustry[];
  /** Behaviour IDs that this relationship commonly produces. */
  readonly behaviourIds: string[];
}

// ── Emotional moment graph node ────────────────────────────────────────────────

/**
 * A specific peak emotional moment — what the camera captures at the
 * highest emotional intensity of a scene.
 *
 * Cross-linked from HeroMomentGraphNode. Emotional moments are not in the
 * primary traversal path (Industry → Campaign → Hero → Scene → Behaviour → Relationship)
 * but can augment any hero moment in the graph.
 *
 * Extends GraphNode so it participates in KnowledgeStore.query().
 */
export interface EmotionalMomentGraphNode extends GraphNode {
  readonly kind:           "emotional_moment";
  /** What is physically happening at this emotional peak — one sentence. */
  readonly moment:         string;
  /** Primary emotion being expressed or experienced. */
  readonly emotionType:    string;
  /** Physically observable visual signals of the emotion. */
  readonly visualSignals:  string[];
  /** Industries this emotional moment is native to. */
  readonly industryIds:    SceneIndustry[];
  /** Hero moment IDs this emotional moment can augment. */
  readonly heroMomentIds:  string[];
}

// ── Commercial situation graph node ───────────────────────────────────────────

/**
 * A specific business or commercial transaction moment.
 * Describes the commercial scenario the creative is designed to drive.
 *
 * Cross-linked from HeroMomentGraphNode and BehaviourGraphNode.
 * Extends GraphNode so it participates in KnowledgeStore.query().
 */
export interface CommercialSituationGraphNode extends GraphNode {
  readonly kind:                 "commercial_situation";
  /** What is happening commercially — the interaction or transaction. */
  readonly situation:            string;
  /** The exact moment commercial conversion happens or is offered. */
  readonly conversionMoment:     string;
  /** What the camera would literally show at this moment. */
  readonly visualRepresentation: string;
  /** Industries this situation is native to. */
  readonly industryIds:          SceneIndustry[];
  /** Campaign types that typically lead to this commercial situation. */
  readonly campaignTypeIds:      string[];
}

// ── Commercial pattern graph node ─────────────────────────────────────────────

/**
 * A recurring commercial mechanism that converts viewers to action.
 * The deepest leaf in the primary traversal path.
 *
 * Extends GraphNode so it participates in KnowledgeStore.query().
 */
export interface CommercialPatternGraphNode extends GraphNode {
  readonly kind:                  "pattern";
  /** Name of the commercial pattern. */
  readonly name:                  string;
  /** How this pattern converts a viewer — plain language. */
  readonly pattern:               string;
  /** The psychological mechanism being leveraged. */
  readonly psychologicalMechanism: string;
  /** Suggested call-to-action text for this pattern. */
  readonly callToAction?:         string;
  /** Behaviour IDs that express this pattern. */
  readonly behaviourIds:          string[];
}

// ── Union type ─────────────────────────────────────────────────────────────────

/**
 * Union of all typed graph node subtypes.
 * Engines can narrow to the specific type using the `kind` discriminant.
 */
export type AnyGraphNode =
  | CampaignTypeGraphNode
  | HeroMomentGraphNode
  | SceneTypeGraphNode
  | BehaviourGraphNode
  | RelationshipGraphNode
  | EmotionalMomentGraphNode
  | CommercialSituationGraphNode
  | CommercialPatternGraphNode;

/**
 * The KnowledgeNodeKind values that correspond to graph node types.
 * Used to filter graph nodes from a general KnowledgeStore query.
 */
export const GRAPH_NODE_KINDS: KnowledgeNodeKind[] = [
  "campaign_type",
  "hero_moment",
  "scene_type",
  "behaviour",
  "relationship",
  "emotional_moment",
  "commercial_situation",
  "pattern",
];
