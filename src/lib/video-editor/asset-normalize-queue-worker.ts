import { getConfig } from "@/lib/admin/config";
import { drainNormalizeQueue } from "./asset-normalize-worker";
import { logger } from "@/lib/observability/logger";

// Upload normalization (2026-07-19) — a fourth, independently-tuned poll
// loop, same "own concurrency budget" reasoning as export-queue-worker.ts
// and ai-edit-queue-worker.ts before it: normalization is FFmpeg-heavy
// local compute, closer in resource shape to the export queue than to
// the network-bound AI-generation/AI-edit queues, so it gets its own
// concurrency knob (EDITOR_NORMALIZE_QUEUE_CONCURRENCY) rather than
// sharing either existing one.

const POLL_INTERVAL_MS = 5000;

const globalForNormalizeWorker = globalThis as unknown as {
  __elevatexNormalizeQueueWorkerStarted?: boolean;
};

async function pollOnce() {
  try {
    const concurrency = await getConfig("EDITOR_NORMALIZE_QUEUE_CONCURRENCY");
    await drainNormalizeQueue(concurrency);
  } catch (err) {
    logger.error({ err }, "[asset normalize queue worker] poll failed");
  }
}

export function startAssetNormalizeQueueWorker() {
  if (globalForNormalizeWorker.__elevatexNormalizeQueueWorkerStarted) return;
  globalForNormalizeWorker.__elevatexNormalizeQueueWorkerStarted = true;

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, "[asset normalize queue worker] started");
  setInterval(pollOnce, POLL_INTERVAL_MS);
}
