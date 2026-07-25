import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Timeline Engine (Milestone 9) — the multi-track editing layer that sits
// ADDITIVELY on top of the Scene Engine (lib/scenes/engine.ts). A Track is a
// lane (kind: VIDEO/IMAGE/TEXT/CAPTION/STICKER/AUDIO/MUSIC); a Clip is a
// timed placement on a track, referencing a Scene or Asset by id (or neither,
// for a TEXT/STICKER clip that carries everything in `content`). Nothing here
// touches Scene/RenderJob — the Scene Engine and render pipeline are exactly
// as they were before this milestone.

type Db = Prisma.TransactionClient | typeof prisma;

export interface ClipSpan {
  startMs: number;
  durationMs: number;
  trimStartMs: number;
}

// Pure — splits a clip at `offsetMs` (measured from the clip's own start,
// 0 < offsetMs < durationMs) into two contiguous spans. `trimStartMs`
// advances on the second half so a video/audio source clip keeps playing
// from where it left off, not from its own beginning — the same trim-offset
// trick that lets Resize shorten a clip without re-rendering its source.
export function splitClipSpan(clip: ClipSpan, offsetMs: number): [ClipSpan, ClipSpan] {
  if (offsetMs <= 0 || offsetMs >= clip.durationMs) {
    throw new RangeError("offsetMs must be strictly between 0 and the clip's duration.");
  }
  return [
    { startMs: clip.startMs, durationMs: offsetMs, trimStartMs: clip.trimStartMs },
    {
      startMs: clip.startMs + offsetMs,
      durationMs: clip.durationMs - offsetMs,
      trimStartMs: clip.trimStartMs + offsetMs,
    },
  ];
}

export interface MergeableClip extends ClipSpan {
  trackId: string;
  sceneId: string | null;
  assetId: string | null;
}

// Pure — two clips can merge only if they're on the same track, exactly
// contiguous in time, and share the same underlying source (including
// "neither", for TEXT/STICKER clips). Merging clips with different sources
// would silently discard information about where the content boundary was.
export function canMergeClips(a: MergeableClip, b: MergeableClip): { ok: true } | { ok: false; reason: string } {
  if (a.trackId !== b.trackId) return { ok: false, reason: "Clips must be on the same track." };
  if (a.sceneId !== b.sceneId || a.assetId !== b.assetId) {
    return { ok: false, reason: "Clips must share the same underlying source." };
  }
  if (a.startMs + a.durationMs !== b.startMs) {
    return { ok: false, reason: "Clips must be exactly adjacent on the timeline." };
  }
  return { ok: true };
}

// Pure — the resulting span after merging two adjacent, mergeable clips.
export function mergeClipSpans(a: ClipSpan, b: ClipSpan): ClipSpan {
  return { startMs: a.startMs, durationMs: a.durationMs + b.durationMs, trimStartMs: a.trimStartMs };
}

// Pure — a duplicate is placed immediately after the original on the same track.
export function duplicateClipSpan(clip: ClipSpan): ClipSpan {
  return { startMs: clip.startMs + clip.durationMs, durationMs: clip.durationMs, trimStartMs: clip.trimStartMs };
}

export interface SceneForTimeline {
  id: string;
  order: number;
  durationSeconds: number;
  voiceKey: string | null;
  backgroundMusicUrl: string | null;
}

export interface SeededClipDef {
  trackKind: "VIDEO" | "AUDIO" | "MUSIC";
  sceneId: string;
  startMs: number;
  durationMs: number;
  /** Source-video offset for a trimmed clip (Talking Head base layer) — 0/unset for the GENERATED flow, where each scene already has its own dedicated rendered video. */
  trimStartMs?: number;
}

// Pure — lays scenes out sequentially on VIDEO (always), AUDIO (only for
// scenes with a voiceover), and MUSIC (only for scenes with background
// music) lanes. This is the Timeline's read of the Scene Engine's existing
// sequential order — never a second source of truth for scene ordering.
export function buildSeedClipsFromScenes(scenes: SceneForTimeline[]): SeededClipDef[] {
  const ordered = [...scenes].sort((a, b) => a.order - b.order);
  const defs: SeededClipDef[] = [];
  let cursorMs = 0;

  for (const scene of ordered) {
    const durationMs = scene.durationSeconds * 1000;
    defs.push({ trackKind: "VIDEO", sceneId: scene.id, startMs: cursorMs, durationMs });
    if (scene.voiceKey) {
      defs.push({ trackKind: "AUDIO", sceneId: scene.id, startMs: cursorMs, durationMs });
    }
    if (scene.backgroundMusicUrl) {
      defs.push({ trackKind: "MUSIC", sceneId: scene.id, startMs: cursorMs, durationMs });
    }
    cursorMs += durationMs;
  }

  return defs;
}

