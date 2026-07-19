import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { resolveAbsoluteUrl } from "@/lib/providers/storage/absolute-url";
import { checkVideoActionAccess, InsufficientTierError } from "@/lib/credits/video-actions";
import { consumeCredits, InsufficientCreditsError } from "@/lib/credits/engine";
import { generateScript } from "@/lib/generation/llm";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";
import { requireOwnedFilmProject } from "@/lib/film/access";
import { resolveFilmCharacterReferenceAssetId } from "@/lib/film/types";

// POST /api/videos/film/[id]/characters/[characterId]/sheet — the Character
// Sheet screen's generation action. Real, functional code: sends the
// character's chosen portrait (AI variation or uploaded front photo) to a
// vision-capable LLM and asks for a structured written description (build,
// face, hair, outfit, distinguishing features) — the kind of thing a real
// film crew's character sheet documents.
//
// Founder decision (2026-07-12): the PHOTO, not this text, is what actually
// holds a character consistent across scenes — text alone lets the video
// model re-invent the face each time. This route's output is supplementary
// prompt detail only; the real consistency mechanism is the same stored
// reference photo (resolveFilmCharacterReferenceAssetId()) being passed as
// per-scene generation's startImage (Variant B / reference-image
// anchoring) — see scenes/[sceneId]/generate/route.ts. Built today per the
// founder's plan but not triggered — same reasoning as variations/route.ts.
const CHARACTER_SHEET_SYSTEM_PROMPT =
  "You are a film production assistant writing a character reference sheet from a photo. " +
  "Respond with ONLY a JSON object with these string fields: build, face, hair, outfit, " +
  "distinguishingFeatures, colorPalette. Keep each field to one concise sentence, describing " +
  "exactly what is visible in the photo — do not invent details you can't see.";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; characterId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, characterId } = await params;

  try {
    const project = await requireOwnedFilmProject(session.user.id, id);
    if (!project) {
      return apiError("ERR_NOT_FOUND", "Film project not found.", 404);
    }

    const character = await prisma.filmCharacter.findFirst({ where: { id: characterId, videoProjectId: id } });
    if (!character) {
      return apiError("ERR_NOT_FOUND", "Character not found.", 404);
    }

    const referenceAssetId = resolveFilmCharacterReferenceAssetId(character);
    if (!referenceAssetId) {
      return apiError("ERR_VALIDATION", "Select a character (a variation or an uploaded photo) first.", 400);
    }

    const referenceAsset = await prisma.asset.findFirst({ where: { id: referenceAssetId, userId: session.user.id } });
    if (!referenceAsset) {
      return apiError("ERR_NOT_FOUND", "The character's reference photo couldn't be found.", 404);
    }

    const { credits } = await checkVideoActionAccess(session.user.id, "film");
    const storage = await getStorageProvider();
    const imageUrl = resolveAbsoluteUrl(storage.getPublicUrl(referenceAsset.storageKey));

    const result = await generateScript(
      {
        prompt: "Describe this character for a film character reference sheet.",
        contentLanguage: "EN",
        systemPrompt: CHARACTER_SHEET_SYSTEM_PROMPT,
        imageUrl,
        responseFormat: "json",
      },
      { userId: session.user.id, videoProjectId: id },
      "film_character_sheet"
    );

    let characterSheet: unknown;
    try {
      characterSheet = JSON.parse(result.text);
    } catch {
      return apiError("ERR_INTERNAL", "The character sheet came back in an unexpected format.", 500);
    }

    // Fixed 2026-07-19 — this used to charge credits regardless of whether
    // the real vision LLM chain was exhausted, unlike every other
    // mock-fallback path in this codebase (generateVeoLiteVideo(),
    // renderTalkingHeadScene(), generateFilmSceneVideo() itself). Also now
    // surfaces isMockFallback in the response so the UI can warn the user,
    // same as Quick Video/Film Scene already do — previously silent here,
    // which mattered in practice: the doubled /uploads/uploads/ bug (fixed
    // this session) made every face-uploaded character's photo URL
    // unfetchable by the real vision provider, silently landing on a fake
    // mock sheet. generateScript()'s declared return type doesn't carry
    // providerId (unlike renderVideo()'s VideoRenderResultWithProvider) even
    // though runGeneration() always attaches it at runtime — cast scoped to
    // this call site rather than widening the shared LLMGenerateResult type,
    // which several existing test mocks construct without providerId.
    const isMockFallback = (result as typeof result & { providerId: string }).providerId === MOCK_PROVIDER_ID;
    if (credits > 0 && !isMockFallback) {
      await consumeCredits({
        userId: session.user.id,
        amount: credits,
        type: "AI_GENERATION",
        description: "AI Film character sheet",
        videoProjectId: id,
      });
    }

    const updated = await prisma.filmCharacter.update({
      where: { id: characterId },
      data: { characterSheet: characterSheet as object, status: "SHEET_READY" },
    });

    return apiSuccess({ character: updated, isMockFallback });
  } catch (err) {
    if (err instanceof InsufficientTierError) {
      return apiError("ERR_TIER_REQUIRED", err.message, 403);
    }
    if (err instanceof InsufficientCreditsError) {
      return apiError("ERR_INSUFFICIENT_CREDITS", err.message, 402);
    }
    console.error("POST /api/videos/film/[id]/characters/[characterId]/sheet failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong generating the character sheet.", 500);
  }
}
