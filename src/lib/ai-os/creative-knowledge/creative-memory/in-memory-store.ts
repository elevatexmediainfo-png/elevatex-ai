// Phase 10.4D — Creative Memory Platform: InMemoryStore.
//
// Array-backed MemoryStore implementation for development and testing.
// Replaces NullMemoryStore as the active store in Phase 10.4D.
//
// Not suitable for production:
//   - State lives only as long as the process (no persistence).
//   - No concurrency safety (fine for Next.js single-process dev server).
//   - No userId scope in searchSimilar (single-user dev assumption).
//
// Replacement path:
//   Phase 10.5B: PrismaMemoryStore (PostgreSQL via Prisma, per-user scope)
//   Phase 10.5C: CachedMemoryStore (wraps PrismaMemoryStore + Redis)

import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { CreativeMemoryEntry }    from "./types";
import type { MemoryFingerprint }      from "./fingerprint";
import { buildFingerprint }            from "./fingerprint";
import type { CreativePattern, PatternFilter } from "./pattern";
import type {
  SuccessWeight,
  LearningSignal,
  WeightedElementKind,
} from "./learning";
import type {
  MemoryFilter,
  CommercialHistoryFilter,
  CommercialSuccessHistory,
  MemoryStore,
} from "./store";
import type {
  SimilaritySearchQuery,
  SimilaritySearchResult,
  SimilarityResult,
} from "./similarity";
import {
  DEFAULT_SIMILARITY_THRESHOLD,
  DEFAULT_DIMENSION_WEIGHTS,
  compareFingerprints,
} from "./similarity";

// ── InMemoryStore ─────────────────────────────────────────────────────────────

export class InMemoryStore implements MemoryStore {
  private readonly entries:        Map<string, CreativeMemoryEntry> = new Map();
  private readonly patterns:       Map<string, CreativePattern>     = new Map();
  private readonly weights:        Map<string, SuccessWeight>        = new Map();
  private readonly signals:        LearningSignal[]                  = [];

  // ── Write ───────────────────────────────────────────────────────────────────

  async save(entry: CreativeMemoryEntry): Promise<void> {
    if (this.entries.has(entry.id)) {
      throw new Error(`[InMemoryStore] Entry ${entry.id} already exists — use update() instead.`);
    }
    this.entries.set(entry.id, entry);
  }

