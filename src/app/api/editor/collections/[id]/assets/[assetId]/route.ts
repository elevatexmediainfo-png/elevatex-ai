import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { addAssetToCollection, removeAssetFromCollection } from "@/lib/video-editor/collections";
import { InvalidStateError } from "@/lib/video-editor/errors";

// POST /api/editor/collections/[id]/assets/[assetId]
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  const { id, assetId } = await params;
  try {
    await addAssetToCollection(session.user.id, id, assetId);
    return apiSuccess({ added: true });
  } catch (err) {
    if (err instanceof InvalidStateError) return apiError("ERR_NOT_FOUND", err.message, 404);
    console.error("POST /api/editor/collections/[id]/assets/[assetId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// DELETE /api/editor/collections/[id]/assets/[assetId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  const { id, assetId } = await params;
  try {
    await removeAssetFromCollection(session.user.id, id, assetId);
    return apiSuccess({ removed: true });
  } catch (err) {
    if (err instanceof InvalidStateError) return apiError("ERR_NOT_FOUND", err.message, 404);
    console.error("DELETE /api/editor/collections/[id]/assets/[assetId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
