import { NextRequest } from "next/server";

import type { FilmCharacterStatus } from "@/generated/prisma/client";
import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { toBuffer } from "@/lib/image/fetch-bytes";
import { recordAsset } from "@/lib/assets/service";
import { checkVideoActionAccess, InsufficientTierError } from "@/lib/credits/video-actions";
import { consumeCredits, InsufficientCreditsError } from "@/lib/credits/engine";
import { generateImage } from "@/lib/generation/image";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";
import { requireOwnedFilmProject } from "@/lib/film/access";
import { parseFilmBrief } from "@/lib/film/types";
import { buildFilmCharacterPrompt } from "@/lib/creative/film-character-prompt";
import { generateFilmCastBreakdown, FilmCastBreakdownError } from "@/lib/creative/film-cast-breakdown";

class FilmCharacterMockFallbackError extends Error {}

// POST /api/videos/film/[id]/characters/[characterId]/variations — the
// Character screen's "generate 2 variations" action. Real, functional
// generation code — built today per the founder's plan but deliberately
// NOT triggered by me; the founder runs this himself once tomorrow's
// Veo/Gemini quota resets, same as every other generation call in this flow.
//
// Two founder-reported bugs fixed here (2026-07-12):
//
// 1. "All 3 characters come out as the same TYPE" — this used to build
// every character's prompt from the film's whole shared idea, so every
// slot rendered as the story's protagonist type (e.g. 3 elderly vendors for
// a story about an elderly vendor). Fixed with a "cast breakdown": the
// first time ANY character in a project requests variations, one real LLM
// call (generateFilmCastBreakdown()) reads the story idea and proposes N
// deliberately DIFFERENT characters (age/gender/role), persisted onto each
// FilmCharacter.castDescription — a project-level, one-time cost, not
// per-character. Later characters in the same project reuse the already-
// persisted breakdown instead of re-running it.
//
// 2. "The 2 variations are 2 different people, not the same person in 2
// poses" — variant B used to be an independent Promise.all() sample with no
// connection to variant A at all. Fixed by generating sequentially and
// attaching variant A's own image bytes as ImageGenerateRequest.referenceImage
// for variant B's call — Gemini's confirmed multimodal image-conditioning
// input (see gemini-images.provider.ts's doc comment). Only genuinely
// reference-conditioned on providers that support it (gemini_images, the
// only enabled one today); other providers silently ignore the field and
// fall back to an independent sample, same "unsupported where absent"
// contract negativePrompt already has.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; characterId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, characterId } = await params;

  // Real bug fix (2026-07-24, found live during the codebase health check)
  // — this route had no concurrency guard: a double-click fired two real
  // Gemini calls (variant A + B, each) and two consumeCredits() charges for
  // one logical action, with the second filmCharacter.update() silently
  // overwriting the first's variationAssetIds (an orphaned, paid-for pair
  // of images). Tracked outside the try block so the catch handler below
  // can always revert the claim on any failure, regardless of which error
  // branch triggered it.
  let claimedFromStatus: FilmCharacterStatus | null = null;

  try {
    const project = await requireOwnedFilmProject(session.user.id, id);
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Film project not found.", 404);
    }

    let character = await prisma.filmCharacter.findFirst({ where: { id: characterId, videoProjectId: id } });
    if (!character) {
      return apiError("ERR_NOT_FOUND", "Character not found.", 404);
    }

    // Atomic claim — a single conditional UPDATE...WHERE (same "claim"
    // pattern as exports.ts's claimNextExport()/scenes/[sceneId]/generate's
    // own matching fix), so only one of two truly concurrent requests can
    // ever flip `count` to 1; the loser gets a clean 409 instead of firing
    // a second real generation. "Regenerate variations" on an already-
    // VARIATIONS_READY character is a deliberate, supported action (see
    // this screen's own "Regenerate variations" label), so every status
    // except the in-progress one itself is claimable.
    const previousStatus = character.status;
    const claimed = await prisma.filmCharacter.updateMany({
      where: { id: characterId, status: { not: "GENERATING_VARIATIONS" } },
      data: { status: "GENERATING_VARIATIONS" },
    });
    if (claimed.count === 0) {
      return apiError("ERR_INVALID_STATE", "Variations are already being generated for this character.", 409);
    }
    claimedFromStatus = previousStatus;

    const { credits } = await checkVideoActionAccess(session.user.id, "film");
    const brief = parseFilmBrief(project.brief);

    // Cast breakdown — a project-level, once-only step. If this character
    // (or, defensively, any sibling) has no cast description yet, the whole
    // project's breakdown hasn't run — do it now, for every character at
    // once, so slot 2's request doesn't redo work slot 0's request already
    // paid the LLM-call cost for.
    if (!character.castDescription) {
      const allCharacters = await prisma.filmCharacter.findMany({ where: { videoProjectId: id }, orderBy: { slotIndex: "asc" } });
      const stillMissing = allCharacters.filter((c) => !c.castDescription);
      if (stillMissing.length > 0) {
        const breakdown = await generateFilmCastBreakdown({
          userId: session.user.id,
          videoProjectId: id,
          idea: brief.idea,
          style: brief.style,
          characterCount: brief.characterCount,
        });
        const bySlot = new Map(breakdown.characters.map((c) => [c.slotIndex, c]));
        await prisma.$transaction(
          allCharacters.map((c) => {
            const cast = bySlot.get(c.slotIndex);
            return prisma.filmCharacter.update({
              where: { id: c.id },
              data: cast ? { name: cast.role, castDescription: cast.description } : {},
            });
          })
        );
      }
      character = await prisma.filmCharacter.findUniqueOrThrow({ where: { id: characterId } });
    }

    const characterDescription = character.castDescription ?? brief.idea;

    const storage = await getStorageProvider();
    const assetIds: string[] = [];

    // Sequential, not Promise.all — variant B needs variant A's actual
    // bytes to condition on, so it genuinely can't start until A finishes.
    const variantAResult = await generateImage(
      {
        prompt: buildFilmCharacterPrompt({
          filmIdea: brief.idea,
          characterDescription,
          style: brief.style,
          slotIndex: character.slotIndex,
          variantSeed: "A",
          hasReferenceImage: false,
        }),
        aspectRatio: "RATIO_1_1",
      },
      "film_character",
      { userId: session.user.id, videoProjectId: id }
    );
    // Fixed (2026-07-24) — variant A/B were never checked against
    // MOCK_PROVIDER_ID, unlike FILM's own scene-video generation
    // (film-scene-video.ts's isMockFallback guard) and character SHEET
    // generation (sheet/route.ts's own MOCK_PROVIDER_ID check) — a real,
    // inconsistent gap in the same feature. A mock result here would
    // persist MockImageProvider's canned sample as if it were the
    // character's real reference photo, then get used as real
    // reference-image conditioning for the video FILM later generates.
    if (variantAResult.providerId === MOCK_PROVIDER_ID) {
      throw new FilmCharacterMockFallbackError(
        "Character variation used the placeholder provider, not a real one — no IMAGE provider is currently enabled and reachable. Check Admin → AI Providers, then try again."
      );
    }
    const variantABytes = await toBuffer(variantAResult.imageUrl);
    const variantAUploaded = await storage.upload({
      key: `film/${id}/characters/${characterId}/variation-0.jpg`,
      data: variantABytes.buffer,
      contentType: variantABytes.contentType || "image/jpeg",
    });
    const variantAAsset = await recordAsset({
      userId: session.user.id,
      kind: "IMAGE",
      source: "AI_GENERATED",
      storageKey: variantAUploaded.key,
      label: `Character ${character.slotIndex + 1} — variation 1`,
      videoProjectId: id,
    });
    assetIds.push(variantAAsset.id);

    const variantBResult = await generateImage(
      {
        prompt: buildFilmCharacterPrompt({
          filmIdea: brief.idea,
          characterDescription,
          style: brief.style,
          slotIndex: character.slotIndex,
          variantSeed: "B",
          hasReferenceImage: true,
        }),
        aspectRatio: "RATIO_1_1",
        referenceImage: { mimeType: variantABytes.contentType || "image/jpeg", data: variantABytes.buffer.toString("base64") },
      },
      "film_character",
      { userId: session.user.id, videoProjectId: id }
    );
    if (variantBResult.providerId === MOCK_PROVIDER_ID) {
      throw new FilmCharacterMockFallbackError(
        "Character variation used the placeholder provider, not a real one — no IMAGE provider is currently enabled and reachable. Check Admin → AI Providers, then try again."
      );
    }
    const variantBBytes = await toBuffer(variantBResult.imageUrl);
    const variantBUploaded = await storage.upload({
      key: `film/${id}/characters/${characterId}/variation-1.jpg`,
      data: variantBBytes.buffer,
      contentType: variantBBytes.contentType || "image/jpeg",
    });
    const variantBAsset = await recordAsset({
      userId: session.user.id,
      kind: "IMAGE",
      source: "AI_GENERATED",
      storageKey: variantBUploaded.key,
      label: `Character ${character.slotIndex + 1} — variation 2`,
      videoProjectId: id,
    });
    assetIds.push(variantBAsset.id);

    if (credits > 0) {
      await consumeCredits({
        userId: session.user.id,
        amount: credits,
        type: "AI_GENERATION",
        description: "AI Film character variations",
        videoProjectId: id,
      });
    }

    const updated = await prisma.filmCharacter.update({
      where: { id: characterId },
      data: { variationAssetIds: assetIds, status: "VARIATIONS_READY" },
    });

    return apiSuccess({ character: updated });
  } catch (err) {
    // Same "every failure path leaves a real, retriable terminal state"
    // rule generate-scene.ts's own catch block already documents — without
    // this, any failure after a successful claim (insufficient credits, a
    // mock-fallback throw, a real provider error) would leave the character
    // stuck at GENERATING_VARIATIONS forever, permanently blocking both the
    // "Regenerate variations" button and any future retry (its own claim
    // guard would treat the stuck row as a live run).
    if (claimedFromStatus !== null) {
      await prisma.filmCharacter.update({ where: { id: characterId }, data: { status: claimedFromStatus } }).catch(() => {});
    }
    if (err instanceof InsufficientTierError) {
      return apiError("ERR_TIER_REQUIRED", err.message, 403);
    }
    if (err instanceof InsufficientCreditsError) {
      return apiError("ERR_INSUFFICIENT_CREDITS", err.message, 402);
    }
    if (err instanceof FilmCastBreakdownError) {
      return apiError("ERR_INTERNAL", "Couldn't plan the film's cast. Please try again.", 500);
    }
    if (err instanceof FilmCharacterMockFallbackError) {
      return apiError("ERR_MOCK_FALLBACK", err.message, 502);
    }
    console.error("POST /api/videos/film/[id]/characters/[characterId]/variations failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong generating character variations.", 500);
  }
}
