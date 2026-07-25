import { describe, expect, it } from "vitest";

import {
  buildSeedClipsFromScenes,
  buildTalkingHeadSeedClips,
  canMergeClips,
  duplicateClipSpan,
  mergeClipSpans,
  splitClipSpan,
  type MergeableClip,
} from "./engine";

describe("splitClipSpan", () => {
  it("splits a clip into two contiguous spans at the offset", () => {
    const [first, second] = splitClipSpan({ startMs: 1000, durationMs: 4000, trimStartMs: 0 }, 1500);
    expect(first).toEqual({ startMs: 1000, durationMs: 1500, trimStartMs: 0 });
    expect(second).toEqual({ startMs: 2500, durationMs: 2500, trimStartMs: 1500 });
  });

  it("advances trimStartMs on the second half so the source keeps playing from where it left off", () => {
    const [, second] = splitClipSpan({ startMs: 0, durationMs: 3000, trimStartMs: 500 }, 1000);
    expect(second.trimStartMs).toBe(1500);
  });

  it("rejects an offset at or beyond either edge", () => {
    const clip = { startMs: 0, durationMs: 2000, trimStartMs: 0 };
    expect(() => splitClipSpan(clip, 0)).toThrow(RangeError);
    expect(() => splitClipSpan(clip, 2000)).toThrow(RangeError);
    expect(() => splitClipSpan(clip, -1)).toThrow(RangeError);
  });
});

function clip(overrides: Partial<MergeableClip>): MergeableClip {
  return { trackId: "t1", sceneId: "s1", assetId: null, startMs: 0, durationMs: 1000, trimStartMs: 0, ...overrides };
}

describe("canMergeClips", () => {
  it("allows merging two contiguous clips on the same track with the same source", () => {
    const a = clip({ startMs: 0, durationMs: 1000 });
    const b = clip({ startMs: 1000, durationMs: 1000 });
    expect(canMergeClips(a, b)).toEqual({ ok: true });
  });

  it("rejects clips on different tracks", () => {
    const a = clip({ startMs: 0, durationMs: 1000, trackId: "t1" });
    const b = clip({ startMs: 1000, durationMs: 1000, trackId: "t2" });
    const result = canMergeClips(a, b);
    expect(result.ok).toBe(false);
  });

  it("rejects clips with different underlying sources", () => {
    const a = clip({ startMs: 0, durationMs: 1000, sceneId: "s1" });
    const b = clip({ startMs: 1000, durationMs: 1000, sceneId: "s2" });
    const result = canMergeClips(a, b);
    expect(result.ok).toBe(false);
  });

  it("rejects clips that aren't exactly adjacent", () => {
    const a = clip({ startMs: 0, durationMs: 1000 });
    const b = clip({ startMs: 1500, durationMs: 1000 });
    const result = canMergeClips(a, b);
    expect(result.ok).toBe(false);
  });

  it("allows merging two TEXT/STICKER clips that share 'neither' source (both null)", () => {
    const a = clip({ startMs: 0, durationMs: 1000, sceneId: null, assetId: null });
    const b = clip({ startMs: 1000, durationMs: 1000, sceneId: null, assetId: null });
    expect(canMergeClips(a, b)).toEqual({ ok: true });
  });
});

describe("mergeClipSpans", () => {
  it("keeps the earlier clip's start/trim and sums the durations", () => {
    const merged = mergeClipSpans({ startMs: 0, durationMs: 1000, trimStartMs: 200 }, { startMs: 1000, durationMs: 1500, trimStartMs: 1200 });
    expect(merged).toEqual({ startMs: 0, durationMs: 2500, trimStartMs: 200 });
  });
});

describe("duplicateClipSpan", () => {
  it("places the duplicate immediately after the original on the same track", () => {
    const dup = duplicateClipSpan({ startMs: 500, durationMs: 1000, trimStartMs: 300 });
    expect(dup).toEqual({ startMs: 1500, durationMs: 1000, trimStartMs: 300 });
  });
});

describe("buildSeedClipsFromScenes", () => {
  it("lays scenes out sequentially on the VIDEO lane in order", () => {
    const defs = buildSeedClipsFromScenes([
      { id: "b", order: 1, durationSeconds: 4, voiceKey: null, backgroundMusicUrl: null },
      { id: "a", order: 0, durationSeconds: 3, voiceKey: null, backgroundMusicUrl: null },
    ]);
    expect(defs).toEqual([
      { trackKind: "VIDEO", sceneId: "a", startMs: 0, durationMs: 3000 },
      { trackKind: "VIDEO", sceneId: "b", startMs: 3000, durationMs: 4000 },
    ]);
  });

  it("adds an AUDIO clip only for scenes with a voiceover", () => {
    const defs = buildSeedClipsFromScenes([
      { id: "a", order: 0, durationSeconds: 2, voiceKey: "scenes/a/voice.mp3", backgroundMusicUrl: null },
      { id: "b", order: 1, durationSeconds: 2, voiceKey: null, backgroundMusicUrl: null },
    ]);
    const audioClips = defs.filter((d) => d.trackKind === "AUDIO");
    expect(audioClips).toEqual([{ trackKind: "AUDIO", sceneId: "a", startMs: 0, durationMs: 2000 }]);
  });

  it("adds a MUSIC clip only for scenes with background music", () => {
    const defs = buildSeedClipsFromScenes([
      { id: "a", order: 0, durationSeconds: 2, voiceKey: null, backgroundMusicUrl: "https://example.com/track.mp3" },
    ]);
    const musicClips = defs.filter((d) => d.trackKind === "MUSIC");
    expect(musicClips).toEqual([{ trackKind: "MUSIC", sceneId: "a", startMs: 0, durationMs: 2000 }]);
  });

  it("returns an empty array for no scenes", () => {
    expect(buildSeedClipsFromScenes([])).toEqual([]);
  });
});

describe("buildTalkingHeadSeedClips", () => {
  it("lays scenes out sequentially with each clip trimmed to its source offset", () => {
    const defs = buildTalkingHeadSeedClips([
      { id: "b", order: 1, durationSeconds: 4, sourceStartMs: 7000 },
      { id: "a", order: 0, durationSeconds: 3, sourceStartMs: 0 },
    ]);
    expect(defs).toEqual([
      { trackKind: "VIDEO", sceneId: "a", startMs: 0, durationMs: 3000, trimStartMs: 0 },
      { trackKind: "VIDEO", sceneId: "b", startMs: 3000, durationMs: 4000, trimStartMs: 7000 },
    ]);
  });

  it("never adds AUDIO/MUSIC lanes — the base clip already carries the original speaker audio", () => {
    const defs = buildTalkingHeadSeedClips([{ id: "a", order: 0, durationSeconds: 2, sourceStartMs: 0 }]);
    expect(defs.every((d) => d.trackKind === "VIDEO")).toBe(true);
  });

  it("returns an empty array for no scenes", () => {
    expect(buildTalkingHeadSeedClips([])).toEqual([]);
  });
});
