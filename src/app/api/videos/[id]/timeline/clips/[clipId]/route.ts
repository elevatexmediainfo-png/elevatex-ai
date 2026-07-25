import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { updateClipSchema } from "@/lib/validations/editor";
import { deleteClip, InvalidStateError, updateClip } from "@/lib/timeline/engine";
import { recordProjectVersion } from "@/lib/projects/versioning";

// PATCH /api/videos/[id]/timeline/clips/[clipId] — Timeline Editor's
// move/resize/retag/restyle (also used by the Text/Caption/Sticker editors
// to save `content` changes onto their clip).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, clipId } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const data = updateClipSchema.parse(body);

    const project = await prisma.videoProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
    }

    const clip = await updateClip(id, clipId, data);
    await recordProjectVersion(id, session.user.id);

    return apiSuccess({ clip });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the clip fields and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("PATCH /api/videos/[id]/timeline/clips/[clipId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// DELETE /api/videos/[id]/timeline/clips/[clipId] — Timeline Editor's
// remove-clip.
export async function DELETE(
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
    await deleteClip(id, clipId);
    await recordProjectVersion(id, session.user.id);
    return apiSuccess({ deleted: true });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("DELETE /api/videos/[id]/timeline/clips/[clipId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
