import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { createProject } from "@/lib/video-editor/projects";
import { addClip } from "@/lib/video-editor/clips";
import { EDITOR_DIMENSIONS_BY_ASPECT } from "@/lib/video-editor/aspect-dimensions";

// POST /api/marketing-templates/generations/[id]/open-in-editor — "ideally
// openable directly in the AI Video Editor" (2026-07-24 investigation
// concluded yes, a clean fit): mirrors mergeScenesViaEditor()'s own
// throwaway-EditorProject pattern, simplified to one clip since there's
// nothing to sequence. VIDEO outputs only — an IMAGE-output template's
// result is still a real EditorAsset (drag-and-drop-able into ANY project's
// timeline via the normal asset library), it just has no video track to
// auto-populate.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  const { id } = await params;
  const generation = await prisma.marketingTemplateGeneration.findFirst({
    where: { id, userId: session.user.id },
    include: { resultEditorAsset: true, template: true },
  });
  if (!generation || !generation.resultEditorAsset) {
    return apiError("ERR_NOT_FOUND", "Generation not found or has no result yet.", 404);
  }
  if (generation.resultEditorAsset.kind !== "VIDEO") {
    return apiError("ERR_VALIDATION", "Only video outputs can be opened directly in the editor.", 400);
  }

  const dims = EDITOR_DIMENSIONS_BY_ASPECT[generation.template.aspectRatio];
  const project = await createProject(session.user.id, {
    name: `${generation.template.name} — ${new Date().toISOString()}`,
    aspectRatio: dims.editorAspectRatio,
    widthPx: dims.widthPx,
    heightPx: dims.heightPx,
  });
  const videoTrack = project.tracks.find((t) => t.kind === "VIDEO");
  if (!videoTrack) return apiError("ERR_INTERNAL", "New editor project has no video track.", 500);

  const durationMs = Math.round((generation.resultEditorAsset.durationSeconds ?? 8) * 1000);
  await addClip({
    projectId: project.id,
    userId: session.user.id,
    trackId: videoTrack.id,
    assetId: generation.resultEditorAsset.id,
    startMs: 0,
    durationMs,
  });

  return apiSuccess({ projectId: project.id }, 201);
}
