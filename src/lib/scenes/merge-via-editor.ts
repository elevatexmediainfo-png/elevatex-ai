import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { createReadyEditorAsset } from "@/lib/video-editor/assets";
import { createProject } from "@/lib/video-editor/projects";
import { addTrack } from "@/lib/video-editor/tracks";
import { addClip } from "@/lib/video-editor/clips";
import { createExport, pollExportUntilDone } from "@/lib/video-editor/exports";
import { EDITOR_DIMENSIONS_BY_ASPECT } from "@/lib/video-editor/aspect-dimensions";
import type { ExportResolution } from "@/lib/video-editor/export-engine";

// AI Video reconciliation Step 2 — the last piece of the "flower" problem.
// System A's scene merge (lib/render/pipeline.ts's processMergeJob) used to
// call provider.mergeScenes() through the Generation Engine — real for
// mock, but Veo/Kling/Seedance all THROW on it ("no generic scene-merge
// capability", an honest, documented limitation, not a bug) — so every
// final video silently fell back to mock's canned sample, even after real
// per-scene Veo generation was fixed. This reuses the exact mechanism AI
// Video Phase 3's veo-multiscene-video.ts already proved live: assemble the
// real scene clips as sequential EditorClips and render the join through
// the Cloud Video Editor's Export Engine, which steps a real headless-
// browser compositor + ffmpeg — a genuinely vendor-independent path, not
// something that can ever throw "no merge capability" the way a video
// vendor's own API can.
//
// Deliberately minimal, not a timeline-UI migration: this creates one
// throwaway EditorProject per merge, used only to drive one real export,
// never surfaced as an editable project anywhere in the UI. The
// preview/master watermark distinction the old vendor-merge path had is
// dropped here — both previewVideoUrl and masterVideoUrl now point at the
// SAME one real render. Worth a real follow-up if preventing free
// full-quality streaming via the preview URL before a paid download
// actually matters — out of scope for "make the final video real."

const FINAL_QUALITY_TO_EXPORT_RESOLUTION: Record<"1080p" | "4K", ExportResolution> = {
  "1080p": "R1080P",
  "4K": "R4K",
};

export class SceneMergeViaEditorError extends Error {}

export interface MergeScenesViaEditorScene {
  videoKey: string;
  durationSeconds: number;
  /** Scene-split's textOverlays land here (Scene.subtitleText) — rendered as a real Editor TEXT clip, never sent to any video vendor. Empty/null means no overlay for this scene. */
  subtitleText: string | null;
  /** Real bug fix (2026-07-25) — this scene's own generated narration (pipeline.ts's generateVoiceover() call) was being recorded but never actually reached the final merged output; this field is what closes that gap. Null when the scene has no voiceover (includeVoiceover off, or a Talking Head scene). */
  voiceKey: string | null;
}

export interface MergeScenesViaEditorInput {
  userId: string;
  videoProjectId: string;
  aspectRatio: "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";
  finalQuality: "1080p" | "4K";
  scenes: MergeScenesViaEditorScene[];
  /** Real bug fix (2026-07-25) — same gap as voiceKey above: DEFAULT_BACKGROUND_MUSIC_URL was assigned onto every scene but never actually composited in. One track spanning the full merged duration, not per-scene (it's the same URL on every scene by construction — see lib/scenes/engine.ts's createScenesFromScript). Null/undefined = no music. */
  backgroundMusicUrl?: string | null;
}

export interface MergeScenesViaEditorResult {
  outputKey: string;
}

// 2026-07-12 — a real merge stalling twice in the same afternoon surfaced two
// separate problems, both fixed here:
//
// 1. The headless-Chromium render genuinely can take longer than the old
// flat 20-minute poll cap. Confirmed live: a 5-scene/60s film's export
// (1800 frames @ 30fps) rendered at ~1-1.8 frames/sec on this host's
// software (swiftshader, no GPU) compositor — 1800 frames landing right at
// or past the old 400-attempt/3s-interval = 1200s cap, even though the
// render was genuinely progressing the whole time, not stuck. The cap is
// now derived from the actual content length instead of a fixed number, at
// a conservative 2s-of-wait-budget per frame (roughly double the slowest
// rate observed live) — a 60s film gets ~60 minutes of patience instead of
// a flat 20. NOTE: this is still a synchronous poll-until-done design: a
// much longer film (multiple minutes) would need a real async/"check back
// later" redesign, not just a bigger number — flagged here, not solved.
//
// 2. Nothing stopped a second call for the SAME videoProjectId from
// starting an entirely new render while an earlier one was still actively
// RENDERING (e.g. an impatient retry click) — two headless-Chromium
// compositors competing for the same CPU would make both slower, plausibly
// compounding exactly this problem. Now checks for and reuses an
// already-in-flight export for this project instead of piling on a
// redundant one.
const SECONDS_OF_WAIT_BUDGET_PER_FRAME = 2;
const POLL_INTERVAL_MS = 3000;
const MIN_POLL_ATTEMPTS = 400; // the old flat cap, kept as a floor for very short merges

