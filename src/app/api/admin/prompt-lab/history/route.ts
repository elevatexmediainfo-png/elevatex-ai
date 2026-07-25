import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getBenchmarkHistory } from "@/lib/benchmark";

// GET /api/admin/prompt-lab/history
// Returns paginated benchmark history + top-10 best performers for this admin.
// Admin-only.
export async function GET(req: Request) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const url   = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);

  try {
    const data = await getBenchmarkHistory({ userId: session.user.id, limit });
    return apiSuccess(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch history.";
    return apiError("ERR_INTERNAL", message, 500);
  }
}
