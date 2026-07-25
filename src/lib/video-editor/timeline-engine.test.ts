import { describe, expect, it } from "vitest";

import {
  clampMoveStart,
  clampTrimLeftStart,
  clampTrimRightEnd,
  clipEndMs,
  collectSnapCandidates,
  computeRippleDelete,
  computeRippleShift,
  duplicateClipSpan,
  findNearestSnapTarget,
  formatTickLabel,
  moveClipSpan,
  pickTickIntervalMs,
  snapMoveStart,
  snapTrimEdge,
  splitClipSpan,
  trimClipSpan,
  type ClipSpanWithId,
  type EditorClipSpan,
} from "./timeline-engine";

function span(overrides: Partial<EditorClipSpan> = {}): EditorClipSpan {
  return { startMs: 1000, durationMs: 4000, trimStartMs: 0, ...overrides };
}

describe("clipEndMs", () => {
  it("returns startMs + durationMs", () => {
    expect(clipEndMs(span({ startMs: 1000, durationMs: 4000 }))).toBe(5000);
  });
});

describe("moveClipSpan", () => {
  it("shifts startMs by deltaMs", () => {
    expect(moveClipSpan(span({ startMs: 1000 }), 500).startMs).toBe(1500);
    expect(moveClipSpan(span({ startMs: 1000 }), -500).startMs).toBe(500);
  });

  it("never moves startMs below 0", () => {
    expect(moveClipSpan(span({ startMs: 200 }), -1000).startMs).toBe(0);
  });

  it("leaves durationMs and trimStartMs untouched", () => {
    const moved = moveClipSpan(span({ durationMs: 3000, trimStartMs: 200 }), 100);
    expect(moved.durationMs).toBe(3000);
    expect(moved.trimStartMs).toBe(200);
  });
});

describe("trimClipSpan", () => {
  it("RIGHT edge only changes durationMs", () => {
    const trimmed = trimClipSpan(span({ startMs: 1000, durationMs: 4000, trimStartMs: 0 }), "RIGHT", 500);
    expect(trimmed).toEqual({ startMs: 1000, durationMs: 4500, trimStartMs: 0 });
  });

  it("RIGHT edge never shrinks below minDurationMs", () => {
    const trimmed = trimClipSpan(span({ durationMs: 300 }), "RIGHT", -1000, 200);
    expect(trimmed.durationMs).toBe(200);
  });

  it("LEFT edge shortens from the start and advances trimStartMs by the same amount", () => {
    const trimmed = trimClipSpan(span({ startMs: 1000, durationMs: 4000, trimStartMs: 500 }), "LEFT", 300);
    expect(trimmed).toEqual({ startMs: 1300, durationMs: 3700, trimStartMs: 800 });
  });

  it("LEFT edge lengthening retreats trimStartMs, clamped at 0", () => {
    const trimmed = trimClipSpan(span({ startMs: 1000, durationMs: 4000, trimStartMs: 200 }), "LEFT", -500, 200);
    expect(trimmed.trimStartMs).toBe(0);
    expect(trimmed.startMs).toBe(800);
    expect(trimmed.durationMs).toBe(4200);
  });

  it("LEFT edge never shrinks duration below minDurationMs", () => {
    const trimmed = trimClipSpan(span({ startMs: 1000, durationMs: 1000, trimStartMs: 0 }), "LEFT", 900, 200);
    expect(trimmed.durationMs).toBe(200);
    expect(trimmed.startMs).toBe(1800);
  });
});

describe("duplicateClipSpan", () => {
  it("places the duplicate immediately after the original", () => {
    const dup = duplicateClipSpan(span({ startMs: 1000, durationMs: 4000, trimStartMs: 300 }));
    expect(dup).toEqual({ startMs: 5000, durationMs: 4000, trimStartMs: 300 });
  });
});

describe("splitClipSpan", () => {
  it("splits a clip into two contiguous spans at the offset", () => {
    const [first, second] = splitClipSpan(span({ startMs: 1000, durationMs: 4000, trimStartMs: 0 }), 1500);
    expect(first).toEqual({ startMs: 1000, durationMs: 1500, trimStartMs: 0 });
    expect(second).toEqual({ startMs: 2500, durationMs: 2500, trimStartMs: 1500 });
  });

  it("advances trimStartMs on the second half so the source keeps playing from where it left off", () => {
    const [, second] = splitClipSpan(span({ startMs: 0, durationMs: 3000, trimStartMs: 500 }), 1000);
    expect(second.trimStartMs).toBe(1500);
  });

  it("rejects an offset at or beyond either edge", () => {
    const clip = span({ startMs: 0, durationMs: 2000, trimStartMs: 0 });
    expect(() => splitClipSpan(clip, 0)).toThrow(RangeError);
    expect(() => splitClipSpan(clip, 2000)).toThrow(RangeError);
    expect(() => splitClipSpan(clip, -1)).toThrow(RangeError);
  });
});

