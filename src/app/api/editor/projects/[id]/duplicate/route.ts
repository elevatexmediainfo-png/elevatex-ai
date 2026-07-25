import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { duplicateProjectSchema } from "@/lib/validations/video-editor";
import { duplicateProject } from "@/lib/video-editor/projects";
import { InvalidStateError } from "@/lib/video-editor/errors";

// POST /api/editor/projects/[id]/duplicate — deep-copies tracks/clips into
// a new project; referenced assets are shared, not duplicated.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const body = duplicateProjectSchema.parse(await req.json().catch(() => ({})));
    const project = await duplicateProject(session.user.id, id, body.name);
    return apiSuccess({ project }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the request and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("POST /api/editor/projects/[id]/duplicate failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
