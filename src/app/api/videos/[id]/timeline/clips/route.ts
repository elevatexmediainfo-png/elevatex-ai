import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createClipSchema } from "@/lib/validations/editor";
import { addClip, InvalidStateError } from "@/lib/timeline/engine";
import { recordProjectVersion } from "@/lib/projects/versioning";

// POST /api/videos/[id]/timeline/clips — Timeline Editor's drag-and-drop
// "place a clip on a track".
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
    const data = createClipSchema.parse(body);

    const project = await prisma.videoProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
    }

    const clip = await addClip({ videoProjectId: id, ...data });
    await recordProjectVersion(id, session.user.id);

    return apiSuccess({ clip }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the clip fields and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("POST /api/videos/[id]/timeline/clips failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
