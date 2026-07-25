import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createEditorTransitionSchema } from "@/lib/validations/video-editor";
import { addTransition } from "@/lib/video-editor/transitions";
import { InvalidStateError } from "@/lib/video-editor/errors";

// POST /api/editor/projects/[id]/transitions — adds a transition between two
// exactly-adjacent clips on the same track, ripple-shifting the incoming
// clip (and everything after it) earlier by the transition's duration to
// open the overlap window. See lib/video-editor/transitions.ts.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const body = createEditorTransitionSchema.parse(await req.json());

    const project = await prisma.editorProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Project not found.", 404);
    }

    const transition = await addTransition({ projectId: id, ...body });
    return apiSuccess({ transition }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the transition fields and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    console.error("POST /api/editor/projects/[id]/transitions failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
