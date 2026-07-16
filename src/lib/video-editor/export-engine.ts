// Pure math + type contracts for the Cloud Video Editor's Export Engine
// (Module 10) — dimension resolution, frame timing, and codec/format
// validity. Framework-agnostic (no DB/Node/Playwright/FFmpeg imports) so
// it's trivially unit-testable, mirroring every other lib/video-editor/*
// pure-math file's convention (transform.ts, transition-engine.ts, ...).
//
// ---------------------------------------------------------------------
// Architecture (read PROJECT_STATUS.md's Module 10 entry for the full
// write-up) — the short version: export renders are produced by stepping
// the SAME browser compositor every other module already built
// (frame-by-frame, deterministic, headless) rather than re-deriving
// transform/keyframe/transition/text-reveal/audio math as a second FFmpeg
// filter-graph engine. This file only holds the math that's genuinely
// engine-agnostic (what size to render at, when each frame falls, which
// codec goes with which container) — everything about HOW a frame gets
// rendered lives in the browser-side compositor (unchanged) and the
// Node-side worker (lib/video-editor/export-worker.ts) that drives it.
// ---------------------------------------------------------------------

export const EXPORT_FORMATS = ["MP4", "MOV", "WEBM", "GIF"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_RESOLUTIONS = ["R720P", "R1080P", "R2K", "R4K"] as const;
export type ExportResolution = (typeof EXPORT_RESOLUTIONS)[number];

export const EXPORT_CODECS = ["H264", "H265", "VP9"] as const;
export type ExportCodec = (typeof EXPORT_CODECS)[number];

// The long edge (whichever of width/height is larger) is scaled to this
// pixel count, preserving the project's own aspect ratio — so a 9:16
// project exported at "1080p" gets a 1080×1920 file, not a squashed
// 1920×1080 one. Matches the common video-platform convention (YouTube's
// "1080p"/"1440p" labels describe the long edge, not a fixed frame size).
export const RESOLUTION_LONG_EDGE: Record<ExportResolution, number> = {
  R720P: 1280,
  R1080P: 1920,
  R2K: 2560,
  R4K: 3840,
};

export const RESOLUTION_LABEL: Record<ExportResolution, string> = {
  R720P: "720p",
  R1080P: "1080p",
  R2K: "2K",
  R4K: "4K",
};

export interface ExportDimensions {
  widthPx: number;
  heightPx: number;
}

// Pure — resolves the actual output pixel size for a resolution tier given
// the project's own aspect ratio (its current widthPx/heightPx, whatever
// they are — CUSTOM aspect ratios included). Rounded to the nearest EVEN
// number on both axes: H.264/H.265/VP9 all require even dimensions for
// 4:2:0 chroma subsampling, and an odd dimension fails to encode outright
// rather than silently rounding on FFmpeg's side.
export function resolveExportDimensions(resolution: ExportResolution, projectWidthPx: number, projectHeightPx: number): ExportDimensions {
  const aspect = projectWidthPx / Math.max(1, projectHeightPx);
  const longEdge = RESOLUTION_LONG_EDGE[resolution];

  const toEven = (n: number) => Math.max(2, Math.round(n / 2) * 2);

  if (aspect >= 1) {
    return { widthPx: toEven(longEdge), heightPx: toEven(longEdge / aspect) };
  }
  return { widthPx: toEven(longEdge * aspect), heightPx: toEven(longEdge) };
}

// Pure — how many frames a render of `durationMs` at `fps` produces. At
// least 1 (a zero-duration project still renders a single frame rather
// than an empty file).
export function computeTotalFrames(durationMs: number, fps: number): number {
  return Math.max(1, Math.round((durationMs / 1000) * fps));
}

// Pure — the exact playhead position (ms) for a given frame index, the
// same deterministic stepping the render worker feeds into the
// compositor's `setFrame()` — NOT real-time playback timing.
export function frameTimeMs(frameIndex: number, fps: number): number {
  return Math.round((frameIndex / fps) * 1000);
}

// Pure — 0..100, clamped. Stored on EditorExport.progress so a status-poll
// GET never has to divide in the route handler.
export function computeProgressPercent(framesRendered: number, totalFrames: number): number {
  if (totalFrames <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((framesRendered / totalFrames) * 100)));
}

// ---------------------------------------------------------------------
// Format/codec validity — GIF has no audio track and no codec choice
// (LZW-compressed indexed color, not H.264/H.265/VP9); MP4/MOV both use
// standard MPEG-4 codecs; WEBM is VP9-only (VP8 deliberately not offered —
// no real quality/size reason to pick it over VP9 today).
// ---------------------------------------------------------------------
export const VALID_CODECS_FOR_FORMAT: Record<ExportFormat, ExportCodec[]> = {
  MP4: ["H264", "H265"],
  MOV: ["H264", "H265"],
  WEBM: ["VP9"],
  GIF: [],
};

