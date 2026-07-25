import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireOwnedFilmProject } from "@/lib/film/access";

// GET /api/videos/film/[id]/scenes/[sceneId]/progress — real-progress
// polling for a single scene's generate/regenerate call (2026-07-25), same
// role as merge/progress/route.ts for the Merge step. A real ~10-minute
// scene render (2 failed video-provider attempts + one timed-out retry,
// live-confirmed during the investigation this route exists to fix) used to
// show nothing but a spinner the whole time — indistinguishable from a
// hang. The generate POST is still one blocking call; this just reads back
// the real attempt/retry state film-scene-video.ts's onProgress callback
// wrote to Scene.renderProgress as it goes, so the frontend can poll it
// concurrently and show real status instead of a silent wait.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, sceneId } = await params;
  const project = await requireOwnedFilmProject(session.user.id, id);
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Film project not found.", 404);
  }

  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, videoProjectId: id },
    select: { status: true, renderProgress: true },
  });
  if (!scene) {
    return apiError("ERR_NOT_FOUND", "Scene not found.", 404);
  }

  return apiSuccess({ status: scene.status, progress: scene.renderProgress });
}
