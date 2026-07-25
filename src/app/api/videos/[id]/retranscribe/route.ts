import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";

// POST /api/videos/[id]/retranscribe — 2026-07-12, prompted by a real
// incident: a Talking Head project transcribed entirely on MockTranscriptionProvider
// (generic "Hi everyone, thanks for joining me today" placeholder text)
// because the real provider (AssemblyAI) had been configured but never
// actually enabled — the transcript/scene plan was silently built from
// content that had nothing to do with what the user's video actually said.
// Before this route, the only way to get a fresh transcript was re-uploading
// the same file as a brand-new project. This resets the SAME project back
// to its pre-transcript state and re-enqueues transcription — same
// "transcribe" RenderJob shape POST /api/videos/talking-head creates, so it
// re-enters lib/render/pipeline.ts's existing processTranscribeJob()
// unchanged. Only reachable before any credit-spending step: once a project
// has left SCRIPT_READY/DRAFT/FAILED (i.e. it queued, rendered, or
// completed), scenes may already reflect real generated/charged work that
// re-transcribing would silently orphan — blocked rather than risking that.
const RETRANSCRIBABLE_STATUSES = ["DRAFT", "SCRIPT_READY", "FAILED"] as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;
  const project = await prisma.videoProject.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!project) {
    return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
  }
  if (project.sourceType !== "TALKING_HEAD_UPLOAD" || !project.sourceAssetId) {
    return apiError("ERR_INVALID_STATE", "Only an uploaded Talking Head video can be re-transcribed.", 400);
  }
  if (!RETRANSCRIBABLE_STATUSES.includes(project.status as (typeof RETRANSCRIBABLE_STATUSES)[number])) {
    return apiError(
      "ERR_INVALID_STATE",
      "This video has already started rendering — re-transcribing is only available before that.",
      400
    );
  }

  const maxAttempts = await getConfig("RENDER_MAX_ATTEMPTS");

  await prisma.$transaction(async (tx) => {
    await tx.scene.deleteMany({ where: { videoProjectId: project.id } });
    await tx.transcript.deleteMany({ where: { videoProjectId: project.id } });
    await tx.videoProject.update({
      where: { id: project.id },
      data: { status: "DRAFT", errorMessage: null },
    });
    await tx.renderJob.create({
      data: {
        videoProjectId: project.id,
        maxAttempts,
        payload: { kind: "transcribe", sourceAssetId: project.sourceAssetId },
      },
    });
  });

  return apiSuccess({ project: { id: project.id, status: "DRAFT" } });
}
