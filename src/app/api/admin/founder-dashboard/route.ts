import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getOrSetCache } from "@/lib/cache/cache";
import { getFounderDashboard } from "@/lib/admin/founder-dashboard";

// Same short-TTL rationale as /api/admin/cost-management and
// /api/admin/revenue — this composes both of those plus several more
// GROUP BY scans, so caching matters more here, not less.
const CACHE_TTL_SECONDS = 60;

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const dashboard = await getOrSetCache("founder-dashboard", CACHE_TTL_SECONDS, () => getFounderDashboard());

  return apiSuccess({ dashboard });
}
