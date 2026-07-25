import type { Prisma } from "@/generated/prisma/client";
import { recordAsset } from "@/lib/assets/service";
import { checkVideoActionAccess } from "@/lib/credits/video-actions";
import { splitScriptIntoScenes, type SceneSplit } from "./scene-split";
import { generateVeoLiteVideo, type GenerateVeoLiteVideoResult } from "./veo-lite-video";
import { createReadyEditorAsset } from "@/lib/video-editor/assets";
import { createProject } from "@/lib/video-editor/projects";
import { addTrack } from "@/lib/video-editor/tracks";
import { addClip } from "@/lib/video-editor/clips";
import { createExport, pollExportUntilDone } from "@/lib/video-editor/exports";
import { EDITOR_DIMENSIONS_BY_ASPECT } from "@/lib/video-editor/aspect-dimensions";

// AI Video Phase 3a/3b — the fix for the "whole script crammed into one 8s
// clip" failure: split the script into independent scenes (scene-split.ts),
// generate one Veo Lite clip per scene (reuses Phase 2 unchanged, no
// last-frame chaining between scenes — these are different locations, not
// one continuous shot, so chaining would be the wrong tool here, unlike
// Phase 3b's single-scene consistency test), assemble them onto the
// Editor's timeline, and burn in any on-screen text as real Editor TEXT
// clips — never sent to Veo, applying the "Veo adds bad text" rule found
// live in Phase 2/3b.

const MULTISCENE_GATE_ACTION_KEY = "veo_multiscene_ad";
const CLIP_DURATION_SECONDS = 8;

export class VeoMultisceneVideoError extends Error {
  constructor(
    message: string,
    /** Scenes that succeeded before the chain failed — already real, charged, standalone Assets. */
    public readonly completedScenes: GenerateVeoLiteVideoResult[]
  ) {
    super(message);
    this.name = "VeoMultisceneVideoError";
  }
}

export interface GenerateVeoMultisceneVideoInput {
  userId: string;
  script: string;
  aspectRatio: "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";
}

export interface GenerateVeoMultisceneVideoResult {
  assetId: string;
  storageKey: string;
  sceneClipAssetIds: string[];
  sceneCount: number;
  totalCreditsCharged: number;
  scenes: SceneSplit["scenes"];
  textOverlays: SceneSplit["textOverlays"];
}

export async function generateVeoMultisceneVideo(
  input: GenerateVeoMultisceneVideoInput
): Promise<GenerateVeoMultisceneVideoResult> {
  // Pro+ gate on the feature itself, checked once — separate from
  // veo_lite's own Basic gate that each scene below still passes through
  // individually. Zero credits by design here: real charging is entirely
  // per-scene, via generateVeoLiteVideo()'s own proven charge-after-success.
  await checkVideoActionAccess(input.userId, MULTISCENE_GATE_ACTION_KEY);

  const split = await splitScriptIntoScenes(input.script, input.userId);

  const clips: GenerateVeoLiteVideoResult[] = [];
  for (const scene of split.scenes) {
    let clip: GenerateVeoLiteVideoResult;
    try {
      clip = await generateVeoLiteVideo({
        userId: input.userId,
        prompt: scene.visualPrompt,
        aspectRatio: input.aspectRatio,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new VeoMultisceneVideoError(
        `Multi-scene ad failed generating scene ${scene.sceneNumber}/${split.scenes.length}: ${message}`,
        clips
      );
    }
    clips.push(clip);
  }

  // Assemble — sequential EditorClips on the video track, the same merge
  // primitives Phase 1/3b already proved, minus 3b's last-frame chaining
  // step (independent scenes need no continuity conditioning between clips).
  const dims = EDITOR_DIMENSIONS_BY_ASPECT[input.aspectRatio];
  const project = await createProject(input.userId, {
    name: `Multi-scene ad — ${split.scenes.length} scenes — ${new Date().toISOString()}`,
    aspectRatio: dims.editorAspectRatio,
    widthPx: dims.widthPx,
    heightPx: dims.heightPx,
  });
  const videoTrack = project.tracks.find((t) => t.kind === "VIDEO");
  if (!videoTrack) throw new VeoMultisceneVideoError("New editor project has no video track.", clips);

  const sceneStartMs: number[] = [];
  let cumulativeMs = 0;
  for (let i = 0; i < clips.length; i++) {
    sceneStartMs.push(cumulativeMs);
    const editorAsset = await createReadyEditorAsset({
      userId: input.userId,
      kind: "VIDEO",
      storageKey: clips[i].storageKey,
      originalFilename: `scene-${i + 1}.mp4`,
      mimeType: "video/mp4",
      fileSizeBytes: 0,
      widthPx: dims.widthPx,
      heightPx: dims.heightPx,
      durationSeconds: CLIP_DURATION_SECONDS,
    });
    await addClip({
      projectId: project.id,
      userId: input.userId,
      trackId: videoTrack.id,
      assetId: editorAsset.id,
      startMs: cumulativeMs,
      durationMs: CLIP_DURATION_SECONDS * 1000,
    });
    cumulativeMs += CLIP_DURATION_SECONDS * 1000;
  }

  // Text overlays — real Editor TEXT clips, never sent to Veo. Each one
  // spans its referenced scene's full duration; a scene number the
  // scene-split hallucinated (out of range) is skipped, not a hard failure
  // — the video itself is already real and correct without it.
  if (split.textOverlays.length > 0) {
    // addTrack() itself now defaults every non-AUDIO kind to landing above
    // whatever already exists (see its own doc comment) — this used to need
    // a manual order reassignment here to render in front of the video
    // track; that was a one-off workaround for a general bug, now fixed at
    // the general level, so the workaround is gone.
    const textTrack = await addTrack(project.id, "TEXT");
    for (const overlay of split.textOverlays) {
      const sceneIndex = split.scenes.findIndex((s) => s.sceneNumber === overlay.afterSceneNumber);
      if (sceneIndex === -1) continue;
      await addClip({
        projectId: project.id,
        userId: input.userId,
        trackId: textTrack.id,
        startMs: sceneStartMs[sceneIndex],
        durationMs: CLIP_DURATION_SECONDS * 1000,
        content: {
          text: overlay.text,
          fontFamily: "Inter",
          fontSize: 48,
          color: "#ffffff",
          x: 0.5,
          y: 0.85,
        } as unknown as Prisma.InputJsonValue,
      });
    }
  }

  const exportRow = await createExport({
    projectId: project.id,
    userId: input.userId,
    format: "MP4",
    resolution: "R1080P",
    fps: 30,
  });

  const finished = await pollExportUntilDone(project.id, input.userId, exportRow.id, { maxAttempts: 400, intervalMs: 3000 });
  if (finished.status !== "COMPLETED" || !finished.outputKey) {
    throw new VeoMultisceneVideoError(finished.errorMessage ?? "Multi-scene merge/export failed.", clips);
  }

  const mergedAsset = await recordAsset({
    userId: input.userId,
    kind: "VIDEO",
    source: "AI_GENERATED",
    storageKey: finished.outputKey,
    label: `Multi-scene ad (${split.scenes.length} scenes)`,
  });

  return {
    assetId: mergedAsset.id,
    storageKey: finished.outputKey,
    sceneClipAssetIds: clips.map((c) => c.assetId),
    sceneCount: split.scenes.length,
    totalCreditsCharged: clips.reduce((sum, c) => sum + c.creditsCharged, 0),
    scenes: split.scenes,
    textOverlays: split.textOverlays,
  };
}
