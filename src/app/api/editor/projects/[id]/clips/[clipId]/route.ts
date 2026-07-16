import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { updateEditorClipSchema } from "@/lib/validations/video-editor";
import { deleteClip, updateClip } from "@/lib/video-editor/clips";
import { InvalidStateError } from "@/lib/video-editor/errors";

// PATCH /api/editor/projects/[id]/clips/[clipId] — move/trim/restyle.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; clipId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, clipId } = await params;

  try {
    const body = updateEditorClipSchema.parse(await req.json());

    const project = await prisma.editorProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Project not found.", 404);
    }

    const { clip, prunedTransitions } = await updateClip(id, clipId, body);
    return apiSuccess({ clip, prunedTransitions });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the clip fields and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("PATCH /api/editor/projects/[id]/clips/[clipId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// DELETE /api/editor/projects/[id]/clips/[clipId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; clipId: string }> }) {
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
    await deleteClip(id, clipId);
    return apiSuccess({ deleted: true });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("DELETE /api/editor/projects/[id]/clips/[clipId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
