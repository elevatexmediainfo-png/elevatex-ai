import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { regenerateSceneSchema } from "@/lib/validations/editor";
import { InvalidStateError, regenerateScene } from "@/lib/render/pipeline";
import { checkRateLimit } from "@/lib/security/rate-limit";

// POST /api/videos/[id]/scenes/[sceneId]/regenerate — AI Editing's
// "Regenerate scene": redoes video+image+voice for a scene (even an
// already-COMPLETED one) by resetting it to PENDING and letting the
// existing, unmodified scene-render processor pick it up. Optionally
// carries a new image/video prompt ("Change image prompt"/"Change video
// prompt" apply together with the regenerate).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, sceneId } = await params;

  try {
    const rateLimit = await checkRateLimit("ai_assistant", session.user.id);
    if (!rateLimit.allowed) {
      return apiError("ERR_RATE_LIMIT", "Too many AI actions. Please try again later.", 429, {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const body = await req.json().catch(() => ({}));
    const data = regenerateSceneSchema.parse(body);

    await regenerateScene(id, session.user.id, sceneId, data);
    return apiSuccess({ queued: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the prompt fields and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    console.error("POST /api/videos/[id]/scenes/[sceneId]/regenerate failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
