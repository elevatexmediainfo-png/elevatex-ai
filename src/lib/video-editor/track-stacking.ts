// Pure track-stacking math for the Cloud Video Editor's compositor
// (Milestone 24). Extracted from compositor-stage.tsx so the convention is
// unit-testable without mounting a React component — see track-stacking.test.ts.
//
// Convention: tracks sorted by `order` ASCENDING is the same array
// timeline-panel.tsx lists top-to-bottom in the track panel, so index 0 in
// that array is both the TOPMOST row a user sees AND (via this function)
// the topmost layer in the composite. A track never needs reordering in
// one place to fix how it looks in the other — see addTrack()'s own doc
// comment (lib/video-editor/tracks.ts) for where a real bug in this area
// actually lived (a newly added track always landing at the BOTTOM of both,
// not a mismatch between the panel and this formula).
export function computeTrackZIndex(orderedTrackCount: number, indexInAscendingOrder: number): number {
  // *2 leaves room for a transition's two simultaneous layers (+ a flash
  // overlay) without colliding with the next track's stack.
  return (orderedTrackCount - indexInAscendingOrder) * 2;
}

// Convenience for tests and callers that already have a plain `order`-bearing
// track list rather than a precomputed index — sorts ascending (matching
// both the Timeline panel and the compositor) and returns each track's id
// paired with its z-index, so a caller can look up "is track A above track B"
// without re-deriving the sort/index math itself.
export function computeTrackZIndexByOrder<T extends { id: string; order: number }>(tracks: T[]): Map<string, number> {
  const ascending = [...tracks].sort((a, b) => a.order - b.order);
  return new Map(ascending.map((t, index) => [t.id, computeTrackZIndex(ascending.length, index)]));
}
