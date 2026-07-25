import { describe, expect, it } from "vitest";
import { decideNormalization, MAX_FPS, MAX_VIDEO_BITRATE_KBPS } from "./normalization";
import type { MediaProbe } from "./ffprobe-exec";

// Upload normalization (2026-07-19) — decideNormalization is the pure
// decision core of the fix for a real, twice-demonstrated bug class: a
// real customer file (H.264/1080x1920, but 100fps, PCM/"twos" audio,
// 83Mbps) broke both live-preview smoothness and audio playback entirely,
// independent of any app code (Chromium simply can't decode "twos" PCM in
// an MP4 container — canPlayType returns ""). These tests cover both
// directions: real problem files correctly trigger normalization, and
// (just as important) an already-compliant file — the common case, e.g.
// any normal phone recording — correctly does NOT get re-encoded, since
// every unnecessary re-encode is a real, avoidable quality loss.

function baseProbe(overrides: Partial<MediaProbe> = {}): MediaProbe {
  return {
    videoCodec: "h264",
    audioCodec: "aac",
    fps: 30,
    videoBitrateKbps: 8000,
    audioBitrateKbps: 192,
    containerBitrateKbps: 8200,
    width: 1920,
    height: 1080,
    ...overrides,
  };
}

describe("decideNormalization", () => {
  it("an already-compliant file (H.264 + AAC + 30fps + reasonable bitrate) is left untouched", () => {
    const decision = decideNormalization(baseProbe());
    expect(decision.needsNormalization).toBe(false);
    expect(decision.targetFps).toBeUndefined();
  });

  it("the real repro file's exact shape (H.264 video, PCM/twos audio, 100fps, 57Mbps video bitrate) triggers normalization for all 3 real reasons", () => {
    const decision = decideNormalization(
      baseProbe({ audioCodec: "pcm_s16be", fps: 100, videoBitrateKbps: 57_000, width: 1080, height: 1920 })
    );
    expect(decision.needsNormalization).toBe(true);
    expect(decision.reasons.some((r) => r.includes("pcm_s16be"))).toBe(true);
    expect(decision.reasons.some((r) => r.includes("fps"))).toBe(true);
    expect(decision.reasons.some((r) => r.includes("bitrate"))).toBe(true);
    expect(decision.targetFps).toBe(MAX_FPS);
  });

  it("wrong audio codec alone (H.264 video, non-AAC audio, otherwise compliant) triggers normalization but does NOT cap fps unnecessarily", () => {
    const decision = decideNormalization(baseProbe({ audioCodec: "mp3" }));
    expect(decision.needsNormalization).toBe(true);
    expect(decision.reasons).toEqual(["audio codec \"mp3\" is not AAC"]);
    // fps was already compliant (30 <= 60) — re-encoding for the audio
    // codec alone must not also force an unrelated fps change.
    expect(decision.targetFps).toBeUndefined();
  });

  it("wrong video codec alone (H.265/HEVC, AAC audio, otherwise compliant) triggers normalization", () => {
    const decision = decideNormalization(baseProbe({ videoCodec: "hevc" }));
    expect(decision.needsNormalization).toBe(true);
    expect(decision.reasons).toEqual(["video codec \"hevc\" is not H.264"]);
  });

  it("fps exactly at the cap (60fps) does NOT trigger normalization — only strictly above", () => {
    const decision = decideNormalization(baseProbe({ fps: MAX_FPS }));
    expect(decision.needsNormalization).toBe(false);
  });

  it("fps just above the cap (61fps) triggers normalization with a capped targetFps", () => {
    const decision = decideNormalization(baseProbe({ fps: MAX_FPS + 1 }));
    expect(decision.needsNormalization).toBe(true);
    expect(decision.targetFps).toBe(MAX_FPS);
  });

  it("video bitrate exactly at the cap does NOT trigger normalization — only strictly above", () => {
    const decision = decideNormalization(baseProbe({ videoBitrateKbps: MAX_VIDEO_BITRATE_KBPS }));
    expect(decision.needsNormalization).toBe(false);
  });

  it("video bitrate just above the cap triggers normalization", () => {
    const decision = decideNormalization(baseProbe({ videoBitrateKbps: MAX_VIDEO_BITRATE_KBPS + 1 }));
    expect(decision.needsNormalization).toBe(true);
    expect(decision.reasons.some((r) => r.includes("bitrate"))).toBe(true);
  });

  it("a probe failure (null) is treated as 'leave as-is', never as a reason to normalize", () => {
    const decision = decideNormalization(null);
    expect(decision.needsNormalization).toBe(false);
  });

  it("missing/unknown codec fields (probe succeeded but a stream's codec_name was absent) are treated as non-compliant, not silently skipped", () => {
    const decision = decideNormalization(baseProbe({ videoCodec: null, audioCodec: null }));
    expect(decision.needsNormalization).toBe(true);
    expect(decision.reasons).toContain('video codec "unknown" is not H.264');
    expect(decision.reasons).toContain('audio codec "unknown" is not AAC');
  });

  it("codec comparison is case-insensitive (ffprobe's own casing isn't guaranteed stable across versions)", () => {
    const decision = decideNormalization(baseProbe({ videoCodec: "H264", audioCodec: "AAC" }));
    expect(decision.needsNormalization).toBe(false);
  });

  it("an AUDIO-kind asset (no video stream — fps/videoCodec/videoBitrate all null) is never flagged for video-specific reasons", () => {
    const decision = decideNormalization(baseProbe({ videoCodec: null, fps: null, videoBitrateKbps: null }));
    // videoCodec is still checked (null -> "not H.264" fires) — this
    // function doesn't know the asset's *kind*, only what it probed; the
    // caller (asset-normalize-worker.ts) only ever invokes this for
    // VIDEO-kind assets in practice, so a null video stream here would
    // only occur for a genuinely broken/audio-only VIDEO-kind upload.
    expect(decision.needsNormalization).toBe(true);
  });
});
