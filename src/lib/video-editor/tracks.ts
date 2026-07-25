import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { InvalidStateError } from "./errors";

// Track CRUD for the Cloud Video Editor (Milestone 24). Every function here
// scopes its query by `projectId` only, not `userId` — the caller (the API
// route) has already established project ownership once via
// getOwnedProject() before reaching these, the same trust boundary
// lib/timeline/engine.ts's addTrack/updateTrack/removeTrack establish for
// the Milestone 9 editor.

type Db = Prisma.TransactionClient | typeof prisma;

// `order` is assigned as `last.order + 1` from a plain read-then-write —
// under Postgres' default READ COMMITTED isolation, two addTrack calls on
// the SAME project fired close together (Module 8 adding an audio track
// while another request is in flight; Phase 12's AI auto-editing creating
// several tracks back-to-back) can both read the same `last` and collide
// on the `(projectId, order)` unique constraint, 500ing the second call —
// found live during Module 7's Playwright verification (two "Add Track"
// clicks ~300ms apart reproduced it every time). Retried here rather than
// prevented with a row lock: a bounded retry that re-reads the now-
// committed state always succeeds within a couple of attempts, without
// needing `SELECT ... FOR UPDATE` or a SERIALIZABLE transaction (either of
// which this codebase has no existing precedent for).
const MAX_ADD_TRACK_ATTEMPTS = 5;

