import { describe, expect, it } from "vitest";
import { createEmptyVarietyLedger, recordUsage } from "./variety-ledger";
import {
  applyNoDeadScreenFixes,
  computeSourceSurvivingWindows,
  computeVisualCoverage,
  decideFixForGap,
  deriveFixSearchQuery,
  findDeadScreenGaps,
} from "./visual-coverage";

function caption(text: string, startMs: number, endMs: number) {
  return { text, startMs, endMs };
}

describe("computeSourceSurvivingWindows", () => {
  it("returns the whole duration when nothing was removed", () => {
    expect(computeSourceSurvivingWindows(10_000, [])).toEqual([{ startMs: 0, endMs: 10_000 }]);
  });

  it("returns the complement of removal windows, in ORIGINAL (not repacked) coordinates", () => {
    const result = computeSourceSurvivingWindows(10_000, [{ startMs: 2000, endMs: 3000 }]);
    // Unlike computeSurvivingSegments' repacked output, the surviving
    // piece after the cut still starts at 3000 (its real source
    // position), not 2000 (where it would land after repacking).
    expect(result).toEqual([
      { startMs: 0, endMs: 2000 },
      { startMs: 3000, endMs: 10_000 },
    ]);
  });
});

describe("computeVisualCoverage + findDeadScreenGaps", () => {
  it("flags no gap when coverage is continuous", () => {
    const coverage = computeVisualCoverage({
      broll: [],
      zoom: [],
      stickers: [],
      captions: [caption("a", 0, 5000), caption("b", 5000, 10_000)],
    });
    expect(findDeadScreenGaps(coverage, [{ startMs: 0, endMs: 10_000 }], 2000)).toEqual([]);
  });

  it("flags a gap at or above the threshold, ignores one below it", () => {
    const coverage = computeVisualCoverage({
      broll: [],
      zoom: [],
      stickers: [],
      captions: [caption("a", 0, 3000)], // gap from 3000-10000 = 7000ms
    });
    const gaps = findDeadScreenGaps(coverage, [{ startMs: 0, endMs: 10_000 }], 2000);
    expect(gaps).toEqual([{ startMs: 3000, endMs: 10_000, durationMs: 7000 }]);

    const noGaps = findDeadScreenGaps(coverage, [{ startMs: 0, endMs: 3500 }], 2000); // remaining gap only 500ms
    expect(noGaps).toEqual([]);
  });

  it("merges overlapping coverage from different kinds before computing gaps", () => {
    const coverage = computeVisualCoverage({
      broll: [{ startMs: 0, endMs: 4000, trackHint: "broll", source: "stock", searchQuery: "x" }],
      zoom: [{ startMs: 3000, endMs: 6000, scaleFrom: 100, scaleTo: 110 }], // overlaps broll, extends coverage to 6000
      stickers: [],
      captions: [],
    });
    const gaps = findDeadScreenGaps(coverage, [{ startMs: 0, endMs: 8000 }], 2000);
    expect(gaps).toEqual([{ startMs: 6000, endMs: 8000, durationMs: 2000 }]);
  });

  it("only reports gaps within surviving segments, never inside removed spans", () => {
    const coverage = computeVisualCoverage({ broll: [], zoom: [], stickers: [], captions: [] });
    // Two surviving segments with a real cut between them — the removed
    // span itself must never appear as a "gap."
    const gaps = findDeadScreenGaps(coverage, [{ startMs: 0, endMs: 3000 }, { startMs: 8000, endMs: 11_000 }], 2000);
    expect(gaps).toEqual([
      { startMs: 0, endMs: 3000, durationMs: 3000 },
      { startMs: 8000, endMs: 11_000, durationMs: 3000 },
    ]);
  });
});

describe("decideFixForGap", () => {
  it("prefers broll for a large gap, zoom for a small one, when the ledger is empty", () => {
    expect(decideFixForGap(createEmptyVarietyLedger(), 5000)).toBe("broll");
    expect(decideFixForGap(createEmptyVarietyLedger(), 2200)).toBe("zoom");
  });

  it("falls through to the next-cheapest option when the preferred kind was already used", () => {
    const ledger = recordUsage(createEmptyVarietyLedger(), "brollStyles", "broll");
    // A large gap would normally pick "broll" first, but it's already used -> falls through.
    const kind = decideFixForGap(ledger, 5000);
    expect(kind).not.toBe("broll");
  });
});

describe("deriveFixSearchQuery", () => {
  it("derives a query from the nearest caption's text", () => {
    const gap = { startMs: 4000, endMs: 6000, durationMs: 2000 };
    const captions = [caption("A quick chat about diabetes care", 3000, 4000), caption("far away caption", 50_000, 51_000)];
    expect(deriveFixSearchQuery(gap, captions)).toBe("A quick chat about");
  });

  it("falls back to a generic phrase when there are no captions", () => {
    expect(deriveFixSearchQuery({ startMs: 0, endMs: 2000, durationMs: 2000 }, [])).toBe("b-roll footage");
  });
});

describe("applyNoDeadScreenFixes", () => {
  it("produces one tagged, autoInserted item per gap and updates the ledger", () => {
    const gaps = [{ startMs: 0, endMs: 5000, durationMs: 5000 }]; // large gap -> broll
    const result = applyNoDeadScreenFixes(gaps, [caption("a doctor talking about diabetes", 0, 1000)], createEmptyVarietyLedger());

    expect(result.gapsFixed).toBe(1);
    expect(result.broll).toHaveLength(1);
    expect(result.broll[0].autoInserted).toBe(true);
    expect(result.broll[0].reason).toContain("no-dead-screen rule");
    expect(result.broll[0].searchQuery).toBeTruthy();
    expect(result.ledger.brollStyles.length).toBeGreaterThan(0);
  });

  it("produces zero items when there are zero gaps", () => {
    const result = applyNoDeadScreenFixes([], [], createEmptyVarietyLedger());
    expect(result).toEqual({ broll: [], zoom: [], stickers: [], ledger: createEmptyVarietyLedger(), gapsFixed: 0 });
  });
});
