import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { replaceSceneSourceSchema } from "@/lib/validations/editor";
import { InvalidStateError, replaceSceneSource } from "@/lib/timeline/engine";
import { recordProjectVersion } from "@/lib/projects/versioning";

// POST /api/videos/[id]/scenes/[sceneId]/replace — AI Editing's "Replace
// scene": repoints every clip referencing this scene (VIDEO/AUDIO/MUSIC) at
// a different Scene or Asset. Purely a DB pointer swap — no RenderJob.
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
    const body = await req.json().catch(() => ({}));
    const data = replaceSceneSourceSchema.parse(body);

    const project = await prisma.videoProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
    }

    const source = data.sceneId ? { sceneId: data.sceneId } : { assetId: data.assetId! };
    const clips = await replaceSceneSource(id, sceneId, source);
    await recordProjectVersion(id, session.user.id);

    return apiSuccess({ clips });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the request and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("POST /api/videos/[id]/scenes/[sceneId]/replace failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