// Compositor stacking convention (compositor-stage.tsx's z-index formula,
// unchanged and confirmed correct): a LOWER `order` renders IN FRONT, and
// that's the exact same array (tracks sorted by `order` ascending) the
// Timeline panel lists top-to-bottom — so "topmost row in the track panel"
// and "topmost layer in the composite" already agree with each other. The
// bug was never a formula inconsistency; it was that every track added
// here always appended at the highest `order + 1`, landing it at the
// BOTTOM of both the panel and the composite. For a video/text/subtitle/
// overlay/effects track, that's backwards from what any editor user
// expects when they add an overlay to an existing video: it should render
// (and list) ABOVE what's already there. Two independent one-off
// workarounds for exactly this (lib/creative/veo-multiscene-video.ts,
// lib/scenes/merge-via-editor.ts) manually reassigned a text track's order
// after calling this function — both are now redundant and have been
// removed, since prepending is this function's own default behavior.
// AUDIO is the one exception: it never participates in the compositor's
// visual stacking at all, so there's no correctness reason to move it, and
// leaving it appending at the bottom matches where audio conventionally
// lives in most editors' track panels.
// `insertBelowOrder` (2026-07-19) — real bug found live: AI Auto-Edit's
// SUBTITLE (captions) and OVERLAY (b-roll/stickers) tracks, when BOTH need
// fresh creation in the same apply, raced via createCompositeCommand's
// parallel execute() for which landed at the lower `order` (renders in
// front) — live-confirmed b-roll winning that race and covering captions.
// This param lets a caller pin the new track BELOW a specific existing
// order value instead of unconditionally prepending to the absolute top —
// used by ai-timeline-translator.ts to guarantee OVERLAY always lands
// below SUBTITLE's real (now-known) order, by construction. Deliberately
// NOT a full reorder/renumbering primitive (this codebase's existing
// drag-reorder already has known undo-interaction issues, flagged
// separately) — this only ever INSERTS a brand-new row, so undo is the
// same plain delete every other track-create command already uses.
export async function addTrack(projectId: string, kind: string, audioSubtype?: string, db: Db = prisma, insertBelowOrder?: number) {
  const prepend = kind !== "AUDIO" && insertBelowOrder === undefined;

  // Real bug found live (2026-07-22) — a real AI Auto-Edit project ended up
  // with its OVERLAY (b-roll) track at order 4, the BOTTOM of a 6-track
  // stack, even though this function's whole `insertBelowOrder` mechanism
  // exists specifically so OVERLAY lands directly below SUBTITLE (its
  // caller passed insertBelowOrder = subtitleTrack.order = -1). Root
  // cause: the old code below computed `order = insertBelowOrder +
  // attempt` on every retry, a mechanism that only actually guards against
  // a genuinely CONCURRENT create landing on the exact same value — it had
  // no defense against the much more mundane case this project actually
  // hit, where OTHER, unrelated tracks (VIDEO order 0, three AUDIO tracks
  // orders 1-3) already densely occupied every slot directly below -1, so
  // the naive +1-per-retry walk marched straight past all four of them
  // before finally landing on the first free number (4) — silently
  // rendering b-roll BEHIND the main video (invisible) even once its own
  // asset-kind rendering gap (OverlayLayer, compositor-stage.tsx) was
  // fixed. A real "insert directly below X" needs to make room, not
  // search for a coincidentally free number arbitrarily far away.
  //
  // Fixed with a genuine ordered-list insert: shift every track at or
  // below the target slot down by exactly one, then insert at
  // insertBelowOrder + 1. Rows are shifted highest-order-first, one
  // update at a time (not a single bulk `updateMany`) — SQL gives no
  // guarantee about which row a set-based bulk UPDATE touches first, so a
  // bulk shift risks a transient (projectId, order) collision against a
  // not-yet-moved row; going strictly highest-to-lowest guarantees every
  // slot a row is about to move into has already been vacated.
  if (insertBelowOrder !== undefined) {
    const targetOrder = insertBelowOrder + 1;
    return prisma.$transaction(async (tx) => {
      const count = await tx.editorTrack.count({ where: { projectId } });
      const maxTracks = await getConfig("EDITOR_MAX_TRACKS_PER_PROJECT");
      if (count >= maxTracks) {
        throw new InvalidStateError(`This project already has the maximum of ${maxTracks} tracks.`);
      }
      const toShift = await tx.editorTrack.findMany({
        where: { projectId, order: { gte: targetOrder } },
        orderBy: { order: "desc" },
      });
      for (const t of toShift) {
        await tx.editorTrack.update({ where: { id: t.id }, data: { order: t.order + 1 } });
      }
      return tx.editorTrack.create({ data: { projectId, kind: kind as never, order: targetOrder, audioSubtype: audioSubtype as never } });
    });
  }

  for (let attempt = 1; attempt <= MAX_ADD_TRACK_ATTEMPTS; attempt++) {
    const count = await db.editorTrack.count({ where: { projectId } });
    const maxTracks = await getConfig("EDITOR_MAX_TRACKS_PER_PROJECT");
    if (count >= maxTracks) {
      throw new InvalidStateError(`This project already has the maximum of ${maxTracks} tracks.`);
    }

    const edge = await db.editorTrack.findFirst({ where: { projectId }, orderBy: { order: prepend ? "asc" : "desc" } });
    const order = edge ? (prepend ? edge.order - 1 : edge.order + 1) : 0;

    try {
      return await db.editorTrack.create({ data: { projectId, kind: kind as never, order, audioSubtype: audioSubtype as never } });
    } catch (err) {
      const isOrderCollision = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isOrderCollision || attempt === MAX_ADD_TRACK_ATTEMPTS) throw err;
      // Loop and re-read — another concurrent create just took this `order`.
    }
  }
  // Unreachable: the loop above always returns or throws.
  throw new InvalidStateError("Could not create track after multiple concurrent attempts.");
}

