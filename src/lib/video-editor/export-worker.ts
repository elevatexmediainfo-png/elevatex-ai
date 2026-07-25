import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";

import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import {
  buildFfmpegEncodingPlan,
  CONTAINER_EXTENSION,
  CONTENT_TYPE_FOR_FORMAT,
  computeTotalFrames,
  frameTimeMs,
  hasAudioTrack,
  resolveExportDimensions,
  type ExportFormat,
  type FrameSource,
  type RenderedFrame,
} from "./export-engine";
import { runFfmpeg } from "./ffmpeg-exec";
import { claimNextExport, completeExport, failExport, updateExportProgress } from "./exports";
import { createRenderToken } from "./render-token";
import type { RenderControl } from "@/app/editor/[projectId]/render/render-workspace";

// Module 10 — the Export render pipeline. See PROJECT_STATUS.md's Module 10
// entry for the full architecture write-up; the short version: this file
// orchestrates (launch a headless browser, step it frame-by-frame,
// screenshot, bounce audio, invoke FFmpeg) — it does NOT contain any
// transform/keyframe/transition/text/audio math of its own. All of that
// lives in the compositor (compositor-stage.tsx, unchanged from the live
// Preview Window) and the pure functions in audio.ts/transform.ts/
// transition-engine.ts, reused as-is.

const APP_BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// 2026-07-12 — a real AI Film merge (1800 frames, 5 real video clips) died
// mid-render 3 times in a row, at 3 different, non-repeating points (36%,
// 53%, 90% through) — confirmed each time via direct OS process inspection
// that the headless Chromium page had genuinely crashed or hung (not a
// queue/worker problem). Root-caused, not guessed: every frame in render
// mode calls RenderWorkspace's setFrame(), which (since `playing` is always
// false here — see render-workspace.tsx) unconditionally sets each active
// <video> element's .currentTime every single frame — a real seek, decoded
// under software rendering (this host runs headless Chromium with
// --enable-unsafe-swiftshader, no GPU) — plus one full-stage PNG screenshot
// per frame. Neither is free, and across ~1800+ iterations in one
// long-lived page, Chromium's own internal state (decoder buffers, V8/Blink
// heap, screenshot scratch buffers) can accumulate to a crash — at a point
// that varies run to run, exactly matching what was observed. A real
// contributing leak was also found and fixed separately (compositor-
// stage.tsx's useClipAudioGraph never disconnected its Web Audio nodes on
// clip unmount), but rather than assume that alone accounts for 3 crashes
// at 3 different points, the render loop below now periodically closes and
// reopens the render page — the same defense this codebase already uses
// for the export QUEUE (workers don't run forever unbounded either) applied
// to the PAGE's own lifetime. This bounds the blast radius of ANY
// leak — known or not-yet-found — instead of chasing every possible one:
// a 5-minute film (~9000 frames at 30fps) gets the same per-page frame
// budget as a 1-minute one, just recycled ~5x as often.
const RECYCLE_PAGE_EVERY_N_FRAMES = 300; // ~10s of 30fps output between fresh pages

// Part D (Future AI Renderer hook) — the concrete FrameSource implementation
// for today: steps the real editor compositor headlessly. See
// export-engine.ts's FrameSource doc comment for why the render loop below
// is written against this interface rather than calling Playwright
// directly — a future AI-generated-frame source satisfies the same
// contract with zero changes to the loop, progress tracking, or FFmpeg
// piping below.
class BrowserFrameSource implements FrameSource {
  readonly totalFrames: number;
  private page: Page;
  private readonly fps: number;

  constructor(page: Page, fps: number, totalFrames: number) {
    this.page = page;
    this.fps = fps;
    this.totalFrames = totalFrames;
  }

  // Lets the render loop below swap in a freshly-opened page mid-export
  // (periodic recycling — see RECYCLE_PAGE_EVERY_N_FRAMES's doc comment)
  // without needing a new FrameSource instance or losing frame-index state.
  setPage(page: Page): void {
    this.page = page;
  }

  async renderFrame(frameIndex: number): Promise<RenderedFrame> {
    const atMs = frameTimeMs(frameIndex, this.fps);
    await this.page.evaluate(async (ms) => {
      const control = (window as unknown as { __renderControl?: RenderControl }).__renderControl;
      if (!control) throw new Error("__renderControl not ready");
      await control.setFrame(ms);
    }, atMs);

    const stage = this.page.locator("[data-render-stage]");
    const pngBuffer = await stage.screenshot({ type: "png" });
    return { frameIndex, atMs, pngBuffer };
  }

  async close(): Promise<void> {
    // The caller owns the Page/Browser lifecycle (it's shared with the
    // audio bounce step, which runs on the same page after every frame is
    // captured) — nothing to do here.
  }
}

