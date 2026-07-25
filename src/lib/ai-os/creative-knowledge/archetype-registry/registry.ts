// Phase 10.4 — Universal Archetype Registry API.
// The registry is intentionally empty — future phases populate _REGISTRY.
// All callers must use the typed API below; never reach into _REGISTRY directly.
//
// Population plan:
//   Phase 10.4B: First 12 archetypes derived from ROUTE_REGISTRY analysis
//   Phase 10.4C+: Remaining archetypes as Knowledge Graph is populated

import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { UniversalArchetype } from "./types";
import type { ArchetypeId, CampaignGoal } from "../types";

// ── Data ─────────────────────────────────────────────────────────────────────
// Future phases add entries here. Each entry must fully satisfy UniversalArchetype.

const _REGISTRY: Record<ArchetypeId, UniversalArchetype> = {};

// ── Public API ────────────────────────────────────────────────────────────────

/** Look up a single archetype by ID. Returns undefined if not yet registered. */
export function getArchetypeById(id: ArchetypeId): UniversalArchetype | undefined {
  return _REGISTRY[id];
}

/**
 * All archetypes compatible with an industry, sorted by priority ascending.
 * Returns archetypes tagged "all" plus those explicitly listing the industry.
 */
export function getArchetypesByIndustry(industry: SceneIndustry): UniversalArchetype[] {
  return Object.values(_REGISTRY)
    .filter(a =>
      a.compatibleIndustries === "all" ||
      (a.compatibleIndustries as SceneIndustry[]).includes(industry),
    )
    .sort((a, b) => a.priority - b.priority);
}

/** All archetypes compatible with a campaign goal. */
export function getArchetypesByGoal(goal: CampaignGoal): UniversalArchetype[] {
  return Object.values(_REGISTRY).filter(a => a.compatibleGoals.includes(goal));
}

/**
 * Archetypes compatible with BOTH industry AND goal — the primary lookup
 * for route selection decisions.
 */
export function getArchetypesForContext(
  industry: SceneIndustry,
  goal:     CampaignGoal,
): UniversalArchetype[] {
  return getArchetypesByIndustry(industry).filter(a => a.compatibleGoals.includes(goal));
}

/** Total number of registered archetypes (for tests and telemetry). */
export function registrySize(): number {
  return Object.keys(_REGISTRY).length;
}