function clipWithId(overrides: Partial<ClipSpanWithId>): ClipSpanWithId {
  return { id: "c1", startMs: 0, durationMs: 1000, trimStartMs: 0, ...overrides };
}

describe("computeRippleDelete", () => {
  it("removes the deleted clip and shifts every later clip left by its duration", () => {
    const clips = [
      clipWithId({ id: "a", startMs: 0, durationMs: 1000 }),
      clipWithId({ id: "b", startMs: 1000, durationMs: 500 }),
      clipWithId({ id: "c", startMs: 1500, durationMs: 2000 }),
    ];
    const result = computeRippleDelete(clips, "b");
    expect(result).toEqual([
      clipWithId({ id: "a", startMs: 0, durationMs: 1000 }),
      clipWithId({ id: "c", startMs: 1000, durationMs: 2000 }),
    ]);
  });

  it("leaves clips before the deleted clip untouched", () => {
    const clips = [clipWithId({ id: "a", startMs: 0, durationMs: 1000 }), clipWithId({ id: "b", startMs: 1000, durationMs: 500 })];
    const result = computeRippleDelete(clips, "b");
    expect(result).toEqual([clipWithId({ id: "a", startMs: 0, durationMs: 1000 })]);
  });

  it("is a no-op when the id isn't found", () => {
    const clips = [clipWithId({ id: "a" })];
    expect(computeRippleDelete(clips, "missing")).toEqual(clips);
  });

  it("does not shift clips that start exactly where the deleted clip started (before its end)", () => {
    // Overlapping/zero-gap edge case: a clip starting before the deleted
    // clip's END should not be shifted, only ones at/after it.
    const clips = [clipWithId({ id: "a", startMs: 0, durationMs: 2000 }), clipWithId({ id: "b", startMs: 500, durationMs: 500 })];
    const result = computeRippleDelete(clips, "b");
    expect(result).toEqual([clipWithId({ id: "a", startMs: 0, durationMs: 2000 })]);
  });
});

describe("computeRippleShift", () => {
  it("shifts every clip at or after fromMs by deltaMs (negative = earlier)", () => {
    const clips = [
      clipWithId({ id: "a", startMs: 0, durationMs: 1000 }),
      clipWithId({ id: "b", startMs: 1000, durationMs: 500 }),
      clipWithId({ id: "c", startMs: 1500, durationMs: 2000 }),
    ];
    const result = computeRippleShift(clips, 1000, -300);
    expect(result).toEqual([
      clipWithId({ id: "a", startMs: 0, durationMs: 1000 }),
      clipWithId({ id: "b", startMs: 700, durationMs: 500 }),
      clipWithId({ id: "c", startMs: 1200, durationMs: 2000 }),
    ]);
  });

  it("shifts later (positive deltaMs), the inverse of opening an overlap", () => {
    const clips = [clipWithId({ id: "a", startMs: 0, durationMs: 1000 }), clipWithId({ id: "b", startMs: 700, durationMs: 500 })];
    const result = computeRippleShift(clips, 700, 300);
    expect(result).toEqual([clipWithId({ id: "a", startMs: 0, durationMs: 1000 }), clipWithId({ id: "b", startMs: 1000, durationMs: 500 })]);
  });

  it("leaves clips before fromMs untouched", () => {
    const clips = [clipWithId({ id: "a", startMs: 0, durationMs: 1000 }), clipWithId({ id: "b", startMs: 2000, durationMs: 500 })];
    expect(computeRippleShift(clips, 2000, -500)).toEqual([
      clipWithId({ id: "a", startMs: 0, durationMs: 1000 }),
      clipWithId({ id: "b", startMs: 1500, durationMs: 500 }),
    ]);
  });

  it("clamps a shift so startMs never goes below 0", () => {
    const clips = [clipWithId({ id: "a", startMs: 200, durationMs: 1000 })];
    expect(computeRippleShift(clips, 200, -500)).toEqual([clipWithId({ id: "a", startMs: 0, durationMs: 1000 })]);
  });
});

