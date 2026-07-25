import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Project-level autosave/version-history (Milestone 8). "Autosave" itself
// needs no special code here — the Studio's granular routes (PATCH scene,
// reorder, PATCH script, etc.) already persist every edit immediately; this
// module is the durable snapshot trail on top of that, used for the version
// history panel and restore. Undo/redo is a client-side concern (an in-memory
// stack over the same granular routes) — see scene-progress-panel-adjacent
// frontend code, not this module.

type Db = Prisma.TransactionClient | typeof prisma;

export interface SceneSnapshot {
  id: string;
  order: number;
  prompt: string;
  imagePrompt: string | null;
  videoPrompt: string | null;
  negativePrompt: string | null;
  durationSeconds: number;
  transition: string;
  voiceId: string | null;
  backgroundMusicUrl: string | null;
  subtitleText: string | null;
}

// Milestone 9 — Track/Clip/CaptionBlock all reference a Scene by id, but
// restoreVersion deletes and recreates Scene rows with brand-new ids (it
// diffs nothing). Snapshotting `sceneOrder`/`trackOrder` instead of raw ids
// lets restore re-link clips/captions to the NEW scene/track rows after
// they're recreated, via the still-stable `order` field — without this, a
// restore would silently orphan every timeline clip (Clip.scene is
// onDelete: SetNull) and drop every caption (CaptionBlock.scene is
// onDelete: Cascade).
export interface TrackSnapshot {
  order: number;
  kind: string;
  isMuted: boolean;
  isHidden: boolean;
}

export interface ClipSnapshot {
  trackOrder: number;
  sceneOrder: number | null;
  assetId: string | null;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  content: unknown;
}

export interface CaptionWordSnapshot {
  order: number;
  text: string;
  startMs: number;
  endMs: number;
}

export interface CaptionBlockSnapshot {
  sceneOrder: number;
  style: unknown;
  words: CaptionWordSnapshot[];
}

export interface ProjectSnapshot {
  generatedScript: string | null;
  scenes: SceneSnapshot[];
  // Optional — absent on ProjectVersion rows recorded before Milestone 9.
  // restoreVersion treats a missing/empty array as "no timeline yet" and
  // leaves ensureTimeline() to reseed from the restored scenes on next use.
  tracks?: TrackSnapshot[];
  clips?: ClipSnapshot[];
  captionBlocks?: CaptionBlockSnapshot[];
}

async function buildSnapshot(videoProjectId: string, db: Db): Promise<ProjectSnapshot> {
  const [project, scenes, tracks, clips, captionBlocks] = await Promise.all([
    db.videoProject.findUniqueOrThrow({ where: { id: videoProjectId }, select: { generatedScript: true } }),
    db.scene.findMany({ where: { videoProjectId }, orderBy: { order: "asc" } }),
    db.track.findMany({ where: { videoProjectId }, orderBy: { order: "asc" } }),
    db.clip.findMany({ where: { videoProjectId } }),
    db.captionBlock.findMany({ where: { videoProjectId }, include: { words: { orderBy: { order: "asc" } } } }),
  ]);

  const sceneOrderById = new Map(scenes.map((s) => [s.id, s.order]));
  const trackOrderById = new Map(tracks.map((t) => [t.id, t.order]));

  return {
    generatedScript: project.generatedScript,
    scenes: scenes.map((s) => ({
      id: s.id,
      order: s.order,
      prompt: s.prompt,
      imagePrompt: s.imagePrompt,
      videoPrompt: s.videoPrompt,
      negativePrompt: s.negativePrompt,
      durationSeconds: s.durationSeconds,
      transition: s.transition,
      voiceId: s.voiceId,
      backgroundMusicUrl: s.backgroundMusicUrl,
      subtitleText: s.subtitleText,
    })),
    tracks: tracks.map((t) => ({ order: t.order, kind: t.kind, isMuted: t.isMuted, isHidden: t.isHidden })),
    clips: clips.map((c) => ({
      trackOrder: trackOrderById.get(c.trackId)!,
      sceneOrder: c.sceneId ? sceneOrderById.get(c.sceneId) ?? null : null,
      assetId: c.assetId,
      startMs: c.startMs,
      durationMs: c.durationMs,
      trimStartMs: c.trimStartMs,
      content: c.content,
    })),
    captionBlocks: captionBlocks.map((cb) => ({
      sceneOrder: sceneOrderById.get(cb.sceneId)!,
      style: cb.style,
      words: cb.words.map((w) => ({ order: w.order, text: w.text, startMs: w.startMs, endMs: w.endMs })),
    })),
  };
}

