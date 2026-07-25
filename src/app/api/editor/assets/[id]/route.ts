import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { deleteEditorAsset, markEditorAssetUploadFailed } from "@/lib/video-editor/assets";
import { InvalidStateError } from "@/lib/video-editor/errors";

// DELETE /api/editor/assets/[id] — Media Library's "remove asset". Clips
// already referencing it have their assetId cleared, not deleted.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    await deleteEditorAsset(session.user.id, id);
    return apiSuccess({ deleted: true });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("DELETE /api/editor/assets/[id] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// PATCH /api/editor/assets/[id] — narrow, single-purpose: only supports
// { action: "mark-upload-failed" } (local-instant-preview's own failure
// callback, queries.ts's useInstantAddVideoClip) — deliberately not a
// general-purpose asset-update endpoint.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (body?.action !== "mark-upload-failed") {
    return apiError("ERR_VALIDATION", "Unsupported action.", 400);
  }

  await markEditorAssetUploadFailed(session.user.id, id);
  return apiSuccess({ ok: true });
}
