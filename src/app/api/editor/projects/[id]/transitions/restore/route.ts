import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createEditorTransitionSchema } from "@/lib/validations/video-editor";
import { restorePrunedTransition } from "@/lib/video-editor/transitions";
import { InvalidStateError } from "@/lib/video-editor/errors";

// POST /api/editor/projects/[id]/transitions/restore — Full Regression
// Pass follow-up fix (2026-07-16). NOT the same operation as the sibling
// POST /transitions route: that one expects gap-free adjacent clips and
// performs its own ripple-shift to open the overlap; this one is only
// ever called by Move/Trim's own undo (commands.ts) after repositioning a
// clip back to the exact OVERLAPPING position a transition it broke used
// to occupy — see restorePrunedTransition's own doc comment for why reusing
// the gap-free route would always fail here. Same request shape (kept for
// symmetry/reuse of the existing Zod schema), different validation and no
// repositioning side effect.
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

    const transition = await restorePrunedTransition({ projectId: id, ...body });
    return apiSuccess({ transition }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the transition fields and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    console.error("POST /api/editor/projects/[id]/transitions/restore failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
