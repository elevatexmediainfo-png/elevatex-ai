import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { InvalidStateError } from "./errors";
import { recomputeProjectDuration } from "./projects";
import { clipEndMs, computeRippleShift, type ClipSpanWithId } from "./timeline-engine";
import { DEFAULT_TRANSITION_EASING, MIN_TRANSITION_MS, type TransitionDirection, type TransitionEasing, type TransitionType } from "./transition-engine";

// Transition CRUD for the Cloud Video Editor (Module 9). See
// transition-engine.ts's file header for the overlap model this ripple-
// shifts clips to create/close, and PROJECT_STATUS.md's Module 9 entry for
// the full reasoning. Scoped by `projectId` only (not `userId`), same trust
// boundary as clips.ts/tracks.ts — the caller (the API route) already
// verified project ownership.

type Db = Prisma.TransactionClient | typeof prisma;

async function shiftTrackFrom(tx: Db, trackId: string, fromMs: number, deltaMs: number): Promise<void> {
  if (deltaMs === 0) return;
  const trackClips: ClipSpanWithId[] = await tx.editorClip.findMany({
    where: { trackId },
    select: { id: true, startMs: true, durationMs: true, trimStartMs: true },
  });
  const shifted = computeRippleShift(trackClips, fromMs, deltaMs);
  await Promise.all(
    shifted
      .filter((s) => {
        const original = trackClips.find((c) => c.id === s.id);
        return original && original.startMs !== s.startMs;
      })
      .map((s) => tx.editorClip.update({ where: { id: s.id }, data: { startMs: s.startMs } }))
  );
}

// A transition is valid iff both its clips still exist, are still on its
// trackId, and clipB's startMs still equals exactly clipA's end minus the
// transition's own durationMs (the precise overlap the transition itself
// created). A plain drag/trim that changes either clip's boundaries
// DIRECTLY (not through addTransition/updateTransition/removeTransition's
// own ripple-aware paths below) breaks this invariant — the documented
// choice (see PROJECT_STATUS.md's Module 9 entry: "dragging clips apart")
// is to REMOVE the transition outright rather than silently reinterpreting
// a new, possibly-nonsensical gap/overlap as some auto-resized duration.
// Called from clips.ts after every operation that can move a clip's
// boundaries: updateClip (move/trim/re-track), splitClip, rippleDeleteClip.
//
// Returns whatever it deleted (2026-07-16, Full Regression Pass fix) — a
// plain void return here left every caller with no way to know a
// transition was just silently destroyed as a side effect, which is
// exactly why Move/Trim's own undo previously had no way to bring it back
// even when the clip(s) landed back in the exact position the transition
// was valid at. Callers that don't care can just ignore the return value.
export async function pruneInvalidTransitionsForTrack(tx: Db, trackId: string) {
  const transitions = await tx.editorTransition.findMany({ where: { trackId } });
  if (transitions.length === 0) return [];

  const clipIds = Array.from(new Set(transitions.flatMap((t) => [t.clipAId, t.clipBId])));
  const clips = await tx.editorClip.findMany({ where: { id: { in: clipIds } } });
  const clipById = new Map(clips.map((c) => [c.id, c]));

  const invalid = transitions.filter((t) => {
    const clipA = clipById.get(t.clipAId);
    const clipB = clipById.get(t.clipBId);
    const valid = Boolean(clipA && clipB && clipA.trackId === trackId && clipB.trackId === trackId && clipB.startMs === clipA.startMs + clipA.durationMs - t.durationMs);
    return !valid;
  });
  if (invalid.length > 0) {
    await tx.editorTransition.deleteMany({ where: { id: { in: invalid.map((t) => t.id) } } });
  }
  return invalid;
}

export interface AddTransitionInput {
  projectId: string;
  trackId: string;
  clipAId: string;
  clipBId: string;
  type: TransitionType;
  direction?: TransitionDirection | null;
  durationMs: number;
  easing?: TransitionEasing;
}

export async function addTransition(input: AddTransitionInput) {
  return prisma.$transaction(async (tx) => {
    const [clipA, clipB] = await Promise.all([
      tx.editorClip.findFirst({ where: { id: input.clipAId, projectId: input.projectId, trackId: input.trackId } }),
      tx.editorClip.findFirst({ where: { id: input.clipBId, projectId: input.projectId, trackId: input.trackId } }),
    ]);
    if (!clipA || !clipB) throw new InvalidStateError("Both clips must exist on the given track.");
    if (clipB.startMs !== clipEndMs(clipA)) {
      throw new InvalidStateError("Clips must be exactly adjacent (no gap) to add a transition.");
    }

    const existing = await tx.editorTransition.findFirst({
      where: { OR: [{ clipAId: input.clipAId }, { clipBId: input.clipBId }] },
    });
    if (existing) throw new InvalidStateError("One of these clips already has a transition on this edge.");

    const maxDurationMs = Math.min(clipA.durationMs, clipB.durationMs);
    const durationMs = Math.max(MIN_TRANSITION_MS, Math.min(input.durationMs, maxDurationMs));
    if (durationMs > maxDurationMs) {
      throw new InvalidStateError("Clips are too short for a transition.");
    }

    // Open the overlap window: shift clipB (and everything after it on this
    // track) earlier by durationMs.
    await shiftTrackFrom(tx, input.trackId, clipB.startMs, -durationMs);

    const transition = await tx.editorTransition.create({
      data: {
        projectId: input.projectId,
        trackId: input.trackId,
        clipAId: input.clipAId,
        clipBId: input.clipBId,
        type: input.type as never,
        direction: (input.direction ?? null) as never,
        durationMs,
        easing: (input.easing ?? DEFAULT_TRANSITION_EASING) as unknown as Prisma.InputJsonValue,
      },
    });

    await recomputeProjectDuration(input.projectId, tx);
    return transition;
  });
}

