import { describe, expect, it } from "vitest";

import {
  buildFfmpegEncodingPlan,
  canRemoveWatermark,
  classifyAspect,
  computeProgressPercent,
  computeTotalFrames,
  DEFAULT_CODEC_FOR_FORMAT,
  EXPORT_PLATFORM_PRESETS,
  frameTimeMs,
  hasAudioTrack,
  isValidCodecForFormat,
  resolveCodec,
  resolveExportDimensions,
  VALID_CODECS_FOR_FORMAT,
} from "./export-engine";

describe("resolveExportDimensions", () => {
  it("scales a 16:9 project's long edge (width) to the resolution tier", () => {
    expect(resolveExportDimensions("R1080P", 1920, 1080)).toEqual({ widthPx: 1920, heightPx: 1080 });
    expect(resolveExportDimensions("R720P", 1920, 1080)).toEqual({ widthPx: 1280, heightPx: 720 });
    expect(resolveExportDimensions("R4K", 1920, 1080)).toEqual({ widthPx: 3840, heightPx: 2160 });
  });

  it("scales a 9:16 project's long edge (height) to the resolution tier", () => {
    expect(resolveExportDimensions("R1080P", 1080, 1920)).toEqual({ widthPx: 1080, heightPx: 1920 });
    expect(resolveExportDimensions("R720P", 1080, 1920)).toEqual({ widthPx: 720, heightPx: 1280 });
  });

  it("keeps a 1:1 project square", () => {
    expect(resolveExportDimensions("R1080P", 1080, 1080)).toEqual({ widthPx: 1920, heightPx: 1920 });
  });

  it("always returns even dimensions on both axes (codec requirement)", () => {
    // A 4:5 project (1080x1350) at 2K's 2560 long edge: 2560 * (1080/1350) = 2048 (already even);
    // height stays 2560. Pick an odd-prone ratio to actually exercise rounding.
    const { widthPx, heightPx } = resolveExportDimensions("R1080P", 1000, 777);
    expect(widthPx % 2).toBe(0);
    expect(heightPx % 2).toBe(0);
  });
});

describe("computeTotalFrames", () => {
  it("computes frame count from duration and fps", () => {
    expect(computeTotalFrames(10_000, 30)).toBe(300);
    expect(computeTotalFrames(1000, 24)).toBe(24);
  });

  it("never returns fewer than 1 frame, even for a zero-duration project", () => {
    expect(computeTotalFrames(0, 30)).toBe(1);
  });

  it("rounds to the nearest whole frame", () => {
    expect(computeTotalFrames(1033, 30)).toBe(Math.round((1033 / 1000) * 30));
  });
});

describe("frameTimeMs", () => {
  it("computes the exact playhead position for a frame index", () => {
    expect(frameTimeMs(0, 30)).toBe(0);
    expect(frameTimeMs(30, 30)).toBe(1000);
    expect(frameTimeMs(15, 30)).toBe(500);
  });
});

describe("computeProgressPercent", () => {
  it("computes a clamped 0..100 percentage", () => {
    expect(computeProgressPercent(0, 100)).toBe(0);
    expect(computeProgressPercent(50, 100)).toBe(50);
    expect(computeProgressPercent(100, 100)).toBe(100);
  });

  it("clamps overshoot to 100", () => {
    expect(computeProgressPercent(110, 100)).toBe(100);
  });

  it("returns 0 when totalFrames is 0 (avoids a divide-by-zero)", () => {
    expect(computeProgressPercent(0, 0)).toBe(0);
  });
});

describe("codec/format validity", () => {
  it("MP4/MOV accept H264 and H265 only", () => {
    expect(VALID_CODECS_FOR_FORMAT.MP4).toEqual(["H264", "H265"]);
    expect(VALID_CODECS_FOR_FORMAT.MOV).toEqual(["H264", "H265"]);
    expect(isValidCodecForFormat("MP4", "VP9")).toBe(false);
  });

  it("WEBM accepts VP9 only", () => {
    expect(VALID_CODECS_FOR_FORMAT.WEBM).toEqual(["VP9"]);
    expect(isValidCodecForFormat("WEBM", "H264")).toBe(false);
    expect(isValidCodecForFormat("WEBM", "VP9")).toBe(true);
  });

  it("GIF has no codec — valid only with codec=null", () => {
    expect(VALID_CODECS_FOR_FORMAT.GIF).toEqual([]);
    expect(isValidCodecForFormat("GIF", null)).toBe(true);
    expect(isValidCodecForFormat("GIF", "H264")).toBe(false);
  });

  it("GIF has no audio track; every video format does", () => {
    expect(hasAudioTrack("GIF")).toBe(false);
    expect(hasAudioTrack("MP4")).toBe(true);
    expect(hasAudioTrack("MOV")).toBe(true);
    expect(hasAudioTrack("WEBM")).toBe(true);
  });
});

