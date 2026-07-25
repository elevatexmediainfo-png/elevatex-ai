import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createTrackSchema } from "@/lib/validations/editor";
import { addTrack } from "@/lib/timeline/engine";
import { recordProjectVersion } from "@/lib/projects/versioning";

// POST /api/videos/[id]/timeline/tracks — Layers panel's "add layer".
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
    const data = createTrackSchema.parse(body);

    const project = await prisma.videoProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
    }

    const track = await addTrack(id, data.kind);
    await recordProjectVersion(id, session.user.id);

    return apiSuccess({ track }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the track fields and try again.", 400, { issues: err.issues });
    }
    console.error("POST /api/videos/[id]/timeline/tracks failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
