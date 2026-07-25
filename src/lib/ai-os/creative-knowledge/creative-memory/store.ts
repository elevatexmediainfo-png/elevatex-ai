// Phase 10.4D — Creative Memory Platform: MemoryStore interface.
//
// MemoryStore is the QUERY CONTRACT for the creative memory system.
// It is a pure TypeScript interface — no implementation, no database,
// no storage logic. Future phases implement it:
//
//   Phase 10.5A: InMemoryStore — array-backed, for unit tests and dev
//   Phase 10.5B: PrismaMemoryStore — production DB (Prisma + PostgreSQL)
//   Phase 10.5C: CachedMemoryStore — wraps PrismaMemoryStore + Redis cache
//
// Engines depend on the MemoryStore interface only.
// Engines never import PrismaMemoryStore or any DB client.
// Dependency injection: the engine receives a MemoryStore at instantiation.
//
// Relationship to existing code:
//   creative-memory/types.ts → CreativeMemoryEntry (the entry schema)
//   creative-memory/fingerprint.ts → MemoryFingerprint (similarity input)
//   creative-memory/pattern.ts → CreativePattern, PatternFilter
//   creative-memory/similarity.ts → SimilaritySearchQuery, SimilaritySearchResult
//   creative-memory/learning.ts → SuccessWeight, LearningSignal
//   creative-memory/store.ts → MemoryStore (this file — pure interface)

import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { CampaignGoal }  from "../types";
import type { CreativeMemoryEntry } from "./types";
import type { MemoryFingerprint }   from "./fingerprint";
import type { CreativePattern, PatternFilter } from "./pattern";
import type {
  SimilaritySearchQuery,
  SimilaritySearchResult,
} from "./similarity";
import type { SuccessWeight, LearningSignal, WeightedElementKind } from "./learning";

// ── MemoryFilter ──────────────────────────────────────────────────────────────

/** Filter for querying memory entries. All fields optional — AND logic. */
export interface MemoryFilter {
  /** Only return entries for this user. */
  userId?:          string;
  /** Only return entries for this industry. */
  industry?:        SceneIndustry;
  /** Only return entries for this campaign goal. */
  campaignGoal?:    CampaignGoal;
  /** Only return entries that used this route. */
  routeId?:         string;
  /** Only return entries that used this archetype. */
  archetypeId?:     string;
  /** Only return entries where isOnBrief = true. */
  onBriefOnly?:     boolean;
  /** Only return entries with user rating >= this value. */
  minUserRating?:   1 | 2 | 3 | 4 | 5;
  /** Only return entries created after this timestamp. */
  fromDate?:        Date;
  /** Only return entries created before this timestamp. */
  toDate?:          Date;
  /** Maximum entries to return. */
  limit?:           number;
  /** Sort by. Default: "date" descending. */
  sortBy?:          "date" | "rating" | "successScore";
}

// ── CommercialHistoryFilter ───────────────────────────────────────────────────

/** Filter for the commercial success history query. */
export interface CommercialHistoryFilter {
  /** Required: aggregate history for this user. */
  userId:        string;
  /** Required: aggregate history for this industry. */
  industry:      SceneIndustry;
  /** Optional: narrow to this campaign goal. */
  campaignGoal?: CampaignGoal;
  /** How many days of history to include. Default: 90. */
  lookbackDays?: number;
}

// ── CommercialSuccessHistory ──────────────────────────────────────────────────

/**
 * Aggregated commercial performance history for one user × industry.
 * Consumed by RouteEvaluationContext.commercialHistory in Phase 10.4C.
 *
 * This is a computed view — not stored directly — aggregated on demand
 * from individual CreativeMemoryEntry records.
 */
export interface CommercialSuccessHistory {
  /** User scope. */
  readonly userId:                string;
  /** Industry scope. */
  readonly industry:              SceneIndustry;

  /** Total generations in this history window. */
  readonly totalGenerations:      number;
  /** Generations where commercial review passed (isOnBrief = true). */
  readonly successfulGenerations: number;
  /** successfulGenerations / totalGenerations. Null when totalGenerations = 0. */
  readonly successRate:           number | null;

  /**
   * Route IDs sorted by success rate descending.
   * The top entries are candidates for a "proven route" boost.
   */
  readonly topRouteIds:           string[];
  /**
   * Archetype IDs sorted by success rate descending.
   * Used to seed commercialHistory.successfulArchetypeIds in the evaluation context.
   */
  readonly topArchetypeIds:       string[];

