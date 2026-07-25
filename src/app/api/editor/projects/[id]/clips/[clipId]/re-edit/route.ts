import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { reeditClipSchema } from "@/lib/validations/video-editor";
import { reeditClip } from "@/lib/video-editor/ai-reedit";
import { InvalidStateError } from "@/lib/video-editor/errors";

// POST /api/editor/projects/[id]/clips/[clipId]/re-edit — Phase 12 Module
// 9. Interprets ONE free-text instruction about this ONE clip via the
// REASONING provider, returning ONE of a small, fixed set of real
// operations (never applied server-side — the client maps the validated
// response onto the exact same Command constructors every other Timeline
// mutation uses, so it's undo-able like everything else).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; clipId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }
  const { id, clipId } = await params;

  try {
    const body = reeditClipSchema.parse(await req.json());
    const result = await reeditClip({ projectId: id, userId: session.user.id, clipId, instruction: body.instruction });
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the instruction and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("POST /api/editor/projects/[id]/clips/[clipId]/re-edit failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
