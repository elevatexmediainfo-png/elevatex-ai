import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { getUserTier } from "@/lib/credits/video-actions";
import { InvalidStateError } from "./errors";
import { getOwnedProject } from "./projects";
import {
  canRemoveWatermark,
  computeProgressPercent,
  computeTotalFrames,
  isValidCodecForFormat,
  resolveCodec,
  resolveExportDimensions,
  type ExportCodec,
  type ExportFormat,
  type ExportResolution,
} from "./export-engine";

// Export job/history service (Module 10). EditorExport doubles as both the
// queue row (status QUEUED is claimed atomically, same compare-and-swap
// pattern as lib/queue/queue.ts's RenderJob) and the user-facing history
// record — see the schema's EditorExport doc comment and export-worker.ts
// for the render pipeline that consumes it.

export interface CreateExportInput {
  projectId: string;
  userId: string;
  format: ExportFormat;
  resolution: ExportResolution;
  fps: number;
  bitrateKbps?: number;
  codec?: ExportCodec;
  watermark?: boolean;
}

export async function createExport(input: CreateExportInput) {
  const project = await getOwnedProject(input.userId, input.projectId);

  const maxDurationMs = await getConfig("EDITOR_EXPORT_MAX_DURATION_MS");
  if (project.durationMs > maxDurationMs) {
    throw new InvalidStateError(`This project (${Math.round(project.durationMs / 1000)}s) exceeds the maximum exportable duration (${Math.round(maxDurationMs / 1000)}s).`);
  }

  // Real bug fix (2026-07-24, found live during the codebase health check)
  // — the duration check above says nothing about fps (up to 120) or
  // resolution (up to 4K), so a single request combining all three near
  // their individual maxima could demand ~216,000 individual PNG frame
  // files with no guardrail at all. Checked here, before any real work
  // (headless Chromium, frame capture, FFmpeg) or even a real DB row is
  // created — see EDITOR_EXPORT_MAX_PIXEL_FRAMES's own doc comment for why
  // pixel-frames (not any single dimension) is the right combined budget.
  const { widthPx, heightPx } = resolveExportDimensions(input.resolution, project.widthPx, project.heightPx);
  const totalFrames = computeTotalFrames(project.durationMs, input.fps);
  const pixelFrames = widthPx * heightPx * totalFrames;
  const maxPixelFrames = await getConfig("EDITOR_EXPORT_MAX_PIXEL_FRAMES");
  if (pixelFrames > maxPixelFrames) {
    throw new InvalidStateError(
      `This export's combined resolution (${widthPx}×${heightPx}), frame rate (${input.fps}fps), and duration (${Math.round(project.durationMs / 1000)}s) exceed what a single export can render. Lower the resolution, frame rate, or trim the project, then try again.`
    );
  }

  if (input.codec && !isValidCodecForFormat(input.format, input.codec)) {
    throw new InvalidStateError(`${input.codec} is not a valid codec for ${input.format}.`);
  }
  const codec = resolveCodec(input.format, input.codec);

  // Local-instant-preview (2026-07-24) — a clip can now legally reference a
  // still-uploading (PENDING_UPLOAD/QUEUED_FOR_NORMALIZATION/NORMALIZING)
  // asset while the real upload finishes in the background. That's fine for
  // editing (the compositor renders a local blob override in the meantime)
  // but export renders server-side off the real storage object, so it must
  // block until every referenced asset has actually arrived.
  const notReady = await prisma.editorClip.findFirst({
    where: {
      projectId: input.projectId,
      assetId: { not: null },
      asset: { status: { not: "READY" } },
    },
    select: { id: true, asset: { select: { status: true } } },
  });
  if (notReady) {
    throw new InvalidStateError(
      "One or more clips reference a file that is still uploading or processing. Wait for the upload to finish before exporting."
    );
  }

  // Server-side watermark tier gate — the real enforcement point. The
  // export panel's own UI gate (disabled checkbox for non-PREMIUM) is a
  // convenience, not the guard: a request that tries to sneak
  // watermark:false through with a non-PREMIUM tier is silently
  // overridden back to true here, not trusted from the client.
  const tier = await getUserTier(input.userId);
  const watermark = canRemoveWatermark(tier) ? (input.watermark ?? false) : true;

  return prisma.editorExport.create({
    data: {
      projectId: input.projectId,
      userId: input.userId,
      format: input.format,
      resolution: input.resolution,
      fps: input.fps,
      bitrateKbps: input.bitrateKbps,
      codec: codec ?? undefined,
      watermark,
    },
  });
}

