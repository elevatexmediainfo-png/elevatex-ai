import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { InvalidStateError, rerenderFailedScenes } from "@/lib/render/pipeline";

// POST /api/videos/[id]/scenes/rerender-failed — only re-renders scenes that
// actually FAILED (the rest stay cached/COMPLETED), then lets the normal
// finalize flow re-queue the merge once they all succeed.
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
    select: { id: true },
  });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
  }

  try {
    const result = await rerenderFailedScenes(id);
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    throw err;
  }
}
