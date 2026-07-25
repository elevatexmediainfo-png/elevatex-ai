import { NextRequest } from "next/server";
import { z, ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireOwnedFilmProject } from "@/lib/film/access";

const selectCharacterSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("variation"), variationAssetId: z.string().min(1) }),
  z.object({ source: z.literal("face_upload") }),
]);

// POST /api/videos/film/[id]/characters/[characterId]/select — the
// Character screen's final "pick this one" action. Handles both paths:
// an AI variation (variationAssetId must be one of the 2 the character
// already has) or the user's own face upload (must already have both
// photos, from face-upload/route.ts, before this can finalize it). Either
// way this is just a status/pointer update — no generation, no charge.
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

    const body = await req.json().catch(() => ({}));
    const data = selectCharacterSchema.parse(body);

    if (data.source === "variation") {
      const variationIds = Array.isArray(character.variationAssetIds) ? (character.variationAssetIds as string[]) : [];
      if (!variationIds.includes(data.variationAssetId)) {
        return apiError("ERR_VALIDATION", "That variation doesn't belong to this character.", 400);
      }
    } else if (!character.faceUploadSideAssetId || !character.faceUploadFrontAssetId) {
      return apiError("ERR_VALIDATION", "Upload both photos before selecting them.", 400);
    }

    const updated = await prisma.filmCharacter.update({
      where: { id: characterId },
      data:
        data.source === "variation"
          ? { selectedVariationAssetId: data.variationAssetId, status: "SELECTED" }
          : { status: "SELECTED" },
    });

    return apiSuccess({ character: updated });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check your selection and try again.", 400, { issues: err.issues });
    }
    console.error("POST /api/videos/film/[id]/characters/[characterId]/select failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong saving your selection.", 500);
  }
}