// Atomic claim — mirrors lib/queue/queue.ts's claimNextJob() exactly: a
// conditional UPDATE (`WHERE status = 'QUEUED'`) is safe under concurrent
// callers because only one `updateMany` can flip a given row, the same
// "not safe for many concurrent WORKER PROCESSES at high volume, swap for
// a real broker later" caveat that file's header already documents for
// this whole codebase's job-queue approach.
export async function claimNextExport() {
  const candidate = await prisma.editorExport.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;

  const claimed = await prisma.editorExport.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: { status: "RENDERING", startedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  return prisma.editorExport.findUnique({ where: { id: candidate.id } });
}

export async function updateExportProgress(exportId: string, framesRendered: number, totalFrames: number): Promise<void> {
  await prisma.editorExport.update({
    where: { id: exportId },
    data: { framesRendered, totalFrames, progress: computeProgressPercent(framesRendered, totalFrames) },
  });
}

// Render Queue polish (2026-07-16) — real gap found while investigating
// cancel correctness: this used to be a bare `update` with no status
// guard, unlike failExport's own `updateMany` + `status: { notIn:
// ["CANCELLED"] }` a few functions below. The render loop only checks the
// CANCELLED flag between captured frames (cooperative cancellation, same
// convention lib/render/pipeline.ts already established) — it does NOT
// check again before the audio-bounce/FFmpeg-encode steps that run after
// the frame loop finishes. Without this guard, a cancel requested during
// that narrow post-frame-capture window would silently get overwritten
// back to COMPLETED once encoding finished, exactly the "hiding it from
// the UI while it keeps running server-side" failure mode this needed to
// rule out — not just here, but as the very last write in the whole job,
// so it wins regardless of what raced before it.
export async function completeExport(
  exportId: string,
  result: { outputKey: string; widthPx: number; heightPx: number; durationMs: number }
): Promise<{ applied: boolean }> {
  const updated = await prisma.editorExport.updateMany({
    where: { id: exportId, status: { not: "CANCELLED" } },
    data: {
      status: "COMPLETED",
      progress: 100,
      completedAt: new Date(),
      outputKey: result.outputKey,
      widthPx: result.widthPx,
      heightPx: result.heightPx,
      durationMs: result.durationMs,
      errorMessage: null,
    },
  });
  return { applied: updated.count > 0 };
}

export async function failExport(exportId: string, errorMessage: string): Promise<void> {
  await prisma.editorExport.updateMany({
    where: { id: exportId, status: { notIn: ["CANCELLED"] } },
    data: { status: "FAILED", completedAt: new Date(), errorMessage },
  });
}

export async function listExports(projectId: string, userId: string) {
  await getOwnedProject(userId, projectId);
  return prisma.editorExport.findMany({ where: { projectId, userId }, orderBy: { createdAt: "desc" } });
}

export async function getExport(projectId: string, userId: string, exportId: string) {
  const row = await prisma.editorExport.findFirst({ where: { id: exportId, projectId, userId } });
  if (!row) throw new InvalidStateError("Export not found in this project.");
  return row;
}

// Cancel only affects a not-yet-claimed (QUEUED) or actively RENDERING
// export — mirrors lib/render/pipeline.ts's cancelInProgressRender's
// "no preemption of in-flight work beyond a status flag" convention: a
// RENDERING export is flagged CANCELLED here, and export-worker.ts checks
// that flag between frames so a long render actually stops promptly
// instead of running to completion regardless.
export async function cancelExport(projectId: string, userId: string, exportId: string): Promise<void> {
  const claimed = await prisma.editorExport.updateMany({
    where: { id: exportId, projectId, userId, status: { in: ["QUEUED", "RENDERING"] } },
    data: { status: "CANCELLED", completedAt: new Date() },
  });
  if (claimed.count === 0) throw new InvalidStateError("Only a queued or rendering export can be cancelled.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// AI Video Phase 1 — shared by every orchestrator that queues an export and
// needs the finished result back in the same call (Animated Poster Video,
// Phase 3b's clip merge) rather than a fire-and-forget job the caller polls
// separately later. The export-queue-worker's own 5s poll loop is what
// actually drains the QUEUED row; this just waits for that to happen.
export async function pollExportUntilDone(
  projectId: string,
  userId: string,
  exportId: string,
  opts: { intervalMs?: number; maxAttempts?: number } = {}
) {
  const intervalMs = opts.intervalMs ?? 1000;
  const maxAttempts = opts.maxAttempts ?? 180; // 3 minutes by default
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const row = await getExport(projectId, userId, exportId);
    if (row.status === "COMPLETED" || row.status === "FAILED" || row.status === "CANCELLED") return row;
    await sleep(intervalMs);
  }
  throw new InvalidStateError("Timed out waiting for the export to render.");
}
