import type { GenerationCategory } from "@/lib/generation/types";
import { startOfUtcDay, startOfUtcMonth } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";
import { getQueueSnapshot } from "@/lib/render/analytics";
import { PROVIDER_CATALOGUE } from "./ai-providers";

const GENERATION_CATEGORIES: readonly GenerationCategory[] = ["LLM", "IMAGE", "VOICE", "VIDEO"];

function isGenerationCategory(category: string): category is GenerationCategory {
  return (GENERATION_CATEGORIES as readonly string[]).includes(category);
}

export interface ProviderDashboardRow {
  category: string;
  providerId: string;
  label: string;
  enabled: boolean;
  /** "NOT_TRACKED" for STORAGE/PAYMENT — they never go through the Generation Engine, so there's no health/cost data to show. */
  status: "HEALTHY" | "DEGRADED" | "DOWN" | "NO_TRAFFIC" | "NOT_TRACKED";
  currentModel: string | null;
  avgResponseMs: number | null;
  successRatePct: number | null;
  failureRatePct: number | null;
  todayRequests: number;
  todayCostUsd: number;
  monthlyCostUsd: number;
  lastError: string | null;
  /** 0-100, or null when there's no traffic yet to score. */
  healthScore: number | null;
  /** Render queue depth — VIDEO only, and shared across every VIDEO provider since RenderJob rows aren't attributed to a specific provider. */
  currentQueue: number | null;
}

// Part 5's Provider Dashboard — one row per catalogue entry (lib/admin/ai-providers.ts),
// joining ProviderConfig (enabled/model), ProviderHealth (circuit-breaker
// status), and GenerationLog (today/month cost, latency, success/failure)
// — no new counters, every number here is derived from tables the engine
// already writes.
export async function getProviderDashboard(): Promise<ProviderDashboardRow[]> {
  const now = new Date();
  const dayStart = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);

  const [configs, healthRows, todayGroups, monthGroups, recentFailures, queue] = await Promise.all([
    prisma.providerConfig.findMany(),
    prisma.providerHealth.findMany(),
    prisma.generationLog.groupBy({
      by: ["category", "providerId", "status"],
      where: { createdAt: { gte: dayStart } },
      _count: { _all: true },
      _avg: { latencyMs: true },
      _sum: { costUsd: true },
    }),
    prisma.generationLog.groupBy({
      by: ["category", "providerId"],
      where: { createdAt: { gte: monthStart } },
      _sum: { costUsd: true },
    }),
    prisma.generationLog.findMany({
      where: { status: "FAILURE" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { category: true, providerId: true, errorMessage: true },
    }),
    getQueueSnapshot(),
  ]);

  const configByKey = new Map(configs.map((c) => [`${c.category}:${c.providerId}`, c]));
  const healthByKey = new Map(healthRows.map((h) => [`${h.category}:${h.providerId}`, h]));
  const monthlyCostByKey = new Map(monthGroups.map((g) => [`${g.category}:${g.providerId}`, g._sum.costUsd ?? 0]));
  const lastErrorByKey = new Map<string, string>();
  for (const failure of recentFailures) {
    const key = `${failure.category}:${failure.providerId}`;
    if (!lastErrorByKey.has(key) && failure.errorMessage) {
      lastErrorByKey.set(key, failure.errorMessage);
    }
  }

  return PROVIDER_CATALOGUE.map((entry) => {
    const key = `${entry.category}:${entry.providerId}`;
    const config = configByKey.get(key);
    const tracked = isGenerationCategory(entry.category);

    if (!tracked) {
      return {
        category: entry.category,
        providerId: entry.providerId,
        label: entry.label,
        enabled: config?.enabled ?? false,
        status: "NOT_TRACKED" as const,
        currentModel: config?.model ?? null,
        avgResponseMs: null,
        successRatePct: null,
        failureRatePct: null,
        todayRequests: 0,
        todayCostUsd: 0,
        monthlyCostUsd: 0,
        lastError: config?.lastTestError ?? null,
        healthScore: null,
        currentQueue: null,
      };
    }

    const todayRowsForProvider = todayGroups.filter((g) => g.category === entry.category && g.providerId === entry.providerId);
    const successGroup = todayRowsForProvider.find((g) => g.status === "SUCCESS");
    const failureGroup = todayRowsForProvider.find((g) => g.status === "FAILURE");
    const successCount = successGroup?._count._all ?? 0;
    const failureCount = failureGroup?._count._all ?? 0;
    const totalToday = successCount + failureCount;

    const successRatePct = totalToday > 0 ? (successCount / totalToday) * 100 : null;
    const failureRatePct = totalToday > 0 ? (failureCount / totalToday) * 100 : null;
    const todayCostUsd = (successGroup?._sum.costUsd ?? 0) + (failureGroup?._sum.costUsd ?? 0);
    const avgResponseMs =
      totalToday > 0
        ? Math.round(
            ((successGroup?._avg.latencyMs ?? 0) * successCount + (failureGroup?._avg.latencyMs ?? 0) * failureCount) /
              totalToday
          )
        : null;

    const health = healthByKey.get(key);
    const status: ProviderDashboardRow["status"] =
      totalToday === 0 ? "NO_TRAFFIC" : health?.status ?? "HEALTHY";

    // Health status dominates the score (a DOWN provider scores 0 no matter
    // how good its historical success rate looked); otherwise it's just
    // today's success rate, nudged down while DEGRADED.
    const healthScore =
      successRatePct === null
        ? null
        : status === "DOWN"
          ? 0
          : Math.round(successRatePct * (status === "DEGRADED" ? 0.7 : 1));

    return {
      category: entry.category,
      providerId: entry.providerId,
      label: entry.label,
      enabled: config?.enabled ?? false,
      status,
      currentModel: config?.model ?? null,
      avgResponseMs,
      successRatePct,
      failureRatePct,
      todayRequests: totalToday,
      todayCostUsd,
      monthlyCostUsd: monthlyCostByKey.get(key) ?? 0,
      lastError: lastErrorByKey.get(key) ?? health?.lastError ?? null,
      healthScore,
      currentQueue: entry.category === "VIDEO" ? queue.pending + queue.processing : null,
    };
  });
}
