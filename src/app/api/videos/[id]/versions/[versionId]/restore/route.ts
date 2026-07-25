import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { InvalidStateError, restoreVersion } from "@/lib/projects/versioning";
import { listScenes } from "@/lib/scenes/engine";

// POST /api/videos/[id]/versions/[versionId]/restore — Studio's version
// history "restore". Only safe pre-render (DRAFT/SCRIPT_READY), enforced
// inside restoreVersion() itself since it fully replaces scene rows.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, versionId } = await params;

  const project = await prisma.videoProject.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
  }

  try {
    await restoreVersion(id, versionId, session.user.id);
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    console.error("POST /api/videos/[id]/versions/[versionId]/restore failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong restoring that version.", 500);
  }

  const [updated, scenes] = await Promise.all([
    prisma.videoProject.findUniqueOrThrow({ where: { id } }),
    listScenes(id),
  ]);
  return apiSuccess({ project: updated, scenes });
}
