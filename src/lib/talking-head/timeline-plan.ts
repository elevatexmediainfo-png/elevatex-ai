import { prisma } from "@/lib/prisma";
import { addClip, addTrack, ensureTimeline } from "@/lib/timeline/engine";

export class TimelinePlanError extends Error {}

// Milestone 11 Part 6 — Automatic Timeline Editing. Expressed entirely as
// Clip rows via the EXISTING Timeline Engine (no new Track.kind values):
// ensureTimeline() has already laid down the trimmed base VIDEO layer (see
// lib/timeline/engine.ts's buildTalkingHeadSeedClips); this function adds
// the overlay layer on top — one IMAGE/VIDEO clip per scene that the
// Intelligent Asset Selector (lib/talking-head/asset-selector.ts) resolved
// an asset for, plus a TEXT clip for TEXT_OVERLAY scenes. Everything this
// produces is exactly as editable in the Editor as anything placed by hand.

async function getOrCreateOverlayTrack(videoProjectId: string, kind: "IMAGE" | "VIDEO" | "TEXT") {
  const tracks = await prisma.track.findMany({ where: { videoProjectId, kind }, orderBy: { order: "asc" } });
  // The base layer already owns one VIDEO track (the trimmed face-cam clips
  // seeded by ensureTimeline) — the overlay layer needs a SECOND VIDEO
  // track. IMAGE/TEXT have no base track, so their first call creates one.
  const needsNewTrack = kind === "VIDEO" ? tracks.length <= 1 : tracks.length === 0;
  if (!needsNewTrack) return tracks[tracks.length - 1];
  return addTrack(videoProjectId, kind);
}

export async function applyAutomaticEditingPlan(videoProjectId: string): Promise<void> {
  await ensureTimeline(videoProjectId);

  const scenes = await prisma.scene.findMany({
    where: { videoProjectId },
    orderBy: { order: "asc" },
    include: { assets: true },
  });
  if (scenes.length === 0) return;

  let cursorMs = 0;
  const startMsByScene = new Map<string, number>();
  for (const scene of scenes) {
    startMsByScene.set(scene.id, cursorMs);
    cursorMs += scene.durationSeconds * 1000;
  }

  let imageTrackId: string | null = null;
  let videoOverlayTrackId: string | null = null;
  let textTrackId: string | null = null;

  for (const scene of scenes) {
    if (scene.visualType === null || scene.visualType === "FACE_ONLY") continue;

    const startMs = startMsByScene.get(scene.id)!;
    const durationMs = scene.durationSeconds * 1000;

    if (scene.visualType === "TEXT_OVERLAY") {
      if (!textTrackId) {
        textTrackId = (await getOrCreateOverlayTrack(videoProjectId, "TEXT")).id;
      }
      const existing = await prisma.clip.findFirst({ where: { videoProjectId, trackId: textTrackId, startMs } });
      if (existing) continue;
      await addClip({
        videoProjectId,
        trackId: textTrackId,
        startMs,
        durationMs,
        content: { text: scene.prompt, animation: "FADE_IN" },
      });
      continue;
    }

    const overlayAsset = scene.assets.find((a) => a.sceneId === scene.id && a.kind !== "VOICE");
    if (!overlayAsset) continue;

    const existing = await prisma.clip.findFirst({ where: { videoProjectId, assetId: overlayAsset.id } });
    if (existing) continue;

    if (overlayAsset.kind === "VIDEO") {
      if (!videoOverlayTrackId) {
        videoOverlayTrackId = (await getOrCreateOverlayTrack(videoProjectId, "VIDEO")).id;
      }
      await addClip({ videoProjectId, trackId: videoOverlayTrackId, assetId: overlayAsset.id, startMs, durationMs });
    } else {
      if (!imageTrackId) {
        imageTrackId = (await getOrCreateOverlayTrack(videoProjectId, "IMAGE")).id;
      }
      await addClip({ videoProjectId, trackId: imageTrackId, assetId: overlayAsset.id, startMs, durationMs });
    }
  }
}

// Milestone 11 Part 8 — AI Marketing Assistant's one-click "Improve Music".
// A Talking Head project's background music is one continuous Clip on the
// MUSIC track (Brand Kit's default, or none) — unlike GENERATED scenes,
// there's no per-scene backgroundMusicUrl to PATCH, so this swaps that one
// clip's source asset directly. Passing null clears it.
export async function swapBackgroundMusic(videoProjectId: string, assetId: string | null): Promise<void> {
  const tracks = await ensureTimeline(videoProjectId);
  const musicTrack = tracks.find((t) => t.kind === "MUSIC");
  if (!musicTrack) throw new TimelinePlanError("This project has no music track.");

  const existing = await prisma.clip.findFirst({ where: { videoProjectId, trackId: musicTrack.id } });

  if (!assetId) {
    if (existing) await prisma.clip.delete({ where: { id: existing.id } });
    return;
  }

  if (existing) {
    await prisma.clip.update({ where: { id: existing.id }, data: { assetId } });
    return;
  }

  const lastVideoClip = await prisma.clip.findFirst({
    where: { videoProjectId, track: { kind: "VIDEO" } },
    orderBy: { startMs: "desc" },
  });
  const totalDurationMs = lastVideoClip ? lastVideoClip.startMs + lastVideoClip.durationMs : 0;
  if (totalDurationMs <= 0) throw new TimelinePlanError("This project has no timeline duration yet.");

  await addClip({ videoProjectId, trackId: musicTrack.id, assetId, startMs: 0, durationMs: totalDurationMs });
}
