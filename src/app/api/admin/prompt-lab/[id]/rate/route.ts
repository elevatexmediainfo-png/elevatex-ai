import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { saveVariantRating } from "@/lib/benchmark";
import { z } from "zod";

const ratingField = z.number().int().min(1).max(10);

const bodySchema = z.object({
  variantId: z.string().min(1),
  rating: z.object({
    commercialAppeal:       ratingField,
    storytelling:           ratingField,
    composition:            ratingField,
    realism:                ratingField,
    premiumFeel:            ratingField,
    scrollStopping:         ratingField,
    brandFit:               ratingField,
    marketingEffectiveness: ratingField,
    overallScore:           ratingField,
    notes:                  z.string().max(2000).optional(),
  }),
});

// POST /api/admin/prompt-lab/[id]/rate
// Saves (upserts) the manual rating for a benchmark variant.
// Admin-only.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  void await params; // benchmarkId — for URL organisation

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

  const { variantId, rating } = parsed.data;

  try {
    await saveVariantRating({ variantId, userId: session.user.id, rating });
    return apiSuccess({ saved: true, variantId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save rating.";
    if (message.includes("not found")) {
      return apiError("ERR_NOT_FOUND", message, 404);
    }
    return apiError("ERR_INTERNAL", message, 500);
  }
}
