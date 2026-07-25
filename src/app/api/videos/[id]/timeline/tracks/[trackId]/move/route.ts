import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { moveTrackSchema } from "@/lib/validations/editor";
import { moveTrack, InvalidStateError } from "@/lib/timeline/engine";
import { recordProjectVersion } from "@/lib/projects/versioning";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; trackId: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, trackId } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const data = moveTrackSchema.parse(body);

    const project = await prisma.videoProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
    }

    const tracks = await moveTrack(id, trackId, data.direction);
    await recordProjectVersion(id, session.user.id);

    return apiSuccess({ tracks });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the reorder fields and try again.", 400, {
        issues: err.issues,
      });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    console.error("POST /api/videos/[id]/timeline/tracks/[trackId]/move failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
