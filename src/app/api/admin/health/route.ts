import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getHealthDashboard } from "@/lib/admin/health-dashboard";
import { listRecentErrors } from "@/lib/observability/error-log";

// GET /api/admin/health — aggregates DB/Redis/Storage reachability, queue
// depth, provider circuit-breaker state, and recent ErrorLog rows into one
// "is the system healthy" view. Backs the admin Health Dashboard.
export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const [health, recentErrors] = await Promise.all([getHealthDashboard(), listRecentErrors(20)]);
  return apiSuccess({ health, recentErrors });
}
