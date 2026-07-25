import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { splitEditorClipSchema } from "@/lib/validations/video-editor";
import { splitClip } from "@/lib/video-editor/clips";
import { InvalidStateError } from "@/lib/video-editor/errors";

// POST /api/editor/projects/[id]/clips/[clipId]/split — Module 2's Split at
// playhead. offsetMs is measured from the clip's own start.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; clipId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, clipId } = await params;

  try {
    const body = splitEditorClipSchema.parse(await req.json());

    const project = await prisma.editorProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Project not found.", 404);
    }

    const { first, second } = await splitClip(id, clipId, body.offsetMs);
    return apiSuccess({ first, second }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the request and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError || err instanceof RangeError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    console.error("POST /api/editor/projects/[id]/clips/[clipId]/split failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
