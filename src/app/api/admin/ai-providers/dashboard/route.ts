import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getProviderDashboard } from "@/lib/admin/provider-dashboard";

// GET /api/admin/ai-providers/dashboard — Part 5's Provider Dashboard feed:
// status, current model, latency, success/failure rate, today's/monthly
// cost, last error, health score, and (VIDEO only) queue depth, per
// configurable provider.
export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  return apiSuccess({ dashboard: await getProviderDashboard() });
}
