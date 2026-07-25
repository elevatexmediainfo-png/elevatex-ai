import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import {
  requestDownload,
  VideoNotReadyError,
  DownloadLimitExceededError,
} from "@/lib/downloads/download-service";
import { InsufficientCreditsError } from "@/lib/credits/engine";

// POST /api/videos/[id]/download — the only route that can ever hand out the
// clean, full-HD master. Validates subscription -> credits -> rate limit
// (see lib/downloads/download-service.ts) and returns a short-lived signed
// URL, never the raw asset location.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const result = await requestDownload({ userId: session.user.id, videoProjectId: id });
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof VideoNotReadyError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    if (err instanceof DownloadLimitExceededError) {
      return apiError("ERR_RATE_LIMIT", err.message, 429);
    }
    if (err instanceof InsufficientCreditsError) {
      return apiError(
        "ERR_INSUFFICIENT_CREDITS",
        `You need ${err.required} credit(s) but only have ${err.available}. Buy more credits or subscribe for unlimited downloads.`,
        402
      );
    }
    if (err instanceof Error && err.message === "Video project not found.") {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    throw err;
  }
}
