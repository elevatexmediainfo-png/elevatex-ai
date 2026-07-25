import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { reorderEditorTrackSchema } from "@/lib/validations/video-editor";
import { reorderTrack } from "@/lib/video-editor/tracks";
import { InvalidStateError } from "@/lib/video-editor/errors";

// POST /api/editor/projects/[id]/tracks/[trackId]/reorder — Layers panel's
// drag-to-reorder. A distinct endpoint rather than a field on the plain
// PATCH route (updateEditorTrackSchema) since reordering is a multi-row
// operation (every track between the old and new position shifts too),
// not a single-row field patch.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; trackId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, trackId } = await params;

  try {
    const body = reorderEditorTrackSchema.parse(await req.json());

    const project = await prisma.editorProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Project not found.", 404);
    }

    const tracks = await reorderTrack(id, trackId, body.targetIndex);
    return apiSuccess({ tracks });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the reorder request and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("POST /api/editor/projects/[id]/tracks/[trackId]/reorder failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
