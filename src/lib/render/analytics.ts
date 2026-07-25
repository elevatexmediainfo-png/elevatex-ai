import { prisma } from "@/lib/prisma";

// Admin render-monitoring dashboard feed (requirements 15-17: analytics,
// history, monitoring). RenderJob rows already constitute the history —
// this just aggregates/exposes them, mirroring how lib/generation/usage-log.ts
// exposes GenerationLog for the provider-level dashboard.

export interface RenderQueueSnapshot {
  pending: number;
  processing: number;
  paused: number;
  failedLast24h: number;
}

export async function getQueueSnapshot(): Promise<RenderQueueSnapshot> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [pending, processing, paused, failedLast24h] = await Promise.all([
    prisma.renderJob.count({ where: { status: "PENDING" } }),
    prisma.renderJob.count({ where: { status: "PROCESSING" } }),
    prisma.renderJob.count({ where: { status: "PAUSED" } }),
    prisma.renderJob.count({ where: { status: "FAILED", updatedAt: { gte: since24h } } }),
  ]);
  return { pending, processing, paused, failedLast24h };
}

export interface SceneRenderStats {
  windowHours: number;
  totalScenes: number;
  completed: number;
  failed: number;
  avgAttempts: number;
  avgRenderSeconds: number | null;
}

export async function getSceneRenderStats(windowHours = 24): Promise<SceneRenderStats> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const scenes = await prisma.scene.findMany({
    where: { updatedAt: { gte: since } },
    select: { status: true, attempts: true, createdAt: true, updatedAt: true },
  });

  const completedScenes = scenes.filter((s) => s.status === "COMPLETED");
  const failed = scenes.filter((s) => s.status === "FAILED").length;
  const avgAttempts = scenes.length ? scenes.reduce((sum, s) => sum + s.attempts, 0) / scenes.length : 0;
  const avgRenderSeconds = completedScenes.length
    ? completedScenes.reduce((sum, s) => sum + (s.updatedAt.getTime() - s.createdAt.getTime()) / 1000, 0) /
      completedScenes.length
    : null;

  return {
    windowHours,
    totalScenes: scenes.length,
    completed: completedScenes.length,
    failed,
    avgAttempts,
    avgRenderSeconds,
  };
}

export async function getRenderHistory(limit = 50) {
  return prisma.renderJob.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      videoProjectId: true,
      sceneId: true,
      status: true,
      attempts: true,
      maxAttempts: true,
      errorMessage: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
    },
  });
}

// Milestone 12 — a permanently-FAILED RenderJob (retries exhausted) already
// IS this queue's dead-letter state; this just surfaces that subset with a
// manual "Retry" admin action in mind, rather than introducing a second
// table/mechanism.
export async function getDeadLetterJobs(limit = 50) {
  return prisma.renderJob.findMany({
    where: { status: "FAILED" },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      videoProjectId: true,
      sceneId: true,
      payload: true,
      attempts: true,
      maxAttempts: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// Resets a permanently-FAILED job back to PENDING with a fresh attempt
// budget — reuses the exact same claim mechanics every other PENDING job
// goes through (lib/queue/queue.ts's claimNextJob()); not a new retry path.
export async function retryDeadLetterJob(jobId: string) {
  const job = await prisma.renderJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "FAILED") return null;

  return prisma.renderJob.update({
    where: { id: jobId },
    data: { status: "PENDING", attempts: 0, errorMessage: null, completedAt: null, scheduledAt: new Date() },
  });
}

export interface QueueThroughputBucket {
  hourStart: string;
  completed: number;
  failed: number;
}

// Hour-bucketed completed/failed counts over a window — "Queue Metrics" per
// Phase A, computed from RenderJob.completedAt/updatedAt that already exist;
// no new tracking columns.
export async function getQueueThroughput(hours = 24): Promise<QueueThroughputBucket[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const jobs = await prisma.renderJob.findMany({
    where: { OR: [{ status: "COMPLETED", completedAt: { gte: since } }, { status: "FAILED", updatedAt: { gte: since } }] },
    select: { status: true, completedAt: true, updatedAt: true },
  });

  const buckets = new Map<string, QueueThroughputBucket>();
  for (const job of jobs) {
    const at = job.status === "COMPLETED" ? job.completedAt ?? job.updatedAt : job.updatedAt;
    const hourStart = new Date(at);
    hourStart.setMinutes(0, 0, 0);
    const key = hourStart.toISOString();
    const bucket = buckets.get(key) ?? { hourStart: key, completed: 0, failed: 0 };
    if (job.status === "COMPLETED") bucket.completed += 1;
    else bucket.failed += 1;
    buckets.set(key, bucket);
  }
  return Array.from(buckets.values()).sort((a, b) => a.hourStart.localeCompare(b.hourStart));
}

export interface JobLatencyPercentiles {
  windowHours: number;
  sampleSize: number;
  p50Ms: number | null;
  p95Ms: number | null;
}

// Claim-to-complete duration percentiles — startedAt is set the moment
// claimNextJob() wins the atomic claim, completedAt the moment the job
// finishes, so this is genuine processing latency, not queue wait time.
export async function getJobLatencyPercentiles(hours = 24): Promise<JobLatencyPercentiles> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const jobs = await prisma.renderJob.findMany({
    where: { status: "COMPLETED", completedAt: { gte: since }, startedAt: { not: null } },
    select: { startedAt: true, completedAt: true },
  });

  const durations = jobs
    .map((j) => (j.completedAt && j.startedAt ? j.completedAt.getTime() - j.startedAt.getTime() : null))
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);

  function percentile(p: number): number | null {
    if (durations.length === 0) return null;
    const index = Math.min(durations.length - 1, Math.floor((p / 100) * durations.length));
    return durations[index];
  }

  return {
    windowHours: hours,
    sampleSize: durations.length,
    p50Ms: percentile(50),
    p95Ms: percentile(95),
  };
}
