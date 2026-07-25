import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { cancelInProgressRender, InvalidStateError } from "@/lib/render/pipeline";

// POST /api/videos/[id]/cancel — DRAFT/SCRIPT_READY cancel via a plain
// atomic status flip (nothing has been queued yet). QUEUED/RENDERING/PAUSED
// cancel via cancelInProgressRender (Milestone 7), which also parks/cancels
// any not-yet-claimed scene or merge RenderJobs — a job already PROCESSING
// when cancelled is left to finish naturally (no preemption).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  const project = await prisma.videoProject.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
  }

  if (project.status === "DRAFT" || project.status === "SCRIPT_READY") {
    // Atomic conditional update, not check-then-update: without the WHERE on
    // status, a render request that wins a race after this function's
    // initial read (but commits before this write) would have its QUEUED
    // transition silently clobbered back to CANCELLED.
    const claim = await prisma.videoProject.updateMany({
      where: { id, status: { in: ["DRAFT", "SCRIPT_READY"] } },
      data: { status: "CANCELLED" },
    });
    if (claim.count === 0) {
      return apiError("ERR_INVALID_STATE", "This video can no longer be cancelled.", 409);
    }
  } else {
    try {
      await cancelInProgressRender(id, session.user.id);
    } catch (err) {
      if (err instanceof InvalidStateError) {
        return apiError("ERR_INVALID_STATE", "This video can no longer be cancelled.", 409);
      }
      throw err;
    }
  }

  const updated = await prisma.videoProject.findUniqueOrThrow({ where: { id } });

  return apiSuccess({ project: updated });
}
