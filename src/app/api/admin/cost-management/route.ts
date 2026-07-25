import { NextRequest } from "next/server";

import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getCostManagementReport } from "@/lib/admin/cost-management";
import { getOrSetCache } from "@/lib/cache/cache";

const DEFAULT_WINDOW_HOURS = 24 * 30;
// Short TTL — this report does several GROUP BY scans over a potentially
// large GenerationLog table; an admin re-loading/switching window tabs
// within a minute shouldn't re-run all of them, but the data is still fresh
// within a minute of a new generation completing.
const CACHE_TTL_SECONDS = 60;

// GET /api/admin/cost-management?hours=720 — Part 8's Cost Management
// dashboard feed: provider/model/project/user/subscription cost breakdowns
// over a window, all derived from GenerationLog.
export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const hoursParam = Number(req.nextUrl.searchParams.get("hours"));
  const hours = Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : DEFAULT_WINDOW_HOURS;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const report = await getOrSetCache(`cost-management:${hours}`, CACHE_TTL_SECONDS, () =>
    getCostManagementReport(since)
  );

  return apiSuccess({ report, windowHours: hours });
}
