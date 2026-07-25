import type { Prisma } from "@/generated/prisma/client";
import type { AspectRatio } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { InvalidStateError } from "./errors";
import { EDITOR_DIMENSIONS_BY_ASPECT } from "./aspect-dimensions";

// Project system for the Cloud Video Editor (Milestone 24) — wholly
// separate from VideoProject/Scene: no AI, no render pipeline, just a
// Project owning Tracks and Clips. getOwnedProject() is the one ownership
// check every route (and every nested track/clip route) delegates to,
// mirroring how the Milestone 9 editor's routes verify VideoProject
// ownership once before calling lib/timeline/engine.ts functions that only
// scope by videoProjectId themselves.

type Db = Prisma.TransactionClient | typeof prisma;

const DEFAULT_TRACK_KINDS = ["VIDEO", "AUDIO"] as const;

export async function listProjects(userId: string, folderId?: string | null, db: Db = prisma) {
  return db.editorProject.findMany({
    where: { userId, ...(folderId !== undefined ? { folderId } : {}) },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getOwnedProject(userId: string, projectId: string, db: Db = prisma) {
  const project = await db.editorProject.findFirst({ where: { id: projectId, userId } });
  if (!project) throw new InvalidStateError("Project not found.");
  return project;
}

export interface CreateProjectInput {
  name: string;
  folderId?: string;
  aspectRatio: string;
  widthPx: number;
  heightPx: number;
}

// New projects start with one VIDEO + one AUDIO track — an empty timeline
// with nothing to drag onto isn't a usable starting point, and these two
// kinds are the ones nearly every project needs (TEXT/SUBTITLE/OVERLAY/
// EFFECTS tracks are added on demand from the Layers panel instead).
export async function createProject(userId: string, input: CreateProjectInput, db: Db = prisma) {
  if (input.folderId) {
    const folder = await db.editorFolder.findFirst({ where: { id: input.folderId, userId } });
    if (!folder) throw new InvalidStateError("Folder not found.");
  }

  return db.editorProject.create({
    data: {
      userId,
      name: input.name,
      folderId: input.folderId,
      aspectRatio: input.aspectRatio as never,
      widthPx: input.widthPx,
      heightPx: input.heightPx,
      tracks: {
        create: DEFAULT_TRACK_KINDS.map((kind, order) => ({ kind, order })),
      },
    },
    include: { tracks: true },
  });
}

export async function getProjectWorkspace(userId: string, projectId: string) {
  const project = await getOwnedProject(userId, projectId);
  const [tracks, clips, markers, transitions] = await Promise.all([
    prisma.editorTrack.findMany({ where: { projectId }, orderBy: { order: "asc" } }),
    prisma.editorClip.findMany({ where: { projectId }, orderBy: { startMs: "asc" } }),
    prisma.editorMarker.findMany({ where: { projectId }, orderBy: { timeMs: "asc" } }),
    prisma.editorTransition.findMany({ where: { projectId } }),
  ]);
  return { project, tracks, clips, markers, transitions };
}

export async function touchLastOpened(userId: string, projectId: string): Promise<void> {
  await prisma.editorProject.updateMany({ where: { id: projectId, userId }, data: { lastOpenedAt: new Date() } });
}

export async function updateProject(
  userId: string,
  projectId: string,
  patch: { name?: string; folderId?: string | null; aspectRatio?: AspectRatio },
  db: Db = prisma
) {
  if (patch.folderId) {
    const folder = await db.editorFolder.findFirst({ where: { id: patch.folderId, userId } });
    if (!folder) throw new InvalidStateError("Folder not found.");
  }
  // Preview window's aspect-ratio quick-switch — width/height are derived
  // server-side from the enum (never trusted from the client) so they can
  // never drift out of sync with EDITOR_DIMENSIONS_BY_ASPECT, the same
  // lookup every AI Video orchestrator uses.
  const { aspectRatio, ...rest } = patch;
  const data: Prisma.EditorProjectUpdateManyMutationInput = { ...rest };
  if (aspectRatio) {
    const dims = EDITOR_DIMENSIONS_BY_ASPECT[aspectRatio];
    data.aspectRatio = dims.editorAspectRatio;
    data.widthPx = dims.widthPx;
    data.heightPx = dims.heightPx;
  }
  const claim = await db.editorProject.updateMany({ where: { id: projectId, userId }, data });
  if (claim.count === 0) throw new InvalidStateError("Project not found.");
  return db.editorProject.findUniqueOrThrow({ where: { id: projectId } });
}

export async function deleteProject(userId: string, projectId: string, db: Db = prisma): Promise<void> {
  const claim = await db.editorProject.deleteMany({ where: { id: projectId, userId } });
  if (claim.count === 0) throw new InvalidStateError("Project not found.");
}

// Deep-copies tracks + clips into a new project; assets themselves are
// referenced by id, not duplicated — a copy shares the same underlying
// media as the original.
export async function duplicateProject(userId: string, projectId: string, name?: string) {
  return prisma.$transaction(async (tx) => {
    const source = await getOwnedProject(userId, projectId, tx);
    const [tracks, clips, markers, transitions] = await Promise.all([
      tx.editorTrack.findMany({ where: { projectId } }),
      tx.editorClip.findMany({ where: { projectId } }),
      tx.editorMarker.findMany({ where: { projectId } }),
      tx.editorTransition.findMany({ where: { projectId } }),
    ]);

    const copy = await tx.editorProject.create({
      data: {
        userId,
        name: name ?? `${source.name} (Copy)`,
        folderId: source.folderId,
        aspectRatio: source.aspectRatio,
        widthPx: source.widthPx,
        heightPx: source.heightPx,
        durationMs: source.durationMs,
      },
    });

    const trackIdMap = new Map<string, string>();
    for (const track of tracks) {
      const newTrack = await tx.editorTrack.create({
        data: { projectId: copy.id, kind: track.kind, order: track.order, isMuted: track.isMuted, isHidden: track.isHidden },
      });
      trackIdMap.set(track.id, newTrack.id);
    }

    // Module 9 — clips are created ONE AT A TIME (not createMany) so each
    // new row's id can be captured into clipIdMap; transitions reference
    // clips by id and need that map to re-point at the copy's fresh clip
    // ids. A real, if modest, perf trade-off for very large projects versus
    // the previous bulk insert — acceptable here since this codebase's
    // realistic clip counts are small, and versions.ts's restore has the
    // exact same requirement (see that file).
    const clipIdMap = new Map<string, string>();
    for (const clip of clips) {
      const newClip = await tx.editorClip.create({
        data: {
          trackId: trackIdMap.get(clip.trackId)!,
          projectId: copy.id,
          assetId: clip.assetId,
          startMs: clip.startMs,
          durationMs: clip.durationMs,
          trimStartMs: clip.trimStartMs,
          content: clip.content as Prisma.InputJsonValue | undefined,
          transform: clip.transform as Prisma.InputJsonValue | undefined,
          // Reusing the source's groupId string verbatim is safe — group
          // queries are always scoped by (projectId, groupId) together, so
          // the same groupId value in the new project forms its own,
          // independent group rather than colliding with the original.
          groupId: clip.groupId,
        },
      });
      clipIdMap.set(clip.id, newClip.id);
    }

    if (markers.length > 0) {
      await tx.editorMarker.createMany({
        data: markers.map((marker) => ({ projectId: copy.id, timeMs: marker.timeMs })),
      });
    }

    const transitionsToCreate = transitions
      .filter((t) => clipIdMap.has(t.clipAId) && clipIdMap.has(t.clipBId) && trackIdMap.has(t.trackId))
      .map((t) => ({
        projectId: copy.id,
        trackId: trackIdMap.get(t.trackId)!,
        clipAId: clipIdMap.get(t.clipAId)!,
        clipBId: clipIdMap.get(t.clipBId)!,
        type: t.type,
        direction: t.direction,
        durationMs: t.durationMs,
        easing: t.easing as Prisma.InputJsonValue,
      }));
    if (transitionsToCreate.length > 0) {
      await tx.editorTransition.createMany({ data: transitionsToCreate });
    }

    return copy;
  });
}

// Recomputed after every clip add/move/trim/delete (called from clips.ts)
// rather than aggregated on read — cheap single-column write, and keeps the
// Project Browser's duration display free of a join+aggregate per card.
export async function recomputeProjectDuration(projectId: string, db: Db = prisma): Promise<void> {
  const clips = await db.editorClip.findMany({ where: { projectId }, select: { startMs: true, durationMs: true } });
  const durationMs = clips.reduce((max, c) => Math.max(max, c.startMs + c.durationMs), 0);
  await db.editorProject.update({ where: { id: projectId }, data: { durationMs } });
}