// Restores a transition pruned as a side effect of a move/trim, once the
// clip(s) are back at the exact position the transition needs (2026-07-16,
// Full Regression Pass follow-up fix — see commands.ts's createMoveClipCommand
// for the bug this closes). Deliberately NOT addTransition: that function's
// contract is "clips sit gap-free adjacent, I'LL shift clipB to create the
// overlap" — but by the time a move/trim's own undo calls this, clipB is
// already sitting at the OVERLAPPING position the transition itself
// requires (that's what "undo the move" restored), so re-running
// addTransition's gap-free check on it would always fail with a false
// "not adjacent" (confirmed live — this is exactly the failure the first
// version of the fix hit). This validates the OVERLAP invariant instead
// (the same formula pruneInvalidTransitionsForTrack itself checks) and
// creates the row directly, with no repositioning of its own — a
// genuinely-invalid restore attempt (e.g. something else also moved in
// between) still fails safely rather than silently creating a transition
// inconsistent with its own clips' positions.
export async function restorePrunedTransition(input: AddTransitionInput) {
  return prisma.$transaction(async (tx) => {
    const [clipA, clipB] = await Promise.all([
      tx.editorClip.findFirst({ where: { id: input.clipAId, projectId: input.projectId, trackId: input.trackId } }),
      tx.editorClip.findFirst({ where: { id: input.clipBId, projectId: input.projectId, trackId: input.trackId } }),
    ]);
    if (!clipA || !clipB) throw new InvalidStateError("Both clips must exist on the given track.");
    if (clipB.startMs !== clipA.startMs + clipA.durationMs - input.durationMs) {
      throw new InvalidStateError("Clips are no longer positioned where this transition would be valid.");
    }

    const existing = await tx.editorTransition.findFirst({
      where: { OR: [{ clipAId: input.clipAId }, { clipBId: input.clipBId }] },
    });
    if (existing) throw new InvalidStateError("One of these clips already has a transition on this edge.");

    const transition = await tx.editorTransition.create({
      data: {
        projectId: input.projectId,
        trackId: input.trackId,
        clipAId: input.clipAId,
        clipBId: input.clipBId,
        type: input.type as never,
        direction: (input.direction ?? null) as never,
        durationMs: input.durationMs,
        easing: (input.easing ?? DEFAULT_TRANSITION_EASING) as unknown as Prisma.InputJsonValue,
      },
    });

    await recomputeProjectDuration(input.projectId, tx);
    return transition;
  });
}

export interface UpdateTransitionInput {
  type?: TransitionType;
  direction?: TransitionDirection | null;
  durationMs?: number;
  easing?: TransitionEasing;
}

export async function updateTransition(projectId: string, transitionId: string, patch: UpdateTransitionInput) {
  return prisma.$transaction(async (tx) => {
    const transition = await tx.editorTransition.findFirst({ where: { id: transitionId, projectId } });
    if (!transition) throw new InvalidStateError("Transition not found in this project.");

    let newDurationMs = transition.durationMs;
    if (patch.durationMs !== undefined && patch.durationMs !== transition.durationMs) {
      const [clipA, clipB] = await Promise.all([
        tx.editorClip.findUnique({ where: { id: transition.clipAId } }),
        tx.editorClip.findUnique({ where: { id: transition.clipBId } }),
      ]);
      if (!clipA || !clipB) throw new InvalidStateError("This transition's clips no longer exist.");

      const maxDurationMs = Math.min(clipA.durationMs, clipB.durationMs);
      newDurationMs = Math.max(MIN_TRANSITION_MS, Math.min(patch.durationMs, maxDurationMs));
      // Growing the overlap (newDurationMs > old) moves clipB EARLIER
      // (negative delta); shrinking it moves clipB LATER (positive delta).
      const delta = transition.durationMs - newDurationMs;
      await shiftTrackFrom(tx, transition.trackId, clipB.startMs, delta);
    }

    const updated = await tx.editorTransition.update({
      where: { id: transitionId },
      data: {
        ...(patch.durationMs !== undefined ? { durationMs: newDurationMs } : {}),
        ...(patch.type !== undefined ? { type: patch.type as never } : {}),
        ...(patch.direction !== undefined ? { direction: (patch.direction ?? null) as never } : {}),
        ...(patch.easing !== undefined ? { easing: patch.easing as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    await recomputeProjectDuration(projectId, tx);
    return updated;
  });
}

export async function removeTransition(projectId: string, transitionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const transition = await tx.editorTransition.findFirst({ where: { id: transitionId, projectId } });
    if (!transition) throw new InvalidStateError("Transition not found in this project.");

    const clipB = await tx.editorClip.findUnique({ where: { id: transition.clipBId } });
    if (clipB) {
      // Restore the pre-transition, gap-free placement: shift clipB (and
      // everything after it on this track) back later by the transition's
      // duration — the exact inverse of addTransition's ripple-shift.
      await shiftTrackFrom(tx, transition.trackId, clipB.startMs, transition.durationMs);
    }

    await tx.editorTransition.delete({ where: { id: transitionId } });
    await recomputeProjectDuration(projectId, tx);
  });
}

export async function listTransitions(projectId: string, db: Db = prisma) {
  return db.editorTransition.findMany({ where: { projectId } });
}
