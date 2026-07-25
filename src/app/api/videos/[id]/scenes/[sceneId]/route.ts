import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { updateSceneSchema } from "@/lib/validations/video";
import { recordPrompt } from "@/lib/prompts/service";
import { recordProjectVersion } from "@/lib/projects/versioning";
import { deleteSceneAndRenormalize } from "@/lib/scenes/engine";

// PATCH /api/videos/[id]/scenes/[sceneId] — Milestone 7: fix a FAILED scene's
// prompt before re-rendering it via POST .../rerender-failed. Milestone 8:
// the Studio's Scene Editor also allows editing a DRAFT scene (pre-render),
// now widened to the Prompt Studio / voice / background-music / subtitle
// fields too. PENDING/RENDERING/COMPLETED scenes stay off-limits either way
// — editing those would race with the worker or violate the cache guarantee.
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
    const data = updateSceneSchema.parse(body);

    const project = await prisma.videoProject.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
    }

    const claim = await prisma.scene.updateMany({
      where: { id: sceneId, videoProjectId: id, status: { in: ["DRAFT", "FAILED"] } },
      data: {
        ...(data.prompt !== undefined ? { prompt: data.prompt } : {}),
        ...(data.negativePrompt !== undefined ? { negativePrompt: data.negativePrompt || null } : {}),
        ...(data.imagePrompt !== undefined ? { imagePrompt: data.imagePrompt || null } : {}),
        ...(data.videoPrompt !== undefined ? { videoPrompt: data.videoPrompt || null } : {}),
        ...(data.subtitleText !== undefined ? { subtitleText: data.subtitleText || null } : {}),
        ...(data.durationSeconds !== undefined ? { durationSeconds: data.durationSeconds } : {}),
        ...(data.transition !== undefined ? { transition: data.transition } : {}),
        ...(data.voiceId !== undefined ? { voiceId: data.voiceId || null } : {}),
        ...(data.backgroundMusicUrl !== undefined ? { backgroundMusicUrl: data.backgroundMusicUrl || null } : {}),
        ...(data.visualType !== undefined ? { visualType: data.visualType } : {}),
      },
    });
    if (claim.count === 0) {
      return apiError(
        "ERR_INVALID_STATE",
        "Only a draft (pre-render) or failed scene can be edited.",
        409
      );
    }

    // Prompt Studio's "prompt history" — log whichever prompt fields actually
    // changed, distinct from GenerationLog's vendor-attempt telemetry.
    await Promise.all([
      data.prompt !== undefined
        ? recordPrompt({ userId: session.user.id, kind: "SCRIPT", text: data.prompt, videoProjectId: id, sceneId })
        : null,
      data.imagePrompt
        ? recordPrompt({ userId: session.user.id, kind: "IMAGE", text: data.imagePrompt, videoProjectId: id, sceneId })
        : null,
      data.videoPrompt
        ? recordPrompt({ userId: session.user.id, kind: "VIDEO", text: data.videoPrompt, videoProjectId: id, sceneId })
        : null,
      data.negativePrompt
        ? recordPrompt({ userId: session.user.id, kind: "NEGATIVE", text: data.negativePrompt, videoProjectId: id, sceneId })
        : null,
    ]);
    await recordProjectVersion(id, session.user.id);

    const scene = await prisma.scene.findUniqueOrThrow({ where: { id: sceneId } });
    return apiSuccess({ scene });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the scene fields and try again.", 400, {
        issues: err.issues,
      });
    }
    console.error("PATCH /api/videos/[id]/scenes/[sceneId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// DELETE /api/videos/[id]/scenes/[sceneId] — Scene Editor's delete, only
// while the project hasn't been queued for render yet (all scenes are DRAFT
// at that point, so there's no RenderJob bookkeeping to reconcile).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, sceneId } = await params;

  const project = await prisma.videoProject.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, status: true },
  });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
  }
  if (project.status !== "DRAFT" && project.status !== "SCRIPT_READY") {
    return apiError("ERR_INVALID_STATE", "Scenes can only be deleted before rendering starts.", 409);
  }

  const scene = await prisma.scene.findFirst({ where: { id: sceneId, videoProjectId: id } });
  if (!scene) {
    return apiError("ERR_NOT_FOUND", "Scene not found.", 404);
  }

  await deleteSceneAndRenormalize(id, sceneId);
  await recordProjectVersion(id, session.user.id);

  return apiSuccess({ deleted: true });
}