  /**
   * Route IDs with < 30% success rate across >= 3 entries.
   * Suppressed in route selection.
   */
  readonly underperformingRouteIds: string[];

  /** Mean user rating across all rated entries (1.0–5.0). Null when no ratings exist. */
  readonly averageUserRating:     number | null;

  /**
   * Performance trend based on the last 10 entries vs. the 10 before that.
   * "improving" = recent success rate > historical.
   * "declining" = recent < historical.
   * "stable"    = within ±5%.
   * "unknown"   = insufficient entries for comparison.
   */
  readonly recentTrend:           "improving" | "stable" | "declining" | "unknown";

  /** ISO 8601 timestamp of when this history was last computed. */
  readonly computedAt:            string;
}

// ── MemoryStore ───────────────────────────────────────────────────────────────

/**
 * The complete query contract for the Creative Memory system.
 *
 * This interface is the ONLY dependency that engines and the route
 * intelligence system take on memory storage. Implementations are
 * injected — never imported directly.
 *
 * All methods are async — even InMemoryStore returns Promises for
 * interface compatibility with DB-backed implementations.
 */
export interface MemoryStore {

  // ── Write ──────────────────────────────────────────────────────────────────

  /**
   * Save a new memory entry. Throws if entry.id already exists.
   * Phase 10.5B: maps to prisma.creativeMemoryEntry.create().
   */
  save(entry: CreativeMemoryEntry): Promise<void>;

  /**
   * Update an existing entry (add review or feedback post-generation).
   * Only fields review and feedback may be updated — immutable otherwise.
   * Throws if entry.id does not exist.
   */
  update(
    id:     string,
    patch:  { review?: CreativeMemoryEntry["review"]; feedback?: CreativeMemoryEntry["feedback"] },
  ): Promise<void>;

  // ── Read ───────────────────────────────────────────────────────────────────

  /**
   * Retrieve a single entry by its UUID.
   * Returns null when not found — never throws.
   */
  getById(id: string): Promise<CreativeMemoryEntry | null>;

  /**
   * Query entries matching the given filter.
   * Returns entries sorted by filter.sortBy (default: date descending).
   * Returns [] when no entries match — never throws.
   */
  query(filter: MemoryFilter): Promise<CreativeMemoryEntry[]>;

  /**
   * Return the N most recent entries for a user in a given industry.
   * Convenience shorthand for query({ userId, industry, limit: n, sortBy: "date" }).
   */
  getRecent(userId: string, industry: SceneIndustry, n?: number): Promise<CreativeMemoryEntry[]>;

  /**
   * Return recent fingerprints for a user in a given industry.
   * Used to build HistorySignal for the route engine.
   * Returns only the hash strings — lightweight, no full entry payload.
   */
  getRecentFingerprints(
    userId:   string,
    industry: SceneIndustry,
    n?:       number,
  ): Promise<string[]>;

  // ── Similarity search ──────────────────────────────────────────────────────

  /**
   * Compare a candidate fingerprint against recent memory entries
   * and return a similarity report with a route recommendation.
   *
   * This is the gate function before generation:
   *   1. Call searchSimilar() with the candidate fingerprint.
   *   2. If result.recommendation = "reject": select next candidate.
   *   3. If result.recommendation = "diversify": log and prefer an alternative.
   *   4. If result.recommendation = "proceed": continue.
   *
   * Phase 10.5A: InMemoryStore implements via compareFingerprints() loop.
   * Phase 10.5B: PrismaMemoryStore implements via DB query + compareFingerprints().
   * Phase 10.5F: Extended with embeddingVector cosine similarity.
   */
  searchSimilar(query: SimilaritySearchQuery): Promise<SimilaritySearchResult>;

  // ── Patterns ───────────────────────────────────────────────────────────────

  /**
   * Retrieve extracted creative patterns matching the given filter.
   * Returns [] when no patterns match — never throws.
   * Phase 10.5A: populated by the pattern extraction pipeline.
   */
  getPatterns(filter: PatternFilter): Promise<CreativePattern[]>;

  /**
   * Upsert a creative pattern.
   * Creates if patternId does not exist; updates if it does.
   * Called by the pattern evolution engine after each new entry.
   */
  upsertPattern(pattern: CreativePattern): Promise<void>;

  // ── Success weights ────────────────────────────────────────────────────────

