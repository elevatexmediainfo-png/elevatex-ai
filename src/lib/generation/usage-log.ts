import { prisma } from "@/lib/prisma";
import type { GenerationCategory } from "./types";

export interface LogEntryInput {
  category: GenerationCategory;
  providerId: string;
  operation: string;
  status: "SUCCESS" | "FAILURE";
  attempt: number;
  latencyMs: number;
  costUsd?: number;
  errorMessage?: string;
  videoProjectId?: string;
  userId?: string;
  sceneId?: string;
  creativeProjectId?: string;
  model?: string;
  usageTokens?: number;
  usageImages?: number;
  usageSeconds?: number;
}

// One row per provider ATTEMPT (see GenerationLog model comment in
// schema.prisma) — this is the single write path the engine uses for both
// usage analytics and cost tracking, so neither can silently drift from
// what actually happened.
export async function logGenerationEvent(entry: LogEntryInput): Promise<void> {
  await prisma.generationLog.create({
    data: {
      category: entry.category,
      providerId: entry.providerId,
      operation: entry.operation,
      status: entry.status,
      attempt: entry.attempt,
      latencyMs: entry.latencyMs,
      costUsd: entry.costUsd,
      errorMessage: entry.errorMessage,
      videoProjectId: entry.videoProjectId,
      userId: entry.userId,
      sceneId: entry.sceneId,
      creativeProjectId: entry.creativeProjectId,
      model: entry.model,
      usageTokens: entry.usageTokens,
      usageImages: entry.usageImages,
      usageSeconds: entry.usageSeconds,
    },
  });
}

export interface UsageAnalyticsFilter {
  since?: Date;
}

export interface UsageAnalyticsRow {
  category: GenerationCategory;
  providerId: string;
  status: "SUCCESS" | "FAILURE";
  count: number;
  avgLatencyMs: number | null;
  totalCostUsd: number | null;
}

// Admin panel feed — per (category, provider, status) aggregates over a
// window. Grouped at the DB layer rather than fetched-and-reduced in app
// code so this stays cheap as GenerationLog grows.
export async function getUsageAnalytics(filter: UsageAnalyticsFilter = {}): Promise<UsageAnalyticsRow[]> {
  const where = filter.since ? { createdAt: { gte: filter.since } } : {};
  const grouped = await prisma.generationLog.groupBy({
    by: ["category", "providerId", "status"],
    where,
    _count: { _all: true },
    _avg: { latencyMs: true },
    _sum: { costUsd: true },
  });

  return grouped.map((g) => ({
    category: g.category,
    providerId: g.providerId,
    status: g.status,
    count: g._count._all,
    avgLatencyMs: g._avg.latencyMs,
    totalCostUsd: g._sum.costUsd,
  }));
}

export async function getRecentFailures(limit = 20) {
  return prisma.generationLog.findMany({
    where: { status: "FAILURE" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
