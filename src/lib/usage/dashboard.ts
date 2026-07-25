import { prisma } from "@/lib/prisma";

// Per-user mirror of lib/admin/cost-management.ts's aggregation style, scoped
// to one account instead of admin-wide — every row read here already exists
// (VideoProject, CreditTransaction, Export, Download), this is pure
// aggregation, not a new tracking mechanism.

export interface UsageSummary {
  projectsBySourceType: { sourceType: string; count: number }[];
  projectsByStatus: { status: string; count: number }[];
  exportsCount: number;
  downloadsCount: number;
  creditsConsumed30d: number;
  creditsConsumedByType: { type: string; amount: number }[];
}

export async function getUserUsageSummary(userId: string): Promise<UsageSummary> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [sourceGroups, statusGroups, exportsCount, downloadsCount, creditDebits] = await Promise.all([
    prisma.videoProject.groupBy({ by: ["sourceType"], where: { userId }, _count: { _all: true } }),
    prisma.videoProject.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
    prisma.export.count({ where: { videoProject: { userId } } }),
    prisma.download.count({ where: { userId } }),
    prisma.creditTransaction.groupBy({
      by: ["type"],
      where: { userId, amount: { lt: 0 }, createdAt: { gte: since30d } },
      _sum: { amount: true },
    }),
  ]);

  const creditsConsumedByType = creditDebits.map((g) => ({
    type: g.type,
    amount: Math.abs(g._sum.amount ?? 0),
  }));

  return {
    projectsBySourceType: sourceGroups.map((g) => ({ sourceType: g.sourceType, count: g._count._all })),
    projectsByStatus: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    exportsCount,
    downloadsCount,
    creditsConsumed30d: creditsConsumedByType.reduce((sum, r) => sum + r.amount, 0),
    creditsConsumedByType,
  };
}
