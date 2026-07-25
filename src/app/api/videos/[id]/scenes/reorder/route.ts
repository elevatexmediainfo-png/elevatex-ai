import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { reorderScenesSchema } from "@/lib/validations/video";
import { listScenes, reorderScenes } from "@/lib/scenes/engine";
import { recordProjectVersion } from "@/lib/projects/versioning";

// POST /api/videos/[id]/scenes/reorder — Scene Editor's drag-and-drop. The
// body's sceneIds must be exactly this project's scene ids (any order) —
// rejecting a partial/foreign set keeps @@unique([videoProjectId, order])
// from ever landing in an inconsistent state.
export async function POST(
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
    const data = reorderScenesSchema.parse(body);

    const project = await prisma.videoProject.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, status: true },
    });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
    }
    if (project.status !== "DRAFT" && project.status !== "SCRIPT_READY") {
      return apiError("ERR_INVALID_STATE", "Scenes can only be reordered before rendering starts.", 409);
    }

    const existing = await listScenes(id);
    const existingIds = new Set(existing.map((s) => s.id));
    const requestedIds = new Set(data.sceneIds);
    const sameSet =
      existing.length === data.sceneIds.length && [...requestedIds].every((sid) => existingIds.has(sid));
    if (!sameSet) {
      return apiError("ERR_VALIDATION", "sceneIds must be exactly this project's scene ids.", 400);
    }

    await reorderScenes(data.sceneIds);
    await recordProjectVersion(id, session.user.id);

    const scenes = await listScenes(id);
    return apiSuccess({ scenes });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the scene order and try again.", 400, {
        issues: err.issues,
      });
    }
    console.error("POST /api/videos/[id]/scenes/reorder failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
