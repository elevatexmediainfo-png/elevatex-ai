// Phase 10.4A — Universal Archetype Platform registry.
// Scalable: Map-based O(1) id lookup + pre-built category/industry/campaign indexes.
// Designed for 100–10,000 archetypes without performance degradation.
//
// Architecture:
//   Primary store: Map<id, UniversalArchetype>
//   Category index: Map<ArchetypeCategory, UniversalArchetype[]>
//   Industry index: Map<SceneIndustry | "all", UniversalArchetype[]>
//   Campaign index: Map<CampaignGoal, UniversalArchetype[]>
//   Stage index:    Map<BuyerStage, UniversalArchetype[]>
//
// All indexes are built at register time — queries are O(1) or O(k) where
// k is the result set size, never O(n) over the full registry.
//
// Population: Phase 10.4.1+. Registry is empty in Phase 10.4A.

import type { SceneIndustry } from "../../../prompt-spec/scene-builder";
import type { CampaignGoal } from "../../types";
import type {
  UniversalArchetype,
  ArchetypeCategory,
  ArchetypeFilter,
  BuyerStage,
  IncomeGroup,
  PsychologicalMechanism,
  CommercialIntent,
} from "./types";

// ── Internal data structures ───────────────────────────────────────────────────

const _byId       = new Map<string, UniversalArchetype>();
const _byCategory = new Map<ArchetypeCategory, UniversalArchetype[]>();
const _byIndustry = new Map<string, UniversalArchetype[]>(); // SceneIndustry | "all"
const _byCampaign = new Map<CampaignGoal, UniversalArchetype[]>();
const _byStage    = new Map<BuyerStage, UniversalArchetype[]>();

// ── Registration ───────────────────────────────────────────────────────────────

/**
 * Register a single archetype. Throws on duplicate id — strict mode prevents
 * silent overwrites that would corrupt the registry.
 *
 * Called at module load time by each knowledge file. Do NOT call at
 * request time — registration is a one-time module-initialisation operation.
 */
export function register(archetype: UniversalArchetype): void {
  if (_byId.has(archetype.id)) {
    throw new Error(
      `ArchetypeRegistry: duplicate id "${archetype.id}". Each archetype must have a unique id.`,
    );
  }

  _byId.set(archetype.id, archetype);

  // Category index
  const catList = _byCategory.get(archetype.category) ?? [];
  catList.push(archetype);
  _byCategory.set(archetype.category, catList);

  // Industry index — entry under every declared industry + under "all"
  const industries =
    archetype.compatibleIndustries === "all"
      ? ["all" as const]
      : archetype.compatibleIndustries;
  for (const industry of industries) {
    const indList = _byIndustry.get(industry) ?? [];
    indList.push(archetype);
    _byIndustry.set(industry, indList);
  }

  // Campaign index
  for (const goal of archetype.compatibleCampaigns) {
    const goalList = _byCampaign.get(goal) ?? [];
    goalList.push(archetype);
    _byCampaign.set(goal, goalList);
  }

  // Buyer stage index
  for (const stage of archetype.compatibleAudience.buyerStages) {
    const stageList = _byStage.get(stage) ?? [];
    stageList.push(archetype);
    _byStage.set(stage, stageList);
  }
}

/**
 * Register multiple archetypes. Convenience wrapper over register().
 * Registration order does not affect query results — sorting is applied at query time.
 */
export function registerAll(archetypes: readonly UniversalArchetype[]): void {
  for (const archetype of archetypes) {
    register(archetype);
  }
}

// ── Point lookups ──────────────────────────────────────────────────────────────

/** O(1) — retrieve a single archetype by its stable id. */
export function getById(id: string): UniversalArchetype | undefined {
  return _byId.get(id);
}

// ── Indexed queries ────────────────────────────────────────────────────────────

/**
 * All archetypes in a category, sorted by priority ascending (1 first).
 * O(k) where k = archetypes in this category.
 */
export function getByCategory(category: ArchetypeCategory): UniversalArchetype[] {
  return (_byCategory.get(category) ?? [])
    .slice()
    .sort((a, b) => a.priority - b.priority);
}

/**
 * All archetypes compatible with an industry, sorted by priority.
 * Returns archetypes explicitly tagged with this industry PLUS those tagged "all".
 * O(k) where k = results for this industry + results for "all".
 */
export function getForIndustry(industry: SceneIndustry): UniversalArchetype[] {
  const specific = _byIndustry.get(industry) ?? [];
  const universal = _byIndustry.get("all") ?? [];
  return [...specific, ...universal]
    .filter((a, i, arr) => arr.indexOf(a) === i) // deduplicate
    .sort((a, b) => a.priority - b.priority);
}

