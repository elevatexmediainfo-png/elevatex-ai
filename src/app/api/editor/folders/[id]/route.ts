import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { updateFolderSchema } from "@/lib/validations/video-editor";
import { deleteFolder, updateFolder } from "@/lib/video-editor/folders";
import { InvalidStateError } from "@/lib/video-editor/errors";

// PATCH /api/editor/folders/[id] — rename and/or move (reparent).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const body = updateFolderSchema.parse(await req.json());
    const folder = await updateFolder(session.user.id, id, body);
    return apiSuccess({ folder });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the folder fields and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("PATCH /api/editor/folders/[id] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// DELETE /api/editor/folders/[id] — cascades to child folders; projects
// inside are orphaned to root, not deleted.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    await deleteFolder(session.user.id, id);
    return apiSuccess({ deleted: true });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("DELETE /api/editor/folders/[id] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