describe("resolveCodec", () => {
  it("keeps a valid requested codec", () => {
    expect(resolveCodec("MP4", "H265")).toBe("H265");
    expect(resolveCodec("WEBM", "VP9")).toBe("VP9");
  });

  it("falls back to the format's default when the requested codec is invalid for it", () => {
    expect(resolveCodec("WEBM", "H264")).toBe(DEFAULT_CODEC_FOR_FORMAT.WEBM);
    expect(resolveCodec("MP4", "VP9")).toBe(DEFAULT_CODEC_FOR_FORMAT.MP4);
  });

  it("falls back to the default when no codec is requested", () => {
    expect(resolveCodec("MP4")).toBe("H264");
    expect(resolveCodec("MOV", null)).toBe("H264");
  });

  it("GIF always resolves to null regardless of what's requested", () => {
    expect(resolveCodec("GIF", "H264")).toBeNull();
    expect(resolveCodec("GIF")).toBeNull();
  });
});

describe("buildFfmpegEncodingPlan", () => {
  it("GIF gets an empty plan (handled by a separate palette-based command)", () => {
    expect(buildFfmpegEncodingPlan("GIF", null)).toEqual({ videoCodecArgs: [], audioCodecArgs: [], pixelFormatArgs: [], containerArgs: [] });
  });

  it("MP4/H264 uses libx264 with faststart and AAC audio", () => {
    const plan = buildFfmpegEncodingPlan("MP4", "H264");
    expect(plan.videoCodecArgs).toContain("libx264");
    expect(plan.audioCodecArgs).toContain("aac");
    expect(plan.containerArgs).toContain("+faststart");
  });

  it("WEBM/VP9 uses libvpx-vp9 with opus audio, no faststart", () => {
    const plan = buildFfmpegEncodingPlan("WEBM", "VP9");
    expect(plan.videoCodecArgs).toContain("libvpx-vp9");
    expect(plan.audioCodecArgs).toContain("libopus");
    expect(plan.containerArgs).not.toContain("+faststart");
  });

  it("an explicit bitrate is passed through as -b:v; omitting it falls back to a CRF quality target", () => {
    const withBitrate = buildFfmpegEncodingPlan("MP4", "H264", 8000);
    expect(withBitrate.videoCodecArgs).toContain("-b:v");
    expect(withBitrate.videoCodecArgs).toContain("8000k");

    const withoutBitrate = buildFfmpegEncodingPlan("MP4", "H264");
    expect(withoutBitrate.videoCodecArgs).toContain("-crf");
  });

  it("every video format sets yuv420p pixel format for broad player compatibility", () => {
    expect(buildFfmpegEncodingPlan("MP4", "H264").pixelFormatArgs).toEqual(["-pix_fmt", "yuv420p"]);
    expect(buildFfmpegEncodingPlan("WEBM", "VP9").pixelFormatArgs).toEqual(["-pix_fmt", "yuv420p"]);
  });
});

describe("classifyAspect", () => {
  it("classifies a wide project as landscape", () => {
    expect(classifyAspect(1920, 1080)).toBe("landscape");
  });

  it("classifies a tall project as portrait", () => {
    expect(classifyAspect(1080, 1920)).toBe("portrait");
  });

  it("classifies an exact 1:1 project as square", () => {
    expect(classifyAspect(1080, 1080)).toBe("square");
  });

  it("tolerates a near-1:1 rounding difference as square", () => {
    expect(classifyAspect(1080, 1078)).toBe("square");
  });

  it("does not misclassify a real 4:5 portrait project as square", () => {
    expect(classifyAspect(1080, 1350)).toBe("portrait");
  });
});

describe("EXPORT_PLATFORM_PRESETS", () => {
  it("every preset resolves to a valid codec for its own format", () => {
    for (const preset of EXPORT_PLATFORM_PRESETS) {
      expect(isValidCodecForFormat(preset.format, preset.codec)).toBe(true);
    }
  });

  it("every preset has a unique id", () => {
    const ids = EXPORT_PLATFORM_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all three aspect classes", () => {
    const classes = new Set(EXPORT_PLATFORM_PRESETS.map((p) => p.recommendedAspect));
    expect(classes).toEqual(new Set(["landscape", "portrait", "square"]));
  });
});

// Watermark tier gate (2026-07-16, Full Regression Pass follow-up) — the
// exact rule both the server's real enforcement (exports.ts's createExport)
// and the export panel's UI gate share. Only PREMIUM removes the
// watermark, per explicit product decision.
describe("canRemoveWatermark", () => {
  it("no active subscription (null tier) is forced-watermark", () => {
    expect(canRemoveWatermark(null)).toBe(false);
  });

  it("BASIC and PRO are still forced-watermark", () => {
    expect(canRemoveWatermark("BASIC")).toBe(false);
    expect(canRemoveWatermark("PRO")).toBe(false);
  });

  it("only PREMIUM can remove the watermark", () => {
    expect(canRemoveWatermark("PREMIUM")).toBe(true);
  });
});
