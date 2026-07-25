import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createTalkingHeadProjectSchema } from "@/lib/validations/video";
import { getConfig } from "@/lib/admin/config";
import { prisma } from "@/lib/prisma";
import { recordProjectVersion } from "@/lib/projects/versioning";
import { checkRateLimit } from "@/lib/security/rate-limit";

// POST /api/videos/talking-head — Milestone 11's second VideoProject
// creation path, alongside POST /api/videos (brief -> AI script). This one
// starts from an already-uploaded video (sourceAssetId, from the presigned
// upload flow) instead: no template, no brief, no generatedScript. Free —
// it only creates the project row and enqueues transcription; nothing
// billable happens until actual generation (Part 12's confirmed boundary).
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  try {
    const rateLimit = await checkRateLimit("video_create", session.user.id);
    if (!rateLimit.allowed) {
      return apiError(
        "ERR_RATE_LIMIT",
        "You've hit the hourly limit for creating projects. Please try again later.",
        429,
        { retryAfterSeconds: rateLimit.retryAfterSeconds }
      );
    }

    const body = await req.json().catch(() => ({}));
    const data = createTalkingHeadProjectSchema.parse(body);

    const sourceAsset = await prisma.asset.findFirst({
      where: { id: data.sourceAssetId, userId: session.user.id },
    });
    if (!sourceAsset) {
      return apiError("ERR_NOT_FOUND", "Source video asset not found.", 404);
    }
    if (sourceAsset.kind !== "VIDEO") {
      return apiError("ERR_VALIDATION", "The source asset must be a video.", 400);
    }
    if (sourceAsset.status !== "READY") {
      return apiError("ERR_VALIDATION", "The source video hasn't finished uploading yet.", 400);
    }

    const maxAttempts = await getConfig("RENDER_MAX_ATTEMPTS");

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.videoProject.create({
        data: {
          userId: session.user.id,
          sourceType: "TALKING_HEAD_UPLOAD",
          sourceAssetId: sourceAsset.id,
          title: data.title,
          objective: data.objective,
          platform: data.platform,
          aspectRatio: data.aspectRatio,
          contentLanguage: data.contentLanguage,
          status: "DRAFT",
        },
      });

      await tx.renderJob.create({
        data: {
          videoProjectId: created.id,
          maxAttempts,
          payload: { kind: "transcribe", sourceAssetId: sourceAsset.id },
        },
      });

      await tx.asset.update({ where: { id: sourceAsset.id }, data: { videoProjectId: created.id } });

      return created;
    });

    await recordProjectVersion(project.id, session.user.id);

    return apiSuccess({ project }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the form and try again.", 400, { issues: err.issues });
    }
    console.error("POST /api/videos/talking-head failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong creating your project.", 500);
  }
}
