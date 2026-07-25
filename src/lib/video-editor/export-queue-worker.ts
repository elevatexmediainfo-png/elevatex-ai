import { getConfig } from "@/lib/admin/config";
import { prisma } from "@/lib/prisma";
import { drainExportQueue } from "./export-worker";
import { logger } from "@/lib/observability/logger";

// Module 10 — a SEPARATE in-process poll loop from lib/queue/worker.ts's
// existing one, on purpose: see export-worker.ts's drainExportQueue doc
// comment for why export jobs (headless Chromium + FFmpeg, heavy local
// compute) shouldn't share a concurrency budget with the existing
// AI-generation render queue (network-bound API calls). Same "not safe
// for many concurrent worker PROCESSES, single-instance only" caveat as
// the existing worker — swap for a real broker at that scale, behind the
// same claim/complete/fail shape, so nothing above this layer changes.

const POLL_INTERVAL_MS = 5000;

const globalForExportWorker = globalThis as unknown as {
  __elevatexExportQueueWorkerStarted?: boolean;
};

// Real bug fix (2026-07-24, found live during the codebase health check) —
// mirrors asset-normalize-worker.ts's reapStaleNormalizingAssets() exactly:
// export-worker.ts's own in-process guards (the try/catch fix + FFmpeg's
// new per-call timeout) only catch a hang WITHIN a still-running process.
// A killed/restarted process (a real deploy — this session's own
// established runbook does this routinely) takes any timer state down
// with it, leaving the export row at RENDERING forever with nothing left
// to ever recover it. 30 minutes (vs. the normalize worker's 10) because a
// single export legitimately involves multiple sequential heavy steps
// (frame capture, audio bounce, up to two FFmpeg passes for GIF, upload)
// with no progress write of their own between them — this must stay well
// above the worst-case real duration of that sequence, not just one step.
const STALE_RENDERING_THRESHOLD_MS = 30 * 60 * 1000;

async function reapStaleRenderingExports(): Promise<void> {
  const staleBefore = new Date(Date.now() - STALE_RENDERING_THRESHOLD_MS);
  const stale = await prisma.editorExport.updateMany({
    where: { status: "RENDERING", updatedAt: { lt: staleBefore } },
    data: { status: "FAILED", errorMessage: "Export timed out — likely interrupted by a server restart. Please try again.", completedAt: new Date() },
  });
  if (stale.count > 0) {
    logger.error(
      { count: stale.count, staleThresholdMs: STALE_RENDERING_THRESHOLD_MS },
      "[export queue worker] reaped stale RENDERING export(s) — likely orphaned by a killed/restarted process"
    );
  }
}

async function pollOnce() {
  try {
    await reapStaleRenderingExports();
    const concurrency = await getConfig("EDITOR_EXPORT_QUEUE_CONCURRENCY");
    await drainExportQueue(concurrency);
  } catch (err) {
    logger.error({ err }, "[export queue worker] poll failed");
  }
}

export function startExportQueueWorker() {
  if (globalForExportWorker.__elevatexExportQueueWorkerStarted) return;
  globalForExportWorker.__elevatexExportQueueWorkerStarted = true;

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, "[export queue worker] started");
  setInterval(pollOnce, POLL_INTERVAL_MS);
}