export interface TalkingHeadSceneForTimeline {
  id: string;
  order: number;
  durationSeconds: number;
  /** This scene's position within the ORIGINAL uploaded video (its earliest transcript segment's startMs) — every Talking Head scene shares one base video file (the upload itself), so trimStartMs is what makes each scene's clip play only its own slice of it. */
  sourceStartMs: number;
}

// Pure — Milestone 11's Talking Head counterpart to buildSeedClipsFromScenes
// above. Every scene shares the SAME underlying video (the uploaded source
// asset), so unlike the GENERATED flow there is no per-scene AUDIO/MUSIC
// lane to seed here (the speaker's original audio rides along with the base
// VIDEO clip itself) — only one VIDEO clip per scene, trimmed to that
// scene's slice of the source video via trimStartMs.
export function buildTalkingHeadSeedClips(scenes: TalkingHeadSceneForTimeline[]): SeededClipDef[] {
  const ordered = [...scenes].sort((a, b) => a.order - b.order);
  const defs: SeededClipDef[] = [];
  let cursorMs = 0;

  for (const scene of ordered) {
    const durationMs = scene.durationSeconds * 1000;
    defs.push({ trackKind: "VIDEO", sceneId: scene.id, startMs: cursorMs, durationMs, trimStartMs: scene.sourceStartMs });
    cursorMs += durationMs;
  }

  return defs;
}

// Idempotent — if this project already has tracks, returns them untouched;
// otherwise seeds VIDEO/AUDIO/MUSIC/CAPTION tracks (the latter starts empty,
// populated by the Caption Editor) from the project's current scenes.
// Milestone 11: branches the seeding shape by sourceType — TALKING_HEAD_
// UPLOAD scenes all share one base video (the upload), so they're seeded as
// trimmed slices (buildTalkingHeadSeedClips) rather than one dedicated
// rendered file per scene (buildSeedClipsFromScenes). Everything past this
// branch (Track/Clip rows, the Editor, Export) is the same Timeline either way.
export async function ensureTimeline(videoProjectId: string, db: Db = prisma) {
  const existing = await db.track.findMany({ where: { videoProjectId }, orderBy: { order: "asc" } });
  if (existing.length > 0) {
    return existing;
  }

  const project = await db.videoProject.findUniqueOrThrow({
    where: { id: videoProjectId },
    select: { sourceType: true },
  });

  const trackKinds: Array<"VIDEO" | "AUDIO" | "MUSIC" | "CAPTION"> = ["VIDEO", "AUDIO", "MUSIC", "CAPTION"];
  const tracks = await Promise.all(
    trackKinds.map((kind, order) => db.track.create({ data: { videoProjectId, kind, order } }))
  );
  const trackIdByKind = new Map(tracks.map((t) => [t.kind, t.id]));

  let seedClips: SeededClipDef[];
  let brandMusicAssetId: string | null = null;
  if (project.sourceType === "TALKING_HEAD_UPLOAD") {
    const fullProject = await db.videoProject.findUniqueOrThrow({
      where: { id: videoProjectId },
      select: { userId: true },
    });
    const scenes = await db.scene.findMany({
      where: { videoProjectId },
      orderBy: { order: "asc" },
      include: { transcriptSegments: { select: { startMs: true }, orderBy: { startMs: "asc" }, take: 1 } },
    });
    seedClips = buildTalkingHeadSeedClips(
      scenes.map((s) => ({
        id: s.id,
        order: s.order,
        durationSeconds: s.durationSeconds,
        sourceStartMs: s.transcriptSegments[0]?.startMs ?? 0,
      }))
    );

    // Milestone 11 Part 9 — Brand Kit's default music, applied automatically
    // whenever a Talking Head project doesn't already have its own (it
    // never does at seed time — same defaulting pattern Scene.backgroundMusicUrl
    // already established for the GENERATED flow).
    const brandKit = await db.brandKit.findUnique({ where: { userId: fullProject.userId }, select: { musicAssetId: true } });
    if (brandKit?.musicAssetId) {
      const musicAsset = await db.asset.findUnique({ where: { id: brandKit.musicAssetId } });
      if (musicAsset) brandMusicAssetId = musicAsset.id;
    }
  } else {
    const scenes = await db.scene.findMany({
      where: { videoProjectId },
      orderBy: { order: "asc" },
      select: { id: true, order: true, durationSeconds: true, voiceKey: true, backgroundMusicUrl: true },
    });
    seedClips = buildSeedClipsFromScenes(scenes);
  }

  if (seedClips.length > 0) {
    await db.clip.createMany({
      data: seedClips.map((c) => ({
        trackId: trackIdByKind.get(c.trackKind)!,
        videoProjectId,
        sceneId: c.sceneId,
        startMs: c.startMs,
        durationMs: c.durationMs,
        trimStartMs: c.trimStartMs ?? 0,
      })),
    });
  }

  if (brandMusicAssetId) {
    const totalDurationMs = seedClips.reduce((max, c) => Math.max(max, c.startMs + c.durationMs), 0);
    if (totalDurationMs > 0) {
      await db.clip.create({
        data: {
          trackId: trackIdByKind.get("MUSIC")!,
          videoProjectId,
          assetId: brandMusicAssetId,
          startMs: 0,
          durationMs: totalDurationMs,
        },
      });
    }
  }

  return tracks;
}

