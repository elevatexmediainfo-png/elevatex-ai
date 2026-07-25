import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { swapMusicSchema } from "@/lib/validations/talking-head";
import { swapBackgroundMusic, TimelinePlanError } from "@/lib/talking-head/timeline-plan";

// POST /api/videos/[id]/music — AI Marketing Assistant's one-click
// "Improve Music" (Part 8) for a Talking Head project, whose background
// music is one continuous Timeline clip rather than a per-scene field (see
// lib/talking-head/timeline-plan.ts's swapBackgroundMusic).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const data = swapMusicSchema.parse(body);

    const project = await prisma.videoProject.findFirst({ where: { id, userId: session.user.id } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
    }

    await swapBackgroundMusic(id, data.assetId);
    return apiSuccess({ updated: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the request and try again.", 400, { issues: err.issues });
    }
    if (err instanceof TimelinePlanError) {
      return apiError("ERR_INVALID_STATE", err.message, 409);
    }
    console.error("POST /api/videos/[id]/music failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
