import { requireAdminSession } from "@/lib/admin/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createBenchmarkSession } from "@/lib/benchmark";
import { z } from "zod";

const bodySchema = z.object({
  rawIdea:   z.string().min(3).max(2000),
  aspectRatio: z.enum(["RATIO_9_16", "RATIO_1_1", "RATIO_16_9"]).optional().default("RATIO_9_16"),
  brandContext: z
    .object({
      primaryColor:   z.string().optional(),
      secondaryColor: z.string().optional(),
      fontFamily:     z.string().optional(),
    })
    .optional(),
  referenceImageAnalysis: z.string().optional(),
});

// POST /api/admin/prompt-lab/create
// Runs the full AI-OS pipeline, builds 4 prompt variants, stores a benchmark session.
// Admin-only. No credits consumed. Not rate-limited.
export async function POST(req: Request) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

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

  const { rawIdea, brandContext, referenceImageAnalysis } = parsed.data;

  try {
    const result = await createBenchmarkSession({
      rawIdea,
      userId:      session.user.id,
      brandContext,
      referenceImageAnalysis,
    });

    return apiSuccess({
      benchmarkId: result.benchmarkId,
      variants:    result.variants,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create benchmark session.";
    if (message.includes("GPT Creative Director is required")) {
      return apiError("ERR_GPT_UNAVAILABLE", message, 503);
    }
    return apiError("ERR_INTERNAL", message, 500);
  }
}
