import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { recordAsset } from "@/lib/assets/service";
import { getConfig } from "@/lib/admin/config";
import { mergeScenesViaEditor, SceneMergeViaEditorError } from "@/lib/scenes/merge-via-editor";
import { requireOwnedFilmProject } from "@/lib/film/access";

// POST /api/videos/film/[id]/merge — the Merge screen's action, joining
// every completed scene into the final film. Fully real — reuses
// mergeScenesViaEditor() exactly as-is (the same vendor-independent Cloud
// Video Editor path AI Video's own merge step uses), since final assembly
// has no dependency on which character-consistency method eventually
// generates each scene's clip. Standalone from render/pipeline.ts's queued
// processMergeJob() (Film scenes aren't enqueued through the standard
// RenderJob flow yet — see scenes/[sceneId]/generate/route.ts's own doc
// comment for why), but does the same real work: merge, upload, record,
// mark the project COMPLETED.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const project = await requireOwnedFilmProject(session.user.id, id);
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Film project not found.", 404);
    }

    const scenes = await prisma.scene.findMany({ where: { videoProjectId: id }, orderBy: { order: "asc" } });
    if (scenes.length === 0) {
      return apiError("ERR_VALIDATION", "This film has no storyboard yet.", 400);
    }
    if (scenes.some((s) => s.status !== "COMPLETED" || !s.videoKey)) {
      return apiError("ERR_VALIDATION", "Every scene must finish generating before the film can be merged.", 400);
    }

    const storage = await getStorageProvider();
    const finalQuality = await getConfig("FINAL_QUALITY");
    // Real bug fix (2026-07-25) — FILM's own generateFilmSceneVideo() now
    // generates a real, separate ElevenLabs voiceover per scene (see that
    // file's own comment for why: the video model no longer renders native
    // speech itself, to avoid two competing voices), stored on
    // Scene.voiceKey exactly like GENERATED already does — this was
    // hardcoded null until now, silently discarding it at merge time.
    const backgroundMusicUrl = await getConfig("DEFAULT_BACKGROUND_MUSIC_URL");
    const merged = await mergeScenesViaEditor({
      userId: session.user.id,
      videoProjectId: id,
      aspectRatio: project.aspectRatio as "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9",
      finalQuality,
      scenes: scenes.map((s) => ({ videoKey: s.videoKey!, durationSeconds: s.durationSeconds, subtitleText: s.subtitleText, voiceKey: s.voiceKey })),
      backgroundMusicUrl: backgroundMusicUrl || null,
    });

    const thumbnailScene = scenes.find((s) => s.imageKey);
    const thumbnailUrl = thumbnailScene?.imageKey
      ? (
          await storage.uploadFromUrl({
            key: `videos/${id}/thumbnail.jpg`,
            sourceUrl: storage.getPublicUrl(thumbnailScene.imageKey),
            contentType: "image/jpeg",
          })
        ).key
      : null;

    await recordAsset({ userId: session.user.id, kind: "VIDEO", storageKey: merged.outputKey, videoProjectId: id, label: "AI Film — merged" });

    const totalDuration = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
    const thumbnailPublicUrl = thumbnailUrl ? storage.getPublicUrl(thumbnailUrl) : null;

    const updated = await prisma.videoProject.update({
      where: { id },
      data: {
        status: "COMPLETED",
        previewVideoUrl: storage.getPublicUrl(merged.outputKey),
        previewThumbnailUrl: thumbnailPublicUrl,
        masterVideoUrl: merged.outputKey,
        masterThumbnailUrl: thumbnailPublicUrl,
        durationSeconds: totalDuration,
        errorMessage: null,
      },
    });

    return apiSuccess({ project: updated });
  } catch (err) {
    if (err instanceof SceneMergeViaEditorError) {
      return apiError("ERR_MERGE_FAILED", err.message, 500);
    }
    console.error("POST /api/videos/film/[id]/merge failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong merging the film.", 500);
  }
}
