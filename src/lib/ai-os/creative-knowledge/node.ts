// Phase 10.4.0 — Universal Knowledge Node contract.
// Every piece of data in creative-knowledge/ must extend KnowledgeNode.
// Engines consume only typed KnowledgeNode subtypes via KnowledgeStore —
// they never import knowledge files directly.
//
// Dependency direction (strictly enforced):
//   creative-engine/ → creative-knowledge/   (engines consume knowledge)
//   creative-knowledge/ → prompt-spec/        (knowledge references domain types)
//   creative-knowledge/ does NOT depend on creative-engine/
//   creative-engine/   does NOT contain hardcoded creative data

import type { SceneIndustry } from "../prompt-spec/scene-builder";
import type { CampaignGoal, ConfidenceLevel } from "./types";

// ── Reserved future slots ─────────────────────────────────────────────────────

/**
 * Future metadata — all null in Phase 10.4.0.
 * Phase 10.4F: embeddingVector → Float32Array for semantic similarity search.
 * Phase 10.4G: successRate + lastUsedAt → learned from generation feedback loops.
 * Phase 10.4H: userAffinity → per-user learned preference score.
 */
export interface FutureMetadata {
  readonly embeddingVector: null;
  readonly successRate:     null;
  readonly lastUsedAt:      null;
  readonly userAffinity:    null;
}

export const EMPTY_FUTURE_METADATA: FutureMetadata = {
  embeddingVector: null,
  successRate:     null,
  lastUsedAt:      null,
  userAffinity:    null,
};

// ── Node kinds ────────────────────────────────────────────────────────────────

/**
 * Discriminant for all knowledge node subtypes.
 * Used by KnowledgeStore.query() to return correctly typed subsets.
 */
export type KnowledgeNodeKind =
  | "archetype"          // creative-knowledge/universal/archetypes/
  | "behaviour"          // creative-knowledge/universal/behaviours/ + industries/{x}/
  | "relationship"       // creative-knowledge/universal/relationships/ + industries/{x}/
  | "emotion"            // creative-knowledge/universal/emotions/
  | "psychology"         // creative-knowledge/universal/psychology/
  | "composition"        // creative-knowledge/universal/compositions/
  | "hero_moment"        // creative-knowledge/industries/{x}/hero-moments
  | "scene_type"         // creative-knowledge/industries/{x}/scene-types
  | "emotional_moment"   // creative-knowledge/industries/{x}/emotional-moments
  | "commercial_situation" // creative-knowledge/industries/{x}/commercial-situations
  | "route"              // creative-knowledge/industries/{x}/
  | "pattern"            // creative-knowledge/industries/{x}/
  | "campaign_type"      // creative-knowledge/industries/{x}/
  | "experience_map"     // creative-knowledge/universal/psychology/
  | "validation_rule";   // creative-knowledge/universal/

// ── Universal base ────────────────────────────────────────────────────────────

/**
 * Universal base interface. Every knowledge entry in the system must extend this.
 *
 * Engines receive KnowledgeNode[] from the KnowledgeStore and narrow to the
 * correct subtype using the `kind` discriminant.
 *
 * ID format: "{kind}:{namespace}:{slug}"
 * Example:   "archetype:universal:arrival"
 * Example:   "hero_moment:restaurant:signature_dish_arrival"
 */
export interface KnowledgeNode {
  /** Stable unique identifier. Never changes after creation. */
  readonly id:              string;
  /** Discriminant — enables type narrowing after store queries. */
  readonly kind:            KnowledgeNodeKind;
  /** Searchable tags for multi-dimensional filtering and discovery. */
  readonly tags:            readonly string[];
  /** Selection priority: 1 = highest, 10 = lowest. Engines sort ascending. */
  readonly priority:        number;
  /** Relative influence weight: 0.0–1.0. Engines blend by weight when scoring. */
  readonly weight:          number;
  /** How confident the curator is in this entry's creative validity. */
  readonly confidence:      ConfidenceLevel;
  /** Expected commercial effectiveness: 0–100. Higher = reliably drives conversion. */
  readonly commercialScore: number;
  /** Reserved for future ML/memory system. All fields null until Phase 10.4F+. */
  readonly futureMetadata:  FutureMetadata;
}

// ── Typed node subtypes ───────────────────────────────────────────────────────

/** A universal creative archetype — industry-agnostic story shape. */
export interface ArchetypeKnowledgeNode extends KnowledgeNode {
  readonly kind:                 "archetype";
  readonly category:             string;
  readonly commercialPurposes:   string[];
  readonly emotionalPurposes:    string[];
  readonly compatibleIndustries: SceneIndustry[] | "all";
  readonly compatibleGoals:      CampaignGoal[];
}

/** Observable human behaviour in a scene — gesture, posture, micro-expression. */
export interface BehaviourKnowledgeNode extends KnowledgeNode {
  readonly kind:             "behaviour";
  readonly description:      string;
  readonly emotionalSignal:  string;
  readonly compatibleHeroes: string[];
  /** Undefined = universal (works in any industry). */
  readonly industryIds?:     SceneIndustry[];
}

