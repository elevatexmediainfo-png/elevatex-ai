import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

// Real bug fix (2026-07-24, found live during the codebase health check) —
// runFfmpeg() had no timeout at all: a genuinely hung ffmpeg process (bad
// input, a pathological filter graph, or the same class of stuck-I/O issue
// already found and fixed for asset-normalize-worker.ts's storage.download())
// would occupy the single export worker slot forever, with nothing to ever
// kill it. Same hardcoded-constant convention as that fix's own
// JOB_TIMEOUT_MS (not admin-configurable — an internal reliability bound,
// not a business policy knob like EDITOR_EXPORT_MAX_PIXEL_FRAMES). This
// timeout guards ANY caller of runFfmpeg (export encode, GIF two-pass,
// frame/thumbnail/filmstrip extraction), all of which share the exact same
// "a stuck child process must not block forever" risk.
const FFMPEG_TIMEOUT_MS = 10 * 60 * 1000;

// Shared FFmpeg CLI wrapper — previously a private copy inside
// export-worker.ts (Module 10's frame-by-frame encode step); extracted here
// so AI Video Phase 3b's last-frame extraction (a genuinely different use
// of the same binary — probing an existing clip, not encoding new frames)
// can reuse it instead of a second copy. Deliberately excludes anything
// Playwright/DB-related, unlike export-worker.ts, so importing this file
// never pulls in a headless browser as a side effect.
export function runFfmpeg(args: string[], timeoutMs: number = FFMPEG_TIMEOUT_MS): Promise<void> {
  const resolvedFfmpegPath = ffmpegPath;
  if (!resolvedFfmpegPath) {
    return Promise.reject(new Error("ffmpeg-static returned no binary path for this platform."));
  }
  return new Promise((resolve, reject) => {
    const proc = spawn(resolvedFfmpegPath, args);
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill("SIGKILL");
      reject(new Error(`ffmpeg timed out after ${timeoutMs}ms and was killed: ${stderr.slice(-2000)}`));
    }, timeoutMs);
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

export interface ExtractedFrame {
  buffer: Buffer;
  mimeType: string;
}

// AI Video Phase 3b — pulls the last real frame out of an already-rendered
// clip, to feed as the next chained clip's start image. `-sseof -0.1` seeks
// from end-of-file rather than requiring the caller to know the exact
// duration up front, and backs off 0.1s so it doesn't land on a
// degenerate all-black/fade-out final frame some encoders emit exactly at
// EOF. The same command shape already used throughout this session to pull
// verification frames from Phase 1/2 outputs — not a new technique, just a
// codified, reusable version of it.
export async function extractLastFrame(videoBuffer: Buffer): Promise<ExtractedFrame> {
  const tempDir = await mkdtemp(join(tmpdir(), "video-frame-"));
  try {
    const inputPath = join(tempDir, "input.mp4");
    const outputPath = join(tempDir, "frame.png");
    await writeFile(inputPath, videoBuffer);
    await runFfmpeg(["-y", "-sseof", "-0.1", "-i", inputPath, "-update", "1", "-frames:v", "1", outputPath]);
    const buffer = await readFile(outputPath);
    return { buffer, mimeType: "image/png" };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Milestone 26 — Admin Asset Library's video thumbnail generation. A sibling
// of extractLastFrame() above (same runFfmpeg wrapper, same temp-file
// pattern) but pulls an EARLY representative frame instead of the last one
// — `-ss 1` seeks 1 second in, which is enough to skip a black/fade-in
// first frame for the vast majority of uploaded clips without needing to
// know the real duration up front (unlike extractLastFrame's -sseof, which
// specifically needs to seek from the end). ffmpeg detects the real
// container format from the file's own bytes, not the temp filename's
// extension, so this works for mp4/mov/webm uploads alike despite the
// fixed ".input" name.
export async function extractThumbnailFrame(videoBuffer: Buffer): Promise<ExtractedFrame> {
  const tempDir = await mkdtemp(join(tmpdir(), "video-thumb-"));
  try {
    const inputPath = join(tempDir, "input");
    const outputPath = join(tempDir, "thumb.png");
    await writeFile(inputPath, videoBuffer);
    try {
      await runFfmpeg(["-y", "-ss", "1", "-i", inputPath, "-frames:v", "1", outputPath]);
    } catch {
      // Falls back to the very first frame — a clip shorter than 1 second
      // has no frame at -ss 1 and would otherwise fail the whole upload
      // over a missing thumbnail.
      await runFfmpeg(["-y", "-i", inputPath, "-frames:v", "1", outputPath]);
    }
    const buffer = await readFile(outputPath);
    return { buffer, mimeType: "image/png" };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Fix (2026-07-13) — Timeline filmstrip generation (lib/video-editor/
// filmstrip.ts). A sibling of extractThumbnailFrame() above (same
// runFfmpeg wrapper, same temp-file pattern) but pulls `frameCount`
// EVENLY-SPACED frames across the whole clip in ONE ffmpeg invocation
// rather than `frameCount` separate `-ss` seeks — `fps=frameCount/
// durationSeconds` computes exactly the fractional sampling rate needed to
// land `frameCount` frames spread across the full duration; `-frames:v` is
// a hard cap in case fps-filter rounding would otherwise emit one extra
// frame. `%03d` output naming + a sorted readdir is what turns "one
// filter chain" into "an ordered array of frame buffers" — ffmpeg has no
// single-call "return N buffers to the caller" mode, only "write N files".
export async function extractFilmstripFrames(videoBuffer: Buffer, frameCount: number, durationSeconds: number): Promise<Buffer[]> {
  const tempDir = await mkdtemp(join(tmpdir(), "video-filmstrip-"));
  try {
    const inputPath = join(tempDir, "input");
    await writeFile(inputPath, videoBuffer);
    // Guard against a degenerate near-zero duration (a genuinely broken
    // upload) producing an infinite/absurd fps value.
    const safeDurationSeconds = Math.max(0.1, durationSeconds);
    const fps = frameCount / safeDurationSeconds;
    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-vf",
      `fps=${fps}`,
      "-frames:v",
      String(frameCount),
      join(tempDir, "frame_%03d.png"),
    ]);
    const files = (await readdir(tempDir)).filter((f) => f.startsWith("frame_")).sort();
    if (files.length === 0) {
      throw new Error("ffmpeg produced no filmstrip frames.");
    }
    return Promise.all(files.map((f) => readFile(join(tempDir, f))));
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
