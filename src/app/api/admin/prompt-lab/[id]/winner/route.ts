import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { markBenchmarkWinner } from "@/lib/benchmark";
import { z } from "zod";

const bodySchema = z.object({
  variantId: z.string().min(1),
});

// POST /api/admin/prompt-lab/[id]/winner
// Marks a variant as the winner of a benchmark session.
// Admin-only.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { id: benchmarkId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("ERR_BAD_REQUEST", "Invalid JSON body.", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", parsed.error.message, 400);
  }

  const { variantId } = parsed.data;

  try {
    await markBenchmarkWinner({ benchmarkId, variantId, userId: session.user.id });
    return apiSuccess({ marked: true, benchmarkId, winnerId: variantId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to mark winner.";
    if (message.includes("not found")) {
      return apiError("ERR_NOT_FOUND", message, 404);
    }
    return apiError("ERR_INTERNAL", message, 500);
  }
}
