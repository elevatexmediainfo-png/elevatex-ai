import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { updateEditorTransitionSchema } from "@/lib/validations/video-editor";
import { removeTransition, updateTransition } from "@/lib/video-editor/transitions";
import { InvalidStateError } from "@/lib/video-editor/errors";

// PATCH /api/editor/projects/[id]/transitions/[transitionId] — resize
// (durationMs, dragged handle, ripple-shifts the same way addTransition
// does) and/or re-pick type/direction/easing (the picker popover).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; transitionId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, transitionId } = await params;

  try {
    const body = updateEditorTransitionSchema.parse(await req.json());

    const project = await prisma.editorProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Project not found.", 404);
    }

    const transition = await updateTransition(id, transitionId, body);
    return apiSuccess({ transition });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the transition fields and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    console.error("PATCH /api/editor/projects/[id]/transitions/[transitionId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// DELETE /api/editor/projects/[id]/transitions/[transitionId] — removes the
// transition and restores the pre-transition, gap-free clip placement (the
// exact inverse ripple-shift of addTransition).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; transitionId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, transitionId } = await params;

  const project = await prisma.editorProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Project not found.", 404);
  }

  try {
    await removeTransition(id, transitionId);
    return apiSuccess({ deleted: true });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("DELETE /api/editor/projects/[id]/transitions/[transitionId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
