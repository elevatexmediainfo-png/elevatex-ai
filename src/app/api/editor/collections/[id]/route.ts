import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { deleteCollection } from "@/lib/video-editor/collections";
import { InvalidStateError } from "@/lib/video-editor/errors";

// DELETE /api/editor/collections/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  const { id } = await params;
  try {
    await deleteCollection(session.user.id, id);
    return apiSuccess({ deleted: true });
  } catch (err) {
    if (err instanceof InvalidStateError) return apiError("ERR_NOT_FOUND", err.message, 404);
    console.error("DELETE /api/editor/collections/[id] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
