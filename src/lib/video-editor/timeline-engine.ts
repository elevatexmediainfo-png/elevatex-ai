// Pure clip-span math for the Cloud Video Editor's Timeline (Milestone 24).
// Mirrors lib/timeline/engine.ts's pure-function split (Milestone 9) but for
// EditorClip — kept separate from the DB-bound services in this same folder
// so the arithmetic is trivially unit-testable with no Postgres involved.

export interface EditorClipSpan {
  startMs: number;
  durationMs: number;
  trimStartMs: number;
}

export function clipEndMs(clip: EditorClipSpan): number {
  return clip.startMs + clip.durationMs;
}

// Pure — Move: shifts a clip's startMs by deltaMs, never past 0.
export function moveClipSpan(clip: EditorClipSpan, deltaMs: number): EditorClipSpan {
  return { ...clip, startMs: Math.max(0, clip.startMs + deltaMs) };
}

export type TrimEdge = "LEFT" | "RIGHT";

// Pure — Trim: dragging the right edge only changes durationMs; dragging the
// left edge shortens/lengthens from the start AND advances/retreats
// trimStartMs by the same amount (the offset into the *source* media), so
// the clip's out-point in the source never moves — the same trick
// lib/timeline/engine.ts's splitClipSpan uses for its second half. deltaMs
// is clamped so durationMs never drops below minDurationMs and
// trimStartMs never goes negative.
export function trimClipSpan(clip: EditorClipSpan, edge: TrimEdge, deltaMs: number, minDurationMs = 200): EditorClipSpan {
  if (edge === "RIGHT") {
    return { ...clip, durationMs: Math.max(minDurationMs, clip.durationMs + deltaMs) };
  }
  const maxDelta = clip.durationMs - minDurationMs;
  const minDelta = -clip.trimStartMs;
  const clamped = Math.max(minDelta, Math.min(maxDelta, deltaMs));
  return {
    startMs: Math.max(0, clip.startMs + clamped),
    durationMs: clip.durationMs - clamped,
    trimStartMs: clip.trimStartMs + clamped,
  };
}

// Pure — Duplicate: placed immediately after the original on the same
// track. Module 2 wires this up as a user-facing Timeline action; defined
// now alongside its siblings since it's the same shape of pure math.
export function duplicateClipSpan(clip: EditorClipSpan): EditorClipSpan {
  return { startMs: clipEndMs(clip), durationMs: clip.durationMs, trimStartMs: clip.trimStartMs };
}

// ============================================================================
// Module 2 additions below. Written fresh against EditorClipSpan's shape —
// deliberately NOT importing lib/timeline/engine.ts, which solves the same
// class of problems for a different schema (Track/Clip, Scene-aware). See
// the Milestone-24-Module-2 audit: near-identical *logic*, zero *coupling* —
// worth sharing only if a real third schema needs the same math, which
// hasn't happened yet.
// ============================================================================