async function openRenderPage(browser: Browser, projectId: string, exportId: string, widthPx: number, heightPx: number): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: widthPx, height: heightPx } });
  const token = createRenderToken(exportId, projectId);
  await page.goto(`${APP_BASE_URL}/editor/${projectId}/render?token=${token}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean((window as unknown as { __renderControl?: RenderControl }).__renderControl?.ready), { timeout: 30_000 });
  return page;
}

async function bounceAudio(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const control = (window as unknown as { __renderControl?: RenderControl }).__renderControl;
    if (!control) throw new Error("__renderControl not ready");
    return control.bounceAudio();
  });
  return Buffer.from(base64, "base64");
}

// Render Queue polish (2026-07-16) — the one query every cooperative-
// cancellation check point in the job below shares, so the frame-loop
// check and the two post-frame-loop checks (audio bounce, FFmpeg encode)
// can't drift into checking slightly different things.
async function isCancelled(exportId: string): Promise<boolean> {
  const current = await prisma.editorExport.findUnique({ where: { id: exportId }, select: { status: true } });
  return current?.status === "CANCELLED";
}

// Renders one export end-to-end: launch → step frames → bounce audio →
// encode → upload → mark complete. Any failure anywhere marks the export
// FAILED with a real error message (never a bare "failed") — the whole
// point of Part C's history requirement.
export async function renderExportJob(exportId: string): Promise<void> {
  // Real bug fix (2026-07-24, found live during the codebase health check)
  // — these setup calls used to run BEFORE the try block, after
  // claimNextExport() had already flipped this row to RENDERING. If
  // findUniqueOrThrow (row deleted mid-flight) or mkdtemp (disk full,
  // permissions — realistic under concurrent load) threw here, the
  // exception propagated all the way out to drainExportQueue's caller
  // (export-queue-worker.ts's pollOnce, which only logs it), so
  // failExport() was never called: the export sat at RENDERING, 0%,
  // forever, with no error message and no retry path anywhere in this
  // pipeline. Moving every fallible step inside the try (tempDir/browser
  // declared outside so the finally block can still clean up whichever of
  // them actually got created) means every failure path here now goes
  // through the same failExport() every other failure in this function
  // already does.
  let tempDir: string | null = null;
  let browser: Browser | null = null;

  try {
    const exportRow = await prisma.editorExport.findUniqueOrThrow({ where: { id: exportId } });
    const project = await prisma.editorProject.findUniqueOrThrow({ where: { id: exportRow.projectId } });
    tempDir = await mkdtemp(join(tmpdir(), `editor-export-${exportId}-`));

    const { widthPx, heightPx } = resolveExportDimensions(exportRow.resolution, project.widthPx, project.heightPx);
    const totalFrames = computeTotalFrames(project.durationMs, exportRow.fps);

    browser = await chromium.launch({ headless: true });
    let page = await openRenderPage(browser, exportRow.projectId, exportId, widthPx, heightPx);

    const frameSource = new BrowserFrameSource(page, exportRow.fps, totalFrames);

    let lastProgressWriteAt = 0;
    let framesSincePageOpen = 0;
    for (let frameIndex = 0; frameIndex < frameSource.totalFrames; frameIndex++) {
      // Periodic page recycling — see RECYCLE_PAGE_EVERY_N_FRAMES's doc
      // comment. Closing and reopening the render page (not the whole
      // browser — cheaper, and the browser process itself isn't what
      // accumulates per-frame state) bounds however much a long render can
      // accumulate before it's crash-prone, regardless of exact cause.
      if (framesSincePageOpen >= RECYCLE_PAGE_EVERY_N_FRAMES) {
        await page.close().catch(() => {});
        page = await openRenderPage(browser, exportRow.projectId, exportId, widthPx, heightPx);
        frameSource.setPage(page);
        framesSincePageOpen = 0;
      }

      // Cooperative cancellation — checked between frames (not preemptive
      // mid-frame), matching lib/render/pipeline.ts's cancelInProgressRender
      // convention: a cancel flag stops the NEXT unit of work, not
      // whatever's already in flight.
      if (frameIndex % 15 === 0) {
        if (await isCancelled(exportId)) return;
      }

      const frame = await frameSource.renderFrame(frameIndex);
      await writeFile(join(tempDir, `frame-${String(frame.frameIndex).padStart(6, "0")}.png`), frame.pngBuffer);
      framesSincePageOpen++;

      const now = Date.now();
      if (now - lastProgressWriteAt > 500 || frameIndex === frameSource.totalFrames - 1) {
        await updateExportProgress(exportId, frameIndex + 1, frameSource.totalFrames);
        lastProgressWriteAt = now;
      }
    }

    // The frame loop above only checks CANCELLED between captured frames —
    // once it finishes, audio-bounce and FFmpeg encoding are both real
    // work with no cancellation checks of their own. One more check here
    // (still cooperative, not preemptive mid-step — same convention as the
    // frame loop) skips straight to the browser-close/cleanup in `finally`
    // instead of spending that work on an export the user already
    // cancelled. completeExport()'s own CANCELLED guard is the backstop if
    // a cancel lands in the narrow window after this check but before the
    // final write — this check is the fast path, not the only guarantee.
    if (await isCancelled(exportId)) return;

    let audioPath: string | null = null;
    if (hasAudioTrack(exportRow.format)) {
      const wavBuffer = await bounceAudio(page);
      audioPath = join(tempDir, "audio.wav");
      await writeFile(audioPath, wavBuffer);
    }

    await browser.close();
    browser = null;

    if (await isCancelled(exportId)) return;

    const outputExt = CONTAINER_EXTENSION[exportRow.format];
    const outputPath = join(tempDir, `output.${outputExt}`);

    if (exportRow.format === "GIF") {
      await encodeGif(tempDir, exportRow.fps, outputPath);
    } else {
      await encodeVideo(tempDir, exportRow.fps, audioPath, exportRow.format, exportRow.codec, exportRow.bitrateKbps, outputPath);
    }

    if (await isCancelled(exportId)) return;

    const outputBuffer = await readFile(outputPath);
    const storage = await getStorageProvider();
    const uploaded = await storage.upload({
      key: `editor-exports/${exportId}/output.${outputExt}`,
      data: outputBuffer,
      contentType: CONTENT_TYPE_FOR_FORMAT[exportRow.format],
    });

    await completeExport(exportId, { outputKey: uploaded.key, widthPx, heightPx, durationMs: project.durationMs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed for an unknown reason.";
    await failExport(exportId, message);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function encodeVideo(
  tempDir: string,
  fps: number,
  audioPath: string | null,
  format: ExportFormat,
  codec: string | null,
  bitrateKbps: number | null,
  outputPath: string
): Promise<void> {
  const plan = buildFfmpegEncodingPlan(format, (codec as never) ?? null, bitrateKbps ?? undefined);
  const args = [
    "-y",
    "-framerate", String(fps),
    "-i", join(tempDir, "frame-%06d.png"),
    ...(audioPath ? ["-i", audioPath] : []),
    ...plan.videoCodecArgs,
    ...(audioPath ? plan.audioCodecArgs : []),
    ...plan.pixelFormatArgs,
    ...plan.containerArgs,
    // Ends the output at the shorter of video/audio streams — the bounced
    // WAV is rendered to the exact same project.durationMs as the video
    // frames, so this is a safety clamp against rounding drift, not a
    // real trim.
    ...(audioPath ? ["-shortest"] : []),
    outputPath,
  ];
  await runFfmpeg(args);
}

// GIF: a two-pass palette-generation recipe (a well-known FFmpeg technique
// for decent-quality GIFs — GIF's 256-color palette looks heavily banded/
// dithered without one, since a naive single-pass encode picks a generic
// palette rather than one fit to this specific clip's actual colors).
async function encodeGif(tempDir: string, fps: number, outputPath: string): Promise<void> {
  const palettePath = join(tempDir, "palette.png");
  await runFfmpeg(["-y", "-framerate", String(fps), "-i", join(tempDir, "frame-%06d.png"), "-vf", "palettegen", palettePath]);
  await runFfmpeg([
    "-y",
    "-framerate", String(fps),
    "-i", join(tempDir, "frame-%06d.png"),
    "-i", palettePath,
    "-lavfi", "paletteuse",
    outputPath,
  ]);
}

// ---------------------------------------------------------------------
// Poll-loop entry point — mirrors lib/render/pipeline.ts's drainQueue()
// shape exactly (claim-and-process in a loop until the queue is empty),
// run by its OWN worker interval (see instrumentation.ts) rather than
// folded into the existing render-queue's drainQueue/RENDER_QUEUE_CONCURRENCY:
// export jobs spawn a real headless Chromium + FFmpeg process each, a much
// heavier per-job resource cost than the existing AI-generation jobs
// (network-bound API calls) — mixing them into the same concurrency knob
// would either starve exports behind generation jobs or over-commit CPU/
// memory when both queues are busy at once. A separate, independently
// tunable EDITOR_EXPORT_QUEUE_CONCURRENCY (defaulting low — see
// lib/admin/config.ts) keeps the two workloads from contending.
// ---------------------------------------------------------------------
export async function drainExportQueue(concurrency: number): Promise<{ processedCount: number }> {
  let processedCount = 0;
  let exhausted = false;

  async function worker() {
    while (!exhausted) {
      const job = await claimNextExport();
      if (!job) {
        exhausted = true;
        return;
      }
      await renderExportJob(job.id);
      processedCount++;
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  return { processedCount };
}
