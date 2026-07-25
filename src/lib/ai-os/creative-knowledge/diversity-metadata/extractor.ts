// Phase 10.4 — Diversity Metadata extractor.
// computeFingerprint() and checkDiversity() are fully implemented — they are
// pure functions with no external dependencies.
// buildEmptyDiversityMetadata() is a stub; future phases replace it with
// real extraction from ScenePlan, LayoutPlan, and CampaignDirection.
//
// Extraction plan:
//   Phase 10.4B: heroId / sceneId from Knowledge Graph once graph is populated
//   Phase 10.4C: layoutId from VisualLayoutPlan.layoutFamilyId (when added)
//   Phase 10.4D: cameraId / compositionId from ScenePlan (when scene planner exposes IDs)

import type { DiversityMetadata, DiversityCheckResult } from "./types";
import type { HeroMomentId, SceneTypeId, ArchetypeId } from "../types";

// ── Fingerprint ───────────────────────────────────────────────────────────────

const NONE = "none";

/**
 * Compute a stable diversity fingerprint from the four most discriminating
 * dimensions. Pure function — no side effects.
 *
 * Empty strings are normalised to the literal "none" so fingerprints are
 * always comparable even before the Knowledge Graph is populated.
 */
export function computeFingerprint(
  heroId:      HeroMomentId,
  sceneId:     SceneTypeId,
  archetypeId: ArchetypeId,
  layoutId:    string,
): string {
  return [
    heroId      || NONE,
    sceneId     || NONE,
    archetypeId || NONE,
    layoutId    || NONE,
  ].join("|");
}

// ── Diversity check ───────────────────────────────────────────────────────────

/**
 * Check whether a fingerprint is an exact duplicate of any recent generation.
 * Phase 10.4 uses exact match only; future phases extend to semantic similarity.
 */
export function checkDiversity(
  fingerprint:        string,
  recentFingerprints: string[],
): DiversityCheckResult {
  const isDuplicate = recentFingerprints.includes(fingerprint);
  return {
    isDuplicate,
    maxSimilarity:      isDuplicate ? 1.0 : 0.0,
    mostSimilarEntryId: undefined,
  };
}

// ── Extractor stub ────────────────────────────────────────────────────────────

/**
 * Build a DiversityMetadata object with empty / unknown IDs.
 * Attach this to RouteCandidate and CreativeMemoryEntry in Phase 10.4
 * so downstream consumers have a typed slot ready to receive real IDs.
 *
 * layoutId and cameraId are accepted as optional arguments because they
 * can sometimes be derived from existing pipeline outputs even in Phase 10.4.
 */
export function buildEmptyDiversityMetadata(
  layoutId = "",
  cameraId = "",
  lightingId = "",
): DiversityMetadata {
  const heroId      = "";
  const sceneId     = "";
  const archetypeId = "";
  return {
    heroId,
    archetypeId,
    sceneId,
    behaviourIds:    [],
    relationshipIds: [],
    layoutId,
    cameraId,
    lightingId,
    compositionId:   "",
    fingerprint:     computeFingerprint(heroId, sceneId, archetypeId, layoutId),
  };
}
