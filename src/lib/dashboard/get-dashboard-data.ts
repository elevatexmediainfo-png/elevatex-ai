import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { getContinueWorking, type ContinueWorking } from "./continue-working";
import { getTrendingIndustries, getTrendingObjectives, type TrendingIndustry, type TrendingObjective } from "./trending";
import { getRecentActivity, type DailyActivity } from "./recent-activity";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export interface DashboardStats {
  credits: number;
  videos: number;
  talkingHeads: number;
  images: number;
  projects: number;
  storageBytes: number;
  apiUsageThisMonth: number;
  // Real denominator for a "credits used this cycle" progress bar — only
  // set when the user has an active subscription (PricingPlan.monthlyCredits
  // > 0); null for pay-per-download users, who have no monthly cap to
  // honestly chart against.
  monthlyCreditsCap: number | null;
}

export interface DashboardData {
  stats: DashboardStats;
  continueWorking: ContinueWorking;
  tools: Awaited<ReturnType<typeof prisma.creativeTool.findMany>>;
  featuredTemplates: Awaited<ReturnType<typeof prisma.template.findMany>>;
  trendingIndustries: TrendingIndustry[];
  trendingObjectives: TrendingObjective[];
  inspiration: Awaited<ReturnType<typeof getConfig<"INSPIRATION_LIBRARY">>>;
  recentActivity: DailyActivity[];
}

// The single composed read for the Dashboard — used by both the page
// (server component, direct render) and GET /api/dashboard (client
// refetch), so the two can never compute different numbers.
export async function getDashboardData(userId: string): Promise<DashboardData> {
  const [
    account,
    totalVideos,
    talkingHeads,
    totalImages,
    totalCreativeProjects,
    storageAgg,
    apiUsageThisMonth,
    continueWorking,
    tools,
    featuredTemplates,
    trendingIndustries,
    trendingObjectives,
    inspiration,
    activeSubscription,
    recentActivity,
  ] = await Promise.all([
    prisma.creditAccount.findUnique({ where: { userId } }),
    prisma.videoProject.count({ where: { userId, sourceType: "GENERATED" } }),
    prisma.videoProject.count({ where: { userId, sourceType: "TALKING_HEAD_UPLOAD" } }),
    prisma.creativeProject.count({ where: { userId, kind: "AI_IMAGE" } }),
    prisma.creativeProject.count({ where: { userId } }),
    prisma.asset.aggregate({ where: { userId }, _sum: { fileSizeBytes: true } }),
    prisma.generationLog.count({ where: { userId, createdAt: { gte: startOfMonth() } } }),
    getContinueWorking(userId),
    prisma.creativeTool.findMany({ where: { enabled: true }, orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    // Festival Greeting excluded from this Popular Templates tile query
    // 2026-07-11 (founder decision, same as /templates gallery) — display
    // only, the Template row and its resolveTemplateForProject() override
    // path are untouched. `defaultObjective` is nullable and every OTHER
    // template has it unset — `not: "..."` alone excludes those NULL rows
    // too (SQL three-valued logic), so NULL must be explicitly allowed
    // back in via OR, same fix as /templates gallery's query.
    prisma.template.findMany({
      where: {
        isActive: true,
        isFeatured: true,
        OR: [{ defaultObjective: null }, { defaultObjective: { not: "FESTIVAL_GREETING" } }],
      },
      orderBy: { name: "asc" },
    }),
    getTrendingIndustries(),
    getTrendingObjectives(),
    getConfig("INSPIRATION_LIBRARY"),
    prisma.subscription.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { currentPeriodStart: "desc" },
      include: { plan: true },
    }),
    getRecentActivity(userId),
  ]);

  return {
    stats: {
      credits: account?.balance ?? 0,
      videos: totalVideos,
      talkingHeads,
      images: totalImages,
      projects: totalVideos + talkingHeads + totalCreativeProjects,
      // Lower bound, not the true total — only direct uploads currently
      // probe their own size (same caveat as the admin Storage page).
      storageBytes: storageAgg._sum.fileSizeBytes ?? 0,
      apiUsageThisMonth,
      monthlyCreditsCap:
        activeSubscription && activeSubscription.plan.monthlyCredits > 0 ? activeSubscription.plan.monthlyCredits : null,
    },
    continueWorking,
    tools,
    featuredTemplates,
    trendingIndustries,
    trendingObjectives,
    inspiration,
    recentActivity,
  };
}
