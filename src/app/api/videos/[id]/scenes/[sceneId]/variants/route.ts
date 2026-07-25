import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { scriptVariantsSchema } from "@/lib/validations/video";
import { runScriptVariants } from "@/lib/ai/script-studio";
import { recordPrompt } from "@/lib/prompts/service";
import { checkRateLimit } from "@/lib/security/rate-limit";

// POST /api/videos/[id]/scenes/[sceneId]/variants — AI Marketing
// Assistant's one-click "Improve Hook"/"Improve CTA" (Part 8), scoped to a
// single scene rather than the whole script. Reuses the exact same
// generator as Script Studio's project-level POST .../script/variants
// (runScriptVariants — no new prompt-building code), since a Talking Head
// scene's spoken words can't be rewritten in place (the video already says
// what it says) — these are alternative on-screen text/caption lines the
// user can apply via the existing scene PATCH (subtitleText/visualType),
// not a rewrite of the scene's underlying transcript text.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, sceneId } = await params;

  try {
    const rateLimit = await checkRateLimit("ai_assistant", session.user.id);
    if (!rateLimit.allowed) {
      return apiError("ERR_RATE_LIMIT", "Too many AI actions. Please try again later.", 429, {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const body = await req.json().catch(() => ({}));
    const data = scriptVariantsSchema.parse(body);

    const project = await prisma.videoProject.findFirst({ where: { id, userId: session.user.id } });
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Video project not found.", 404);
    }

    const scene = await prisma.scene.findFirst({ where: { id: sceneId, videoProjectId: id } });
    if (!scene) {
      return apiError("ERR_NOT_FOUND", "Scene not found in this project.", 404);
    }

    const result = await runScriptVariants(
      scene.prompt,
      data.kind,
      data.count ?? 3,
      project.contentLanguage as never,
      { videoProjectId: id, userId: session.user.id, sceneId }
    );
    await recordPrompt({ userId: session.user.id, kind: "SCRIPT", text: result.prompt, videoProjectId: id, sceneId });

    return apiSuccess({ variants: result.variants });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the request and try again.", 400, { issues: err.issues });
    }
    console.error("POST /api/videos/[id]/scenes/[sceneId]/variants failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong generating variants.", 500);
  }
}
