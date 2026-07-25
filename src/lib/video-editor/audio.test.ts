import { describe, expect, it } from "vitest";
import {
  computeDuckingMultiplier,
  computeFadeMultiplier,
  computePeaksFromChannelData,
  isTrackAudible,
  pitchToPlaybackRateMultiplier,
  resolveVolume,
  sliceWaveformPeaks,
  WAVEFORM_PEAK_BUCKETS,
} from "./audio";

describe("resolveVolume", () => {
  it("returns the static value when unkeyframed", () => {
    expect(resolveVolume({ value: 0.5, keyframes: null }, 1000)).toBe(0.5);
  });
});

describe("computeFadeMultiplier", () => {
  it("returns 1 with no fades", () => {
    expect(computeFadeMultiplier(500, 1000, 0, 0)).toBe(1);
  });

  it("ramps 0->1 during fade-in", () => {
    expect(computeFadeMultiplier(0, 1000, 200, 0)).toBe(0);
    expect(computeFadeMultiplier(100, 1000, 200, 0)).toBe(0.5);
    expect(computeFadeMultiplier(200, 1000, 200, 0)).toBe(1);
  });

  it("ramps 1->0 during fade-out", () => {
    expect(computeFadeMultiplier(1000, 1000, 0, 200)).toBe(0);
    expect(computeFadeMultiplier(900, 1000, 0, 200)).toBe(0.5);
    expect(computeFadeMultiplier(800, 1000, 0, 200)).toBe(1);
  });

  it("combines fade-in and fade-out when windows don't overlap", () => {
    expect(computeFadeMultiplier(50, 1000, 200, 200)).toBe(0.25);
    expect(computeFadeMultiplier(950, 1000, 200, 200)).toBe(0.25);
    expect(computeFadeMultiplier(500, 1000, 200, 200)).toBe(1);
  });

  it("handles overlapping fade windows (very short clip) by taking the minimum", () => {
    // durationMs=100, fadeInMs=200, fadeOutMs=200 — fade windows exceed the clip.
    const mid = computeFadeMultiplier(50, 100, 200, 200);
    expect(mid).toBeLessThanOrEqual(1);
    expect(mid).toBeGreaterThanOrEqual(0);
  });

  it("returns 1 for a zero-duration clip (no divide-by-zero)", () => {
    expect(computeFadeMultiplier(0, 0, 200, 200)).toBe(1);
  });
});

describe("isTrackAudible", () => {
  it("is audible when unmuted and nothing is soloed", () => {
    expect(isTrackAudible({ isMuted: false, soloed: false }, false)).toBe(true);
  });

  it("is silent when muted, regardless of solo state", () => {
    expect(isTrackAudible({ isMuted: true, soloed: true }, true)).toBe(false);
  });

  it("is silent when another track is soloed and this one isn't", () => {
    expect(isTrackAudible({ isMuted: false, soloed: false }, true)).toBe(false);
  });

  it("is audible when this track is the soloed one", () => {
    expect(isTrackAudible({ isMuted: false, soloed: true }, true)).toBe(true);
  });
});

describe("pitchToPlaybackRateMultiplier", () => {
  it("returns 1 at zero semitones", () => {
    expect(pitchToPlaybackRateMultiplier(0)).toBe(1);
  });

  it("doubles at +12 semitones (one octave up)", () => {
    expect(pitchToPlaybackRateMultiplier(12)).toBeCloseTo(2, 5);
  });

  it("halves at -12 semitones (one octave down)", () => {
    expect(pitchToPlaybackRateMultiplier(-12)).toBeCloseTo(0.5, 5);
  });
});