export async function mergeScenesViaEditor(input: MergeScenesViaEditorInput): Promise<MergeScenesViaEditorResult> {
  if (input.scenes.length === 0) {
    throw new SceneMergeViaEditorError("No completed scenes to merge.");
  }

  const inFlight = await findInFlightMergeExport(input.userId, input.videoProjectId);
  if (inFlight) {
    const finished = await pollExportUntilDone(inFlight.projectId, input.userId, inFlight.id, {
      maxAttempts: computePollMaxAttempts(input.scenes),
      intervalMs: POLL_INTERVAL_MS,
    });
    if (finished.status !== "COMPLETED" || !finished.outputKey) {
      throw new SceneMergeViaEditorError(finished.errorMessage ?? "Scene merge/export failed.");
    }
    return { outputKey: finished.outputKey };
  }

  const dims = EDITOR_DIMENSIONS_BY_ASPECT[input.aspectRatio];
  const project = await createProject(input.userId, {
    name: `Scene merge — ${input.videoProjectId} — ${new Date().toISOString()}`,
    aspectRatio: dims.editorAspectRatio,
    widthPx: dims.widthPx,
    heightPx: dims.heightPx,
  });
  const videoTrack = project.tracks.find((t) => t.kind === "VIDEO");
  if (!videoTrack) throw new SceneMergeViaEditorError("New editor project has no video track.");

  const sceneStartMs: number[] = [];
  let cumulativeMs = 0;
  for (const scene of input.scenes) {
    sceneStartMs.push(cumulativeMs);
    const durationMs = Math.round(scene.durationSeconds * 1000);
    const editorAsset = await createReadyEditorAsset({
      userId: input.userId,
      kind: "VIDEO",
      storageKey: scene.videoKey,
      originalFilename: "scene.mp4",
      mimeType: "video/mp4",
      fileSizeBytes: 0,
      widthPx: dims.widthPx,
      heightPx: dims.heightPx,
      durationSeconds: scene.durationSeconds,
    });
    await addClip({
      projectId: project.id,
      userId: input.userId,
      trackId: videoTrack.id,
      assetId: editorAsset.id,
      startMs: cumulativeMs,
      durationMs,
    });
    cumulativeMs += durationMs;
  }

  const overlays = input.scenes
    .map((scene, i) => ({ text: scene.subtitleText, startMs: sceneStartMs[i], durationMs: Math.round(scene.durationSeconds * 1000) }))
    .filter((overlay): overlay is { text: string; startMs: number; durationMs: number } => !!overlay.text && overlay.text.trim().length > 0);

  if (overlays.length > 0) {
    // addTrack() now defaults every non-AUDIO kind to landing above
    // whatever already exists — this used to need a manual order
    // reassignment (matching veo-multiscene-video.ts's identical old
    // workaround) to render in front of the video track; fixed at the
    // general level now, so the workaround is gone.
    const textTrack = await addTrack(project.id, "TEXT");
    for (const overlay of overlays) {
      await addClip({
        projectId: project.id,
        userId: input.userId,
        trackId: textTrack.id,
        startMs: overlay.startMs,
        durationMs: overlay.durationMs,
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

  // Real bug fix (2026-07-25) — voiceKey/backgroundMusicUrl were real,
  // already-generated inputs (pipeline.ts's generateVoiceover() call, and
  // getConfig("DEFAULT_BACKGROUND_MUSIC_URL")) that this function silently
  // discarded: every GENERATED video's real narration was recorded as an
  // Asset and then never reached the final merged output. Same AUDIO track
  // kind/VOICE-MUSIC subtype the main Cloud Video Editor UI already uses —
  // this was the one caller that never wired it up, not a missing
  // capability in the Export Engine itself.
  const voiceClips = input.scenes
    .map((scene, i) => ({ voiceKey: scene.voiceKey, startMs: sceneStartMs[i], durationMs: Math.round(scene.durationSeconds * 1000) }))
    .filter((c): c is { voiceKey: string; startMs: number; durationMs: number } => !!c.voiceKey);

  if (voiceClips.length > 0) {
    const voiceTrack = await addTrack(project.id, "AUDIO", "VOICE");
    for (const clip of voiceClips) {
      const voiceAsset = await createReadyEditorAsset({
        userId: input.userId,
        kind: "AUDIO",
        storageKey: clip.voiceKey,
        originalFilename: "voice.mp3",
        mimeType: "audio/mpeg",
        fileSizeBytes: 0,
        durationSeconds: clip.durationMs / 1000,
      });
      await addClip({
        projectId: project.id,
        userId: input.userId,
        trackId: voiceTrack.id,
        assetId: voiceAsset.id,
        startMs: clip.startMs,
        durationMs: clip.durationMs,
      });
    }
  }

  if (input.backgroundMusicUrl) {
    const storage = await getStorageProvider();
    const musicKey = `scene-merges/${input.videoProjectId}/music-${Date.now()}.mp3`;
    await storage.uploadFromUrl({ key: musicKey, sourceUrl: input.backgroundMusicUrl, contentType: "audio/mpeg" });
    const musicAsset = await createReadyEditorAsset({
      userId: input.userId,
      kind: "AUDIO",
      storageKey: musicKey,
      originalFilename: "music.mp3",
      mimeType: "audio/mpeg",
      fileSizeBytes: 0,
      durationSeconds: cumulativeMs / 1000,
    });
    const musicTrack = await addTrack(project.id, "AUDIO", "MUSIC");
    await addClip({
      projectId: project.id,
      userId: input.userId,
      trackId: musicTrack.id,
      assetId: musicAsset.id,
      startMs: 0,
      durationMs: cumulativeMs,
    });
  }

  const exportRow = await createExport({
    projectId: project.id,
    userId: input.userId,
    format: "MP4",
    resolution: FINAL_QUALITY_TO_EXPORT_RESOLUTION[input.finalQuality],
    fps: 30,
  });

  const finished = await pollExportUntilDone(project.id, input.userId, exportRow.id, {
    maxAttempts: computePollMaxAttempts(input.scenes),
    intervalMs: POLL_INTERVAL_MS,
  });
  if (finished.status !== "COMPLETED" || !finished.outputKey) {
    throw new SceneMergeViaEditorError(finished.errorMessage ?? "Scene merge/export failed.");
  }

  return { outputKey: finished.outputKey };
}

function computePollMaxAttempts(scenes: MergeScenesViaEditorScene[]): number {
  const totalDurationSeconds = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  const totalFrames = totalDurationSeconds * 30; // this function always exports at 30fps
  const budgetMs = totalFrames * SECONDS_OF_WAIT_BUDGET_PER_FRAME * 1000;
  return Math.max(MIN_POLL_ATTEMPTS, Math.ceil(budgetMs / POLL_INTERVAL_MS));
}

// Finds an export this exact function already kicked off for this
// videoProjectId that's still QUEUED or RENDERING — relies on this
// function's own naming convention (`Scene merge — ${videoProjectId} — `)
// since EditorProject has no direct FK back to the source VideoProject
// (deliberate — these are throwaway, never a real editable project, see
// this file's own top-of-file doc comment).
async function findInFlightMergeExport(
  userId: string,
  videoProjectId: string
): Promise<{ id: string; projectId: string } | null> {
  const candidateProjects = await prisma.editorProject.findMany({
    where: { userId, name: { startsWith: `Scene merge — ${videoProjectId} — ` } },
    select: { id: true },
  });
  if (candidateProjects.length === 0) return null;

  const inFlightExport = await prisma.editorExport.findFirst({
    where: { projectId: { in: candidateProjects.map((p) => p.id) }, userId, status: { in: ["QUEUED", "RENDERING"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, projectId: true },
  });
  return inFlightExport;
}

// FILM Merge progress polling (2026-07-23) — mergeScenesViaEditor() is
// still one synchronous call (its own internal pollExportUntilDone loop,
// not converted to a real background job — a bigger, separate change),
// which meant real per-frame progress ALREADY tracked on EditorExport.progress
// (exports.ts's computeProgressPercent, updated during the export worker's
// frame loop) was invisible to the frontend the whole time it was blocked
// on the one merge POST call. Live-measured: a 60s/5-scene film's Merge
// took 25-35 minutes with zero feedback, indistinguishable from a hang —
// this reuses findInFlightMergeExport's own naming-convention lookup (not
// status-restricted, so it returns the FINAL state too, letting the
// frontend's poll loop see COMPLETED/FAILED and stop) so a route can poll
// it CONCURRENTLY with the still-blocking merge request, without
// restructuring that request into a real async job.
export async function getMergeExportProgress(
  userId: string,
  videoProjectId: string
): Promise<{ status: string; progress: number; framesRendered: number; totalFrames: number | null } | null> {
  const candidateProjects = await prisma.editorProject.findMany({
    where: { userId, name: { startsWith: `Scene merge — ${videoProjectId} — ` } },
    select: { id: true },
  });
  if (candidateProjects.length === 0) return null;

  const latestExport = await prisma.editorExport.findFirst({
    where: { projectId: { in: candidateProjects.map((p) => p.id) }, userId },
    orderBy: { createdAt: "desc" },
    select: { status: true, progress: true, framesRendered: true, totalFrames: true },
  });
  return latestExport;
}
