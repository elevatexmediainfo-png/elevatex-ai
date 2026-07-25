import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { mergeClipsSchema } from "@/lib/validations/editor";
import { InvalidStateError, mergeClips } from "@/lib/timeline/engine";
import { recordProjectVersion } from "@/lib/projects/versioning";

// POST /api/videos/[id]/timeline/clips/merge — Timeline Editor's "merge
// clips" (combines two adjacent, same-source clips on the same track).
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
    const data = mergeClipsSchema.parse(body);

    const project = await prisma.videoProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
    }

    const merged = await mergeClips(id, data.clipId, data.withClipId);
    await recordProjectVersion(id, session.user.id);

    return apiSuccess({ clip: merged });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the request and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    console.error("POST /api/videos/[id]/timeline/clips/merge failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
