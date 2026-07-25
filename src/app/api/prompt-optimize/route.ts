import { NextRequest } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { runPromptOptimization } from "@/lib/prompts/optimizer";

const optimizeSchema = z.object({
  kind: z.enum(["SCRIPT", "IMAGE", "VIDEO", "NEGATIVE"]),
  text: z.string().min(1).max(4000),
  businessContext: z.string().max(500).optional(),
  videoProjectId: z.string().optional(),
  sceneId: z.string().optional(),
});

// POST /api/prompt-optimize — Prompt Studio's "Improve this prompt" action.
// Routes through generateScript() (the Generation Engine) exactly like
// every other script/transform/variant call — no parallel optimization
// pipeline.
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = optimizeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Please check the request and try again.", 400, {
      issues: parsed.error.issues,
    });
  }

  try {
    const result = await runPromptOptimization({ userId: session.user.id, ...parsed.data });
    return apiSuccess({ result });
  } catch (err) {
    console.error("POST /api/prompt-optimize failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong optimizing that prompt.", 500);
  }
}