/**
 * All archetypes compatible with a campaign goal, sorted by priority.
 */
export function getForCampaign(goal: CampaignGoal): UniversalArchetype[] {
  return (_byCampaign.get(goal) ?? [])
    .slice()
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Archetypes compatible with BOTH industry AND campaign goal.
 * The primary lookup used by the Archetype Selector engine.
 * Results sorted by commercialScore descending (highest commercial value first).
 */
export function getForContext(
  industry:     SceneIndustry,
  campaignGoal: CampaignGoal,
): UniversalArchetype[] {
  const industrySet = new Set(getForIndustry(industry).map(a => a.id));
  return getForCampaign(campaignGoal)
    .filter(a => industrySet.has(a.id))
    .sort((a, b) => b.commercialScore - a.commercialScore);
}

/**
 * Archetypes that match a buyer journey stage.
 * Used when the pipeline has a strong audience stage signal.
 */
export function getForBuyerStage(stage: BuyerStage): UniversalArchetype[] {
  return (_byStage.get(stage) ?? [])
    .slice()
    .sort((a, b) => a.priority - b.priority);
}

// ── Composite filter query ─────────────────────────────────────────────────────

/**
 * Multi-dimensional filter with optional text search.
 * Filters are applied in order of selectivity (most selective first).
 * Text search scans name + description + tags (case-insensitive, partial match).
 *
 * Use this for:
 *   - Advanced archetype discovery in admin tools
 *   - Future semantic search (Phase 10.5)
 *   - Engine-side fallback when no strong signal is available
 */
export function query(filter: ArchetypeFilter): UniversalArchetype[] {
  let results: UniversalArchetype[];

  // Start with the most selective index available
  if (filter.industry && filter.campaign) {
    results = getForContext(filter.industry, filter.campaign);
  } else if (filter.industry) {
    results = getForIndustry(filter.industry);
  } else if (filter.campaign) {
    results = getForCampaign(filter.campaign);
  } else if (filter.category) {
    const categories = Array.isArray(filter.category) ? filter.category : [filter.category];
    results = categories.flatMap(c => getByCategory(c));
  } else {
    results = [..._byId.values()];
  }

  // Apply remaining filters
  if (filter.category && !(filter.industry || filter.campaign)) {
    // already filtered above
  } else if (filter.category) {
    const categories = Array.isArray(filter.category) ? filter.category : [filter.category];
    const catSet = new Set(categories);
    results = results.filter(a => catSet.has(a.category));
  }

  if (filter.buyerStage) {
    const stageSet = _byStage.get(filter.buyerStage);
    if (stageSet) {
      const stageIds = new Set(stageSet.map(a => a.id));
      results = results.filter(a => stageIds.has(a.id));
    }
  }

  if (filter.incomeGroup && filter.incomeGroup !== "all") {
    results = results.filter(
      a =>
        a.compatibleAudience.universal ||
        a.compatibleAudience.incomeGroups.includes("all") ||
        a.compatibleAudience.incomeGroups.includes(filter.incomeGroup as IncomeGroup),
    );
  }

  if (filter.mechanism) {
    results = results.filter(
      a => a.psychologicalPurpose.mechanism === filter.mechanism,
    );
  }

  if (filter.intent) {
    results = results.filter(
      a =>
        a.commercialPurpose.primaryIntent === filter.intent ||
        a.commercialPurpose.secondaryIntent === filter.intent,
    );
  }

  if (filter.search) {
    const q = filter.search.toLowerCase();
    results = results.filter(
      a =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q)),
    );
  }

  // Sort
  const sortBy = filter.sortBy ?? "priority";
  results = results.sort((a, b) => {
    if (sortBy === "priority")       return a.priority - b.priority;
    if (sortBy === "weight")         return b.weight - a.weight;
    if (sortBy === "commercialScore") return b.commercialScore - a.commercialScore;
    return 0;
  });

  // Deduplicate (multiple index paths may yield the same archetype)
  const seen = new Set<string>();
  results = results.filter(a => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  return filter.limit ? results.slice(0, filter.limit) : results;
}

// ── Introspection ──────────────────────────────────────────────────────────────

/** Total number of registered archetypes. */
export function size(): number {
  return _byId.size;
}

/** All registered categories that have at least one archetype. */
export function categories(): ArchetypeCategory[] {
  return [..._byCategory.keys()];
}

/** Distribution of archetypes by category — useful for coverage audits. */
export function coverageReport(): Record<string, number> {
  const report: Record<string, number> = {};
  for (const [cat, list] of _byCategory) {
    report[cat] = list.length;
  }
  return report;
}
