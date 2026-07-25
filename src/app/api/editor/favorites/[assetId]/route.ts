import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { toggleFavorite } from "@/lib/video-editor/favorites";
import { InvalidStateError } from "@/lib/video-editor/errors";

// POST /api/editor/favorites/[assetId] — toggles (favorite <-> unfavorite),
// mirroring how a single "heart" button is meant to behave client-side.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  const { assetId } = await params;
  try {
    const result = await toggleFavorite(session.user.id, assetId);
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof InvalidStateError) return apiError("ERR_NOT_FOUND", err.message, 404);
    console.error("POST /api/editor/favorites/[assetId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
