import { NextRequest } from "next/server";

import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getUsageAnalytics, getRecentFailures } from "@/lib/generation";

const DEFAULT_WINDOW_HOURS = 24;

// GET /api/admin/generation/analytics?hours=24 — per (category, provider,
// status) counts/avg latency/total cost over a window, plus the most
// recent failures for quick debugging. Backs the Usage Analytics panel on
// /admin/generation.
export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const hoursParam = Number(req.nextUrl.searchParams.get("hours"));
  const hours = Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : DEFAULT_WINDOW_HOURS;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const [usage, recentFailures] = await Promise.all([
    getUsageAnalytics({ since }),
    getRecentFailures(20),
  ]);

  return apiSuccess({ usage, recentFailures, windowHours: hours });
}
