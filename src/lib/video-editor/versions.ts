import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { InvalidStateError } from "./errors";
import { recomputeProjectDuration } from "./projects";

// Version History for the Cloud Video Editor (Module 5) — mirrors
// lib/projects/versioning.ts's ProjectVersion pattern for the old AI editor
// (one Json snapshot blob per row, restore = delete+recreate inside a
// transaction) without sharing that model: this module has no Scene
// concept, and clips already carry stable ids the old system's
// order-keyed re-linking doesn't need. Original ids ARE kept in the
// snapshot (useful for display/debugging), but restore always generates
// fresh rows regardless — reusing the exact ids back would collide with
// nothing today, but a snapshot describes desired *content*, not row
// identity, so treating restore as "replace" rather than "upsert by id" is
// the simpler, more robust contract (also matches duplicateProject's
// existing delete-then-recreate-with-a-fresh-id-map technique in
// projects.ts).

type Db = Prisma.TransactionClient | typeof prisma;

interface TrackSnapshot {
  id: string;
  kind: string;
  order: number;
  isMuted: boolean;
  isHidden: boolean;
  isLocked: boolean;
  heightPx: number;
  audioSubtype: string | null;
  soloed: boolean;
  duckingEnabled: boolean;
  duckingAmountDb: number;
  duckingFadeMs: number;
  // References OTHER tracks by id (the voice tracks this one ducks under) —
  // remapped through the same old-id -> new-id trackIdMap as transitions,
  // in a second pass after every track has been recreated (see
  // restoreVersion below) since a referenced track may not exist yet when
  // this one is created.
  duckingVoiceTrackIds: string[];
}

interface ClipSnapshot {
  id: string;
  trackId: string;
  assetId: string | null;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  content: unknown;
  transform: unknown;
  groupId: string | null;
}

interface MarkerSnapshot {
  id: string;
  timeMs: number;
}

// Module 9 — transitions reference clips by id (`clipAId`/`clipBId`), so
// restore needs a clip-id remap the same way it already has a track-id
// remap; see restoreVersion below for why clip creation switched from
// createMany to a per-clip loop to get one.
interface TransitionSnapshot {
  id: string;
  trackId: string;
  clipAId: string;
  clipBId: string;
  type: string;
  direction: string | null;
  durationMs: number;
  easing: unknown;
}

export interface ProjectSnapshot {
  tracks: TrackSnapshot[];
  clips: ClipSnapshot[];
  markers: MarkerSnapshot[];
  transitions: TransitionSnapshot[];
}

async function buildSnapshot(projectId: string, db: Db): Promise<ProjectSnapshot> {
  const [tracks, clips, markers, transitions] = await Promise.all([
    db.editorTrack.findMany({ where: { projectId } }),
    db.editorClip.findMany({ where: { projectId } }),
    db.editorMarker.findMany({ where: { projectId } }),
    db.editorTransition.findMany({ where: { projectId } }),
  ]);

  return {
    tracks: tracks.map((t) => ({
      id: t.id,
      kind: t.kind,
      order: t.order,
      isMuted: t.isMuted,
      isHidden: t.isHidden,
      isLocked: t.isLocked,
      heightPx: t.heightPx,
      audioSubtype: t.audioSubtype,
      soloed: t.soloed,
      duckingEnabled: t.duckingEnabled,
      duckingAmountDb: t.duckingAmountDb,
      duckingFadeMs: t.duckingFadeMs,
      duckingVoiceTrackIds: t.duckingVoiceTrackIds,
    })),
    clips: clips.map((c) => ({
      id: c.id,
      trackId: c.trackId,
      assetId: c.assetId,
      startMs: c.startMs,
      durationMs: c.durationMs,
      trimStartMs: c.trimStartMs,
      content: c.content,
      transform: c.transform,
      groupId: c.groupId,
    })),
    markers: markers.map((m) => ({ id: m.id, timeMs: m.timeMs })),
    transitions: transitions.map((t) => ({
      id: t.id,
      trackId: t.trackId,
      clipAId: t.clipAId,
      clipBId: t.clipBId,
      type: t.type,
      direction: t.direction,
      durationMs: t.durationMs,
      easing: t.easing,
    })),
  };
}

// Called by the periodic/command-count-triggered autosave hook (client) and
// always (no dedup) immediately before a restore. Dedupes consecutive
// automatic snapshots via JSON.stringify equality against the most recent
// row — an idle project shouldn't accumulate identical snapshots every time
// the interval fires — but a labeled snapshot (the "before restore" one)
// always writes, since restore's undo depends on that exact row existing.
export async function createVersionSnapshot(
  projectId: string,
  options: { label?: string; dedupe?: boolean } = {}
): Promise<{ id: string; createdAt: Date } | null> {
  const snapshot = await buildSnapshot(projectId, prisma);

  if (options.dedupe !== false) {
    const latest = await prisma.editorProjectVersion.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { snapshot: true },
    });
    if (latest && JSON.stringify(latest.snapshot) === JSON.stringify(snapshot)) return null;
  }

  return prisma.editorProjectVersion.create({
    data: { projectId, snapshot: snapshot as unknown as Prisma.InputJsonValue, label: options.label },
    select: { id: true, createdAt: true },
  });
}

