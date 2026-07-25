// Phase 10.4 — Diversity Metadata types.
// Every generated creative exposes these IDs so future engines can
// avoid repetitive hero + scene + behaviour combinations across generations.
//
// Integration: DiversityMetadata is attached to:
//   - RouteCandidate.diversity (before generation)
//   - CreativeMemoryEntry.diversity (after generation)
//   - Future: UniversalCampaignBlueprint.diversity (optional extension slot)

import type {
  HeroMomentId,
  SceneTypeId,
  HumanBehaviourId,
  RelationshipId,
  ArchetypeId,
} from "../types";

/**
 * Full diversity metadata for one generated creative.
 * IDs reference Knowledge Graph nodes; layout/camera/lighting/composition IDs
 * reference existing pipeline subsystems (visual-layout, scene-planner, realism-engine).
 *
 * Until the Knowledge Graph is populated (Phase 10.4B), heroId / sceneId /
 * archetypeId will be empty strings and fingerprints will be non-discriminating.
 * That is by design — diversity checking degrades gracefully.
 */
export interface DiversityMetadata {
  /** Hero moment from Knowledge Graph — matches HeroMomentNode.id. */
  heroId:          HeroMomentId;
  /** Archetype from Archetype Registry — matches UniversalArchetype.id. */
  archetypeId:     ArchetypeId;
  /** Scene type from Knowledge Graph — matches SceneTypeNode.id. */
  sceneId:         SceneTypeId;
  /** All human behaviour IDs present in this generation. */
  behaviourIds:    HumanBehaviourId[];
  /** Relationship types between people in this generation. */
  relationshipIds: RelationshipId[];
  /**
   * Layout family ID from visual-layout engine.
   * Matches VisualLayoutPlan identifiers when populated.
   */
  layoutId:        string;
  /**
   * Camera configuration ID from scene-planner/builders/camera.ts.
   * Populated when scene planner exposes a stable camera ID.
   */
  cameraId:        string;
  /**
   * Lighting configuration from realism-engine.ts physics note key.
   * Matches SceneIndustry values for the physics note that was applied.
   */
  lightingId:      string;
  /**
   * Composition pattern ID from scene-planner/builders/composition.ts.
   * Populated when composition builder exposes a stable pattern ID.
   */
  compositionId:   string;
  /**
   * Stable fingerprint for fast similarity detection.
   * Computed by computeFingerprint() in extractor.ts.
   * Format: "{heroId}|{sceneId}|{archetypeId}|{layoutId}"
   * Empty segment positions use "none" as a literal placeholder.
   */
  fingerprint:     string;
}

/**
 * Result of checking a fingerprint against recent generation history.
 */
export interface DiversityCheckResult {
  isDuplicate:          boolean;
  /** Similarity 0.0–1.0 against the most similar recent generation. */
  maxSimilarity:        number;
  /** Entry ID of the most similar previous generation, if any. */
  mostSimilarEntryId?:  string;
}
