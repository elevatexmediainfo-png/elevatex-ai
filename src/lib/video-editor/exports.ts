import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { getUserTier } from "@/lib/credits/video-actions";
import { InvalidStateError } from "./errors";
import { getOwnedProject } from "./projects";
import { canRemoveWatermark, computeProgressPercent, isValidCodecForFormat, resolveCodec, type ExportCodec, type ExportFormat, type ExportResolution } from "./export-engine";

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

  if (input.codec && !isValidCodecForFormat(input.format, input.codec)) {
    throw new InvalidStateError(`${input.codec} is not a valid codec for ${input.format}.`);
  }
  const codec = resolveCodec(input.format, input.codec);

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
