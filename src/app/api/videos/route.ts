import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createVideoProjectSchema } from "@/lib/validations/video";
import { generateScript } from "@/lib/generation";
import { buildScriptPrompt, languageInstruction } from "@/lib/prompt-engine";
import { getConfig } from "@/lib/admin/config";
import { createScenesFromScript } from "@/lib/scenes/engine";
import { recordProjectVersion } from "@/lib/projects/versioning";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { MAX_VIDEO_GENERATION_TOTAL_SECONDS } from "@/lib/video-generation-limits";
import type { BusinessVertical, VideoObjective } from "@/generated/prisma/enums";

// Replaces the removed "pick a template" step. Every seeded Template has
// identical platform/aspectRatio/durationSeconds/creditCost — the only
// things that ever varied were `vertical` and the tone-setting
// `promptTemplate` — and `vertical` is already mandatory on the user's own
// Profile from onboarding (see lib/validations/onboarding.ts), so the user
// was never really making a meaningful choice by picking a template card.
// Objective takes priority over vertical for the one case that's actually
// objective-driven, not vertical-driven: the seeded "Festival Greetings"
// template (vertical: OTHER, defaultObjective: FESTIVAL_GREETING) should
// win regardless of the user's own business type. Falls back to the OTHER
// template (defensive only — every real BusinessVertical value has its own
// seeded template today, this path shouldn't trigger in practice).
async function resolveTemplateForProject(objective: VideoObjective, businessVertical: BusinessVertical | null) {
  const byObjective = await prisma.template.findFirst({
    where: { isActive: true, defaultObjective: objective },
  });
  if (byObjective) return byObjective;

  if (businessVertical) {
    const byVertical = await prisma.template.findFirst({
      where: { isActive: true, vertical: businessVertical },
    });
    if (byVertical) return byVertical;
  }

  return prisma.template.findFirst({ where: { isActive: true, vertical: "OTHER" } });
}

// GET /api/videos — list the signed-in user's video projects, newest first.
export async function GET() {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const projects = await prisma.videoProject.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { template: { select: { name: true } } },
  });

  return apiSuccess({ projects });
}

// POST /api/videos — create a draft project and generate its AI script.
// Does NOT touch credits — the user reviews/edits the script before any
// credit is spent. See /api/videos/[id]/render for the billed step.
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
        "You've hit the hourly limit for script generation. Please try again later.",
        429,
        { retryAfterSeconds: rateLimit.retryAfterSeconds }
      );
    }

    const body = await req.json().catch(() => ({}));
    const data = createVideoProjectSchema.parse(body);

    const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });

    const template = await resolveTemplateForProject(data.objective, profile?.businessVertical ?? null);
    if (!template) {
      return apiError("ERR_INTERNAL", "No template available for this video type.", 500);
    }

    const prompt = `${buildScriptPrompt({
      promptTemplate: template.promptTemplate,
      vertical: template.vertical,
      objective: data.objective,
      brief: data.brief,
      businessName: profile?.businessName,
      city: profile?.city,
    })}\n\n${languageInstruction(data.contentLanguage)}`;

    const { text: script } = await generateScript(
      { prompt, contentLanguage: data.contentLanguage },
      { userId: session.user.id }
    );

    const project = await prisma.videoProject.create({
      data: {
        userId: session.user.id,
        templateId: template.id,
        title: data.title,
        objective: data.objective,
        platform: template.platform,
        aspectRatio: template.aspectRatio,
        contentLanguage: data.contentLanguage,
        brief: data.brief,
        generatedScript: script,
        status: "SCRIPT_READY",
        creditCost: template.creditCost,
      },
    });

    // Milestone 8 — scenes are created right after script generation (as
    // DRAFT, not yet render-eligible) so the Studio's Scene Editor has
    // something to edit before the user ever confirms render. See
    // lib/scenes/engine.ts; /api/videos/[id]/render no longer creates them.
    const [negativePrompt, backgroundMusicUrl] = await Promise.all([
      getConfig("DEFAULT_NEGATIVE_PROMPT"),
      getConfig("DEFAULT_BACKGROUND_MUSIC_URL"),
    ]);
    // Hard cap (2026-07-24) — every seeded Template's durationSeconds is 30,
    // over MAX_VIDEO_GENERATION_TOTAL_SECONDS; clamped here rather than in
    // allocateSceneDurations() itself so the cap lives in one shared place
    // (lib/video-generation-limits.ts), not duplicated per caller.
    const cappedTemplateDurationSeconds = Math.min(template.durationSeconds, MAX_VIDEO_GENERATION_TOTAL_SECONDS);
    const sceneCount = await createScenesFromScript(
      {
        id: project.id,
        generatedScript: script,
        templateDurationSeconds: cappedTemplateDurationSeconds,
        userId: session.user.id,
        useSceneSplit: template.useSceneSplit,
      },
      { negativePrompt, backgroundMusicUrl }
    );
    // useSceneSplit scenes are always a fixed 8s each (Veo Lite's real
    // output length) — the LLM decides scene count (3-5), so the project's
    // total duration is a RESULT of that split, not template.durationSeconds
    // driving it, unlike the proportional-allocation flow below.
    if (template.useSceneSplit) {
      await prisma.videoProject.update({
        where: { id: project.id },
        data: { durationSeconds: sceneCount * 8 },
      });
    }
    await recordProjectVersion(project.id, session.user.id);

    return apiSuccess({ project }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the form and try again.", 400, {
        issues: err.issues,
      });
    }
    console.error("POST /api/videos failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong generating your script.", 500);
  }
}
