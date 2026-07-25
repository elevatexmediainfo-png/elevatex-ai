import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { scriptTransformSchema } from "@/lib/validations/video";
import { runScriptTransform } from "@/lib/ai/script-studio";
import { recordPrompt } from "@/lib/prompts/service";
import { checkRateLimit } from "@/lib/security/rate-limit";

// POST /api/videos/[id]/script/transform — Script Studio's
// Rewrite/Expand/Shorten/Translate. Generate-only: returns the transformed
// text for the user to review, the same as the initial script generation
// the user already reviews before render. Applying it reuses the existing
// PATCH /api/videos/[id] script-edit route — no second save path.
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
    const rateLimit = await checkRateLimit("ai_assistant", session.user.id);
    if (!rateLimit.allowed) {
      return apiError("ERR_RATE_LIMIT", "Too many AI actions. Please try again later.", 429, {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const body = await req.json().catch(() => ({}));
    const data = scriptTransformSchema.parse(body);

    const project = await prisma.videoProject.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
    }
    if (project.status !== "SCRIPT_READY" || !project.generatedScript) {
      return apiError("ERR_INVALID_STATE", "This video has no editable script right now.", 409);
    }

    const result = await runScriptTransform(
      project.generatedScript,
      data.operation,
      project.contentLanguage as never,
      { tone: data.tone, targetLanguage: data.targetLanguage },
      { videoProjectId: id, userId: session.user.id }
    );
    await recordPrompt({ userId: session.user.id, kind: "SCRIPT", text: result.prompt, videoProjectId: id });

    return apiSuccess({ text: result.text });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the request and try again.", 400, {
        issues: err.issues,
      });
    }
    console.error("POST /api/videos/[id]/script/transform failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong generating that variation.", 500);
  }
}
