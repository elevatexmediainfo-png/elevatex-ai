import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { InvalidStateError } from "./errors";
import { recomputeProjectDuration } from "./projects";
import { computeRippleDelete, duplicateClipSpan, splitClipSpan, type ClipSpanWithId } from "./timeline-engine";
import { pruneInvalidTransitionsForTrack } from "./transitions";

// Clip CRUD for the Cloud Video Editor (Milestone 24). Scoped by
// `projectId` only (not `userId`) — same trust boundary as tracks.ts, the
// caller already verified project ownership. Every mutation recomputes the
// project's cached durationMs afterward (see projects.ts) so the Project
// Browser's duration display never drifts from the real timeline.

export interface AddClipInput {
  projectId: string;
  userId: string;
  trackId: string;
  assetId?: string;
  startMs: number;
  durationMs: number;
  trimStartMs?: number;
  content?: Prisma.InputJsonValue;
  transform?: Prisma.InputJsonValue;
}

export async function addClip(input: AddClipInput) {
  return prisma.$transaction(async (tx) => {
    const track = await tx.editorTrack.findFirst({ where: { id: input.trackId, projectId: input.projectId } });
    if (!track) throw new InvalidStateError("Track not found in this project.");

    if (input.assetId) {
      // Real bug fix (2026-07-24, found live during the codebase health
      // check) — this only ever checked the asset ROW exists, never that
      // it belongs to the requesting user. Project ownership is already
      // checked by every caller (see this file's own header comment), but
      // the asset itself wasn't — any authenticated user who obtained
      // another user's EditorAsset id (a leak, a shared link, a future
      // collaboration feature) could attach it to their own clip, which
      // then renders in their preview and gets included in their export.
      // A LIBRARY-scope asset (admin-curated, shared) stays usable by
      // anyone, same as every other user-facing query in this codebase
      // already treats it (see EditorAsset.scope's own doc comment).
      const asset = await tx.editorAsset.findFirst({
        where: { id: input.assetId, OR: [{ scope: "LIBRARY" }, { userId: input.userId }] },
        select: { id: true },
      });
      if (!asset) throw new InvalidStateError("Asset not found.");
    }

    const clip = await tx.editorClip.create({
      data: {
        trackId: input.trackId,
        projectId: input.projectId,
        assetId: input.assetId,
        startMs: input.startMs,
        durationMs: input.durationMs,
        trimStartMs: input.trimStartMs ?? 0,
        content: input.content,
        transform: input.transform,
      },
    });

    await recomputeProjectDuration(input.projectId, tx);
    return clip;
  });
}

export interface UpdateClipInput {
  trackId?: string;
  startMs?: number;
  durationMs?: number;
  trimStartMs?: number;
  content?: Prisma.InputJsonValue;
  transform?: Prisma.InputJsonValue;
}

export async function updateClip(projectId: string, clipId: string, patch: UpdateClipInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.editorClip.findFirst({ where: { id: clipId, projectId } });
    if (!existing) throw new InvalidStateError("Clip not found in this project.");

    if (patch.trackId) {
      const track = await tx.editorTrack.findFirst({ where: { id: patch.trackId, projectId } });
      if (!track) throw new InvalidStateError("Track not found in this project.");
    }

    await tx.editorClip.update({ where: { id: clipId }, data: patch });

    // Module 9 — a plain move/trim/re-track can break an existing
    // transition's overlap invariant; see pruneInvalidTransitionsForTrack's
    // doc comment for the documented "remove, don't auto-resize" choice.
    // Full Regression Pass fix (2026-07-16) — the caller (Move/Trim's own
    // undo, commands.ts) needs to know exactly what got destroyed as a side
    // effect so it can restore it if the clip lands back where it was
    // valid; collecting both calls' return values is what makes that
    // possible instead of the prune being a silent, unrecoverable side
    // effect.
    const prunedFromSourceTrack = await pruneInvalidTransitionsForTrack(tx, existing.trackId);
    const prunedFromDestTrack = patch.trackId && patch.trackId !== existing.trackId ? await pruneInvalidTransitionsForTrack(tx, patch.trackId) : [];

    await recomputeProjectDuration(projectId, tx);
    const clip = await tx.editorClip.findUniqueOrThrow({ where: { id: clipId } });
    return { clip, prunedTransitions: [...prunedFromSourceTrack, ...prunedFromDestTrack] };
  });
}

export async function deleteClip(projectId: string, clipId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const claim = await tx.editorClip.deleteMany({ where: { id: clipId, projectId } });
    if (claim.count === 0) throw new InvalidStateError("Clip not found in this project.");
    await recomputeProjectDuration(projectId, tx);
  });
}

// Module 2 — Timeline core operations.

