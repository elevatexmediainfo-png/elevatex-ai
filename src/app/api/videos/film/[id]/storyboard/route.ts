import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { checkVideoActionAccess, InsufficientTierError } from "@/lib/credits/video-actions";
import { consumeCredits, InsufficientCreditsError } from "@/lib/credits/engine";
import { requireOwnedFilmProject } from "@/lib/film/access";
import { parseFilmBrief } from "@/lib/film/types";
import { splitFilmIntoStoryboard, clampSceneDuration, FilmStoryboardError } from "@/lib/creative/film-storyboard";
import { generateFilmScenePreview } from "@/lib/creative/film-storyboard-preview";
import { resolveFilmCharacterReferenceAssetId } from "@/lib/film/types";

// POST /api/videos/film/[id]/storyboard — the Storyboard screen's generation
// action. Real, functional code: plans the full scene sequence from the
// film's idea + each character's sheet, then creates ordinary Scene rows
// (reusing the exact model every other VideoProject flow uses — see this
// project's own schema.prisma comment on why Film deliberately isn't a
// parallel model). Requires every character to have reached SHEET_READY
// first, matching the founder's own listed screen order (character sheet
// before storyboard). Built today, not triggered — same reasoning as every
// other real generation route in this flow.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const project = await requireOwnedFilmProject(session.user.id, id);
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Film project not found.", 404);
    }

    const existingScenes = await prisma.scene.count({ where: { videoProjectId: id } });
    if (existingScenes > 0) {
      return apiError("ERR_VALIDATION", "This film already has a storyboard.", 400);
    }

    const characters = await prisma.filmCharacter.findMany({
      where: { videoProjectId: id },
      orderBy: { slotIndex: "asc" },
    });
    if (characters.length === 0 || characters.some((c) => c.status !== "SHEET_READY")) {
      return apiError("ERR_VALIDATION", "Every character needs a character sheet before the storyboard.", 400);
    }

    const { credits } = await checkVideoActionAccess(session.user.id, "film");
    const brief = parseFilmBrief(project.brief);

    const storyboard = await splitFilmIntoStoryboard({
      userId: session.user.id,
      videoProjectId: id,
      idea: brief.idea,
      style: brief.style,
      totalDurationSeconds: brief.totalDurationSeconds,
      characters: characters.map((c) => ({ slotIndex: c.slotIndex, name: c.name, characterSheet: c.characterSheet })),
    });

    const characterIdBySlot = new Map(characters.map((c) => [c.slotIndex, c.id]));

    if (credits > 0) {
      await consumeCredits({
        userId: session.user.id,
        amount: credits,
        type: "AI_GENERATION",
        description: "AI Film storyboard",
        videoProjectId: id,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.scene.createMany({
        data: storyboard.scenes.map((scene, i) => ({
          videoProjectId: id,
          order: i,
          prompt: scene.visualPrompt,
          videoPrompt: scene.visualPrompt,
          imagePrompt: scene.visualPrompt,
          spokenLine: scene.spokenLine,
          durationSeconds: clampSceneDuration(scene.durationSeconds),
          filmCharacterId: scene.characterSlotIndex !== null ? (characterIdBySlot.get(scene.characterSlotIndex) ?? null) : null,
        })),
      });
      await tx.videoProject.update({ where: { id }, data: { status: "SCRIPT_READY" } });
    });

    const scenes = await prisma.scene.findMany({ where: { videoProjectId: id }, orderBy: { order: "asc" } });

    // Real, cheap preview image per scene (2026-07-24) — generated here,
    // right after the storyboard is planned, so the review screen shows a
    // real thumbnail instead of text-only. Reuses the same character-
    // reference resolution generate-scene.ts uses for the real (expensive)
    // video render, so the preview and the eventual video are conditioned
    // consistently. Fully non-blocking per scene (Promise.allSettled, not
    // Promise.all): a failed/degraded preview for one scene must never fail
    // the whole storyboard response — the founder already has real video
    // credits reserved and scenes committed by this point.
    const characterById = new Map(characters.map((c) => [c.id, c]));
    const previewResults = await Promise.allSettled(
      scenes.map((scene) => {
        const character = scene.filmCharacterId ? characterById.get(scene.filmCharacterId) : null;
        const startImageAssetId = character ? (resolveFilmCharacterReferenceAssetId(character) ?? undefined) : undefined;
        return generateFilmScenePreview({
          userId: session.user.id,
          videoProjectId: id,
          sceneId: scene.id,
          prompt: scene.videoPrompt ?? scene.prompt,
          aspectRatio: project.aspectRatio as "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9",
          startImageAssetId,
        });
      })
    );
    for (const [i, result] of previewResults.entries()) {
      if (result.status === "fulfilled" && result.value.previewImageKey) {
        scenes[i].previewImageKey = result.value.previewImageKey;
      } else if (result.status === "rejected") {
        console.error(`Unexpected error generating storyboard preview for scene ${scenes[i].id}`, result.reason);
      }
    }

    return apiSuccess({ scenes }, 201);
  } catch (err) {
    if (err instanceof InsufficientTierError) {
      return apiError("ERR_TIER_REQUIRED", err.message, 403);
    }
    if (err instanceof InsufficientCreditsError) {
      return apiError("ERR_INSUFFICIENT_CREDITS", err.message, 402);
    }
    if (err instanceof FilmStoryboardError) {
      return apiError("ERR_INTERNAL", "Couldn't plan the storyboard. Please try again.", 500);
    }
    console.error("POST /api/videos/film/[id]/storyboard failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong generating the storyboard.", 500);
  }
}
