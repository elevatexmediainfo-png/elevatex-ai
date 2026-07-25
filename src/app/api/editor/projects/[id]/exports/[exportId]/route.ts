import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { cancelExport, getExport } from "@/lib/video-editor/exports";
import { InvalidStateError } from "@/lib/video-editor/errors";

// GET /api/editor/projects/[id]/exports/[exportId] — status poll (Part B's
// progress tracking: percentage, framesRendered/totalFrames).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; exportId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, exportId } = await params;

  try {
    const exportRow = await getExport(id, session.user.id, exportId);
    return apiSuccess({ export: exportRow });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("GET /api/editor/projects/[id]/exports/[exportId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// DELETE /api/editor/projects/[id]/exports/[exportId] — cancels a queued or
// in-progress export; export-worker.ts checks the CANCELLED flag between
// frames so an active render actually stops promptly.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; exportId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, exportId } = await params;

  try {
    await cancelExport(id, session.user.id, exportId);
    return apiSuccess({ cancelled: true });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    console.error("DELETE /api/editor/projects/[id]/exports/[exportId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