// Split: the original row keeps its id and shrinks to the first half; a new
// row is created for the second half (same track/asset/content, advanced
// trimStartMs) — the same "update in place + insert" shape
// lib/timeline/engine.ts's splitClip uses, just against EditorClip.
export async function splitClip(projectId: string, clipId: string, offsetMs: number) {
  return prisma.$transaction(async (tx) => {
    const clip = await tx.editorClip.findFirst({ where: { id: clipId, projectId } });
    if (!clip) throw new InvalidStateError("Clip not found in this project.");

    const [firstSpan, secondSpan] = splitClipSpan(clip, offsetMs);

    const first = await tx.editorClip.update({ where: { id: clip.id }, data: firstSpan });
    const second = await tx.editorClip.create({
      data: {
        trackId: clip.trackId,
        projectId: clip.projectId,
        assetId: clip.assetId,
        content: clip.content as Prisma.InputJsonValue | undefined,
        transform: clip.transform as Prisma.InputJsonValue | undefined,
        groupId: clip.groupId,
        ...secondSpan,
      },
    });

    // Module 9 — splitting shrinks the first half, which can break a
    // transition on ITS right edge (a transition on the left edge stays
    // valid, since the first half keeps the original clip's id/left edge).
    await pruneInvalidTransitionsForTrack(tx, clip.trackId);

    await recomputeProjectDuration(projectId, tx);
    return { first, second };
  });
}

// Ripple delete: deliberately scoped to the deleted clip's own track only
// (see the pure computeRippleDelete's doc comment) — unrelated tracks never
// shift just because one track's clip was removed.
export async function rippleDeleteClip(projectId: string, clipId: string) {
  return prisma.$transaction(async (tx) => {
    const clip = await tx.editorClip.findFirst({ where: { id: clipId, projectId } });
    if (!clip) throw new InvalidStateError("Clip not found in this project.");

    const trackClips: ClipSpanWithId[] = await tx.editorClip.findMany({
      where: { trackId: clip.trackId, projectId },
      select: { id: true, startMs: true, durationMs: true, trimStartMs: true },
    });

    const shifted = computeRippleDelete(trackClips, clipId);

    await tx.editorClip.delete({ where: { id: clipId } });
    await Promise.all(
      shifted
        .filter((s) => {
          const original = trackClips.find((c) => c.id === s.id);
          return original && original.startMs !== s.startMs;
        })
        .map((s) => tx.editorClip.update({ where: { id: s.id }, data: { startMs: s.startMs } }))
    );

    // Module 9 — the deleted clip's own transitions cascade-delete via the
    // FK, but the ripple shift above can break an unrelated transition
    // further down this same track.
    await pruneInvalidTransitionsForTrack(tx, clip.trackId);

    await recomputeProjectDuration(projectId, tx);
    return tx.editorClip.findMany({ where: { trackId: clip.trackId, projectId }, orderBy: { startMs: "asc" } });
  });
}

export async function duplicateEditorClip(projectId: string, clipId: string) {
  return prisma.$transaction(async (tx) => {
    const clip = await tx.editorClip.findFirst({ where: { id: clipId, projectId } });
    if (!clip) throw new InvalidStateError("Clip not found in this project.");

    const span = duplicateClipSpan(clip);
    const duplicate = await tx.editorClip.create({
      data: {
        trackId: clip.trackId,
        projectId: clip.projectId,
        assetId: clip.assetId,
        content: clip.content as Prisma.InputJsonValue | undefined,
        transform: clip.transform as Prisma.InputJsonValue | undefined,
        // A duplicate starts its own, independent existence — never
        // silently joins the original's group.
        groupId: null,
        ...span,
      },
    });

    await recomputeProjectDuration(projectId, tx);
    return duplicate;
  });
}

// Replace source: swaps only which asset a clip plays, leaving its
// timing/content untouched. Same ownership check as addClip's own fix
// above (2026-07-24) — an existence-only check let any authenticated user
// attach another user's asset to their own clip via this route.
export async function replaceClipSource(projectId: string, userId: string, clipId: string, assetId: string) {
  return prisma.$transaction(async (tx) => {
    const asset = await tx.editorAsset.findFirst({ where: { id: assetId, OR: [{ scope: "LIBRARY" }, { userId }] }, select: { id: true } });
    if (!asset) throw new InvalidStateError("Asset not found.");

    const claim = await tx.editorClip.updateMany({ where: { id: clipId, projectId }, data: { assetId } });
    if (claim.count === 0) throw new InvalidStateError("Clip not found in this project.");

    return tx.editorClip.findUniqueOrThrow({ where: { id: clipId } });
  });
}

// Group: every given clip id must belong to this project (verified by
// count, the same atomic-claim pattern used everywhere else in this
// module) — assigns a fresh group id to all of them, replacing any group
// they were previously in.
export async function groupClips(projectId: string, clipIds: string[]) {
  const groupId = crypto.randomUUID();
  const claim = await prisma.editorClip.updateMany({
    where: { id: { in: clipIds }, projectId },
    data: { groupId },
  });
  if (claim.count !== clipIds.length) throw new InvalidStateError("One or more clips were not found in this project.");
  return prisma.editorClip.findMany({ where: { id: { in: clipIds } } });
}

export async function ungroupClips(projectId: string, clipIds: string[]) {
  const claim = await prisma.editorClip.updateMany({
    where: { id: { in: clipIds }, projectId },
    data: { groupId: null },
  });
  if (claim.count === 0) throw new InvalidStateError("No matching clips found in this project.");
  return prisma.editorClip.findMany({ where: { id: { in: clipIds } } });
}