/** Social or commercial relationship between people in a scene. */
export interface RelationshipKnowledgeNode extends KnowledgeNode {
  readonly kind:        "relationship";
  readonly description: string;
  readonly sceneRoles:  string[];
  /** Undefined = universal (works in any industry). */
  readonly industryIds?: SceneIndustry[];
}

/** An emotional state that drives creative direction. */
export interface EmotionKnowledgeNode extends KnowledgeNode {
  readonly kind:              "emotion";
  readonly displayName:       string;
  readonly visualSignals:     string[];
  readonly opposingEmotion?:  string;
}

/** A psychological trigger that moves audiences to action. */
export interface PsychologyKnowledgeNode extends KnowledgeNode {
  readonly kind:               "psychology";
  readonly mechanism:          string;
  readonly visualExpression:   string;
  readonly conversionFunction: string;
}

/** A visual composition formula that organises elements in the frame. */
export interface CompositionKnowledgeNode extends KnowledgeNode {
  readonly kind:        "composition";
  readonly rule:        string;
  readonly description: string;
  readonly bestFor:     string[];
}

/** A specific hero moment — what the frame is literally about. */
export interface HeroMomentKnowledgeNode extends KnowledgeNode {
  readonly kind:            "hero_moment";
  readonly subject:         string;
  readonly heroType:        string;
  readonly industryIds:     SceneIndustry[];
  readonly campaignTypeIds: string[];
  readonly behaviourIds:    string[];
  /** Bridge to existing HERO_SUBJECTS key — set if migrated from Phase 8 hero-decision-engine. */
  readonly legacyHeroKey?:  string;
}

/** A named creative execution route — extended from Phase 8.6 CreativeRoute. */
export interface RouteKnowledgeNode extends KnowledgeNode {
  readonly kind:          "route";
  readonly displayName:   string;
  readonly hero:          string;
  readonly composition:   string;
  readonly photography:   string;
  readonly layout:        string;
  readonly marketing:     string;
  readonly emotion:       string;
  readonly industryIds:   SceneIndustry[];
  readonly bestFor:       string[];
  readonly notFor:        string[];
  /** Bridge to Phase 8.6 CreativeRoute.id — set for migrated routes. */
  readonly legacyRouteId: string;
}

/** A named visual formula with selection trigger. */
export interface PatternKnowledgeNode extends KnowledgeNode {
  readonly kind:        "pattern";
  readonly name:        string;
  readonly description: string;
  readonly trigger:     string;
  readonly industryIds: SceneIndustry[];
}

/** A campaign type definition — what this campaign is trying to do. */
export interface CampaignTypeKnowledgeNode extends KnowledgeNode {
  readonly kind:            "campaign_type";
  readonly displayName:     string;
  readonly industryIds:     SceneIndustry[];
  readonly primaryGoal:     CampaignGoal;
  readonly secondaryGoals:  CampaignGoal[];
  readonly heroMomentIds:   string[];
  readonly archetypeIds:    string[];
}

/** Mapping from intent or goal signal → ExperienceType. */
export interface ExperienceMapKnowledgeNode extends KnowledgeNode {
  readonly kind:        "experience_map";
  readonly triggerType: "intent" | "goal" | "industry_secondary";
  readonly triggerKey:  string;
  readonly primary:     string;
  readonly secondary:   string | "none";
}

/** A validation rule — a constraint that generated output must satisfy. */
export interface ValidationRuleKnowledgeNode extends KnowledgeNode {
  readonly kind:        "validation_rule";
  readonly rule:        string;
  readonly severity:    "error" | "warning";
  readonly industryIds: SceneIndustry[] | "all";
  readonly goalIds:     CampaignGoal[] | "all";
}

/** A physical environment or setting in which a scene takes place. */
export interface SceneTypeKnowledgeNode extends KnowledgeNode {
  readonly kind:                "scene_type";
  /** Plain-language description of the physical space. */
  readonly environment:         string;
  /** Quality, colour temperature and character of the dominant light source. */
  readonly lightingCharacter:   string;
  /** The atmospheric and emotional quality of the space. */
  readonly mood:                string;
  readonly industryIds:         SceneIndustry[];
  readonly compatibleHeroTypes: string[];
}

/** A specific, industry-situated peak emotional moment — what the camera captures. */
export interface EmotionalMomentKnowledgeNode extends KnowledgeNode {
  readonly kind:          "emotional_moment";
  /** One sentence — what is physically happening at this emotional peak. */
  readonly moment:        string;
  /** The primary emotion being expressed or experienced. */
  readonly emotionType:   string;
  /** Physically observable visual signals of the emotion. */
  readonly visualSignals: string[];
  readonly industryIds:   SceneIndustry[];
}

/** A specific business/commercial transaction or interaction moment. */
export interface CommercialSituationKnowledgeNode extends KnowledgeNode {
  readonly kind:                    "commercial_situation";
  /** What is happening in the scene — the commercial interaction. */
  readonly situation:               string;
  /** The exact moment commercial conversion happens or is offered. */
  readonly conversionMoment:        string;
  /** What the camera would literally show at this moment. */
  readonly visualRepresentation:    string;
  readonly industryIds:             SceneIndustry[];
}
