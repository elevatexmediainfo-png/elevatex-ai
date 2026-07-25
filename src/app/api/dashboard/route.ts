import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getOrSetCache } from "@/lib/cache/cache";
import { getDashboardData } from "@/lib/dashboard/get-dashboard-data";

// GET /api/dashboard — one composed read for the redesigned Dashboard
// (stats, continue-working, enabled tools, featured templates). The
// Dashboard page itself calls getDashboardData() directly (no need for a
// server-to-server HTTP round trip); this route exists for client-side
// refetches. Briefly cached per-user — same key/TTL either caller uses.
export async function GET() {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const data = await getOrSetCache(`dashboard:${session.user.id}`, 15, () => getDashboardData(session.user.id));
  return apiSuccess(data);
}