// Pure — Split: divides a clip at `offsetMs` (measured from the clip's own
// start, 0 < offsetMs < durationMs) into two contiguous spans. trimStartMs
// advances on the second half so a video/audio source keeps playing from
// where it left off, not from its own beginning.
export function splitClipSpan(clip: EditorClipSpan, offsetMs: number): [EditorClipSpan, EditorClipSpan] {
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

export interface ClipSpanWithId extends EditorClipSpan {
  id: string;
}

// Pure — Ripple delete: removes `deletedClipId` from `clipsOnTrack` (one
// track's clips only — ripple deliberately does not cross tracks here, so
// deleting a video clip never silently shifts an unrelated audio/text
// track) and shifts left, by the deleted clip's durationMs, every clip that
// started at or after the deleted clip's end — closing the gap exactly.
// Clips before the deleted clip are untouched.
export function computeRippleDelete<T extends ClipSpanWithId>(clipsOnTrack: T[], deletedClipId: string): T[] {
  const deleted = clipsOnTrack.find((c) => c.id === deletedClipId);
  if (!deleted) return clipsOnTrack;
  const deletedEndMs = clipEndMs(deleted);

  return clipsOnTrack
    .filter((c) => c.id !== deletedClipId)
    .map((c) => (c.startMs >= deletedEndMs ? { ...c, startMs: c.startMs - deleted.durationMs } : c));
}

// Pure — shifts every clip that starts at or after `fromMs` by `deltaMs`
// (negative = earlier, positive = later), leaving clips before `fromMs`
// untouched (never below 0). Module 9 (Transitions) uses this to open/close
// the overlap window a transition's duration creates: adding or growing a
// transition ripple-shifts the incoming clip (and everything after it on
// the same track) earlier by exactly the transition's duration, so the
// track never ends up with a dead gap where the overlap "ate into" the
// timeline — removing/shrinking a transition calls this again with a
// positive deltaMs to restore the prior gap-free placement. Same
// one-track-only scoping computeRippleDelete already uses, just shifting
// instead of removing.
export function computeRippleShift<T extends ClipSpanWithId>(clipsOnTrack: T[], fromMs: number, deltaMs: number): T[] {
  return clipsOnTrack.map((c) => (c.startMs >= fromMs ? { ...c, startMs: Math.max(0, c.startMs + deltaMs) } : c));
}

// Pure — Magnetic snap. `candidates` are absolute Ms positions (other
// clips' edges, the playhead, markers); returns the closest one within
// `thresholdMs`, or null if nothing is close enough. Unit-agnostic on
// purpose — the caller converts the admin-configured pixel threshold
// (EDITOR_SNAP_THRESHOLD_PX) to Ms using the current zoom (pxPerSecond),
// since "how many ms is 8px" only means something at a given zoom level.
export function findNearestSnapTarget(valueMs: number, candidates: number[], thresholdMs: number): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - valueMs);
    if (distance <= thresholdMs && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

export interface SnapCandidateInput {
  clips: ClipSpanWithId[];
  excludeClipIds: Set<string>;
  markerTimesMs: number[];
  playheadMs: number;
}

// Pure — every snap-target Ms position in scope for one drag: the start
// and end of every clip NOT currently being dragged (across all tracks —
// aligning a text clip's edge to a video clip's edge on a different track
// is a normal, expected editing motion), every marker, and the playhead.
export function collectSnapCandidates(input: SnapCandidateInput): number[] {
  const candidates: number[] = [input.playheadMs, ...input.markerTimesMs];
  for (const clip of input.clips) {
    if (input.excludeClipIds.has(clip.id)) continue;
    candidates.push(clip.startMs, clipEndMs(clip));
  }
  return candidates;
}

// Pure — snapping a Move: a moved clip has two edges that can each
// independently snap. Tries the start edge first; if it isn't within
// threshold, tries the end edge (and derives the start that would put the
// end exactly on the target); otherwise returns startMs unchanged.
export function snapMoveStart(startMs: number, durationMs: number, candidates: number[], thresholdMs: number): number {
  const startSnap = findNearestSnapTarget(startMs, candidates, thresholdMs);
  if (startSnap !== null) return startSnap;

  const endMs = startMs + durationMs;
  const endSnap = findNearestSnapTarget(endMs, candidates, thresholdMs);
  if (endSnap !== null) return endSnap - durationMs;

  return startMs;
}

// Pure — snapping a single Trim edge (an absolute Ms position — the
// clip's current startMs for a LEFT trim, or its current end for a RIGHT
// trim). Returns the snapped value, or the input unchanged if nothing is
// within threshold.
export function snapTrimEdge(valueMs: number, candidates: number[], thresholdMs: number): number {
  return findNearestSnapTarget(valueMs, candidates, thresholdMs) ?? valueMs;
}

// Fix (2026-07-12) — this timeline never had same-track collision
// handling at all (Known Issues' own "Timeline has no collision handling"
// entry, a documented scope cut, not a regression): dropping a new clip
// near an existing one, moving a clip onto another, or trimming a clip
// past its neighbor all silently produced overlapping EditorClip rows —
// confirmed live, both in the DB and as visually garbled overlapping
// clip blocks. These three functions are the shared clamp used by every
// same-track mutation path (drop, move, trim-left, trim-right) so a clip
// always stops at its neighbor's edge instead of continuing through it —
// the same "block, don't reject" convention every mainstream NLE
// (including the CapCut reference) uses. `neighbors` must already exclude
// the clip's own id and any group mates moving with it.

// Move (and new-clip-drop, which is really "place a clip with no prior
// position") — commits to ONE escape direction (whichever side of the
// nearest blocker is closer to where the gesture was actually aiming),
// then sweeps monotonically in that direction only, resolving any further
// neighbors the sweep runs into. Re-deciding "nearest side" from scratch
// after every push (instead of committing once) oscillates forever
// between two neighbors sitting back-to-back — this doesn't.
export function clampMoveStart(proposedStartMs: number, durationMs: number, neighbors: ClipSpanWithId[]): number {
  const proposedStart = Math.max(0, proposedStartMs);
  const proposedEnd = proposedStart + durationMs;
  const overlapping = neighbors.filter((n) => proposedStart < n.startMs + n.durationMs && n.startMs < proposedEnd);
  if (overlapping.length === 0) return proposedStart;

  const distanceToEdges = (n: ClipSpanWithId) =>
    Math.min(Math.abs(n.startMs - proposedEnd), Math.abs(n.startMs + n.durationMs - proposedStart));
  const nearest = overlapping.reduce((closest, n) => (distanceToEdges(n) < distanceToEdges(closest) ? n : closest));

  const pushBeforeMs = nearest.startMs - durationMs;
  const pushAfterMs = nearest.startMs + nearest.durationMs;
  const goingBackward = pushBeforeMs >= 0 && Math.abs(pushBeforeMs - proposedStart) <= Math.abs(pushAfterMs - proposedStart);

  let start = goingBackward ? pushBeforeMs : pushAfterMs;
  for (let pass = 0; pass <= neighbors.length; pass++) {
    const end = start + durationMs;
    const blocker = neighbors.find((n) => start < n.startMs + n.durationMs && n.startMs < end);
    if (!blocker) break;
    start = goingBackward ? Math.max(0, blocker.startMs - durationMs) : blocker.startMs + blocker.durationMs;
  }
  return Math.max(0, start);
}

// Trim-right — only neighbors starting at/after the clip's own (unchanged)
// start can be "in front" of a right-edge trim; a neighbor already
// overlapping the clip's start isn't this gesture's to resolve.
export function clampTrimRightEnd(clipStartMs: number, proposedEndMs: number, neighbors: ClipSpanWithId[]): number {
  let end = Math.max(clipStartMs, proposedEndMs);
  for (const n of neighbors) {
    if (n.startMs >= clipStartMs && n.startMs < end) end = n.startMs;
  }
  return end;
}

// Trim-left — mirrors clampTrimRightEnd: only neighbors ending at/before
// the clip's own (unchanged) end can be "behind" a left-edge trim.
export function clampTrimLeftStart(clipEndMs: number, proposedStartMs: number, neighbors: ClipSpanWithId[]): number {
  let start = Math.min(clipEndMs, Math.max(0, proposedStartMs));
  for (const n of neighbors) {
    const nEnd = n.startMs + n.durationMs;
    if (nEnd <= clipEndMs && nEnd > start) start = nEnd;
  }
  return start;
}

// Fix (2026-07-12) — the Timeline ruler used to hard-code exactly one tick
// per whole second regardless of zoom (`pxPerSecond`), so trim never had a
// finer visual reference to aim at when zoomed in, and got cluttered with
// overlapping labels when zoomed out. Trim's own underlying math
// (pxToMs/snapTrimEdge above) was already millisecond-precise the whole
// time — this was purely a ruler-rendering limitation, not a real
// constraint, confirmed by reading every trim code path before touching
// anything here. These two pure functions replace that hard-coded interval
// with one that adapts to zoom, from a coarse multi-minute view (scrubbing
// a long timeline) down to a 100ms view (frame-accurate trim work) —
// spanning MIN_PX_PER_SECOND..MAX_PX_PER_SECOND in store.tsx.
const NICE_TICK_INTERVALS_MS = [
  50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000,
];

// Picks the smallest "nice" interval (round ms/s/min values, not arbitrary
// numbers) whose on-screen spacing is at least `minPxBetweenTicks` — dense
// enough to read at a glance, never so dense ticks/labels overlap.
export function pickTickIntervalMs(pxPerSecond: number, minPxBetweenTicks = 60): number {
  for (const interval of NICE_TICK_INTERVALS_MS) {
    if ((interval / 1000) * pxPerSecond >= minPxBetweenTicks) return interval;
  }
  return NICE_TICK_INTERVALS_MS[NICE_TICK_INTERVALS_MS.length - 1];
}

// Formats a tick's timestamp to match its own interval's precision — whole
// seconds read as "Ns" (unchanged from before this fix, for every interval
// this ruler already showed), sub-second intervals get decimal seconds
// (1-2 places, matching how fine the interval itself is) since a bare "Ns"
// would round away the very precision the tick exists to show, and
// minute-scale intervals switch to M:SS to stay readable at a coarse zoom.
export function formatTickLabel(ms: number, intervalMs: number): string {
  if (intervalMs >= 60_000) {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
  const seconds = ms / 1000;
  if (intervalMs >= 1_000) return `${Math.round(seconds)}s`;
  return `${seconds.toFixed(intervalMs < 100 ? 2 : 1)}s`;
}
