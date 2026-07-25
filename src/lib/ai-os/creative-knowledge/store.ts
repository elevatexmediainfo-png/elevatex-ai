// Phase 10.4.0 — KnowledgeStore query interface.
// The ONLY contract between creative-engine/ and creative-knowledge/.
// Engines depend on this interface; never on concrete implementations or data files.
//
// Implementation delivery schedule:
//   Phase 10.4.1 — InMemoryKnowledgeStore (module-load registration)
//   Phase 10.4.2 — CachedKnowledgeStore (add LRU caching layer)
//   Phase 10.4.5 — DbKnowledgeStore (Prisma-backed, for user-specific knowledge)
// Engines require zero changes across all implementation upgrades.

import type { ConfidenceLevel, CampaignGoal } from "./types";
import type { KnowledgeNode, KnowledgeNodeKind } from "./node";
import type { SceneIndustry } from "../prompt-spec/scene-builder";

// ── Query filter ──────────────────────────────────────────────────────────────

export interface KnowledgeFilter {
  /** Filter by one or more node kinds (OR between multiple). */
  kind?:          KnowledgeNodeKind | KnowledgeNodeKind[];
  /** Filter by industry — matches nodes where industryIds includes this value, or "all". */
  industry?:      SceneIndustry;
  /** Tag OR filter — returns nodes that have ANY of the listed tags. */
  anyTags?:       string[];
  /** Tag AND filter — returns nodes that have ALL of the listed tags. */
  allTags?:       string[];
  /** Returns only nodes where priority <= maxPriority. Lower number = higher priority. */
  maxPriority?:   number;
  /** Returns only nodes where weight >= minWeight. */
  minWeight?:     number;
  /** Returns only nodes meeting this confidence level or above (high > medium > low). */
  minConfidence?: ConfidenceLevel;
  /** Returns only nodes whose goalIds includes this campaign goal, or "all". */
  campaignGoal?:  CampaignGoal;
  /** Caps the result set. Applied after sorting. */
  limit?:         number;
  /** Sort dimension — defaults to "priority" ascending (1 first). */
  sortBy?:        "priority" | "weight" | "commercialScore";
}

// ── Store interface ───────────────────────────────────────────────────────────

/**
 * The single query contract between creative-engine/ and creative-knowledge/.
 *
 * Engines depend only on this interface — they are never imported knowledge files.
 * This makes every engine trivially testable: inject a 3-node mock store.
 *
 * Registration happens at module load time. Each knowledge file calls
 * store.registerAll([...nodes]) when the InMemoryKnowledgeStore is imported.
 * The engine receives the store via dependency injection from the pipeline.
 */
export interface KnowledgeStore {
  /**
   * Query the store. Returns a read-only snapshot matching the filter,
   * sorted by the sortBy field. Returns an empty array when nothing matches.
   * Never throws.
   */
  query(filter: KnowledgeFilter): readonly KnowledgeNode[];

  /**
   * Retrieve a single node by its stable ID.
   * Returns undefined if the ID is unknown or not yet registered.
   */
  getById(id: string): KnowledgeNode | undefined;

  /**
   * Register a node at load time. Throws if a duplicate id is registered
   * so curation errors surface immediately (fail-fast).
   */
  register(node: KnowledgeNode): void;

  /**
   * Register multiple nodes in one call. Convenience wrapper over register().
   * Throws on the first duplicate id found.
   */
  registerAll(nodes: readonly KnowledgeNode[]): void;

  /** Total count of registered nodes across all kinds. */
  size(): number;
}
