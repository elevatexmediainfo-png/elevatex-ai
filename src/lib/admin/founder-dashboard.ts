import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { getCostManagementReport } from "@/lib/admin/cost-management";
import { getActiveSubscriptionCount, getARR, getMRR, getRevenueSummary } from "@/lib/admin/revenue";
import { getStorageUsageSummary } from "@/lib/admin/storage-monitor";
import { getQueueSnapshot } from "@/lib/render/analytics";

// Milestone 13 — composition-only module, same shape as getHealthDashboard():
// every constituent metric already has its own function (revenue.ts,
// cost-management.ts, render/analytics.ts, storage-monitor.ts); this just
// runs them together plus the two genuinely new aggregations below
// (signup trend, today/this-month windows) via Promise.all.

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface SignupDayBucket {
  dayStart: string;
  count: number;
}

// Pure — same UTC-day-bucketing fix learned from revenue.ts's
// bucketRevenueByDay() (local-time bucketing silently mis-groups timestamps
// near midnight on a non-UTC host).
export function bucketSignupsByDay(users: { createdAt: Date }[]): SignupDayBucket[] {
  const buckets = new Map<string, SignupDayBucket>();
  for (const user of users) {
    const d = user.createdAt;
    const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const key = dayStart.toISOString();
    const bucket = buckets.get(key) ?? { dayStart: key, count: 0 };
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return Array.from(buckets.values()).sort((a, b) => a.dayStart.localeCompare(b.dayStart));
}

export async function getSignupTrend(days = 30): Promise<SignupDayBucket[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } });
  return bucketSignupsByDay(users);
}

export interface FounderDashboard {
  revenue: {
    todayPaise: number;
    mrr: number;
    arr: number;
    activeSubscriptions: number;
  };
  usage: {
    activeUsersToday: number;
    videosGeneratedToday: number;
    talkingHeadVideosToday: number;
    imagesGeneratedToday: number;
    voiceMinutesToday: number;
    signupTrend: SignupDayBucket[];
  };
  cost: {
    apiCostTodayUsd: number;
    apiCostMonthUsd: number;
    mostUsedProvider: string | null;
  };
  // All three fields below combine INR revenue with USD cost (via the
  // admin-configurable USD_TO_INR_RATE) and, for the impact estimates, an
  // admin-configurable assumption about outsourcing cost/time — these are
  // estimates for a founder's gut check, not accounting figures. Surfaced
  // with that caveat in the dashboard UI, not silently presented as exact.
  estimate: {
    profitTodayInr: number;
    grossMarginPercent: number | null;
    editorCostSavedInr: number;
    timeSavedMinutes: number;
    clvInr: number;
    arpuInr: number;
  };
  ops: {
    storageUsedBytes: number;
    queuePending: number;
    queueProcessing: number;
    queueFailedLast24h: number;
    creditsConsumedToday: number;
  };
}

export async function getFounderDashboard(): Promise<FounderDashboard> {
  const todayStart = startOfTodayUTC();
  const monthStart = startOfMonthUTC();

  const [
    revenueToday,
    mrr,
    arr,
    activeSubscriptions,
    activeUsersToday,
    videosGeneratedToday,
    talkingHeadVideosToday,
    imagesGeneratedToday,
    voiceSecondsToday,
    signupTrend,
    costToday,
    costThisMonth,
    storage,
    queue,
    creditsConsumedTodayAgg,
    usdToInrRate,
    editorCostPerVideo,
    timeSavedPerVideoMinutes,
    allTimeRevenue,
    payingUserCount,
  ] = await Promise.all([
    getRevenueSummary(todayStart),
    getMRR(),
    getARR(),
    getActiveSubscriptionCount(),
    prisma.creditTransaction.findMany({ where: { createdAt: { gte: todayStart } }, distinct: ["userId"], select: { userId: true } }).then((r) => r.length),
    prisma.videoProject.count({ where: { sourceType: "GENERATED", createdAt: { gte: todayStart } } }),
    prisma.videoProject.count({ where: { sourceType: "TALKING_HEAD_UPLOAD", createdAt: { gte: todayStart } } }),
    prisma.generationLog.count({ where: { category: "IMAGE", status: "SUCCESS", createdAt: { gte: todayStart } } }),
    prisma.generationLog.aggregate({
      where: { category: "VOICE", status: "SUCCESS", createdAt: { gte: todayStart } },
      _sum: { usageSeconds: true },
    }),
    getSignupTrend(30),
    getCostManagementReport(todayStart),
    getCostManagementReport(monthStart),
    getStorageUsageSummary(),
    getQueueSnapshot(),
    prisma.creditTransaction.aggregate({ where: { createdAt: { gte: todayStart }, amount: { lt: 0 } }, _sum: { amount: true } }),
    getConfig("USD_TO_INR_RATE"),
    getConfig("EDITOR_COST_SAVED_PER_VIDEO_INR"),
    getConfig("TIME_SAVED_PER_VIDEO_MINUTES"),
    getRevenueSummary(new Date(0)),
    prisma.paymentIntent.findMany({ where: { status: "PAID" }, distinct: ["userId"], select: { userId: true } }).then((r) => r.length),
  ]);

  const mostUsedProvider =
    costToday.byProvider.length > 0
      ? [...costToday.byProvider].sort((a, b) => b.requests - a.requests)[0].providerId
      : null;

  const revenueTodayInr = revenueToday.totalRevenuePaise / 100;
  const apiCostTodayInr = costToday.totals.costUsd * usdToInrRate;
  const profitTodayInr = revenueTodayInr - apiCostTodayInr;
  const grossMarginPercent = revenueTodayInr > 0 ? (profitTodayInr / revenueTodayInr) * 100 : null;

  const totalVideosToday = videosGeneratedToday + talkingHeadVideosToday;
  const editorCostSavedInr = totalVideosToday * editorCostPerVideo;
  const timeSavedMinutes = totalVideosToday * timeSavedPerVideoMinutes;

  const allTimeRevenueInr = allTimeRevenue.totalRevenuePaise / 100;
  const clvInr = payingUserCount > 0 ? allTimeRevenueInr / payingUserCount : 0;
  const arpuInr = activeUsersToday > 0 ? revenueTodayInr / activeUsersToday : 0;

  return {
    revenue: {
      todayPaise: revenueToday.totalRevenuePaise,
      mrr,
      arr,
      activeSubscriptions,
    },
    usage: {
      activeUsersToday,
      videosGeneratedToday,
      talkingHeadVideosToday,
      imagesGeneratedToday,
      voiceMinutesToday: (voiceSecondsToday._sum.usageSeconds ?? 0) / 60,
      signupTrend,
    },
    cost: {
      apiCostTodayUsd: costToday.totals.costUsd,
      apiCostMonthUsd: costThisMonth.totals.costUsd,
      mostUsedProvider,
    },
    estimate: {
      profitTodayInr,
      grossMarginPercent,
      editorCostSavedInr,
      timeSavedMinutes,
      clvInr,
      arpuInr,
    },
    ops: {
      storageUsedBytes: storage.totalKnownBytes,
      queuePending: queue.pending,
      queueProcessing: queue.processing,
      queueFailedLast24h: queue.failedLast24h,
      creditsConsumedToday: Math.abs(creditsConsumedTodayAgg._sum.amount ?? 0),
    },
  };
}