export async function listTimeline(videoProjectId: string) {
  const [tracks, clips] = await Promise.all([
    prisma.track.findMany({ where: { videoProjectId }, orderBy: { order: "asc" } }),
    prisma.clip.findMany({ where: { videoProjectId }, orderBy: { startMs: "asc" } }),
  ]);
  return { tracks, clips };
}

export async function addTrack(videoProjectId: string, kind: string, db: Db = prisma) {
  const last = await db.track.findFirst({ where: { videoProjectId }, orderBy: { order: "desc" } });
  const order = last ? last.order + 1 : 0;
  return db.track.create({ data: { videoProjectId, kind: kind as never, order } });
}

export class InvalidStateError extends Error {}

export async function removeTrack(videoProjectId: string, trackId: string, db: Db = prisma): Promise<void> {
  const claim = await db.track.deleteMany({ where: { id: trackId, videoProjectId } });
  if (claim.count === 0) throw new InvalidStateError("Track not found in this project.");
}

// Layers panel's mute/hide toggles.
export async function updateTrack(
  videoProjectId: string,
  trackId: string,
  patch: { isMuted?: boolean; isHidden?: boolean },
  db: Db = prisma
) {
  const claim = await db.track.updateMany({ where: { id: trackId, videoProjectId }, data: patch });
  if (claim.count === 0) throw new InvalidStateError("Track not found in this project.");
  return db.track.findUniqueOrThrow({ where: { id: trackId } });
}

export async function moveTrack(videoProjectId: string, trackId: string, direction: "UP" | "DOWN", db: Db = prisma) {
  return db.$transaction(async (tx) => {
    const track = await tx.track.findFirst({ where: { id: trackId, videoProjectId } });
    if (!track) throw new InvalidStateError("Track not found in this project.");

    const comparator = direction === "UP" ? { lt: track.order } : { gt: track.order };
    const orderSort = direction === "UP" ? "desc" : "asc";
    const neighbor = await tx.track.findFirst({
      where: { videoProjectId, order: comparator },
      orderBy: { order: orderSort },
    });

    if (!neighbor) {
      throw new InvalidStateError("Track cannot be moved further in this direction.");
    }

    await Promise.all([
      tx.track.update({ where: { id: track.id }, data: { order: neighbor.order } }),
      tx.track.update({ where: { id: neighbor.id }, data: { order: track.order } }),
    ]);

    return tx.track.findMany({ where: { videoProjectId }, orderBy: { order: "asc" } });
  });
}

export interface AddClipInput {
  videoProjectId: string;
  trackId: string;
  sceneId?: string;
  assetId?: string;
  startMs: number;
  durationMs: number;
  trimStartMs?: number;
  content?: Prisma.InputJsonValue;
}

export async function addClip(input: AddClipInput, db: Db = prisma) {
  const track = await db.track.findFirst({ where: { id: input.trackId, videoProjectId: input.videoProjectId } });
  if (!track) throw new InvalidStateError("Track not found in this project.");

  return db.clip.create({
    data: {
      trackId: input.trackId,
      videoProjectId: input.videoProjectId,
      sceneId: input.sceneId,
      assetId: input.assetId,
      startMs: input.startMs,
      durationMs: input.durationMs,
      trimStartMs: input.trimStartMs ?? 0,
      content: input.content,
    },
  });
}

