import { prisma } from "@/lib/prisma";
import type { BillingInterval } from "@/generated/prisma/enums";

// Milestone 13 — no revenue aggregation existed anywhere before this file.
// GenerationLog.costUsd (lib/admin/cost-management.ts) is AI vendor cost,
// not customer-paid revenue — a completely different number derived from a
// completely different table (PaymentIntent), hence a separate module
// rather than extending cost-management.ts.

export interface RevenueByKind {
  kind: string;
  revenuePaise: number;
  count: number;
}

export interface RevenueSummary {
  totalRevenuePaise: number;
  byKind: RevenueByKind[];
}

export async function getRevenueSummary(since: Date): Promise<RevenueSummary> {
  const grouped = await prisma.paymentIntent.groupBy({
    by: ["kind"],
    where: { status: "PAID", createdAt: { gte: since } },
    _sum: { amountPaise: true },
    _count: { _all: true },
  });

  const byKind = grouped.map((g) => ({
    kind: g.kind,
    revenuePaise: g._sum.amountPaise ?? 0,
    count: g._count._all,
  }));

  return {
    totalRevenuePaise: byKind.reduce((sum, g) => sum + g.revenuePaise, 0),
    byKind,
  };
}

export interface RevenueDayBucket {
  dayStart: string;
  revenuePaise: number;
  count: number;
}

// Pure — same overall bucketing technique as render/analytics.ts's
// getQueueThroughput(), just day-granularity and summing paise instead of
// counting statuses. Split out from getRevenueByDay() so the bucketing math
// itself is unit-testable without a database.
//
// Buckets by UTC calendar day specifically (setUTCHours, not setHours) —
// this server may run in any timezone (confirmed IST, UTC+5:30, in this dev
// environment), and local-time bucketing would silently put two payments
// made hours apart on the same UTC day into different buckets whenever the
// local offset crosses midnight differently. A revenue dashboard's day
// boundaries should not depend on the host machine's timezone.
export function bucketRevenueByDay(intents: { amountPaise: number; createdAt: Date }[]): RevenueDayBucket[] {
  const buckets = new Map<string, RevenueDayBucket>();
  for (const intent of intents) {
    const d = intent.createdAt;
    const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const key = dayStart.toISOString();
    const bucket = buckets.get(key) ?? { dayStart: key, revenuePaise: 0, count: 0 };
    bucket.revenuePaise += intent.amountPaise;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return Array.from(buckets.values()).sort((a, b) => a.dayStart.localeCompare(b.dayStart));
}

export async function getRevenueByDay(days = 30): Promise<RevenueDayBucket[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const intents = await prisma.paymentIntent.findMany({
    where: { status: "PAID", createdAt: { gte: since } },
    select: { amountPaise: true, createdAt: true },
  });
  return bucketRevenueByDay(intents);
}

// Months-per-billing-cycle, for normalizing any interval onto a monthly
// figure — this is exactly why Milestone 13 made BillingInterval a real enum
// with real renewal math (lib/billing/interval.ts): without it, a YEARLY
// plan's full price would have wrongly inflated MRR by 12x.
const INTERVAL_TO_MONTHS: Record<BillingInterval, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  YEARLY: 12,
};

// Pure — takes already-fetched active subscriptions' plan price/interval and
// computes the monthly-normalized total.
export function computeMRR(subscriptions: { priceInPaise: number; billingInterval: BillingInterval | null }[]): number {
  return subscriptions.reduce((sum, sub) => {
    const months = INTERVAL_TO_MONTHS[sub.billingInterval ?? "MONTHLY"];
    return sum + sub.priceInPaise / months;
  }, 0);
}

export async function getMRR(): Promise<number> {
  const subs = await prisma.subscription.findMany({
    where: { status: "ACTIVE" },
    include: { plan: { select: { priceInPaise: true, billingInterval: true } } },
  });
  return computeMRR(subs.map((s) => s.plan));
}

export async function getARR(): Promise<number> {
  return (await getMRR()) * 12;
}

export interface TopPlanRevenue {
  planId: string;
  name: string;
  revenuePaise: number;
  count: number;
}

export async function getTopPlansByRevenue(since: Date, limit = 10): Promise<TopPlanRevenue[]> {
  const grouped = await prisma.paymentIntent.groupBy({
    by: ["referenceId"],
    where: { status: "PAID", kind: "SUBSCRIPTION", createdAt: { gte: since } },
    _sum: { amountPaise: true },
    _count: { _all: true },
  });
  if (grouped.length === 0) return [];

  const plans = await prisma.pricingPlan.findMany({
    where: { id: { in: grouped.map((g) => g.referenceId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(plans.map((p) => [p.id, p.name]));

  return grouped
    .map((g) => ({
      planId: g.referenceId,
      name: nameById.get(g.referenceId) ?? "(deleted plan)",
      revenuePaise: g._sum.amountPaise ?? 0,
      count: g._count._all,
    }))
    .sort((a, b) => b.revenuePaise - a.revenuePaise)
    .slice(0, limit);
}

export async function getActiveSubscriptionCount(): Promise<number> {
  return prisma.subscription.count({ where: { status: "ACTIVE" } });
}
