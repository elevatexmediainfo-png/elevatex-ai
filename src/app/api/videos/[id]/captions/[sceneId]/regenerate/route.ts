import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { regenerateCaptionWords } from "@/lib/captions/engine";
import { recordProjectVersion } from "@/lib/projects/versioning";

// POST /api/videos/[id]/captions/[sceneId]/regenerate — AI Editing's
// "Regenerate subtitles". Deterministic (proportional word-timing, no
// speech-to-text provider), so this runs synchronously, not through the
// render queue.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, sceneId } = await params;

  const scene = await prisma.scene.findFirst({ where: { id: sceneId, videoProjectId: id, videoProject: { userId: session.user.id } } });
  if (!scene) {
    return apiError("ERR_NOT_FOUND", "Scene not found in this project.", 404);
  }

  const captionBlock = await regenerateCaptionWords(sceneId);
  await recordProjectVersion(id, session.user.id);

  return apiSuccess({ captionBlock });
}