  async update(
    id:    string,
    patch: { review?: CreativeMemoryEntry["review"]; feedback?: CreativeMemoryEntry["feedback"] },
  ): Promise<void> {
    const existing = this.entries.get(id);
    if (!existing) {
      throw new Error(`[InMemoryStore] Entry ${id} not found — cannot update.`);
    }
    this.entries.set(id, {
      ...existing,
      ...(patch.review   !== undefined && { review:   patch.review }),
      ...(patch.feedback !== undefined && { feedback: patch.feedback }),
    });
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  async getById(id: string): Promise<CreativeMemoryEntry | null> {
    return this.entries.get(id) ?? null;
  }

  async query(filter: MemoryFilter): Promise<CreativeMemoryEntry[]> {
    let results = [...this.entries.values()];

    if (filter.userId)       results = results.filter(e => e.userId === filter.userId);
    if (filter.industry)     results = results.filter(e => e.input.industry === filter.industry);
    if (filter.campaignGoal) results = results.filter(e => e.input.campaignGoal === filter.campaignGoal);
    if (filter.routeId)      results = results.filter(e => e.blueprint.selectedRouteId === filter.routeId);
    if (filter.archetypeId)  results = results.filter(e => e.blueprint.archetypeId === filter.archetypeId);

    if (filter.onBriefOnly)    results = results.filter(e => e.review?.isOnBrief === true);
    if (filter.minUserRating)  results = results.filter(e => (e.feedback?.rating ?? 0) >= filter.minUserRating!);
    if (filter.fromDate)       results = results.filter(e => e.timestamp >= filter.fromDate!);
    if (filter.toDate)         results = results.filter(e => e.timestamp <= filter.toDate!);

    // Sort
    const sortBy = filter.sortBy ?? "date";
    if (sortBy === "date") {
      results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } else if (sortBy === "rating") {
      results.sort((a, b) => (b.feedback?.rating ?? 0) - (a.feedback?.rating ?? 0));
    } else if (sortBy === "successScore") {
      results.sort((a, b) =>
        (b.review?.isOnBrief ? 1 : 0) - (a.review?.isOnBrief ? 1 : 0)
      );
    }

    if (filter.limit) results = results.slice(0, filter.limit);

    return results;
  }

  async getRecent(userId: string, industry: SceneIndustry, n = 5): Promise<CreativeMemoryEntry[]> {
    return this.query({ userId, industry, limit: n, sortBy: "date" });
  }

  /**
   * Returns fingerprint hashes in the exploration-avoidance format:
   *   "{heroMomentId||"none"}|{sceneTypeId||"none"}|{routeId}"
   *
   * This format matches the `candidateHash` computed in exploration.ts
   * `findRejectionReason()`, so the Set lookup correctly identifies
   * candidates that should be avoided.
   */
  async getRecentFingerprints(userId: string, industry: SceneIndustry, n = 5): Promise<string[]> {
    const entries = await this.getRecent(userId, industry, n);
    return entries.map(e => toAvoidanceHash(e));
  }

  // ── Similarity search ───────────────────────────────────────────────────────

  async searchSimilar(query: SimilaritySearchQuery): Promise<SimilaritySearchResult> {
    const threshold  = query.threshold  ?? DEFAULT_SIMILARITY_THRESHOLD;
    const weights    = query.weights    ?? DEFAULT_DIMENSION_WEIGHTS;
    const maxResults = query.maxResults ?? 5;

    // Resolve scope → entries for same industry (no userId scope — InMemoryStore is
    // a single-user dev store; PrismaMemoryStore adds userId scoping in Phase 10.5B)
    const recentEntries = this.getRecentByIndustry(
      query.targetFingerprint.industryId,
      scopeToLimit(query.scope),
      query.scope === "last_30" ? 30 : undefined,
    );

    const matches: SimilarityResult[] = [];

    for (const entry of recentEntries) {
      const refFp = entryToFingerprint(entry);
      const result = compareFingerprints(
        query.targetFingerprint.hash,
        query.targetFingerprint,
        refFp,
        entry.id,
        threshold,
        weights,
      );
      matches.push(result);
    }

    matches.sort((a, b) => b.compositeScore - a.compositeScore);
    const topMatches = matches.slice(0, maxResults);

    const maxSimilarity  = topMatches[0]?.compositeScore ?? 0;
    const recommendation =
      maxSimilarity >= threshold.hard ? "reject"    :
      maxSimilarity >= threshold.soft ? "diversify" :
                                        "proceed";

    const avoidRouteIds = recommendation !== "proceed"
      ? topMatches
          .filter(m => m.compositeScore >= threshold.soft)
          .map(m => this.entries.get(m.referenceEntryId)?.blueprint.selectedRouteId ?? "")
          .filter(Boolean)
      : [];

    return {
      query,
      matches: topMatches,
      maxSimilarity,
      recommendation,
      avoidRouteIds,
      safeAlternativeRouteIds: [],
    };
  }

  // ── Patterns ─────────────────────────────────────────────────────────────────

  async getPatterns(filter: PatternFilter): Promise<CreativePattern[]> {
    let results = [...this.patterns.values()];

    if (filter.industry)     results = results.filter(p => p.industryIds.includes(filter.industry!));
    if (filter.campaignGoal) results = results.filter(p => p.campaignGoals.includes(filter.campaignGoal!));
    if (filter.type)         results = results.filter(p => p.type === filter.type);
    if (filter.activeOnly !== false) results = results.filter(p => p.isActive);
    if (filter.minScore)     results = results.filter(p => p.rankingScore.total >= filter.minScore!);
    if (filter.minEntryCount) results = results.filter(p => p.entryCount >= filter.minEntryCount!);

    results.sort((a, b) => b.rankingScore.total - a.rankingScore.total);
    if (filter.limit) results = results.slice(0, filter.limit);

    return results;
  }

  async upsertPattern(pattern: CreativePattern): Promise<void> {
    this.patterns.set(pattern.patternId, pattern);
  }

  // ── Success weights ──────────────────────────────────────────────────────────

  async getSuccessWeights(
    elementKind: WeightedElementKind,
    industry?:   SceneIndustry,
  ): Promise<SuccessWeight[]> {
    let results = [...this.weights.values()].filter(w => w.elementKind === elementKind);
    if (industry) {
      results = results.filter(w =>
        !w.industryScoped || w.industryScope.includes(industry)
      );
    }
    return results.sort((a, b) => b.weight - a.weight);
  }

  async getSuccessWeight(
    elementId:   string,
    elementKind: WeightedElementKind,
  ): Promise<SuccessWeight | null> {
    const key = `${elementKind}:${elementId}`;
    return this.weights.get(key) ?? null;
  }

  async upsertSuccessWeight(weight: SuccessWeight): Promise<void> {
    const key = `${weight.elementKind}:${weight.elementId}`;
    this.weights.set(key, weight);
  }

  // ── Learning signals ─────────────────────────────────────────────────────────

  async saveLearningSignal(signal: LearningSignal): Promise<void> {
    this.signals.push(signal);
  }

  async getPendingLearningSignals(limit = 50): Promise<LearningSignal[]> {
    return this.signals.slice(0, limit);
  }

  // ── Commercial history ───────────────────────────────────────────────────────

  async getCommercialHistory(filter: CommercialHistoryFilter): Promise<CommercialSuccessHistory> {
    const lookback = filter.lookbackDays ?? 90;
    const fromDate = new Date(Date.now() - lookback * 86_400_000);

    const entries = await this.query({
      userId:       filter.userId,
      industry:     filter.industry,
      ...(filter.campaignGoal ? { campaignGoal: filter.campaignGoal } : {}),
      fromDate,
    });

    if (entries.length === 0) {
      return emptyHistory(filter.userId, filter.industry);
    }

    const totalGenerations     = entries.length;
    const successfulGenerations = entries.filter(e => e.review?.isOnBrief === true).length;
    const successRate = totalGenerations > 0 ? successfulGenerations / totalGenerations : null;

    // Route-level stats
    const routeStats = new Map<string, { s: number; t: number }>();
    for (const e of entries) {
      const id = e.blueprint.selectedRouteId;
      if (!id) continue;
      const st = routeStats.get(id) ?? { s: 0, t: 0 };
      st.t++;
      if (e.review?.isOnBrief) st.s++;
      routeStats.set(id, st);
    }

    const topRouteIds = [...routeStats.entries()]
      .sort((a, b) => (b[1].s / b[1].t) - (a[1].s / a[1].t))
      .map(([id]) => id);

    const underperformingRouteIds = [...routeStats.entries()]
      .filter(([, s]) => s.t >= 3 && s.s / s.t < 0.3)
      .map(([id]) => id);

    // User ratings
    const rated = entries.filter(e => e.feedback?.rating != null);
    const averageUserRating = rated.length > 0
      ? rated.reduce((sum, e) => sum + (e.feedback!.rating ?? 0), 0) / rated.length
      : null;

    // Trend: last 10 vs previous 10
    let recentTrend: CommercialSuccessHistory["recentTrend"] = "unknown";
    if (entries.length >= 20) {
      const sorted   = [...entries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      const r10 = sorted.slice(0, 10).filter(e => e.review?.isOnBrief !== undefined);
      const p10 = sorted.slice(10, 20).filter(e => e.review?.isOnBrief !== undefined);
      if (r10.length > 0 && p10.length > 0) {
        const rRate = r10.filter(e => e.review?.isOnBrief).length / r10.length;
        const pRate = p10.filter(e => e.review?.isOnBrief).length / p10.length;
        recentTrend =
          rRate - pRate >  0.05 ? "improving" :
          pRate - rRate >  0.05 ? "declining" : "stable";
      }
    }

    return {
      userId:                    filter.userId,
      industry:                  filter.industry,
      totalGenerations,
      successfulGenerations,
      successRate,
      topRouteIds,
      topArchetypeIds:           [],
      underperformingRouteIds,
      averageUserRating,
      recentTrend,
      computedAt:                new Date().toISOString(),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private getRecentByIndustry(
    industry: SceneIndustry,
    limit: number,
    daysLimit?: number,
  ): CreativeMemoryEntry[] {
    let results = [...this.entries.values()].filter(e => e.input.industry === industry);

    if (daysLimit !== undefined) {
      const cutoff = new Date(Date.now() - daysLimit * 86_400_000);
      results = results.filter(e => e.timestamp >= cutoff);
    }

    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return results.slice(0, limit);
  }
}

// ── Private module helpers ────────────────────────────────────────────────────

/** Build a MemoryFingerprint from an entry's stored identifiers. */
function entryToFingerprint(entry: CreativeMemoryEntry): MemoryFingerprint {
  return buildFingerprint({
    heroId:          entry.blueprint.heroMomentId,
    sceneId:         entry.blueprint.sceneTypeId,
    emotionId:       entry.blueprint.emotionId      ?? "",
    environmentId:   entry.blueprint.environmentId  ?? "",
    behaviourIds:    [],
    relationshipIds: [],
    layoutId:        "",
    cameraId:        "",
    lightingId:      "",
    compositionId:   "",
    routeId:         entry.blueprint.selectedRouteId,
    archetypeIds:    [],
    psychologyIds:   [],
    industryId:      entry.input.industry,
    campaignGoal:    entry.input.campaignGoal,
    luxuryTier:      entry.input.luxuryTier,
  });
}

/**
 * Convert a scope string to a hard entry limit.
 * "last_30" uses daysLimit instead of a count limit — pass 999 as limit cap.
 */
function scopeToLimit(scope: SimilaritySearchQuery["scope"]): number {
  if (scope === "last_5")  return 5;
  if (scope === "last_10") return 10;
  if (scope === "last_30") return 999;
  return 999; // "all"
}

/**
 * Build the avoidance hash for an entry in the format expected by
 * findRejectionReason() in exploration.ts:
 *   "{heroMomentId||"none"}|{sceneTypeId||"none"}|{selectedRouteId}"
 *
 * This matches the candidateHash computed during the exploration diversity walk,
 * ensuring entries stored in avoidFingerprintHashes correctly gate future selections.
 */
function toAvoidanceHash(entry: CreativeMemoryEntry): string {
  const heroId  = entry.blueprint.heroMomentId  || "none";
  const sceneId = entry.blueprint.sceneTypeId   || "none";
  const routeId = entry.blueprint.selectedRouteId;
  return `${heroId}|${sceneId}|${routeId}`;
}

function emptyHistory(userId: string, industry: SceneIndustry): CommercialSuccessHistory {
  return {
    userId,
    industry,
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
