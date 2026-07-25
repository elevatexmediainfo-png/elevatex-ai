import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getBenchmark } from "@/lib/benchmark";

// GET /api/admin/prompt-lab/[id]
// Returns a single benchmark session with all variants and ratings.
// Admin-only.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { id } = await params;

  try {
    const benchmark = await getBenchmark({ id, userId: session.user.id });
    if (!benchmark) return apiError("ERR_NOT_FOUND", "Benchmark not found.", 404);
    return apiSuccess(benchmark);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch benchmark.";
    return apiError("ERR_INTERNAL", message, 500);
  }
}
