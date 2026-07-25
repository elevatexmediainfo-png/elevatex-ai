import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { updateScriptSchema } from "@/lib/validations/video";
import { recordProjectVersion } from "@/lib/projects/versioning";

// GET /api/videos/[id] — detail + status, polled by the videos/[id] page
// while the project is QUEUED/RENDERING.
export async function GET(
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
    include: { template: { select: { name: true } } },
  });

  if (!project) {
    return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
  }

  return apiSuccess({ project });
}

// PATCH /api/videos/[id] — edit the AI-generated script before confirming
// render. Only allowed while the project hasn't been queued yet.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const data = updateScriptSchema.parse(body);

    const existing = await prisma.videoProject.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
    }

    // Atomic conditional update — guards against editing a script after a
    // concurrent /render call already snapshotted it into a render job's
    // payload (the edit would otherwise look "saved" but never actually render).
    const claim = await prisma.videoProject.updateMany({
      where: { id, status: "SCRIPT_READY" },
      data: { generatedScript: data.generatedScript },
    });
    if (claim.count === 0) {
      return apiError(
        "ERR_INVALID_STATE",
        "This script can no longer be edited.",
        409
      );
    }

    const project = await prisma.videoProject.findUniqueOrThrow({ where: { id } });
    await recordProjectVersion(id, session.user.id);

    return apiSuccess({ project });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the script and try again.", 400, {
        issues: err.issues,
      });
    }
    console.error("PATCH /api/videos/[id] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
