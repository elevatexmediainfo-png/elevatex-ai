import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { setThumbnailSchema } from "@/lib/validations/video";

// POST /api/videos/[id]/thumbnail — Scene Editor's thumbnail picker. Stored
// as a plain scene-id pointer (VideoProject.thumbnailSceneId), read by the
// merge step (lib/render/pipeline.ts's processMergeJob) once all scenes are
// COMPLETED — so this can be set any time before the project finishes.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const data = setThumbnailSchema.parse(body);

    const project = await prisma.videoProject.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, status: true },
    });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
    }
    if (project.status === "COMPLETED" || project.status === "CANCELLED") {
      return apiError("ERR_INVALID_STATE", "This video's thumbnail can no longer be changed.", 409);
    }

    const scene = await prisma.scene.findFirst({ where: { id: data.sceneId, videoProjectId: id } });
    if (!scene) {
      return apiError("ERR_NOT_FOUND", "Scene not found in this project.", 404);
    }

    const updated = await prisma.videoProject.update({
      where: { id },
      data: { thumbnailSceneId: data.sceneId },
    });

    return apiSuccess({ project: updated });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the request and try again.", 400, {
        issues: err.issues,
      });
    }
    console.error("POST /api/videos/[id]/thumbnail failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
