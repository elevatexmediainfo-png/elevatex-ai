import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createEditorTrackSchema } from "@/lib/validations/video-editor";
import { addTrack } from "@/lib/video-editor/tracks";
import { InvalidStateError } from "@/lib/video-editor/errors";

// POST /api/editor/projects/[id]/tracks — Layers panel's "add track". The
// project-ownership check is inline (not the throwing getOwnedProject()
// helper) so its failure stays distinct from addTrack()'s own
// InvalidStateError (the admin-configured max-tracks-per-project limit,
// which is a 409 business-rule rejection, not a 404).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const body = createEditorTrackSchema.parse(await req.json());

    const project = await prisma.editorProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Project not found.", 404);
    }

    const track = await addTrack(id, body.kind, body.audioSubtype, prisma, body.insertBelowOrder);
    return apiSuccess({ track }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the track fields and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    console.error("POST /api/editor/projects/[id]/tracks failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