export const DEFAULT_CODEC_FOR_FORMAT: Record<ExportFormat, ExportCodec | null> = {
  MP4: "H264",
  MOV: "H264",
  WEBM: "VP9",
  GIF: null,
};

export function hasAudioTrack(format: ExportFormat): boolean {
  return format !== "GIF";
}

export function isValidCodecForFormat(format: ExportFormat, codec: ExportCodec | null): boolean {
  if (format === "GIF") return codec === null;
  return codec !== null && VALID_CODECS_FOR_FORMAT[format].includes(codec);
}

// Pure — resolves a requested codec against its format, falling back to
// that format's default when the request is missing/invalid (e.g. VP9
// requested for an MP4 container) rather than rejecting outright — the
// same "clamp to something sane" convention every other settings input in
// this module follows (transition duration, crop bounds, ...).
export function resolveCodec(format: ExportFormat, requestedCodec?: ExportCodec | null): ExportCodec | null {
  if (format === "GIF") return null;
  if (requestedCodec && VALID_CODECS_FOR_FORMAT[format].includes(requestedCodec)) return requestedCodec;
  return DEFAULT_CODEC_FOR_FORMAT[format];
}

export const CONTAINER_EXTENSION: Record<ExportFormat, string> = {
  MP4: "mp4",
  MOV: "mov",
  WEBM: "webm",
  GIF: "gif",
};

export const CONTENT_TYPE_FOR_FORMAT: Record<ExportFormat, string> = {
  MP4: "video/mp4",
  MOV: "video/quicktime",
  WEBM: "video/webm",
  GIF: "image/gif",
};

// ---------------------------------------------------------------------
// Social-platform export presets — a convenience prefill for the manual
// format/resolution/fps/codec/bitrate fields above, NOT a second encoding
// path (buildFfmpegEncodingPlan is still what actually runs). Values are
// each platform's own commonly published upload recommendation (YouTube's
// documented 1080p30 SDR bitrate guidance, TikTok/Reels/Shorts' widely-used
// higher-bitrate convention for vertical mobile viewing, etc.) — not
// queried live from any platform API, and not guaranteed to match a
// platform's CURRENT limits exactly; treat as a sensible starting point a
// user can still edit afterward, same as every other field in this panel.
//
// Deliberately does NOT change the project's own aspect ratio — that's a
// real, separate, already-existing mutation (the Preview Window's 16:9/
// 9:16/1:1 quick-switch, PATCHes EditorProject.aspectRatio) with its own
// effect on already-placed clips; silently invoking it as a side effect of
// picking an export preset would be a surprising, hard-to-undo action.
// Instead, `recommendedAspect` lets the UI show an honest heads-up when
// the project's CURRENT aspect doesn't match what the preset assumes.
export type ExportAspectClass = "landscape" | "portrait" | "square";

export interface ExportPlatformPreset {
  id: string;
  label: string;
  format: ExportFormat;
  resolution: ExportResolution;
  fps: number;
  codec: ExportCodec;
  bitrateKbps: number;
  recommendedAspect: ExportAspectClass;
}

export const EXPORT_PLATFORM_PRESETS: ExportPlatformPreset[] = [
  { id: "YOUTUBE", label: "YouTube", format: "MP4", resolution: "R1080P", fps: 30, codec: "H264", bitrateKbps: 8000, recommendedAspect: "landscape" },
  {
    id: "SHORTS_TIKTOK_REELS",
    label: "YouTube Shorts / TikTok / Reels",
    format: "MP4",
    resolution: "R1080P",
    fps: 30,
    codec: "H264",
    bitrateKbps: 10000,
    recommendedAspect: "portrait",
  },
  { id: "INSTAGRAM_SQUARE", label: "Instagram Feed (Square)", format: "MP4", resolution: "R1080P", fps: 30, codec: "H264", bitrateKbps: 8000, recommendedAspect: "square" },
  { id: "X_TWITTER", label: "X / Twitter", format: "MP4", resolution: "R1080P", fps: 30, codec: "H264", bitrateKbps: 6000, recommendedAspect: "landscape" },
];

// Pure — classifies a project's own dimensions into the same 3 buckets
// EXPORT_PLATFORM_PRESETS' `recommendedAspect` uses, with a small
// tolerance band around 1:1 (a 1080x1080 project and a hypothetical
// 1080x1078 one should both read as "square", not fall through to
// landscape/portrait on a rounding technicality).
export function classifyAspect(widthPx: number, heightPx: number): ExportAspectClass {
  const ratio = widthPx / Math.max(1, heightPx);
  if (Math.abs(ratio - 1) < 0.02) return "square";
  return ratio > 1 ? "landscape" : "portrait";
}

