import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createFilmProjectSchema } from "@/lib/validations/video";
import { prisma } from "@/lib/prisma";
import { recordProjectVersion } from "@/lib/projects/versioning";
import { checkRateLimit } from "@/lib/security/rate-limit";

// POST /api/videos/film — AI Film's Input screen (idea/duration/character-
// count/style/aspect-ratio -> "Generate Film"). Third VideoProject creation
// path alongside POST /api/videos (GENERATED) and POST /api/videos/talking-head
// (TALKING_HEAD_UPLOAD). Free, like both of those — only creates the
// project + its FilmCharacter slots; nothing billable happens until a real
// generation step runs (character variations, sheet, storyboard, or
// per-scene video), each gated by checkVideoActionAccess() at its own route.
//
// objective/platform are required, non-nullable VideoProject columns with
// no natural Film equivalent (Film has no "objective" or "platform" picker
// — see the founder's own listed Input fields). Rather than loosen those
// columns' nullability and risk the GENERATED flow's existing code paths,
// this fills fixed constants, the same reasoning TALKING_HEAD_UPLOAD
// already applies to fields that don't fit its flow either.
const FILM_DEFAULT_OBJECTIVE = "BRAND_AWARENESS" as const;
const FILM_DEFAULT_PLATFORM = "INSTAGRAM_REEL" as const;

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
    const data = createFilmProjectSchema.parse(body);

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.videoProject.create({
        data: {
          userId: session.user.id,
          sourceType: "FILM",
          title: data.title,
          objective: FILM_DEFAULT_OBJECTIVE,
          platform: FILM_DEFAULT_PLATFORM,
          aspectRatio: data.aspectRatio,
          status: "DRAFT",
          brief: {
            idea: data.idea,
            style: data.style,
            totalDurationSeconds: data.durationSeconds,
            characterCount: data.characterCount,
          },
        },
      });

      await tx.filmCharacter.createMany({
        data: Array.from({ length: data.characterCount }, (_, slotIndex) => ({
          videoProjectId: created.id,
          slotIndex,
          status: "PENDING" as const,
        })),
      });

      return created;
    });

    await recordProjectVersion(project.id, session.user.id);

    const characters = await prisma.filmCharacter.findMany({
      where: { videoProjectId: project.id },
      orderBy: { slotIndex: "asc" },
    });

    return apiSuccess({ project, characters }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the form and try again.", 400, { issues: err.issues });
    }
    console.error("POST /api/videos/film failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong creating your project.", 500);
  }
}
