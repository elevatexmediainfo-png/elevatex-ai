import type { AiEditJobStatus } from "@/generated/prisma/client";
import { getConfig } from "@/lib/admin/config";
import { prisma } from "@/lib/prisma";
import { claimNextAiEditJob, processAiEditJob } from "./ai-edit-jobs";
import { logger } from "@/lib/observability/logger";

// Phase 12 Module 2 — a SEPARATE in-process poll loop from both
// lib/queue/worker.ts's existing one AND export-queue-worker.ts, same
// "own concurrency budget" reasoning export-queue-worker.ts's own doc
// comment already gives: an AI Edit job is a network-bound transcription
// API call (like the AI-generation render queue), NOT the export queue's
// heavy local headless-Chromium+FFmpeg cost — sharing either existing
// queue's concurrency knob would either starve this behind exports or let
// this one starve exports, depending on which fills up first. Same
// "not safe for many concurrent worker PROCESSES, single-instance only"
// caveat as every other poll-queue in this codebase.

const POLL_INTERVAL_MS = 5000;

const globalForAiEditWorker = globalThis as unknown as {
  __elevatexAiEditQueueWorkerStarted?: boolean;
};

// Real bug fix (2026-07-24, found live during the codebase health check) —
// mirrors asset-normalize-worker.ts's reapStaleNormalizingAssets() /
// export-queue-worker.ts's reapStaleRenderingExports() exactly: a worker
// process killed mid-job (a real deploy) leaves the job at whatever
// intermediate status it was in when it died, forever — nothing else in
// this file's own try/catch (processAiEditJob's own outer catch only
// covers an exception WITHIN a still-running process) can ever catch
// that. 15 minutes — longer than the export/normalize workers' own
// thresholds since this pipeline chains multiple real, sequential vendor
// calls (transcription, video understanding, GPT reasoning, asset
// resolution) that each individually take real time.
const STALE_JOB_THRESHOLD_MS = 15 * 60 * 1000;
const IN_PROGRESS_STATUSES: AiEditJobStatus[] = [
  "UPLOADING",
  "TRANSCRIBING",
  "ANALYZING_VIDEO",
  "PLANNING_REMOVALS",
  "PLANNING_TIMELINE",
  "RESOLVING_ASSETS",
  "BUILDING_TIMELINE",
];

async function reapStaleAiEditJobs(): Promise<void> {
  const staleBefore = new Date(Date.now() - STALE_JOB_THRESHOLD_MS);
  const stale = await prisma.aiEditJob.updateMany({
    where: { status: { in: IN_PROGRESS_STATUSES }, updatedAt: { lt: staleBefore } },
    data: { status: "FAILED", completedAt: new Date(), errorMessage: "This job timed out — likely interrupted by a server restart. Please try again." },
  });
  if (stale.count > 0) {
    logger.error(
      { count: stale.count, staleThresholdMs: STALE_JOB_THRESHOLD_MS },
      "[ai edit queue worker] reaped stale in-progress job(s) — likely orphaned by a killed/restarted process"
    );
  }
}

async function drainAiEditQueue(concurrency: number): Promise<{ processedCount: number }> {
  let processedCount = 0;
  let exhausted = false;

  async function worker() {
    while (!exhausted) {
      const job = await claimNextAiEditJob();
      if (!job) {
        exhausted = true;
        return;
      }
      await processAiEditJob(job.id);
      processedCount++;
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  return { processedCount };
}

async function pollOnce() {
  try {
    await reapStaleAiEditJobs();
    const concurrency = await getConfig("AI_EDIT_QUEUE_CONCURRENCY");
    await drainAiEditQueue(concurrency);
  } catch (err) {
    logger.error({ err }, "[ai edit queue worker] poll failed");
  }
}

export function startAiEditQueueWorker() {
  if (globalForAiEditWorker.__elevatexAiEditQueueWorkerStarted) return;
  globalForAiEditWorker.__elevatexAiEditQueueWorkerStarted = true;

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, "[ai edit queue worker] started");
  setInterval(pollOnce, POLL_INTERVAL_MS);
}
