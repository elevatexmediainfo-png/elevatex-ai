import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ensureTimeline, listTimeline } from "@/lib/timeline/engine";

// GET /api/videos/[id]/timeline — Timeline Editor's initial load. Seeds
// VIDEO/AUDIO/MUSIC/CAPTION tracks from the project's current scenes the
// first time this is called for a project (idempotent thereafter).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  const project = await prisma.videoProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
  }

  await ensureTimeline(id);
  const timeline = await listTimeline(id);
  return apiSuccess(timeline);
}
