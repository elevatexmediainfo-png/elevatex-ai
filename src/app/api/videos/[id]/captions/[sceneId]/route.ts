import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { updateCaptionWordsSchema } from "@/lib/validations/editor";
import { InvalidStateError, listCaptionBlock, updateCaptionWords } from "@/lib/captions/engine";
import { recordProjectVersion } from "@/lib/projects/versioning";

// GET /api/videos/[id]/captions/[sceneId] — Caption Editor's initial load.
// Seeds a CaptionBlock from the scene's current subtitle the first time
// this is called for a scene (idempotent thereafter).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, sceneId } = await params;

  const project = await prisma.videoProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
  }

  try {
    const captionBlock = await listCaptionBlock(id, sceneId);
    return apiSuccess({ captionBlock });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("GET /api/videos/[id]/captions/[sceneId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// PATCH /api/videos/[id]/captions/[sceneId] — Caption Editor's save: word
// level editing + manually-adjusted timing + an optional style preset.
// Rebuilds the scene's actual rendered subtitle artifact, so edits reach the
// render pipeline, not just this table.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, sceneId } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const data = updateCaptionWordsSchema.parse(body);

    const project = await prisma.videoProject.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
    }

    const captionBlock = await updateCaptionWords(id, sceneId, data.words, data.stylePresetId);
    await recordProjectVersion(id, session.user.id);

    return apiSuccess({ captionBlock });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the caption words and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("PATCH /api/videos/[id]/captions/[sceneId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
