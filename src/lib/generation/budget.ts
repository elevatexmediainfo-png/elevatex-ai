import { startOfUtcDay, startOfUtcMonth } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";
import { getProviderPolicyOverrides } from "@/lib/providers/credentials";
import type { GenerationCategory } from "./types";

export interface BudgetUsage {
  dailySpendUsd: number;
  monthlySpendUsd: number;
  recentRequestCount: number;
}

export interface BudgetLimits {
  dailyBudgetUsd?: number;
  monthlyBudgetUsd?: number;
  rateLimitPerMinute?: number;
}

export interface BudgetCheckResult {
  ok: boolean;
  reason?: string;
}

// Pure — no DB access — so the cap-comparison logic is unit-testable
// without Postgres, same split as health.ts's computeNextHealthState().
// An unset limit field never blocks; budgets/rate limits are opt-in caps,
// not a default restriction.
export function evaluateBudget(usage: BudgetUsage, limits: BudgetLimits): BudgetCheckResult {
  if (limits.dailyBudgetUsd != null && usage.dailySpendUsd >= limits.dailyBudgetUsd) {
    return { ok: false, reason: `daily budget of $${limits.dailyBudgetUsd} reached` };
  }
  if (limits.monthlyBudgetUsd != null && usage.monthlySpendUsd >= limits.monthlyBudgetUsd) {
    return { ok: false, reason: `monthly budget of $${limits.monthlyBudgetUsd} reached` };
  }
  if (limits.rateLimitPerMinute != null && usage.recentRequestCount >= limits.rateLimitPerMinute) {
    return { ok: false, reason: `rate limit of ${limits.rateLimitPerMinute}/min reached` };
  }
  return { ok: true };
}

// DB-backed wrapper production code calls — admin-set budgets/rate limits
// are hard caps (unlike the health circuit-breaker, exhausting every
// provider here is a genuine "no," not something the engine retries
// through). Spend/request counts are derived from GenerationLog, the same
// table usage-log.ts already writes — no separate counter table to drift
// out of sync with it.
export async function checkProviderBudget(
  category: GenerationCategory,
  providerId: string
): Promise<BudgetCheckResult> {
  const limits = await getProviderPolicyOverrides(category, providerId);
  if (limits.dailyBudgetUsd == null && limits.monthlyBudgetUsd == null && limits.rateLimitPerMinute == null) {
    return { ok: true };
  }

  const now = new Date();
  const [dailyAgg, monthlyAgg, recentRequestCount] = await Promise.all([
    limits.dailyBudgetUsd != null
      ? prisma.generationLog.aggregate({
          _sum: { costUsd: true },
          where: { category, providerId, createdAt: { gte: startOfUtcDay(now) } },
        })
      : null,
    limits.monthlyBudgetUsd != null
      ? prisma.generationLog.aggregate({
          _sum: { costUsd: true },
          where: { category, providerId, createdAt: { gte: startOfUtcMonth(now) } },
        })
      : null,
    limits.rateLimitPerMinute != null
      ? prisma.generationLog.count({
          where: { category, providerId, createdAt: { gte: new Date(now.getTime() - 60_000) } },
        })
      : null,
  ]);

  return evaluateBudget(
    {
      dailySpendUsd: dailyAgg?._sum.costUsd ?? 0,
      monthlySpendUsd: monthlyAgg?._sum.costUsd ?? 0,
      recentRequestCount: recentRequestCount ?? 0,
    },
    limits
  );
}
