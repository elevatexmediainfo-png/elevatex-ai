import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { InvalidStateError, pauseProject } from "@/lib/render/pipeline";

// POST /api/videos/[id]/pause — parks not-yet-claimed scene RenderJobs
// (PENDING -> PAUSED) so the worker skips them until resumed. Jobs already
// PROCESSING are left to finish naturally — no preemption.
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
    await pauseProject(id, session.user.id);
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    throw err;
  }

  const project = await prisma.videoProject.findUniqueOrThrow({ where: { id } });
  return apiSuccess({ project });
}
