import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { generateVariantImage } from "@/lib/benchmark";
import { z } from "zod";

const bodySchema = z.object({
  variantId:   z.string().min(1),
  aspectRatio: z.enum(["RATIO_9_16", "RATIO_1_1", "RATIO_16_9"]).default("RATIO_9_16"),
});

// POST /api/admin/prompt-lab/[id]/generate
// Generates an image for a specific variant of the benchmark.
// Admin-only. Uses existing generation infrastructure — no credits consumed.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { id: benchmarkId } = await params;
  void benchmarkId; // route param is for URL organisation; variantId is the key

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

  const { variantId, aspectRatio } = parsed.data;

  try {
    const variant = await generateVariantImage({
      variantId,
      userId:      session.user.id,
      aspectRatio,
    });
    return apiSuccess(variant);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed.";
    if (message.includes("already in progress")) {
      return apiError("ERR_CONFLICT", message, 409);
    }
    if (message.includes("not found")) {
      return apiError("ERR_NOT_FOUND", message, 404);
    }
    return apiError("ERR_INTERNAL", message, 500);
  }
}