// Watermark tier gate (2026-07-16, Full Regression Pass follow-up) — the
// pricing page promises Free/Starter/Growth downloads carry a watermark
// and only the top tier removes it; per an explicit product decision, that
// line is drawn at PREMIUM specifically (BASIC/PRO/no-subscription all
// still forced). Pure and framework-agnostic (this file's whole point) so
// BOTH the server's real enforcement (lib/video-editor/exports.ts's
// createExport) and the export panel's own UI gate import the exact same
// rule instead of the client guessing at a rule only the server enforces.
// `PricingTierLevel` is a type-only import — erased at build time, so
// pulling it in here never drags lib/credits/video-actions.ts's
// prisma/server imports into this file or the client bundle.
export function canRemoveWatermark(tier: import("@/lib/credits/video-actions").PricingTierLevel | null): boolean {
  return tier === "PREMIUM";
}

// ---------------------------------------------------------------------
// Part D (Future AI Renderer hook) — the render worker's frame-capture
// step is written against this interface, not a concrete "launch
// Playwright" call. `BrowserFrameSource` (export-worker.ts) is the only
// implementation today: it steps the real editor compositor headlessly.
// A future AI-generated-frame source (Phase 12) satisfies the exact same
// contract — the worker's frame loop, FFmpeg piping, and progress
// tracking are all already written against "something that hands me
// PNG bytes for frame N," not "a headless browser" specifically, so
// swapping the source in is a one-line change at the call site, not a
// pipeline rewrite.
// ---------------------------------------------------------------------
export interface RenderedFrame {
  frameIndex: number;
  atMs: number;
  pngBuffer: Buffer;
}

export interface FrameSource {
  readonly totalFrames: number;
  renderFrame(frameIndex: number): Promise<RenderedFrame>;
  close(): Promise<void>;
}

// ---------------------------------------------------------------------
// FFmpeg argument construction — pure (returns argv arrays; export-worker.ts
// is the only caller that actually spawns the process). Kept as data here
// rather than string-templated in the worker so the encoding choices per
// format/codec are unit-testable without spawning FFmpeg.
// ---------------------------------------------------------------------
export interface FfmpegEncodingPlan {
  videoCodecArgs: string[];
  audioCodecArgs: string[];
  pixelFormatArgs: string[];
  containerArgs: string[];
}

const VIDEO_CODEC_ARGS: Record<ExportCodec, (bitrateKbps?: number) => string[]> = {
  H264: (bitrateKbps) => ["-c:v", "libx264", "-preset", "medium", ...(bitrateKbps ? ["-b:v", `${bitrateKbps}k`] : ["-crf", "18"])],
  H265: (bitrateKbps) => ["-c:v", "libx265", "-preset", "medium", ...(bitrateKbps ? ["-b:v", `${bitrateKbps}k`] : ["-crf", "20"])],
  VP9: (bitrateKbps) => ["-c:v", "libvpx-vp9", ...(bitrateKbps ? ["-b:v", `${bitrateKbps}k`] : ["-crf", "30", "-b:v", "0"])],
};

// Pure — builds the FFmpeg argv fragments for a given format/codec/bitrate.
// GIF is deliberately NOT a "video codec" path: it uses a two-pass
// palette-generation filter (a well-known FFmpeg recipe for decent-quality
// GIFs, since GIF's 256-color palette looks banded/dithered badly without
// one) — see export-worker.ts's buildGifCommand for where this plan is
// actually consumed differently from the video-format path.
export function buildFfmpegEncodingPlan(format: ExportFormat, codec: ExportCodec | null, bitrateKbps?: number): FfmpegEncodingPlan {
  if (format === "GIF") {
    return { videoCodecArgs: [], audioCodecArgs: [], pixelFormatArgs: [], containerArgs: [] };
  }
  const resolvedCodec = codec ?? DEFAULT_CODEC_FOR_FORMAT[format]!;
  const videoCodecArgs = VIDEO_CODEC_ARGS[resolvedCodec](bitrateKbps);
  const audioCodecArgs = format === "WEBM" ? ["-c:a", "libopus", "-b:a", "192k"] : ["-c:a", "aac", "-b:a", "192k"];
  const pixelFormatArgs = ["-pix_fmt", "yuv420p"];
  // faststart moves MP4/MOV's moov atom to the front so playback can begin
  // before the whole file downloads — meaningless for WEBM, harmless to omit.
  const containerArgs = format === "MP4" || format === "MOV" ? ["-movflags", "+faststart"] : [];
  return { videoCodecArgs, audioCodecArgs, pixelFormatArgs, containerArgs };
}
