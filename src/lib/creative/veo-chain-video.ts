import { getStorageProvider } from "@/lib/providers/storage";
import { recordAsset } from "@/lib/assets/service";
import { extractLastFrame } from "@/lib/video-editor/ffmpeg-exec";
import { createReadyEditorAsset } from "@/lib/video-editor/assets";
import { createProject } from "@/lib/video-editor/projects";
import { addClip } from "@/lib/video-editor/clips";
import { createExport, pollExportUntilDone } from "@/lib/video-editor/exports";
import { EDITOR_DIMENSIONS_BY_ASPECT } from "@/lib/video-editor/aspect-dimensions";
import { generateVeoLiteVideo, type GenerateVeoLiteVideoResult } from "./veo-lite-video";

// AI Video Phase 3b/3c — chains N Veo Lite clips via last-frame conditioning
// and merges them into one exported video. Deliberately reuses, not
// reimplements, three things already proven live: generateVeoLiteVideo()
// (called once per clip, so every clip is precheck-then-charge-after-
// success exactly like a standalone Phase 2 generation — no new credit
// logic), extractLastFrame() (the same ffmpeg command already used all
// session to pull verification frames, now codified), and the Editor's
// existing multi-clip-on-one-track + Export Engine (Phase 1's merge
// pattern, VIDEO assets instead of IMAGE). The only genuinely new logic
// here is the loop that ties them together.

const CLIP_DURATION_SECONDS = 8; // Veo Lite's confirmed fixed real output length (Phase 2)

export class VeoChainVideoError extends Error {
  constructor(
    message: string,
    /** Clips that succeeded before the chain failed — already real, charged, standalone Assets; not lost even though the merge never ran. */
    public readonly completedClips: GenerateVeoLiteVideoResult[]
  ) {
    super(message);
    this.name = "VeoChainVideoError";
  }
}

export interface GenerateVeoChainVideoInput {
  userId: string;
  prompt: string;
  aspectRatio: "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";
  negativePrompt?: string;
  /** Starting image for clip 1 only. Every later clip starts from the previous clip's own last frame. */
  startImageAssetId?: string;
  /** Total requested length. clipCount = ceil(totalDurationSeconds / 8); the final clip is trimmed to the exact remainder. */
  totalDurationSeconds: number;
}

export interface GenerateVeoChainVideoResult {
  assetId: string;
  storageKey: string;
  clipAssetIds: string[];
  clipCount: number;
  totalCreditsCharged: number;
}

async function bridgeLastFrameAsAsset(userId: string, videoStorageKey: string): Promise<string> {
  const storage = await getStorageProvider();
  const videoBuffer = await storage.download(videoStorageKey);
  const frame = await extractLastFrame(videoBuffer);
  const uploaded = await storage.upload({
    key: `creative-video/${userId}/${Date.now()}-lastframe.png`,
    data: frame.buffer,
    contentType: frame.mimeType,
  });
  const asset = await recordAsset({
    userId,
    kind: "IMAGE",
    source: "AI_GENERATED",
    storageKey: uploaded.key,
    label: "Veo chain — extracted last frame",
  });
  return asset.id;
}

export async function generateVeoChainVideo(input: GenerateVeoChainVideoInput): Promise<GenerateVeoChainVideoResult> {
  const clipCount = Math.max(1, Math.ceil(input.totalDurationSeconds / CLIP_DURATION_SECONDS));

  const clips: GenerateVeoLiteVideoResult[] = [];
  let startImageAssetId = input.startImageAssetId;

  for (let i = 0; i < clipCount; i++) {
    let clip: GenerateVeoLiteVideoResult;
    try {
      clip = await generateVeoLiteVideo({
        userId: input.userId,
        prompt: input.prompt,
        aspectRatio: input.aspectRatio,
        negativePrompt: input.negativePrompt,
        startImageAssetId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new VeoChainVideoError(`Chain failed generating clip ${i + 1}/${clipCount}: ${message}`, clips);
    }
    clips.push(clip);

    // Not the last clip — extract its last frame to condition the next one.
    if (i < clipCount - 1) {
      startImageAssetId = await bridgeLastFrameAsAsset(input.userId, clip.storageKey);
    }
  }

  // Merge — sequential EditorClips on one track, exported exactly like
  // Phase 1 (no new render/merge capability, same primitives).
  const dims = EDITOR_DIMENSIONS_BY_ASPECT[input.aspectRatio];
  const project = await createProject(input.userId, {
    name: `Veo Chain — ${clipCount} clip(s) — ${new Date().toISOString()}`,
    aspectRatio: dims.editorAspectRatio,
    widthPx: dims.widthPx,
    heightPx: dims.heightPx,
  });

  const videoTrack = project.tracks.find((t) => t.kind === "VIDEO");
  if (!videoTrack) throw new VeoChainVideoError("New editor project has no video track.", clips);

  const totalMs = Math.round(input.totalDurationSeconds * 1000);
  let cumulativeMs = 0;
  for (let i = 0; i < clips.length; i++) {
    const isLast = i === clips.length - 1;
    // Every clip but the last plays its full real 8s; the last is trimmed
    // down to whatever's left of the requested total (never longer than
    // its own real 8s).
    const remainingMs = totalMs - cumulativeMs;
    const clipDurationMs = isLast ? Math.min(remainingMs, CLIP_DURATION_SECONDS * 1000) : CLIP_DURATION_SECONDS * 1000;

    const editorAsset = await createReadyEditorAsset({
      userId: input.userId,
      kind: "VIDEO",
      storageKey: clips[i].storageKey,
      originalFilename: `veo-chain-clip-${i + 1}.mp4`,
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
      durationMs: clipDurationMs,
    });

    cumulativeMs += clipDurationMs;
  }

  const exportRow = await createExport({
    projectId: project.id,
    userId: input.userId,
    format: "MP4",
    resolution: "R1080P",
    fps: 30,
  });

  const finished = await pollExportUntilDone(project.id, input.userId, exportRow.id, { maxAttempts: 240 });
  if (finished.status !== "COMPLETED" || !finished.outputKey) {
    throw new VeoChainVideoError(finished.errorMessage ?? "Chain merge/export failed.", clips);
  }

  const mergedAsset = await recordAsset({
    userId: input.userId,
    kind: "VIDEO",
    source: "AI_GENERATED",
    storageKey: finished.outputKey,
    label: `Veo Chain (${clipCount} clips)`,
  });

  return {
    assetId: mergedAsset.id,
    storageKey: finished.outputKey,
    clipAssetIds: clips.map((c) => c.assetId),
    clipCount,
    totalCreditsCharged: clips.reduce((sum, c) => sum + c.creditsCharged, 0),
  };
}
