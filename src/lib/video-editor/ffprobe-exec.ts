import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error — ffprobe-static ships no types, same as ffmpeg-static.
import ffprobePath from "ffprobe-static";

// Upload normalization (2026-07-19) — the first ffprobe wrapper in this
// codebase. Every prior ffmpeg-exec.ts helper only ever ENCODES; nothing
// existing needed to INSPECT a source file's real codec/fps/bitrate before
// this. Mirrors ffmpeg-exec.ts's own runFfmpeg shape deliberately (spawn +
// buffer stderr + reject on non-zero exit) for consistency, but is a
// separate function/file rather than added to ffmpeg-exec.ts — ffprobe and
// ffmpeg are different binaries (ffprobe-static vs ffmpeg-static), and
// keeping them apart matches that file's own stated goal of staying a
// minimal, dependency-free wrapper around exactly one process.

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  bit_rate?: string;
  width?: number;
  height?: number;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: { bit_rate?: string; duration?: string };
}

export interface MediaProbe {
  videoCodec: string | null;
  audioCodec: string | null;
  // Parsed from the video stream's own r_frame_rate ("100/1" -> 100),
  // falling back to avg_frame_rate if r_frame_rate is malformed/absent —
  // null if there's no video stream at all (an AUDIO-kind asset).
  fps: number | null;
  videoBitrateKbps: number | null;
  audioBitrateKbps: number | null;
  // Container-level bit_rate — the same combined figure ffprobe reported
  // for the real C2084.MP4 repro (83Mbps, driven mostly by an embedded
  // metadata/timed-data stream, not the video track alone) — kept
  // separate from videoBitrateKbps specifically so the normalization
  // decision below can reason about the VIDEO stream's own bitrate,
  // not an inflated container-wide figure.
  containerBitrateKbps: number | null;
  width: number | null;
  height: number | null;
}

function parseFrameRate(raw: string | undefined): number | null {
  if (!raw) return null;
  const [num, den] = raw.split("/").map(Number);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
}

function kbps(bitRateStr: string | undefined): number | null {
  const n = bitRateStr ? Number(bitRateStr) : NaN;
  return Number.isFinite(n) ? Math.round(n / 1000) : null;
}

// Probes a media buffer's real codec/fps/bitrate — the decision this
// project never had a way to make server-side before (see this file's
// header comment; duration/width/height were always client-reported,
// never independently verified). Returns null (rather than throwing) on
// any ffprobe failure — a probe failure should never itself block an
// upload; the caller treats "couldn't determine" as "don't normalize,
// let it through as-is," matching this codebase's existing "best-effort,
// never block the upload" convention for filmstrip generation.
export async function probeMediaFile(buffer: Buffer): Promise<MediaProbe | null> {
  const binaryPath: string | undefined = ffprobePath?.path;
  if (!binaryPath) return null;

  const tempDir = await mkdtemp(join(tmpdir(), "video-probe-"));
  try {
    const inputPath = join(tempDir, "input");
    await writeFile(inputPath, buffer);

    const output = await new Promise<string>((resolve, reject) => {
      const proc = spawn(binaryPath, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", inputPath]);
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (chunk) => (stdout += chunk.toString()));
      proc.stderr.on("data", (chunk) => (stderr += chunk.toString()));
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`ffprobe exited with code ${code}: ${stderr.slice(-2000)}`));
      });
    });

    const parsed = JSON.parse(output) as FfprobeOutput;
    const videoStream = parsed.streams?.find((s) => s.codec_type === "video");
    const audioStream = parsed.streams?.find((s) => s.codec_type === "audio");

    return {
      videoCodec: videoStream?.codec_name ?? null,
      audioCodec: audioStream?.codec_name ?? null,
      fps: videoStream ? (parseFrameRate(videoStream.r_frame_rate) ?? parseFrameRate(videoStream.avg_frame_rate)) : null,
      videoBitrateKbps: kbps(videoStream?.bit_rate),
      audioBitrateKbps: kbps(audioStream?.bit_rate),
      containerBitrateKbps: kbps(parsed.format?.bit_rate),
      width: videoStream?.width ?? null,
      height: videoStream?.height ?? null,
    };
  } catch (err) {
    console.error("[ffprobe-exec] probe failed:", err);
    return null;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
