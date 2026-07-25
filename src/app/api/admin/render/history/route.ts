import { NextRequest } from "next/server";

import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getRenderHistory } from "@/lib/render/analytics";

const DEFAULT_LIMIT = 50;

// GET /api/admin/render/history?limit=50 — recent RenderJob rows (both
// scene and merge jobs) for the render monitoring dashboard's history table.
export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : DEFAULT_LIMIT;

  return apiSuccess({ history: await getRenderHistory(limit) });
}