describe("findNearestSnapTarget", () => {
  it("returns the closest candidate within threshold", () => {
    expect(findNearestSnapTarget(1000, [900, 1050, 2000], 100)).toBe(1050);
  });

  it("returns null when nothing is within threshold", () => {
    expect(findNearestSnapTarget(1000, [500, 2000], 100)).toBeNull();
  });

  it("returns null for an empty candidate list", () => {
    expect(findNearestSnapTarget(1000, [], 100)).toBeNull();
  });
});

describe("collectSnapCandidates", () => {
  it("includes the playhead, markers, and every non-excluded clip's edges", () => {
    const clips = [clipWithId({ id: "a", startMs: 0, durationMs: 1000 }), clipWithId({ id: "b", startMs: 2000, durationMs: 500 })];
    const candidates = collectSnapCandidates({
      clips,
      excludeClipIds: new Set(),
      markerTimesMs: [3000],
      playheadMs: 750,
    });
    expect(candidates.sort((a, b) => a - b)).toEqual([0, 750, 1000, 2000, 2500, 3000]);
  });

  it("excludes the given clip ids (e.g. the clip currently being dragged)", () => {
    const clips = [clipWithId({ id: "a", startMs: 0, durationMs: 1000 }), clipWithId({ id: "b", startMs: 2000, durationMs: 500 })];
    const candidates = collectSnapCandidates({
      clips,
      excludeClipIds: new Set(["a"]),
      markerTimesMs: [],
      playheadMs: 0,
    });
    expect(candidates.sort((a, b) => a - b)).toEqual([0, 2000, 2500]);
  });
});

describe("snapMoveStart", () => {
  it("snaps the start edge when it's within threshold", () => {
    expect(snapMoveStart(1005, 2000, [1000], 50)).toBe(1000);
  });

  it("snaps the end edge (deriving start) when the start edge isn't close but the end edge is", () => {
    // start=1000, duration=2000 -> end=3000; candidate 3010 is close to the END only.
    expect(snapMoveStart(1000, 2000, [3010], 50)).toBe(1010);
  });

  it("returns startMs unchanged when neither edge is within threshold", () => {
    expect(snapMoveStart(1000, 2000, [5000], 50)).toBe(1000);
  });
});

describe("snapTrimEdge", () => {
  it("snaps to the nearest candidate within threshold", () => {
    expect(snapTrimEdge(998, [1000], 50)).toBe(1000);
  });

  it("returns the value unchanged when nothing is within threshold", () => {
    expect(snapTrimEdge(998, [2000], 50)).toBe(998);
  });
});

describe("pickTickIntervalMs", () => {
  it("picks a coarse multi-minute interval at min zoom (10 px/sec)", () => {
    expect(pickTickIntervalMs(10)).toBe(10_000);
  });

  it("picks the default 60px-density interval at the editor's default zoom (60 px/sec)", () => {
    expect(pickTickIntervalMs(60)).toBe(1_000);
  });

  it("picks a sub-second interval at high zoom", () => {
    expect(pickTickIntervalMs(600)).toBe(100);
  });

  it("never returns an interval whose on-screen spacing is below the minimum", () => {
    for (const pxPerSecond of [10, 30, 60, 150, 300, 600]) {
      const interval = pickTickIntervalMs(pxPerSecond, 60);
      expect((interval / 1000) * pxPerSecond).toBeGreaterThanOrEqual(60);
    }
  });

  it("respects a custom minPxBetweenTicks", () => {
    // At 60px/sec, a 500ms interval is 30px apart — too dense for the
    // default 60px minimum, but fine for a smaller one.
    expect(pickTickIntervalMs(60, 25)).toBe(500);
  });
});

describe("formatTickLabel", () => {
  it("formats whole-second intervals as 'Ns', matching the ruler's original convention", () => {
    expect(formatTickLabel(5000, 1000)).toBe("5s");
    expect(formatTickLabel(12000, 5000)).toBe("12s");
  });

  it("formats sub-second intervals as decimal seconds, precision matching the interval", () => {
    expect(formatTickLabel(1500, 500)).toBe("1.5s");
    expect(formatTickLabel(1200, 100)).toBe("1.2s");
    expect(formatTickLabel(1250, 50)).toBe("1.25s");
    expect(formatTickLabel(50, 50)).toBe("0.05s");
  });

  it("formats minute-scale intervals as M:SS", () => {
    expect(formatTickLabel(90_000, 60_000)).toBe("1:30");
    expect(formatTickLabel(600_000, 300_000)).toBe("10:00");
  });
});

