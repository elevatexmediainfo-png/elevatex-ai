import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { updateEditorTrackSchema } from "@/lib/validations/video-editor";
import { removeTrack, updateTrack } from "@/lib/video-editor/tracks";
import { InvalidStateError } from "@/lib/video-editor/errors";

// PATCH /api/editor/projects/[id]/tracks/[trackId] — Layers panel's
// mute/hide toggles.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; trackId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, trackId } = await params;

  try {
    const body = updateEditorTrackSchema.parse(await req.json());

    const project = await prisma.editorProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Project not found.", 404);
    }

    const track = await updateTrack(id, trackId, body);
    return apiSuccess({ track });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the track fields and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("PATCH /api/editor/projects/[id]/tracks/[trackId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// DELETE /api/editor/projects/[id]/tracks/[trackId] — Layers panel's
// "remove track" (cascades to every clip on it).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; trackId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, trackId } = await params;

  const project = await prisma.editorProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Project not found.", 404);
  }

  try {
    await removeTrack(id, trackId);
    return apiSuccess({ deleted: true });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("DELETE /api/editor/projects/[id]/tracks/[trackId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
