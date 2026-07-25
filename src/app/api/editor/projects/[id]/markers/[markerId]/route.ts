import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { removeMarker } from "@/lib/video-editor/markers";
import { InvalidStateError } from "@/lib/video-editor/errors";

// DELETE /api/editor/projects/[id]/markers/[markerId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; markerId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, markerId } = await params;

  const project = await prisma.editorProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Project not found.", 404);
  }

  try {
    await removeMarker(id, markerId);
    return apiSuccess({ deleted: true });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("DELETE /api/editor/projects/[id]/markers/[markerId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