export async function listVersions(projectId: string) {
  return prisma.editorProjectVersion.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true },
  });
}

// Restore = delete every current track (cascades to its clips) + every
// current marker, then recreate from the target snapshot with fresh ids
// (trackId references remapped via an old-id -> new-id map, same technique
// projects.ts#duplicateProject already uses). Snapshots the CURRENT state
// first (always, no dedup) so the returned preRestoreVersionId lets the
// caller build an undo-able Command (see commands.ts#createRestoreVersionCommand)
// without the client needing to construct or diff a snapshot itself.
export async function restoreVersion(projectId: string, versionId: string): Promise<{ preRestoreVersionId: string }> {
  const target = await prisma.editorProjectVersion.findFirst({ where: { id: versionId, projectId } });
  if (!target) throw new InvalidStateError("Version not found.");
  const targetSnapshot = target.snapshot as unknown as ProjectSnapshot;

  const preRestore = await createVersionSnapshot(projectId, { label: "Before restore", dedupe: false });
  if (!preRestore) throw new InvalidStateError("Failed to snapshot current state before restoring.");

  await prisma.$transaction(async (tx) => {
    await tx.editorTrack.deleteMany({ where: { projectId } });
    await tx.editorMarker.deleteMany({ where: { projectId } });

    const trackIdMap = new Map<string, string>();
    for (const track of targetSnapshot.tracks) {
      const created = await tx.editorTrack.create({
        data: {
          projectId,
          kind: track.kind as never,
          order: track.order,
          isMuted: track.isMuted,
          isHidden: track.isHidden,
          isLocked: track.isLocked,
          heightPx: track.heightPx,
          audioSubtype: track.audioSubtype as never,
          soloed: track.soloed,
          duckingEnabled: track.duckingEnabled,
          duckingAmountDb: track.duckingAmountDb,
          duckingFadeMs: track.duckingFadeMs,
        },
      });
      trackIdMap.set(track.id, created.id);
    }

    // Second pass — duckingVoiceTrackIds references OTHER tracks by id,
    // so it can only be remapped once every track above has a fresh id.
    for (const track of targetSnapshot.tracks) {
      if (!track.duckingVoiceTrackIds || track.duckingVoiceTrackIds.length === 0) continue;
      const newId = trackIdMap.get(track.id);
      if (!newId) continue;
      const remapped = track.duckingVoiceTrackIds.map((oldId) => trackIdMap.get(oldId)).filter((id): id is string => !!id);
      await tx.editorTrack.update({ where: { id: newId }, data: { duckingVoiceTrackIds: remapped } });
    }

    // Module 9 — clips are created ONE AT A TIME (not createMany) so each
    // new row's id can be captured into clipIdMap, the same way trackIdMap
    // is built above — transitions reference clips by id and need it to
    // re-point at the restored clips' fresh ids.
    const clipIdMap = new Map<string, string>();
    for (const clip of targetSnapshot.clips) {
      const newTrackId = trackIdMap.get(clip.trackId);
      if (!newTrackId) continue;
      const created = await tx.editorClip.create({
        data: {
          trackId: newTrackId,
          projectId,
          assetId: clip.assetId,
          startMs: clip.startMs,
          durationMs: clip.durationMs,
          trimStartMs: clip.trimStartMs,
          content: clip.content as Prisma.InputJsonValue | undefined,
          transform: clip.transform as Prisma.InputJsonValue | undefined,
          groupId: clip.groupId,
        },
      });
      clipIdMap.set(clip.id, created.id);
    }

    if (targetSnapshot.markers.length > 0) {
      await tx.editorMarker.createMany({
        data: targetSnapshot.markers.map((m) => ({ projectId, timeMs: m.timeMs })),
      });
    }

    const transitionsToCreate = (targetSnapshot.transitions ?? [])
      .filter((t) => clipIdMap.has(t.clipAId) && clipIdMap.has(t.clipBId) && trackIdMap.has(t.trackId))
      .map((t) => ({
        projectId,
        trackId: trackIdMap.get(t.trackId)!,
        clipAId: clipIdMap.get(t.clipAId)!,
        clipBId: clipIdMap.get(t.clipBId)!,
        type: t.type as never,
        direction: t.direction as never,
        durationMs: t.durationMs,
        easing: t.easing as Prisma.InputJsonValue,
      }));
    if (transitionsToCreate.length > 0) {
      await tx.editorTransition.createMany({ data: transitionsToCreate });
    }
  });

  await recomputeProjectDuration(projectId);

  return { preRestoreVersionId: preRestore.id };
}
