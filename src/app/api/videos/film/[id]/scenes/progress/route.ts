import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireOwnedFilmProject } from "@/lib/film/access";

// GET /api/videos/film/[id]/scenes/progress — real-progress polling for the
// "Approve storyboard & generate all scenes" bulk action (2026-07-23), same
// role as merge/progress/route.ts for the Merge step. The bulk POST
// (scenes/generate-all/route.ts) is still one blocking call, but it writes
// each scene's real status (RENDERING -> COMPLETED/FAILED) to the DB as it
// goes — this just reads that back, no separate progress-tracking field
// needed. Lightweight by design (id + status + errorMessage only) so the
// frontend can poll it every few seconds without pulling full scene payloads.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;
  const project = await requireOwnedFilmProject(session.user.id, id);
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Film project not found.", 404);
  }

  const scenes = await prisma.scene.findMany({
    where: { videoProjectId: id },
    orderBy: { order: "asc" },
    select: { id: true, status: true, errorMessage: true },
  });

  return apiSuccess({ scenes });
}
