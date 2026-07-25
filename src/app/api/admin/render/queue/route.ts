import { NextRequest } from "next/server";

import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getQueueSnapshot, getSceneRenderStats } from "@/lib/render/analytics";

const DEFAULT_WINDOW_HOURS = 24;

// GET /api/admin/render/queue?hours=24 — live queue depth + in-flight count,
// plus scene render stats over a window. Backs the render monitoring
// dashboard's "Queue" and "Rendering analytics" panels.
export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const hoursParam = Number(req.nextUrl.searchParams.get("hours"));
  const hours = Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : DEFAULT_WINDOW_HOURS;

  const [queue, sceneStats] = await Promise.all([getQueueSnapshot(), getSceneRenderStats(hours)]);

  return apiSuccess({ queue, sceneStats });
}
