import { getConfig } from "@/lib/admin/config";
import { drainQueue } from "@/lib/render/pipeline";
import { logger } from "@/lib/observability/logger";

// In-process worker loop — appropriate for local dev and single-instance
// deployments (e.g. a Node server on a single VM/container). It is NOT
// appropriate for multi-instance serverless deployments (Vercel etc.), where
// no process stays alive between requests: there, trigger drainQueue via
// the /api/internal/queue/process route on a schedule (Vercel Cron, a
// external scheduler) instead of relying on this loop.
//
// Guarded the same way as the Prisma client singleton (lib/prisma.ts) so
// Next.js's dev-mode module hot-reloading can't spawn a second interval.

const POLL_INTERVAL_MS = 3000;

const globalForWorker = globalThis as unknown as {
  __elevatexQueueWorkerStarted?: boolean;
};

async function pollOnce() {
  try {
    // drainQueue runs up to RENDER_QUEUE_CONCURRENCY jobs in parallel,
    // re-claiming until the queue is empty — real parallel rendering, not
    // sequential draining.
    const concurrency = await getConfig("RENDER_QUEUE_CONCURRENCY");
    await drainQueue(concurrency);
  } catch (err) {
    logger.error({ err }, "[queue worker] poll failed");
  }
}

export function startQueueWorker() {
  if (globalForWorker.__elevatexQueueWorkerStarted) return;
  globalForWorker.__elevatexQueueWorkerStarted = true;

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, "[queue worker] started");
  setInterval(pollOnce, POLL_INTERVAL_MS);
}