describe("computePeaksFromChannelData", () => {
  it("returns bucketCount peaks, each 0..1", () => {
    const channel = new Float32Array(10000).map((_, i) => Math.sin(i / 10));
    const peaks = computePeaksFromChannelData([channel], 100);
    expect(peaks).toHaveLength(100);
    for (const p of peaks) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("returns all-zero peaks for silence", () => {
    const channel = new Float32Array(1000).fill(0);
    const peaks = computePeaksFromChannelData([channel], 10);
    expect(peaks.every((p) => p === 0)).toBe(true);
  });

  it("averages across channels", () => {
    const left = new Float32Array(100).fill(1);
    const right = new Float32Array(100).fill(0);
    const peaks = computePeaksFromChannelData([left, right], 1);
    expect(peaks[0]).toBeCloseTo(0.5, 5);
  });

  it("returns a zero-filled default bucket array for empty input", () => {
    const peaks = computePeaksFromChannelData([], 50);
    expect(peaks).toHaveLength(50);
    expect(peaks.every((p) => p === 0)).toBe(true);
  });

  it("defaults to WAVEFORM_PEAK_BUCKETS when bucketCount is omitted", () => {
    const channel = new Float32Array(50000).fill(0.5);
    const peaks = computePeaksFromChannelData([channel]);
    expect(peaks).toHaveLength(WAVEFORM_PEAK_BUCKETS);
  });
});

describe("sliceWaveformPeaks", () => {
  const fullPeaks = Array.from({ length: 1000 }, (_, i) => i / 1000);

  it("returns the whole array when trim covers the full source", () => {
    const sliced = sliceWaveformPeaks(fullPeaks, 10000, 0, 10000);
    expect(sliced.length).toBe(1000);
  });

  it("returns roughly the middle half when trimmed to the middle 50%", () => {
    const sliced = sliceWaveformPeaks(fullPeaks, 10000, 2500, 5000);
    expect(sliced.length).toBeCloseTo(500, -1);
    // First sliced value should be roughly the peak at the 25% mark.
    expect(sliced[0]).toBeCloseTo(fullPeaks[250], 1);
  });

  it("returns an empty array for an empty peaks input", () => {
    expect(sliceWaveformPeaks([], 10000, 0, 5000)).toEqual([]);
  });

  it("returns an empty array when sourceDurationMs is zero", () => {
    expect(sliceWaveformPeaks(fullPeaks, 0, 0, 5000)).toEqual([]);
  });

  it("clamps a trim window that runs past the end of the source", () => {
    const sliced = sliceWaveformPeaks(fullPeaks, 10000, 9000, 5000);
    expect(sliced.length).toBeGreaterThan(0);
    expect(sliced.length).toBeLessThanOrEqual(100);
  });
});

describe("computeDuckingMultiplier", () => {
  it("returns 1 (no ducking) with no voice intervals", () => {
    expect(computeDuckingMultiplier(500, [], -12, 300)).toBe(1);
  });

  it("returns 1 when duckAmountDb is 0 (no reduction configured)", () => {
    expect(computeDuckingMultiplier(500, [{ startMs: 0, endMs: 1000 }], 0, 300)).toBe(1);
  });

  it("returns 1 well before and well after a voice interval (outside the fade window)", () => {
    const intervals = [{ startMs: 2000, endMs: 3000 }];
    expect(computeDuckingMultiplier(0, intervals, -12, 300)).toBe(1);
    expect(computeDuckingMultiplier(5000, intervals, -12, 300)).toBe(1);
  });

  it("fully ducks to the configured floor during the voice interval", () => {
    const floor = Math.pow(10, -12 / 20);
    expect(computeDuckingMultiplier(2500, [{ startMs: 2000, endMs: 3000 }], -12, 300)).toBeCloseTo(floor, 5);
  });

  it("ramps smoothly (not an instant cut) during the attack, before the voice interval starts", () => {
    const intervals = [{ startMs: 2000, endMs: 3000 }];
    const floor = Math.pow(10, -12 / 20);
    // Halfway through the 300ms attack window (1850ms): half-ducked.
    const halfway = computeDuckingMultiplier(1850, intervals, -12, 300);
    expect(halfway).toBeGreaterThan(floor);
    expect(halfway).toBeLessThan(1);
    expect(halfway).toBeCloseTo(1 - 0.5 * (1 - floor), 5);
    // Right at the fade's leading edge: still full volume.
    expect(computeDuckingMultiplier(1700, intervals, -12, 300)).toBe(1);
    // Right at the interval's own start: fully ducked.
    expect(computeDuckingMultiplier(2000, intervals, -12, 300)).toBeCloseTo(floor, 5);
  });

  it("ramps smoothly back up during the release, after the voice interval ends", () => {
    const intervals = [{ startMs: 2000, endMs: 3000 }];
    const floor = Math.pow(10, -12 / 20);
    expect(computeDuckingMultiplier(3000, intervals, -12, 300)).toBeCloseTo(floor, 5);
    const halfway = computeDuckingMultiplier(3150, intervals, -12, 300);
    expect(halfway).toBeGreaterThan(floor);
    expect(halfway).toBeLessThan(1);
    expect(computeDuckingMultiplier(3300, intervals, -12, 300)).toBe(1);
  });

  it("does not double-duck below the floor when two voice intervals' fade windows overlap", () => {
    // Two back-to-back voice clips 100ms apart, each with a 300ms fade —
    // their release/attack windows overlap in the gap between them.
    const intervals = [
      { startMs: 0, endMs: 1000 },
      { startMs: 1100, endMs: 2000 },
    ];
    const floor = Math.pow(10, -12 / 20);
    const result = computeDuckingMultiplier(1050, intervals, -12, 300);
    expect(result).toBeGreaterThanOrEqual(floor - 1e-9);
    expect(result).toBeLessThanOrEqual(1);
  });

  it("treats a zero fadeMs as an instant cut", () => {
    const intervals = [{ startMs: 2000, endMs: 3000 }];
    const floor = Math.pow(10, -12 / 20);
    expect(computeDuckingMultiplier(1999, intervals, -12, 0)).toBe(1);
    expect(computeDuckingMultiplier(2000, intervals, -12, 0)).toBeCloseTo(floor, 5);
  });
});
