import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { updateProjectSchema } from "@/lib/validations/video-editor";
import { deleteProject, getProjectWorkspace, updateProject } from "@/lib/video-editor/projects";
import { InvalidStateError } from "@/lib/video-editor/errors";

// GET /api/editor/projects/[id] — the workspace's project + tracks + clips,
// same shape the server-rendered page.tsx seeds as initial data (used here
// for the client's React Query refetches after a mutation elsewhere).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const workspace = await getProjectWorkspace(session.user.id, id);
    return apiSuccess(workspace);
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("GET /api/editor/projects/[id] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// PATCH /api/editor/projects/[id] — rename and/or move to a different folder.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const body = updateProjectSchema.parse(await req.json());
    const project = await updateProject(session.user.id, id, body);
    return apiSuccess({ project });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the project fields and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("PATCH /api/editor/projects/[id] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// DELETE /api/editor/projects/[id] — cascades to its tracks/clips.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    await deleteProject(session.user.id, id);
    return apiSuccess({ deleted: true });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("DELETE /api/editor/projects/[id] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
