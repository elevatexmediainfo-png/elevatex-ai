import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listCollectionAssets } from "@/lib/video-editor/collections";
import { InvalidStateError } from "@/lib/video-editor/errors";

// GET /api/editor/collections/[id]/assets
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  const { id } = await params;
  try {
    const assets = await listCollectionAssets(session.user.id, id);
    return apiSuccess({ assets });
  } catch (err) {
    if (err instanceof InvalidStateError) return apiError("ERR_NOT_FOUND", err.message, 404);
    console.error("GET /api/editor/collections/[id]/assets failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