export interface UpdateClipInput {
  trackId?: string;
  startMs?: number;
  durationMs?: number;
  trimStartMs?: number;
  content?: Prisma.InputJsonValue;
}

export async function updateClip(
  videoProjectId: string,
  clipId: string,
  patch: UpdateClipInput,
  db: Db = prisma
) {
  const claim = await db.clip.updateMany({
    where: { id: clipId, videoProjectId },
    data: patch,
  });
  if (claim.count === 0) throw new InvalidStateError("Clip not found in this project.");
  return db.clip.findUniqueOrThrow({ where: { id: clipId } });
}

export async function deleteClip(videoProjectId: string, clipId: string, db: Db = prisma): Promise<void> {
  const claim = await db.clip.deleteMany({ where: { id: clipId, videoProjectId } });
  if (claim.count === 0) throw new InvalidStateError("Clip not found in this project.");
}

export async function splitClip(videoProjectId: string, clipId: string, offsetMs: number) {
  return prisma.$transaction(async (tx) => {
    const clip = await tx.clip.findFirst({ where: { id: clipId, videoProjectId } });
    if (!clip) throw new InvalidStateError("Clip not found in this project.");

    const [first, second] = splitClipSpan(clip, offsetMs);

    const updated = await tx.clip.update({ where: { id: clip.id }, data: first });
    const created = await tx.clip.create({
      data: {
        trackId: clip.trackId,
        videoProjectId: clip.videoProjectId,
        sceneId: clip.sceneId,
        assetId: clip.assetId,
        content: clip.content as Prisma.InputJsonValue | undefined,
        ...second,
      },
    });

    return { first: updated, second: created };
  });
}

export async function mergeClips(videoProjectId: string, clipId: string, withClipId: string) {
  return prisma.$transaction(async (tx) => {
    const [a, b] = await Promise.all([
      tx.clip.findFirst({ where: { id: clipId, videoProjectId } }),
      tx.clip.findFirst({ where: { id: withClipId, videoProjectId } }),
    ]);
    if (!a || !b) throw new InvalidStateError("Both clips must belong to this project.");

    const [earlier, later] = a.startMs <= b.startMs ? [a, b] : [b, a];
    const check = canMergeClips(earlier, later);
    if (!check.ok) throw new InvalidStateError(check.reason);

    const merged = mergeClipSpans(earlier, later);
    const updated = await tx.clip.update({ where: { id: earlier.id }, data: merged });
    await tx.clip.delete({ where: { id: later.id } });

    return updated;
  });
}

export async function duplicateClip(videoProjectId: string, clipId: string, db: Db = prisma) {
  const clip = await db.clip.findFirst({ where: { id: clipId, videoProjectId } });
  if (!clip) throw new InvalidStateError("Clip not found in this project.");

  const span = duplicateClipSpan(clip);
  return db.clip.create({
    data: {
      trackId: clip.trackId,
      videoProjectId: clip.videoProjectId,
      sceneId: clip.sceneId,
      assetId: clip.assetId,
      content: clip.content as Prisma.InputJsonValue | undefined,
      ...span,
    },
  });
}

// AI Editing "Replace scene" — repoints EVERY clip that currently references
// `sceneId` (the VIDEO clip, plus any AUDIO/MUSIC clips seeded alongside it)
// at a different Scene or Asset in one shot. Purely a DB pointer swap (no
// RenderJob): every clip keeps its own position/duration, only its source
// changes. Exactly one of sceneId/assetId must be given (enforced by
// replaceSceneSourceSchema's XOR refine at the API layer); the other is
// cleared so a clip never points at both at once.
export async function replaceSceneSource(
  videoProjectId: string,
  sceneId: string,
  source: { sceneId: string } | { assetId: string },
  db: Db = prisma
) {
  const claim = await db.clip.updateMany({
    where: { videoProjectId, sceneId },
    data:
      "sceneId" in source
        ? { sceneId: source.sceneId, assetId: null }
        : { sceneId: null, assetId: source.assetId },
  });
  if (claim.count === 0) throw new InvalidStateError("No clips reference this scene in this project.");
  return db.clip.findMany({ where: { videoProjectId, ...source } });
}
