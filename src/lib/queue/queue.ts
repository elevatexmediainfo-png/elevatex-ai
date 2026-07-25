import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// PRD Section 18 (rendering pipeline) — a Postgres-backed queue.
//
// This is intentionally a minimal, dependency-free implementation: claiming a
// job is a single conditional UPDATE (`WHERE id = ? AND status = 'PENDING'`),
// which is atomic under Postgres's row-level locking and safe for one worker
// process. It is NOT safe for many concurrent worker processes racing on the
// same row set at high volume — at that scale, swap this module for a real
// broker (Redis/BullMQ, SQS+Lambda) behind the same enqueue/claim/complete/fail
// function signatures so nothing above this layer has to change.

// Milestone 7: a job is either a scene render (sceneId set) or a merge
// (sceneId null) — see lib/render/pipeline.ts for the processing logic. The
// processor always re-fetches live Scene/VideoProject rows rather than
// trusting a payload snapshot (avoids staleness if a prompt was edited after
// enqueue), so `payload` carries no required fields anymore; it's kept as an
// empty object for forward-compatible debugging metadata only.

// `db` defaults to the module-level client but accepts a transaction client
// so callers (e.g. the render-trigger route) can fold the enqueue into the
// same transaction as the project's status claim — otherwise a crash between
// those calls could claim QUEUED with no job ever created.
type Db = Prisma.TransactionClient | typeof prisma;

export interface EnqueueJobInput {
  videoProjectId: string;
  sceneId?: string;
  maxAttempts?: number;
}

export async function enqueueJob(input: EnqueueJobInput, db: Db = prisma) {
  return db.renderJob.create({
    data: {
      videoProjectId: input.videoProjectId,
      sceneId: input.sceneId,
      maxAttempts: input.maxAttempts ?? 3,
      payload: {},
    },
  });
}

// Claiming is atomic under concurrent callers: if two workers race on the
// same candidate row, only one `updateMany` succeeds (count === 1) — the
// other gets count === 0 and simply returns null, so running many of these
// concurrently (see lib/render/pipeline.ts's drainQueue) is safe by
// construction, not an afterthought.
export async function claimNextJob() {
  const candidate = await prisma.renderJob.findFirst({
    where: { status: "PENDING", scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
  });
  if (!candidate) return null;

  const claimed = await prisma.renderJob.updateMany({
    where: { id: candidate.id, status: "PENDING" },
    data: { status: "PROCESSING", startedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return null;

  return prisma.renderJob.findUnique({ where: { id: candidate.id } });
}

export async function completeJob(
  jobId: string,
  result: Record<string, unknown>,
  db: Db = prisma
) {
  return db.renderJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      result: result as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function failJob(
  jobId: string,
  errorMessage: string,
  willRetry: boolean,
  db: Db = prisma
) {
  return db.renderJob.update({
    where: { id: jobId },
    data: {
      status: willRetry ? "PENDING" : "FAILED",
      errorMessage,
      completedAt: willRetry ? null : new Date(),
    },
  });
}
