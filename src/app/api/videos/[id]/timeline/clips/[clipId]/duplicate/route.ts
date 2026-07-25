import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { duplicateClip, InvalidStateError } from "@/lib/timeline/engine";
import { recordProjectVersion } from "@/lib/projects/versioning";

// POST /api/videos/[id]/timeline/clips/[clipId]/duplicate — Timeline
// Editor's "duplicate clip" (placed immediately after the original).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, clipId } = await params;

  const project = await prisma.videoProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
  }

  try {
    const clip = await duplicateClip(id, clipId);
    await recordProjectVersion(id, session.user.id);
    return apiSuccess({ clip }, 201);
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("POST /api/videos/[id]/timeline/clips/[clipId]/duplicate failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
