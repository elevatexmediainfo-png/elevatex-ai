import { NextRequest } from "next/server";

import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getQueueThroughput, getJobLatencyPercentiles } from "@/lib/render/analytics";

const DEFAULT_WINDOW_HOURS = 24;

// GET /api/admin/render/metrics?hours=24 — hour-bucketed completed/failed
// throughput plus claim-to-complete latency percentiles. "Queue Metrics"
// per Milestone 12 Phase A, computed from RenderJob columns that already
// existed — no new tracking added.
export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const hoursParam = Number(req.nextUrl.searchParams.get("hours"));
  const hours = Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : DEFAULT_WINDOW_HOURS;

  const [throughput, latency] = await Promise.all([getQueueThroughput(hours), getJobLatencyPercentiles(hours)]);

  return apiSuccess({ throughput, latency });
}
