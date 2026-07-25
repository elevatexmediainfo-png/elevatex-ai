// Phase 10.4 — Universal Archetype Registry types.
// ⚠ SUPERSEDED by Phase 10.4A — creative-knowledge/universal/archetypes/types.ts
// This file is retained for backward compatibility only.
// New code should import UniversalArchetype from universal/archetypes/index.ts.
//
// An Archetype is the universal creative grammar above industry routes.
// Each Phase 8.6 CreativeRoute instantiates one Archetype.
// Future phases tag each ROUTE_REGISTRY entry with an archetypeId.

import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { ArchetypeId, CampaignGoal, ConfidenceLevel } from "../types";

// ── Category ────────────────────────────────────────────────────────────────

/**
 * The universal creative pattern this archetype represents.
 * Derived from analysis of Phase 8.6 route-registry.ts — every route
 * maps to one of these categories.
 *
 * Examples of existing routes by category:
 *   arrival         → food_dish_hero (dish at peak visual state)
 *   threshold       → food_grand_opening_event (founder at entrance)
 *   private_moment  → jewelry_private_moment (bride before calling family)
 *   social_proof    → food_celebration_lifestyle (table they remember)
 *   craft_precision → food_chef_hero (final garnish placement)
 *   abundance       → food_delivery_family (everyone reaching in)
 *   contrast        → realestate_ownership_moment (future owner in empty space)
 *   aspiration      → auto_ownership_morning (keys in hand at showroom)
 *   ritual          → beauty_self_care_ritual (morning that belongs to her)
 *   discovery       → dental_patient_discovery (smile in mirror)
 *   transformation  → fitness_transformation_real (real member at milestone)
 *   authority       → beauty_stylist_watching (stylist watching the result)
 *   belonging       → food_open_kitchen (kitchen brigade visible)
 */
export type ArchetypeCategory =
  | "arrival"          // Receiving or first experiencing something
  | "threshold"        // Standing at the boundary between before and after
  | "private_moment"   // Intimate personal moment before sharing
  | "social_proof"     // Humans validating a product or place together
  | "craft_precision"  // Expert hands doing something with visible skill
  | "abundance"        // Plenty, variety, fullness — collective satisfaction
  | "contrast"         // Empty space, future state, implied comparison
  | "aspiration"       // Desired future state made visually present
  | "ritual"           // Repeated, habitual, personally owned routine
  | "discovery"        // Recognising something new in yourself or the world
  | "transformation"   // Visible change — the journey, not just the result
  | "authority"        // Expert in their domain, competence legible at a glance
  | "belonging";       // Warm human connection, community, shared experience

// ── Purpose ─────────────────────────────────────────────────────────────────

/**
 * The primary commercial objective served by this archetype.
 * One archetype can serve multiple purposes.
 */
export type CommercialPurpose =
  | "generate_desire"    // Make the viewer want to experience this
  | "build_trust"        // Make the viewer trust this brand or person
  | "drive_action"       // Trigger an immediate conversion behaviour
  | "establish_identity" // Position the brand as a specific kind of entity
  | "demonstrate_value"  // Show concretely what the product/service delivers
  | "create_belonging"   // Make the viewer want to be part of this group
  | "signal_quality"     // Communicate premium through craft and specificity
  | "trigger_nostalgia"; // Activate a remembered emotional state

/**
 * The primary psychological lever activated in the viewer.
 * Viewer-psychology-focused (complements ExperienceType from experience-engine.ts,
 * which is campaign-design-focused).
 */
export type EmotionalPurpose =
  | "desire"      // "I want this"
  | "trust"       // "I trust this"
  | "pride"       // "I am the kind of person who chooses this"
  | "belonging"   // "I want to be in this room / family / group"
  | "nostalgia"   // "This is the feeling I remember"
  | "excitement"  // "I want to be there when this happens"
  | "calm"        // "This is safe and considered"
  | "aspiration"; // "I want to become the person in this image"

// ── Archetype interface ──────────────────────────────────────────────────────

/**
 * One entry in the Universal Archetype Registry.
 * Archetypes are industry-agnostic. Specific campaigns instantiate them.
 * Future phases populate the registry; this interface defines the contract.
 */
export interface UniversalArchetype {
  /** Stable screaming-snake-case ID. Example: "THE_CRAFTSMAN". */
  id:                   ArchetypeId;
  category:             ArchetypeCategory;
  name:                 string;
  /** One sentence: what this archetype IS, not how to execute it. */
  description:          string;
  commercialPurposes:   CommercialPurpose[];
  emotionalPurposes:    EmotionalPurpose[];
  /**
   * Which industries this archetype fires well in.
   * "all" = no industry restriction.
   */
  compatibleIndustries: SceneIndustry[] | "all";
  compatibleGoals:      CampaignGoal[];
  /** How reliably this archetype converts when conditions are met. */
  confidence:           ConfidenceLevel;
  /**
   * Default priority when multiple archetypes compete (1 = highest).
   * Tie-broken by signal strength from Route Engine.
   */
  priority:             number;
  /**
   * Reserved 0.0–1.0 weight for future ML-based scoring.
   * Not read or written by routing logic until Phase 10.4F.
   */
  readonly futureWeight: number;
}

/**
 * Per-industry affinity boost for a specific archetype.
 * Stored on IndustryNode in the Knowledge Graph.
 * Adds to the archetype's base score for that industry during route evaluation.
 */
export interface ArchetypeAffinity {
  archetypeId:   ArchetypeId;
  /** Additive score boost 0–20 on top of the archetype's base confidence. */
  affinityScore: number;
}
