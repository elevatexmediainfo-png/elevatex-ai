import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listVersions } from "@/lib/projects/versioning";

// GET /api/videos/[id]/versions — Studio's version history panel.
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
    select: { id: true },
  });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
  }

  const versions = await listVersions(id);
  return apiSuccess({ versions });
}