function neighbor(overrides: Partial<ClipSpanWithId> = {}): ClipSpanWithId {
  return { id: "n1", startMs: 5000, durationMs: 3000, trimStartMs: 0, ...overrides };
}

describe("clampMoveStart", () => {
  it("leaves the proposed start untouched when there is no overlap", () => {
    expect(clampMoveStart(0, 2000, [neighbor()])).toBe(0);
  });

  it("pushes a move that would overlap forward to sit exactly at the neighbor's end when that's closer", () => {
    // Proposed [4000, 7000) overlaps neighbor [5000, 8000). Pushing before
    // would land at 2000 (distance 2000); pushing after lands at 8000
    // (distance 4000) — before wins.
    expect(clampMoveStart(4000, 3000, [neighbor()])).toBe(2000);
  });

  it("breaks an equidistant tie toward pushing before the neighbor", () => {
    // Proposed [6000, 7000) sits fully inside neighbor [5000, 8000).
    // pushBefore = 5000-1000 = 4000 (distance 2000); pushAfter = 8000
    // (distance 2000) — an exact tie, resolved toward "before" by <=.
    expect(clampMoveStart(6000, 1000, [neighbor()])).toBe(4000);
  });

  it("never returns a negative start", () => {
    expect(clampMoveStart(-500, 1000, [])).toBe(0);
  });

  it("resolves a chain of overlaps across multiple neighbors in one call", () => {
    const neighbors = [neighbor({ id: "a", startMs: 0, durationMs: 2000 }), neighbor({ id: "b", startMs: 2000, durationMs: 2000 })];
    // Proposed start deep inside the first neighbor should end up pushed
    // clear of BOTH neighbors, not just the first one it happens to hit.
    const result = clampMoveStart(500, 1500, neighbors);
    const end = result + 1500;
    for (const n of neighbors) {
      const nEnd = n.startMs + n.durationMs;
      expect(result < nEnd && n.startMs < end).toBe(false);
    }
  });

  it("is a no-op when neighbors is empty", () => {
    expect(clampMoveStart(12345, 1000, [])).toBe(12345);
  });
});

describe("clampTrimRightEnd", () => {
  it("leaves the proposed end untouched when there is no forward neighbor in the way", () => {
    expect(clampTrimRightEnd(0, 3000, [neighbor({ startMs: 5000 })])).toBe(3000);
  });

  it("caps the end at the next neighbor's start instead of letting it grow past", () => {
    expect(clampTrimRightEnd(0, 6000, [neighbor({ startMs: 5000 })])).toBe(5000);
  });

  it("ignores a neighbor that starts before this clip's own start (an existing, unrelated overlap)", () => {
    expect(clampTrimRightEnd(4000, 9000, [neighbor({ startMs: 1000, durationMs: 2000 })])).toBe(9000);
  });

  it("never returns an end before the clip's own start", () => {
    expect(clampTrimRightEnd(5000, 4000, [])).toBe(5000);
  });
});

describe("clampTrimLeftStart", () => {
  it("leaves the proposed start untouched when there is no preceding neighbor in the way", () => {
    // Neighbor ends at 1000, well before the proposed start of 3000.
    expect(clampTrimLeftStart(9000, 3000, [neighbor({ startMs: 0, durationMs: 1000 })])).toBe(3000);
  });

  it("caps the start at the previous neighbor's end instead of letting it shrink past", () => {
    // Neighbor ends at 8000; proposed start of 3000 would cross it.
    expect(clampTrimLeftStart(9000, 3000, [neighbor({ startMs: 5000, durationMs: 3000 })])).toBe(8000);
  });

  it("ignores a neighbor that ends after this clip's own end (an existing, unrelated overlap)", () => {
    expect(clampTrimLeftStart(4000, 1000, [neighbor({ startMs: 3000, durationMs: 5000 })])).toBe(1000);
  });

  it("never returns a start before 0 or after the clip's own end", () => {
    expect(clampTrimLeftStart(5000, -100, [])).toBe(0);
    expect(clampTrimLeftStart(5000, 9000, [])).toBe(5000);
  });
});
