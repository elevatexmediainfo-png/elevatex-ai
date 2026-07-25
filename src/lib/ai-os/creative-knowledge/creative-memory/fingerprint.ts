// Phase 10.4D — Creative Memory Platform: full generation fingerprint.
//
// MemoryFingerprint is the COMPLETE identity of one generated creative.
// It carries every ID needed for similarity search, pattern extraction,
// and route recommendation. It supersedes DiversityMetadata for the
// memory system — DiversityMetadata is retained for backward compat in
// RouteCandidate and CreativeMemoryEntry.
//
// Key difference vs. DiversityMetadata:
//   DiversityMetadata — 10 fields, singular archetypeId, no routeId, no psychologyIds
//   MemoryFingerprint  — 13 fields, plural archetypeIds[], explicit routeId, psychologyIds[]
//
// Hash format: pipe-delimited canonical string of all resolved IDs.
// Hash is stable — same generation always produces the same hash.
// "none" is the canonical placeholder for any missing / empty ID.

import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { MaterialTier }  from "../../prompt-spec/material-engine";
import type { CampaignGoal }  from "../types";

// ── MemoryFingerprint ─────────────────────────────────────────────────────────

/**
 * Complete identity fingerprint for one generated creative.
 *
 * Every field is a knowledge-graph ID, a pipeline subsystem ID, or a
 * creative-context discriminator. Together they uniquely identify the
 * combination of creative choices made in one generation.
 *
 * Population schedule:
 *   Phase 10.4D: all fields present as empty string / empty array (architecture).
 *   Phase 10.4E: heroId + sceneId filled from knowledge graph.
 *   Phase 10.4F: behaviourIds + relationshipIds filled from scene plan.
 *   Phase 10.4G: layoutId + cameraId + lightingId + compositionId from pipeline.
 *   Phase 10.5A: archetypeIds + psychologyIds from archetype registry.
 */
export interface MemoryFingerprint {
  // ── Knowledge Graph IDs ─────────────────────────────────────────────────────

  /** Hero moment ID from the industry knowledge graph. Populated from Phase 10.4I. */
  readonly heroId:           string;
  /** Scene type ID from the industry knowledge graph. Populated from Phase 10.4I. */
  readonly sceneId:          string;
  /** Hero emotion category — equals heroCategory from HeroKnowledgeGraphMeta. Populated from Phase 10.4I. */
  readonly emotionId:        string;
  /** Scene environment category — equals sceneCategory from HeroKnowledgeGraphMeta. Populated from Phase 10.4I. */
  readonly environmentId:    string;
  /** All human behaviour IDs present in this generation. Empty until Phase 10.4F. */
  readonly behaviourIds:     string[];
  /** Relationship type IDs between people in the scene. Empty until Phase 10.4F. */
  readonly relationshipIds:  string[];

  // ── Pipeline subsystem IDs ──────────────────────────────────────────────────

  /** Visual layout family ID from the visual-layout engine. Empty until Phase 10.4G. */
  readonly layoutId:         string;
  /** Camera configuration ID from the scene planner. Empty until Phase 10.4G. */
  readonly cameraId:         string;
  /** Lighting setup ID from the realism engine. Empty until Phase 10.4G. */
  readonly lightingId:       string;
  /** Composition pattern ID from the scene planner. Empty until Phase 10.4G. */
  readonly compositionId:    string;

  // ── Route and archetype IDs ─────────────────────────────────────────────────

  /** Phase 8.6 creative route ID that was selected. */
  readonly routeId:          string;
  /**
   * All archetype IDs that fired in this generation.
   * Primary archetype first. May include secondary.
   * Empty until Phase 10.5A.
   */
  readonly archetypeIds:     string[];
  /**
   * Psychological mechanism IDs that are active in this generation.
   * Derived from the selected archetype's psychologicalPurpose.
   * Empty until Phase 10.5A.
   */
  readonly psychologyIds:    string[];

  // ── Creative context discriminators ────────────────────────────────────────

  /** Industry — high-weight discriminator in similarity scoring. */
  readonly industryId:       SceneIndustry;
  /** Campaign goal — shapes commercial similarity weighting. */
  readonly campaignGoal:     CampaignGoal;
  /** Material / luxury tier — shapes audience and style similarity. */
  readonly luxuryTier:       MaterialTier;

  // ── Hash ────────────────────────────────────────────────────────────────────

  /**
   * Stable pipe-delimited hash of all discriminating IDs.
   * Format: "{heroId}|{sceneId}|{routeId}|{archetypeIds[0]}|{layoutId}|{industryId}"
   * Empty segments use the literal "none".
   *
   * Designed to be fast to compute and compare (string equality).
   * For richer similarity scoring use SimilarityVector (similarity.ts).
   */
  readonly hash:             string;
}

// ── Hash computation ───────────────────────────────────────────────────────────

const NONE = "none";

function orNone(v: string): string {
  return v || NONE;
}

/**
 * Compute the stable hash string for a MemoryFingerprint.
 * The 6-segment format captures the highest-weight discriminators only,
 * keeping the hash short and fast to compare.
 *
 * Full similarity scoring (all 13 fields) happens in similarity.ts via
 * SimilarityVector — this hash is for fast exact-match deduplication.
 */
export function computeHash(
  heroId:       string,
  sceneId:      string,
  routeId:      string,
  archetypeId0: string, // first archetype ID only
  layoutId:     string,
  industryId:   SceneIndustry,
): string {
  return [
    orNone(heroId),
    orNone(sceneId),
    orNone(routeId),
    orNone(archetypeId0),
    orNone(layoutId),
    industryId,
  ].join("|");
}

/**
 * Build a MemoryFingerprint from all individual IDs.
 * This is the canonical constructor — call it once per generation.
 */
export function buildFingerprint(fields: Omit<MemoryFingerprint, "hash">): MemoryFingerprint {
  const hash = computeHash(
    fields.heroId,
    fields.sceneId,
    fields.routeId,
    fields.archetypeIds[0] ?? "",
    fields.layoutId,
    fields.industryId,
  );
  return { ...fields, hash };
}

/**
 * Build a fingerprint where all optional IDs are empty.
 * Use for backward-compat paths where heroGraph is not yet available.
 */
export function buildEmptyFingerprint(
  industryId:   SceneIndustry,
  campaignGoal: CampaignGoal,
  luxuryTier:   MaterialTier,
  routeId = "",
): MemoryFingerprint {
  return buildFingerprint({
    heroId:          "",
    sceneId:         "",
    emotionId:       "",
    environmentId:   "",
    behaviourIds:    [],
    relationshipIds: [],
    layoutId:        "",
    cameraId:        "",
    lightingId:      "",
    compositionId:   "",
    routeId,
    archetypeIds:    [],
    psychologyIds:   [],
    industryId,
    campaignGoal,
    luxuryTier,
  });
}

// ── Fingerprint equality ───────────────────────────────────────────────────────

/** Exact match — same hash = identical generation. */
export function fingerprintsAreIdentical(a: MemoryFingerprint, b: MemoryFingerprint): boolean {
  return a.hash === b.hash;
}

/**
 * Check whether two fingerprints share the same industry + routeId.
 * A weaker match — same route in the same industry, different hero/scene.
 */
export function sameRouteAndIndustry(a: MemoryFingerprint, b: MemoryFingerprint): boolean {
  return a.routeId !== "" && a.routeId === b.routeId && a.industryId === b.industryId;
}
