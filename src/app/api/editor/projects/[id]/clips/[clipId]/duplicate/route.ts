import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { duplicateEditorClip } from "@/lib/video-editor/clips";
import { InvalidStateError } from "@/lib/video-editor/errors";

// POST /api/editor/projects/[id]/clips/[clipId]/duplicate — Module 2's
// Duplicate clip.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; clipId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, clipId } = await params;

  const project = await prisma.editorProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Project not found.", 404);
  }

  try {
    const clip = await duplicateEditorClip(id, clipId);
    return apiSuccess({ clip }, 201);
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("POST /api/editor/projects/[id]/clips/[clipId]/duplicate failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
