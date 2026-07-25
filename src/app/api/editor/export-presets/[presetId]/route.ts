import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { deleteExportPreset } from "@/lib/video-editor/export-presets";
import { InvalidStateError } from "@/lib/video-editor/errors";

// DELETE /api/editor/export-presets/[presetId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ presetId: string }> }) {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  const { presetId } = await params;

  try {
    await deleteExportPreset(session.user.id, presetId);
    return apiSuccess({ deleted: true });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("DELETE /api/editor/export-presets/[presetId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
