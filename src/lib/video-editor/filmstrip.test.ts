import { describe, expect, it } from "vitest";
import { computeFilmstripFrameCount, computeVisibleFilmstripFrameIndices } from "./filmstrip";

describe("computeFilmstripFrameCount", () => {
  it("clamps a short clip up to the minimum", () => {
    expect(computeFilmstripFrameCount(1)).toBe(8);
    expect(computeFilmstripFrameCount(5.055)).toBe(8);
  });

  it("clamps a very long clip down to the maximum", () => {
    expect(computeFilmstripFrameCount(600)).toBe(40);
  });

  it("scales roughly one frame per 2 seconds in the middle range", () => {
    expect(computeFilmstripFrameCount(40)).toBe(20);
    expect(computeFilmstripFrameCount(60)).toBe(30);
  });
});

describe("computeVisibleFilmstripFrameIndices", () => {
  // 10 frames evenly spaced across a 20,000ms (20s) asset — one frame
  // every 2000ms, at source times 0, 2000, 4000, ..., 18000.
  const frameCount = 10;
  const assetDurationMs = 20_000;

  it("returns every frame for a clip spanning the whole asset", () => {
    const indices = computeVisibleFilmstripFrameIndices(frameCount, assetDurationMs, 0, assetDurationMs);
    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("returns frames within a trimmed sub-range, plus one frame-interval of padding on each edge", () => {
    // Trim window [4000, 10000) — the ±one-frame-interval (2000ms)
    // padding on each side means frames from 2000ms through 12000ms all
    // qualify (indices 1-6), not just the ones strictly inside the trim
    // window (2-4) — deliberately generous so a boundary doesn't cut off
    // the frame that's visually closest to it.
    const indices = computeVisibleFilmstripFrameIndices(frameCount, assetDurationMs, 4000, 6000);
    expect(indices).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("still returns real, non-empty frames when the trim window is much narrower than one frame interval", () => {
    // Trim window [4900, 5100) — 200ms wide, much smaller than the
    // 2000ms frame interval. The padded range comfortably covers the
    // neighboring frames at 4000ms/6000ms (indices 2 and 3).
    const indices = computeVisibleFilmstripFrameIndices(frameCount, assetDurationMs, 4900, 200);
    expect(indices.length).toBeGreaterThan(0);
    for (const i of indices) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(frameCount);
    }
  });

  it("returns an empty array for a degenerate zero frameCount or assetDurationMs", () => {
    expect(computeVisibleFilmstripFrameIndices(0, assetDurationMs, 0, 1000)).toEqual([]);
    expect(computeVisibleFilmstripFrameIndices(frameCount, 0, 0, 1000)).toEqual([]);
  });

  it("thins evenly down to maxVisibleFrames rather than truncating from one end", () => {
    const indices = computeVisibleFilmstripFrameIndices(frameCount, assetDurationMs, 0, assetDurationMs, 3);
    expect(indices).toHaveLength(3);
    // Must span the full range, not just the first 3 (0,1,2) or last 3.
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(9);
  });

  it("doesn't thin when already at or under maxVisibleFrames", () => {
    const indices = computeVisibleFilmstripFrameIndices(frameCount, assetDurationMs, 0, assetDurationMs, 20);
    expect(indices).toHaveLength(10);
  });
});
