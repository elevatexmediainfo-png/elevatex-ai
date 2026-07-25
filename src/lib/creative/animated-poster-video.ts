import type { Prisma } from "@/generated/prisma/client";
import type { AspectRatio } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { recordAsset } from "@/lib/assets/service";
import { consumeCredits } from "@/lib/credits/engine";
import { checkVideoActionAccess } from "@/lib/credits/video-actions";
import { createReadyEditorAsset } from "@/lib/video-editor/assets";
import { createProject } from "@/lib/video-editor/projects";
import { addClip } from "@/lib/video-editor/clips";
import { createExport, pollExportUntilDone } from "@/lib/video-editor/exports";
import { createKeyframe, DEFAULT_CLIP_TRANSFORM, type ClipTransform } from "@/lib/video-editor/transform";
import { EDITOR_DIMENSIONS_BY_ASPECT } from "@/lib/video-editor/aspect-dimensions";

// AI Video Phase 1 — Animated Poster Video. The orchestrator that ties
// together the pieces confirmed to already exist: an existing poster Asset
// is bridged into the Cloud Video Editor (createReadyEditorAsset, no bytes
// re-uploaded), assembled into a minimal one-clip EditorProject with a
// zoom-in animation preset already built for Module 6, and rendered through
// the existing Export Engine queue. Credits are charged only after the
// render actually completes — never on failure — the same
// precheck-then-charge-after-success pattern renderTalkingHeadScene() uses,
// applied here instead of a new deduct/refund mechanism.

const ANIMATED_POSTER_ACTION_KEY = "animated_poster";
const ANIMATED_POSTER_DURATION_MS = 6000;

// Live-reviewed and adjusted: the shared "zoom-in" preset (transform.ts,
// 60% -> 100%) starts too small/letterboxed for this specific use — a
// poster's own text is meant to be legible from frame 0, not zoomed past.
// A local, gentler range (85% -> 100%) fixes that without touching the
// shared preset itself, which is also used by the general-purpose Cloud
// Video Editor for arbitrary clips where a bigger pop-in IS the intended
// look — changing it there would be a much wider blast radius than this
// feature's own opening-frame polish. Same timing (over the first 500ms,
// then hold) as the shared preset — only the range changed.
const ZOOM_START_SCALE = 85;
const ZOOM_DURATION_MS = 500;

function buildAnimatedPosterTransform(durationMs: number): ClipTransform {
  const zoomEnd = Math.min(ZOOM_DURATION_MS, durationMs);
  return {
    ...DEFAULT_CLIP_TRANSFORM,
    scale: {
      value: DEFAULT_CLIP_TRANSFORM.scale.value,
      keyframes: [
        createKeyframe(0, ZOOM_START_SCALE, { in: { type: "LINEAR" }, out: { type: "EASE_OUT" } }),
        createKeyframe(zoomEnd, 100, { in: { type: "EASE_OUT" }, out: { type: "LINEAR" } }),
      ],
    },
  };
}

export class AnimatedPosterVideoError extends Error {}

export interface GenerateAnimatedPosterVideoInput {
  userId: string;
  /** An existing, owned Asset id — typically a completed MARKETING_CREATIVE poster. */
  posterAssetId: string;
}

export interface GenerateAnimatedPosterVideoResult {
  assetId: string;
  storageKey: string;
  editorProjectId: string;
  exportId: string;
  creditsCharged: number;
}

export async function generateAnimatedPosterVideo(
  input: GenerateAnimatedPosterVideoInput
): Promise<GenerateAnimatedPosterVideoResult> {
  // Precheck — cheap, avoids spending real render compute on a request that
  // would be rejected anyway; consumeCredits() re-validates atomically below.
  const { credits } = await checkVideoActionAccess(input.userId, ANIMATED_POSTER_ACTION_KEY);

  const posterAsset = await prisma.asset.findFirst({ where: { id: input.posterAssetId, userId: input.userId } });
  if (!posterAsset) throw new AnimatedPosterVideoError("Poster not found.");

  const creativeProject = posterAsset.creativeProjectId
    ? await prisma.creativeProject.findUnique({ where: { id: posterAsset.creativeProjectId } })
    : null;
  const aspectRatio = (creativeProject?.aspectRatio ?? "RATIO_9_16") as AspectRatio;
  const dims = EDITOR_DIMENSIONS_BY_ASPECT[aspectRatio];

  const editorAsset = await createReadyEditorAsset({
    userId: input.userId,
    kind: "IMAGE",
    storageKey: posterAsset.storageKey,
    originalFilename: `poster-${posterAsset.id}.jpg`,
    mimeType: posterAsset.mimeType ?? "image/jpeg",
    fileSizeBytes: posterAsset.fileSizeBytes ?? 0,
    widthPx: dims.widthPx,
    heightPx: dims.heightPx,
  });

  const project = await createProject(input.userId, {
    name: `Animated Poster — ${posterAsset.id}`,
    aspectRatio: dims.editorAspectRatio,
    widthPx: dims.widthPx,
    heightPx: dims.heightPx,
  });

  const videoTrack = project.tracks.find((t) => t.kind === "VIDEO");
  if (!videoTrack) throw new AnimatedPosterVideoError("New editor project has no video track.");

  const transform = buildAnimatedPosterTransform(ANIMATED_POSTER_DURATION_MS);

  await addClip({
    projectId: project.id,
    userId: input.userId,
    trackId: videoTrack.id,
    assetId: editorAsset.id,
    startMs: 0,
    durationMs: ANIMATED_POSTER_DURATION_MS,
    transform: transform as unknown as Prisma.InputJsonValue,
  });

  const exportRow = await createExport({
    projectId: project.id,
    userId: input.userId,
    format: "MP4",
    resolution: "R1080P",
    fps: 30,
  });

  const finished = await pollExportUntilDone(project.id, input.userId, exportRow.id, { maxAttempts: 180 });
  if (finished.status !== "COMPLETED" || !finished.outputKey) {
    throw new AnimatedPosterVideoError(finished.errorMessage ?? "Animated poster video render failed.");
  }

  // Charge only now that the render has actually succeeded — a failed or
  // cancelled export never reaches this line, so there is nothing to refund.
  if (credits > 0) {
    await consumeCredits({
      userId: input.userId,
      amount: credits,
      type: "AI_GENERATION",
      description: "Animated Poster Video",
    });
  }

  const asset = await recordAsset({
    userId: input.userId,
    kind: "VIDEO",
    source: "AI_GENERATED",
    storageKey: finished.outputKey,
    label: `Animated Poster (from ${posterAsset.id})`,
  });

  return {
    assetId: asset.id,
    storageKey: finished.outputKey,
    editorProjectId: project.id,
    exportId: exportRow.id,
    creditsCharged: credits,
  };
}
