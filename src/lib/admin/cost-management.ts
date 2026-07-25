import { prisma } from "@/lib/prisma";

// Milestone 10 Part 8 — Cost Management. Every row this reads already exists
// on GenerationLog (lib/generation/usage-log.ts writes it once per provider
// attempt) — this module only aggregates/joins, it never introduces a second
// place that tracks spend.

export interface CostByProviderRow {
  category: string;
  providerId: string;
  requests: number;
  costUsd: number;
  avgLatencyMs: number;
  tokens: number;
  images: number;
  seconds: number;
}

export interface CostByModelRow {
  category: string;
  providerId: string;
  model: string;
  requests: number;
  costUsd: number;
}

export interface CostByProjectRow {
  videoProjectId: string;
  title: string;
  requests: number;
  costUsd: number;
}

export interface CostByUserRow {
  userId: string;
  label: string;
  requests: number;
  costUsd: number;
}

export interface CostBySubscriptionRow {
  planName: string;
  requests: number;
  costUsd: number;
}

export interface CostManagementTotals {
  requests: number;
  costUsd: number;
  tokens: number;
  images: number;
  voiceSeconds: number;
  videoSeconds: number;
}

export interface CostManagementReport {
  since: Date;
  totals: CostManagementTotals;
  byProvider: CostByProviderRow[];
  byModel: CostByModelRow[];
  byProject: CostByProjectRow[];
  byUser: CostByUserRow[];
  bySubscription: CostBySubscriptionRow[];
}

const TOP_N = 20;

// Pure — buckets a (userId, costUsd, requests) list against a userId->plan
// name lookup. Split out from getCostManagementReport so the bucketing rule
// (one row per distinct plan name, "No active subscription" for the rest)
// is unit-testable without touching Postgres.
export function bucketBySubscription(
  rows: { userId: string; requests: number; costUsd: number }[],
  planNameByUserId: Map<string, string>
): CostBySubscriptionRow[] {
  const NO_SUBSCRIPTION = "No active subscription";
  const byPlan = new Map<string, { requests: number; costUsd: number }>();

  for (const row of rows) {
    const planName = planNameByUserId.get(row.userId) ?? NO_SUBSCRIPTION;
    const entry = byPlan.get(planName) ?? { requests: 0, costUsd: 0 };
    entry.requests += row.requests;
    entry.costUsd += row.costUsd;
    byPlan.set(planName, entry);
  }

  return Array.from(byPlan.entries())
    .map(([planName, { requests, costUsd }]) => ({ planName, requests, costUsd }))
    .sort((a, b) => b.costUsd - a.costUsd);
}

export async function getCostManagementReport(since: Date): Promise<CostManagementReport> {
  const where = { createdAt: { gte: since } };

  const [providerGroups, modelGroups, projectGroups, userGroups] = await Promise.all([
    prisma.generationLog.groupBy({
      by: ["category", "providerId"],
      where,
      _count: { _all: true },
      _avg: { latencyMs: true },
      _sum: { costUsd: true, usageTokens: true, usageImages: true, usageSeconds: true },
    }),
    prisma.generationLog.groupBy({
      by: ["category", "providerId", "model"],
      where: { ...where, model: { not: null } },
      _count: { _all: true },
      _sum: { costUsd: true },
    }),
    prisma.generationLog.groupBy({
      by: ["videoProjectId"],
      where: { ...where, videoProjectId: { not: null } },
      _count: { _all: true },
      _sum: { costUsd: true },
    }),
    prisma.generationLog.groupBy({
      by: ["userId"],
      where: { ...where, userId: { not: null } },
      _count: { _all: true },
      _sum: { costUsd: true },
    }),
  ]);

  const byProvider: CostByProviderRow[] = providerGroups
    .map((g) => ({
      category: g.category,
      providerId: g.providerId,
      requests: g._count._all,
      costUsd: g._sum.costUsd ?? 0,
      avgLatencyMs: Math.round(g._avg.latencyMs ?? 0),
      tokens: g._sum.usageTokens ?? 0,
      images: g._sum.usageImages ?? 0,
      seconds: g._sum.usageSeconds ?? 0,
    }))
    .sort((a, b) => b.costUsd - a.costUsd);

  const byModel: CostByModelRow[] = modelGroups
    .map((g) => ({
      category: g.category,
      providerId: g.providerId,
      model: g.model as string,
      requests: g._count._all,
      costUsd: g._sum.costUsd ?? 0,
    }))
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, TOP_N);

  const topProjectGroups = [...projectGroups]
    .sort((a, b) => (b._sum.costUsd ?? 0) - (a._sum.costUsd ?? 0))
    .slice(0, TOP_N);
  const projectIds = topProjectGroups.map((g) => g.videoProjectId as string);
  const projects = projectIds.length
    ? await prisma.videoProject.findMany({ where: { id: { in: projectIds } }, select: { id: true, title: true } })
    : [];
  const titleByProjectId = new Map(projects.map((p) => [p.id, p.title]));
  const byProject: CostByProjectRow[] = topProjectGroups.map((g) => {
    const videoProjectId = g.videoProjectId as string;
    return {
      videoProjectId,
      title: titleByProjectId.get(videoProjectId) ?? "(deleted project)",
      requests: g._count._all,
      costUsd: g._sum.costUsd ?? 0,
    };
  });

  const topUserGroups = [...userGroups]
    .sort((a, b) => (b._sum.costUsd ?? 0) - (a._sum.costUsd ?? 0))
    .slice(0, TOP_N);
  const userIds = topUserGroups.map((g) => g.userId as string);
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, phone: true } })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));
  const byUser: CostByUserRow[] = topUserGroups.map((g) => {
    const userId = g.userId as string;
    const user = userById.get(userId);
    return {
      userId,
      label: user?.name ?? user?.email ?? user?.phone ?? "(deleted user)",
      requests: g._count._all,
      costUsd: g._sum.costUsd ?? 0,
    };
  });

  // Subscription breakdown is computed over EVERY user with usage in the
  // window (not just the top N) so the totals/percentages stay meaningful —
  // only the per-user table above is capped for display purposes.
  const allUserIds = userGroups.map((g) => g.userId as string);
  const subscriptions = allUserIds.length
    ? await prisma.subscription.findMany({
        where: { userId: { in: allUserIds }, status: "ACTIVE" },
        select: { userId: true, plan: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const planNameByUserId = new Map<string, string>();
  for (const sub of subscriptions) {
    if (!planNameByUserId.has(sub.userId)) planNameByUserId.set(sub.userId, sub.plan.name);
  }
  const bySubscription = bucketBySubscription(
    userGroups.map((g) => ({
      userId: g.userId as string,
      requests: g._count._all,
      costUsd: g._sum.costUsd ?? 0,
    })),
    planNameByUserId
  );

  const totals: CostManagementTotals = byProvider.reduce(
    (acc, row) => {
      acc.requests += row.requests;
      acc.costUsd += row.costUsd;
      acc.tokens += row.tokens;
      if (row.category === "VOICE") acc.voiceSeconds += row.seconds;
      if (row.category === "VIDEO") acc.videoSeconds += row.seconds;
      acc.images += row.images;
      return acc;
    },
    { requests: 0, costUsd: 0, tokens: 0, images: 0, voiceSeconds: 0, videoSeconds: 0 }
  );

  return { since, totals, byProvider, byModel, byProject, byUser, bySubscription };
}
