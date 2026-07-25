import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildFfmpegEncodingPlan } from "./export-engine";
import { runFfmpeg } from "./ffmpeg-exec";
import type { MediaProbe } from "./ffprobe-exec";

// Upload normalization (2026-07-19) — the durable fix for a real, twice-
// demonstrated bug class: a real customer file (H.264/1080x1920, but
// 100fps, PCM/"twos" audio, 83Mbps combined bitrate — an XAVC camera
// export, not a phone recording) broke BOTH live-preview smoothness (real
// decode-throughput deficit, measured at 0.665x real-time speed) AND
// audio playback entirely (canPlayType('...,twos') returns "" — Chromium
// cannot decode that audio codec in an MP4 container, full stop,
// independent of anything this app's own code does with gain/mute/the Web
// Audio graph). Any future upload with an unusual codec or extreme
// fps/bitrate hits this same class of bug without a fix at THIS layer —
// patching the compositor's Web Audio graph (already done once, see
// project_editor_persistent_element_stutter_fix) or the sync effect
// (project_editor_play_spam_fix) only ever addresses symptoms downstream
// of a source file the browser was never going to play cleanly anyway.
//
// MAX_FPS = 60 — chosen because this app's own export pipeline ALWAYS
// re-samples to its own configured export fps via explicit per-frame
// seeks (export-engine.ts's frameTimeMs/computeTotalFrames), confirmed
// live during the original investigation — capping a proxy's fps costs
// nothing at export time as long as the export's own fps setting stays
// <=60, which covers virtually every real export (this app's own export
// panel doesn't even offer >60fps as an option). 60fps also comfortably
// covers every real display/consumer use case for this app's actual
// audience (short marketing/social video) — the difference between 60fps
// and 100fps is imperceptible for anything that isn't deliberate slow-mo
// capture, which this app has no slow-mo feature to exploit anyway.
//
// MAX_VIDEO_BITRATE_KBPS = 20_000 (20 Mbps) — a generous ceiling clearly
// above typical high-quality H.264 output at any resolution up to 4K
// (YouTube's own recommended upload bitrate for 1080p60 is ~12Mbps, 4K60
// ~53Mbps combined across a whole ladder) but clearly below what a raw/
// prosumer camera export routinely produces (the real repro file's video
// stream alone was ~57Mbps). Deliberately NOT a resolution-scaled
// bits-per-pixel formula — simpler, and this bug class is about catching
// obviously-excessive camera-default bitrates, not fine-tuning quality.
export const MAX_FPS = 60;
export const MAX_VIDEO_BITRATE_KBPS = 20_000;
const KNOWN_GOOD_VIDEO_CODECS = new Set(["h264"]);
const KNOWN_GOOD_AUDIO_CODECS = new Set(["aac"]);

export interface NormalizationDecision {
  needsNormalization: boolean;
  reasons: string[];
  // Only set when needsNormalization — the fps to cap to via `-r`, or
  // undefined to preserve the source's native fps (still re-encoding for
  // a codec/bitrate reason, but with no reason to touch frame timing).
  targetFps?: number;
}

// Pure — decides whether a probed source needs re-encoding at all, and
// why. Skipping re-encode for an already-compliant file (H.264 + AAC +
// <=60fps + reasonable bitrate — the common case, e.g. any normal phone
// recording) matters for real reasons: re-encoding is lossy (every
// generation of H.264 re-compression loses real quality) and costs real
// CPU/time, so this must never fire on a file the browser already plays
// fine.
export function decideNormalization(probe: MediaProbe | null): NormalizationDecision {
  if (!probe) {
    // Couldn't probe at all — matches this codebase's existing "best-
    // effort, never block the upload over a diagnostic failure" rule
    // (see confirmEditorAssetUpload's filmstrip try/catch). Leaving the
    // file untouched is the safe default: it may already be fine, and a
    // failed probe is far more likely to mean "ffprobe hiccuped" than
    // "this file is secretly broken."
    return { needsNormalization: false, reasons: ["probe unavailable — left as-is"] };
  }

  const reasons: string[] = [];
  if (!probe.videoCodec || !KNOWN_GOOD_VIDEO_CODECS.has(probe.videoCodec.toLowerCase())) {
    reasons.push(`video codec "${probe.videoCodec ?? "unknown"}" is not H.264`);
  }
  if (!probe.audioCodec || !KNOWN_GOOD_AUDIO_CODECS.has(probe.audioCodec.toLowerCase())) {
    reasons.push(`audio codec "${probe.audioCodec ?? "unknown"}" is not AAC`);
  }
  const fpsExceeded = probe.fps !== null && probe.fps > MAX_FPS;
  if (fpsExceeded) {
    reasons.push(`fps ${probe.fps!.toFixed(1)} exceeds the ${MAX_FPS}fps cap`);
  }
  const bitrateExceeded = probe.videoBitrateKbps !== null && probe.videoBitrateKbps > MAX_VIDEO_BITRATE_KBPS;
  if (bitrateExceeded) {
    reasons.push(`video bitrate ${(probe.videoBitrateKbps! / 1000).toFixed(1)}Mbps exceeds the ${MAX_VIDEO_BITRATE_KBPS / 1000}Mbps cap`);
  }

  if (reasons.length === 0) {
    return { needsNormalization: false, reasons: ["already H.264 + AAC + within fps/bitrate limits"] };
  }
  return { needsNormalization: true, reasons, targetFps: fpsExceeded ? MAX_FPS : undefined };
}

// Re-encodes a video buffer to the H.264/AAC baseline. Reuses
// buildFfmpegEncodingPlan("MP4", "H264") — the EXACT same codec/pixel-
// format/container args this app's own Export Engine already uses for
// its default (no-explicit-bitrate) H.264 export, i.e. `-crf 18`
// (visually near-lossless x264) + `-c:a aac -b:a 192k` — deliberately not
// a second, separately-invented encoding profile. Native resolution is
// always preserved (only fps is ever capped, via `-r`, and only when the
// source genuinely exceeds MAX_FPS) — export quality in this app is
// bounded by the PROJECT's own export resolution setting, not the
// source's, so there is no quality reason to downscale here, and real
// reason not to (a smaller normalized file is of no benefit if the
// project's own export targets a larger frame).
export async function normalizeVideoBuffer(buffer: Buffer, decision: NormalizationDecision): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "video-normalize-"));
  try {
    const inputPath = join(tempDir, "input");
    const outputPath = join(tempDir, "output.mp4");
    await writeFile(inputPath, buffer);

    const plan = buildFfmpegEncodingPlan("MP4", "H264");
    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      ...(decision.targetFps ? ["-r", String(decision.targetFps)] : []),
      ...plan.videoCodecArgs,
      ...plan.audioCodecArgs,
      ...plan.pixelFormatArgs,
      ...plan.containerArgs,
      outputPath,
    ]);

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