// Track reordering (2026-07-15) — the previously-tracked "reorderTracks()
// for the Layers panel" backlog item. Unlike addTrack's single-row
// insert, moving an existing track past others touches EVERY track whose
// position shifts as a result, so a straight per-row order swap risks the
// exact same `(projectId, order)` unique-constraint collision addTrack's
// own retry loop exists to survive — reuses that SAME "attempt, catch a
// P2002 collision from a genuinely concurrent edit, re-read and retry"
// outer shape rather than inventing a second mechanism, per the explicit
// ask. The actual per-attempt reassignment is a real `prisma.$transaction`
// (matching clips.ts's own convention for multi-row atomicity, not the
// plain injected `db` param this file's simpler single-row functions
// use) with two phases: phase 1 moves every affected row to a
// guaranteed-unused negative-offset temporary order, phase 2 assigns the
// real final values — necessary because writing straight to final values
// one row at a time can transiently duplicate another row's CURRENT order
// mid-transaction even though the end state has none (the classic
// reorder-under-a-unique-constraint problem).
const MAX_REORDER_ATTEMPTS = 5;
const REORDER_TEMP_OFFSET = 1_000_000;

export interface ReorderedTrack {
  id: string;
  order: number;
}

// `targetIndex` is 0-based among the project's tracks sorted by order
// ascending — 0 = topmost row in the panel = frontmost compositor layer
// (see track-stacking.ts's own doc comment for why those two always
// already agree). Out-of-range values clamp rather than throw, matching
// how a drag gesture naturally produces slightly-past-the-end indices.
export async function reorderTrack(projectId: string, trackId: string, targetIndex: number): Promise<ReorderedTrack[]> {
  for (let attempt = 1; attempt <= MAX_REORDER_ATTEMPTS; attempt++) {
    const tracks = await prisma.editorTrack.findMany({ where: { projectId }, orderBy: { order: "asc" }, select: { id: true, order: true } });
    const fromIndex = tracks.findIndex((t) => t.id === trackId);
    if (fromIndex === -1) throw new InvalidStateError("Track not found in this project.");

    const clampedTarget = Math.max(0, Math.min(tracks.length - 1, targetIndex));
    if (clampedTarget === fromIndex) return tracks.map((t) => ({ id: t.id, order: t.order }));

    const reordered = [...tracks];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(clampedTarget, 0, moved);
    // The pool of `order` values is unchanged, only permuted to match the
    // new sequence — every track keeps the SET of values it already had,
    // just reassigned to the new positions, so no track outside the
    // dragged range needs a value it's never held before.
    const finalOrders = reordered.map((t, i) => ({ id: t.id, order: tracks[i].order }));

    try {
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < finalOrders.length; i++) {
          await tx.editorTrack.update({ where: { id: finalOrders[i].id }, data: { order: -(i + 1) - REORDER_TEMP_OFFSET } });
        }
        for (const { id, order } of finalOrders) {
          await tx.editorTrack.update({ where: { id }, data: { order } });
        }
      });
      return finalOrders;
    } catch (err) {
      const isOrderCollision = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isOrderCollision || attempt === MAX_REORDER_ATTEMPTS) throw err;
      // Loop and re-read — another concurrent add/remove/reorder just
      // changed the track set or its order values out from under us.
    }
  }
  // Unreachable: the loop above always returns or throws.
  throw new InvalidStateError("Could not reorder track after multiple concurrent attempts.");
}

export interface UpdateTrackInput {
  isMuted?: boolean;
  isHidden?: boolean;
  isLocked?: boolean;
  heightPx?: number;
  soloed?: boolean;
  duckingEnabled?: boolean;
  duckingAmountDb?: number;
  duckingFadeMs?: number;
  duckingVoiceTrackIds?: string[];
}

export async function updateTrack(projectId: string, trackId: string, patch: UpdateTrackInput, db: Db = prisma) {
  const claim = await db.editorTrack.updateMany({ where: { id: trackId, projectId }, data: patch });
  if (claim.count === 0) throw new InvalidStateError("Track not found in this project.");
  return db.editorTrack.findUniqueOrThrow({ where: { id: trackId } });
}

export async function removeTrack(projectId: string, trackId: string, db: Db = prisma): Promise<void> {
  const claim = await db.editorTrack.deleteMany({ where: { id: trackId, projectId } });
  if (claim.count === 0) throw new InvalidStateError("Track not found in this project.");
}
