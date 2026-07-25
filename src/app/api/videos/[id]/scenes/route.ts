import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { appendScene, computeProgress, listScenes } from "@/lib/scenes/engine";
import { getConfig } from "@/lib/admin/config";
import { recordProjectVersion } from "@/lib/projects/versioning";

// GET /api/videos/[id]/scenes — one-shot scene list + overall progress.
// Also the data source the SSE stream (./stream/route.ts) polls internally.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  const project = await prisma.videoProject.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
  }

  const scenes = await listScenes(id);
  return apiSuccess({ scenes, progress: computeProgress(scenes) });
}

// POST /api/videos/[id]/scenes — Scene Editor's "add scene", only while the
// project hasn't been queued for render yet.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  const project = await prisma.videoProject.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, status: true },
  });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
  }
  if (project.status !== "DRAFT" && project.status !== "SCRIPT_READY") {
    return apiError("ERR_INVALID_STATE", "Scenes can only be added before rendering starts.", 409);
  }

  const [negativePrompt, backgroundMusicUrl] = await Promise.all([
    getConfig("DEFAULT_NEGATIVE_PROMPT"),
    getConfig("DEFAULT_BACKGROUND_MUSIC_URL"),
  ]);
  const scene = await appendScene(id, { negativePrompt, backgroundMusicUrl });
  await recordProjectVersion(id, session.user.id);

  return apiSuccess({ scene }, 201);
}
