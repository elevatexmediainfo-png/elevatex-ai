import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { restoreVersion } from "@/lib/video-editor/versions";
import { InvalidStateError } from "@/lib/video-editor/errors";

// POST /api/editor/projects/[id]/versions/[versionId]/restore — swaps in
// the target version's tracks/clips/markers, but first snapshots the
// CURRENT state (always, no dedup) and returns its id as
// `preRestoreVersionId` so the client can build an undo-able Command (see
// commands.ts#createRestoreVersionCommand) without diffing anything itself.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, versionId } = await params;

  const project = await prisma.editorProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Project not found.", 404);
  }

  try {
    const result = await restoreVersion(id, versionId);
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("POST /api/editor/projects/[id]/versions/[versionId]/restore failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
