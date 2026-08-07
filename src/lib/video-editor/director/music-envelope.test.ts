import { describe, expect, it } from "vitest";
import { buildMusicVolumeEnvelope } from "./music-envelope";
import type { AIStoryBeat } from "@/lib/validations/ai-timeline";

function beat(kind: AIStoryBeat["kind"], startMs: number, endMs: number): AIStoryBeat {
  return { kind, startMs, endMs, description: "d" };
}

describe("buildMusicVolumeEnvelope", () => {
  it("returns an empty envelope when there are no beats", () => {
    expect(buildMusicVolumeEnvelope([], 60_000)).toEqual([]);
  });

  it("maps hook to a LOW level and cta to an UPLIFTING (higher) level", () => {
    const beats = [beat("hook", 0, 3000), beat("cta", 27_000, 30_000)];
    const envelope = buildMusicVolumeEnvelope(beats, 30_000);
    const hookPoint = envelope.find((p) => p.atFraction === 0);
    const ctaPoint = envelope.find((p) => Math.abs(p.atFraction - 0.9) < 0.001);
    expect(hookPoint?.volumeLevel).toBeLessThan(ctaPoint!.volumeLevel);
  });

  it("expresses positions as FRACTIONS of the source duration, not absolute ms", () => {
    const beats = [beat("hook", 0, 5000), beat("value", 5000, 10_000)];
    const envelope = buildMusicVolumeEnvelope(beats, 10_000);
    expect(envelope[0].atFraction).toBe(0);
    expect(envelope[1].atFraction).toBe(0.5);
    for (const point of envelope) {
      expect(point.atFraction).toBeGreaterThanOrEqual(0);
      expect(point.atFraction).toBeLessThanOrEqual(1);
    }
  });

  it("holds the last beat's level through to the end of the video when beats don't reach it", () => {
    const beats = [beat("hook", 0, 2000)];
    const envelope = buildMusicVolumeEnvelope(beats, 10_000);
    expect(envelope).toHaveLength(2); // beat start + end-of-video hold point
    expect(envelope[1].atFraction).toBe(0.2); // beat's own endMs (2000/10000)
    expect(envelope[1].volumeLevel).toBe(envelope[0].volumeLevel); // same hook-level held
  });

  it("does not add a redundant hold point when the last beat already reaches the end", () => {
    const beats = [beat("hook", 0, 5000), beat("cta", 5000, 10_000)];
    const envelope = buildMusicVolumeEnvelope(beats, 10_000);
    expect(envelope).toHaveLength(2); // no extra 3rd point
  });

  it("handles beats given out of chronological order", () => {
    const beats = [beat("cta", 8000, 10_000), beat("hook", 0, 2000)];
    const envelope = buildMusicVolumeEnvelope(beats, 10_000);
    expect(envelope[0].atFraction).toBe(0); // hook (earliest) sorted first
  });
});
