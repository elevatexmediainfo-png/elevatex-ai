import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createAiEditJobSchema } from "@/lib/validations/video-editor";
import { createAiEditJob, listAiEditJobs } from "@/lib/video-editor/ai-edit-jobs";
import { InvalidStateError } from "@/lib/video-editor/errors";
import { InsufficientCreditsError } from "@/lib/credits/engine";
import { InsufficientTierError, UnknownVideoActionError } from "@/lib/credits/video-actions";

// GET /api/editor/projects/[id]/ai-edit-jobs — Phase 12 Module 2's minimal
// polling list, same shape as GET .../exports.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }
  const { id } = await params;

  try {
    const jobs = await listAiEditJobs(id, session.user.id);
    return apiSuccess({ jobs });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("GET /api/editor/projects/[id]/ai-edit-jobs failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

// POST /api/editor/projects/[id]/ai-edit-jobs — queues a new job (QUEUED
// status); the AI Edit queue worker (ai-edit-queue-worker.ts, started from
// instrumentation.ts) picks it up within POLL_INTERVAL_MS.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }
  const { id } = await params;

  try {
    const body = createAiEditJobSchema.parse(await req.json());
    const job = await createAiEditJob({
      projectId: id,
      userId: session.user.id,
      assetId: body.assetId,
      stylePreset: body.stylePreset,
      brollDensity: body.brollDensity,
      brollStockOnly: body.brollStockOnly,
      script: body.script,
    });
    return apiSuccess({ job }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the request and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    if (err instanceof InsufficientTierError) {
      return apiError("ERR_INSUFFICIENT_TIER", err.message, 403);
    }
    if (err instanceof InsufficientCreditsError) {
      return apiError(
        "ERR_INSUFFICIENT_CREDITS",
        `You need at least ${err.required} credit(s) but only have ${err.available}. Buy more credits to continue.`,
        402
      );
    }
    if (err instanceof UnknownVideoActionError) {
      return apiError("ERR_INVALID_STATE", err.message, 400);
    }
    console.error("POST /api/editor/projects/[id]/ai-edit-jobs failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
