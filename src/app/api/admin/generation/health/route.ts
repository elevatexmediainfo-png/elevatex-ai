import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getHealthSnapshot } from "@/lib/generation";

// GET /api/admin/generation/health — current circuit-breaker state for
// every (category, provider) pair the Generation Engine has ever attempted.
// Read-only; the engine itself is the only writer (lib/generation/health.ts).
export async function GET() {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  return apiSuccess({ health: await getHealthSnapshot() });
}