// Called at the end of every Studio mutation (script edit, scene
// create/edit/delete/reorder). Dedupes against the most recent snapshot for
// this project so routine saves with no actual change don't grow the table.
export async function recordProjectVersion(
  videoProjectId: string,
  createdBy: string | undefined,
  db: Db = prisma
): Promise<void> {
  const snapshot = await buildSnapshot(videoProjectId, db);

  const latest = await db.projectVersion.findFirst({
    where: { videoProjectId },
    orderBy: { createdAt: "desc" },
  });
  if (latest && JSON.stringify(latest.snapshot) === JSON.stringify(snapshot)) {
    return;
  }

  await db.projectVersion.create({
    data: {
      videoProjectId,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      createdBy,
    },
  });
}

export async function listVersions(videoProjectId: string) {
  return prisma.projectVersion.findMany({
    where: { videoProjectId },
    orderBy: { createdAt: "desc" },
  });
}

export class InvalidStateError extends Error {}

// Replaces the live script + every scene with the snapshot's content. Only
// safe pre-render (enforced by the caller's status gate — DRAFT/SCRIPT_READY
// only, before any RenderJob exists), since it fully deletes and recreates
// scene rows rather than diffing them.
export async function restoreVersion(
  videoProjectId: string,
  versionId: string,
  restoredBy: string | undefined
): Promise<void> {
  const version = await prisma.projectVersion.findFirst({ where: { id: versionId, videoProjectId } });
  if (!version) throw new InvalidStateError("Version not found for this project.");

  const snapshot = version.snapshot as unknown as ProjectSnapshot;

  await prisma.$transaction(async (tx) => {
    const claim = await tx.videoProject.updateMany({
      where: { id: videoProjectId, status: { in: ["DRAFT", "SCRIPT_READY"] } },
      data: { generatedScript: snapshot.generatedScript },
    });
    if (claim.count === 0) {
      throw new InvalidStateError("Versions can only be restored before a video is rendered.");
    }

    await tx.scene.deleteMany({ where: { videoProjectId } });
    if (snapshot.scenes.length > 0) {
      await tx.scene.createMany({
        data: snapshot.scenes.map((s) => ({
          videoProjectId,
          order: s.order,
          prompt: s.prompt,
          imagePrompt: s.imagePrompt,
          videoPrompt: s.videoPrompt,
          negativePrompt: s.negativePrompt,
          durationSeconds: s.durationSeconds,
          transition: s.transition as never,
          voiceId: s.voiceId,
          backgroundMusicUrl: s.backgroundMusicUrl,
          subtitleText: s.subtitleText,
        })),
      });
    }

    // Milestone 9 — Tracks/Clips survive scene deletion (Track has no scene
    // relation; Clip.scene is onDelete: SetNull), so they'd otherwise be left
    // pointing at nothing. Rebuild the whole timeline layer from the
    // snapshot instead, re-linked to the just-recreated scenes by `order`.
    await tx.track.deleteMany({ where: { videoProjectId } });

    const newScenes = await tx.scene.findMany({ where: { videoProjectId }, select: { id: true, order: true } });
    const sceneIdByOrder = new Map(newScenes.map((s) => [s.order, s.id]));

    const snapshotTracks = snapshot.tracks ?? [];
    if (snapshotTracks.length > 0) {
      await tx.track.createMany({
        data: snapshotTracks.map((t) => ({
          videoProjectId,
          kind: t.kind as never,
          order: t.order,
          isMuted: t.isMuted,
          isHidden: t.isHidden,
        })),
      });
      const newTracks = await tx.track.findMany({ where: { videoProjectId }, select: { id: true, order: true } });
      const trackIdByOrder = new Map(newTracks.map((t) => [t.order, t.id]));

      const snapshotClips = (snapshot.clips ?? []).filter((c) => trackIdByOrder.has(c.trackOrder));
      if (snapshotClips.length > 0) {
        await tx.clip.createMany({
          data: snapshotClips.map((c) => ({
            trackId: trackIdByOrder.get(c.trackOrder)!,
            videoProjectId,
            sceneId: c.sceneOrder != null ? sceneIdByOrder.get(c.sceneOrder) ?? null : null,
            assetId: c.assetId,
            startMs: c.startMs,
            durationMs: c.durationMs,
            trimStartMs: c.trimStartMs,
            content: c.content as Prisma.InputJsonValue | undefined,
          })),
        });
      }
    }

    for (const cb of snapshot.captionBlocks ?? []) {
      const sceneId = sceneIdByOrder.get(cb.sceneOrder);
      if (!sceneId) continue;

      const captionBlock = await tx.captionBlock.create({
        data: { sceneId, videoProjectId, style: cb.style as Prisma.InputJsonValue | undefined },
      });
      if (cb.words.length > 0) {
        await tx.captionWord.createMany({
          data: cb.words.map((w) => ({
            captionBlockId: captionBlock.id,
            order: w.order,
            text: w.text,
            startMs: w.startMs,
            endMs: w.endMs,
          })),
        });
      }
    }
  });

  await recordProjectVersion(videoProjectId, restoredBy);
}
