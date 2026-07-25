import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { InvalidStateError, regenerateSceneVoice } from "@/lib/render/pipeline";
import { checkRateLimit } from "@/lib/security/rate-limit";

// POST /api/videos/[id]/scenes/[sceneId]/regenerate-voice — AI Editing's
// "Regenerate voice": redoes ONLY the voiceover, leaving the scene's
// existing video/image untouched. A new RenderJob kind processed by
// lib/render/pipeline.ts's processRegenVoiceJob().
export async function POST(
  _req: NextRequest,
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

    await regenerateSceneVoice(id, session.user.id, sceneId);
    return apiSuccess({ queued: true });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("POST /api/videos/[id]/scenes/[sceneId]/regenerate-voice failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
