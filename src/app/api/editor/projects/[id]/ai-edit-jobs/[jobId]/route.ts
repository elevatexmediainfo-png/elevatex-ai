import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { cancelAiEditJob } from "@/lib/video-editor/ai-edit-jobs";
import { InvalidStateError } from "@/lib/video-editor/errors";

// DELETE /api/editor/projects/[id]/ai-edit-jobs/[jobId] — cancels a queued
// or in-progress job. Real bug fix (2026-07-24, found live during the
// codebase health check) — this pipeline had no cancel/retry mechanism at
// all, unlike Export's own matching DELETE .../exports/[exportId]. Same
// shape as that route: cancelAiEditJob() flags the row CANCELLED
// (cancelAiEditJob's own doc comment covers why an actively-running job
// isn't literally preempted, only prevented from ever completing/charging).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; jobId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, jobId } = await params;

  try {
    await cancelAiEditJob(id, session.user.id, jobId);
    return apiSuccess({ cancelled: true });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    console.error("DELETE /api/editor/projects/[id]/ai-edit-jobs/[jobId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
