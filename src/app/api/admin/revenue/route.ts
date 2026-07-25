import { NextRequest } from "next/server";

import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getOrSetCache } from "@/lib/cache/cache";
import {
  getActiveSubscriptionCount,
  getARR,
  getMRR,
  getRevenueByDay,
  getRevenueSummary,
  getTopPlansByRevenue,
} from "@/lib/admin/revenue";

const DEFAULT_WINDOW_DAYS = 30;
// Same short-TTL rationale as /api/admin/cost-management — several GROUP BY
// scans over PaymentIntent/Subscription, refreshed often enough that a new
// payment is reflected within a minute.
const CACHE_TTL_SECONDS = 60;

export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const daysParam = Number(req.nextUrl.searchParams.get("days"));
  const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : DEFAULT_WINDOW_DAYS;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const report = await getOrSetCache(`revenue:${days}`, CACHE_TTL_SECONDS, async () => {
    const [summary, byDay, mrr, arr, activeSubscriptions, topPlans] = await Promise.all([
      getRevenueSummary(since),
      getRevenueByDay(days),
      getMRR(),
      getARR(),
      getActiveSubscriptionCount(),
      getTopPlansByRevenue(since),
    ]);
    return { summary, byDay, mrr, arr, activeSubscriptions, topPlans };
  });

  return apiSuccess({ report, windowDays: days });
}