  /**
   * Get current success weights for a specific element kind, optionally
   * scoped to an industry.
   *
   * Returns all weights where elementKind matches, sorted by weight descending.
   * Returns [] when no weights exist yet — never throws.
   *
   * Phase 10.5A: populated by the learning signal processor.
   */
  getSuccessWeights(
    elementKind: WeightedElementKind,
    industry?:   SceneIndustry,
  ): Promise<SuccessWeight[]>;

  /**
   * Get the success weight for a specific element by ID and kind.
   * Returns null when no weight data exists (treat as 1.0 = neutral).
   */
  getSuccessWeight(
    elementId:   string,
    elementKind: WeightedElementKind,
  ): Promise<SuccessWeight | null>;

  /**
   * Upsert a success weight after processing a learning signal.
   * Called by the learning signal processor.
   */
  upsertSuccessWeight(weight: SuccessWeight): Promise<void>;

  // ── Learning signals ───────────────────────────────────────────────────────

  /**
   * Save a learning signal extracted from a completed entry.
   * Called once per entry, after commercial review or user feedback is added.
   */
  saveLearningSignal(signal: LearningSignal): Promise<void>;

  /**
   * Get pending learning signals (not yet processed into weights).
   * Returns signals where their entry's outcome has not yet been incorporated.
   * Phase 10.5A: batch-processed on a schedule.
   */
  getPendingLearningSignals(limit?: number): Promise<LearningSignal[]>;

  // ── Commercial history ─────────────────────────────────────────────────────

  /**
   * Aggregate commercial success history for a user × industry window.
   * This is a computed read — implementations aggregate on demand or from a cache.
   *
   * Returns a zero-filled history object when no entries exist for this
   * user × industry — never throws.
   */
  getCommercialHistory(filter: CommercialHistoryFilter): Promise<CommercialSuccessHistory>;
}

// ── Null store ────────────────────────────────────────────────────────────────

/**
 * A no-op implementation of MemoryStore.
 * Useful as a default when no store is provided (e.g. during testing or
 * when the feature is disabled). Every method is a no-op or returns an
 * empty / zero result.
 *
 * This is the only implementation in Phase 10.4D (architecture only).
 * Phase 10.5A replaces this with InMemoryStore.
 */
export class NullMemoryStore implements MemoryStore {
  async save(_e: CreativeMemoryEntry): Promise<void> { /* no-op */ }

  async update(_id: string, _p: Parameters<MemoryStore["update"]>[1]): Promise<void> { /* no-op */ }

  async getById(_id: string): Promise<CreativeMemoryEntry | null> { return null; }

  async query(_f: MemoryFilter): Promise<CreativeMemoryEntry[]> { return []; }

  async getRecent(
    _u: string, _i: SceneIndustry, _n?: number,
  ): Promise<CreativeMemoryEntry[]> { return []; }

  async getRecentFingerprints(
    _u: string, _i: SceneIndustry, _n?: number,
  ): Promise<string[]> { return []; }

  async searchSimilar(query: SimilaritySearchQuery): Promise<SimilaritySearchResult> {
    return {
      query,
      matches:                   [],
      maxSimilarity:             0,
      recommendation:            "proceed",
      avoidRouteIds:             [],
      safeAlternativeRouteIds:   [],
    };
  }

  async getPatterns(_f: PatternFilter): Promise<CreativePattern[]> { return []; }

  async upsertPattern(_p: CreativePattern): Promise<void> { /* no-op */ }

  async getSuccessWeights(
    _k: WeightedElementKind, _i?: SceneIndustry,
  ): Promise<SuccessWeight[]> { return []; }

  async getSuccessWeight(
    _id: string, _k: WeightedElementKind,
  ): Promise<SuccessWeight | null> { return null; }

  async upsertSuccessWeight(_w: SuccessWeight): Promise<void> { /* no-op */ }

  async saveLearningSignal(_s: LearningSignal): Promise<void> { /* no-op */ }

  async getPendingLearningSignals(_l?: number): Promise<LearningSignal[]> { return []; }

  async getCommercialHistory(
    filter: CommercialHistoryFilter,
  ): Promise<CommercialSuccessHistory> {
    return {
      userId:                    filter.userId,
      industry:                  filter.industry,
      totalGenerations:          0,
      successfulGenerations:     0,
      successRate:               null,
      topRouteIds:               [],
      topArchetypeIds:           [],
      underperformingRouteIds:   [],
      averageUserRating:         null,
      recentTrend:               "unknown",
      computedAt:                new Date().toISOString(),
    };
  }
}
