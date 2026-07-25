import { NextRequest } from "next/server";
import { z, ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireOwnedFilmProject } from "@/lib/film/access";

const faceUploadSchema = z.object({
  sideAssetId: z.string().min(1),
  frontAssetId: z.string().min(1),
});

// POST /api/videos/film/[id]/characters/[characterId]/face-upload — the
// Character screen's alternative to AI variations: the user uploads their
// own side + front photos (via the existing generic presigned-upload flow,
// POST /api/assets/upload-url -> confirm-upload, same pattern
// create/talking-head/page.tsx already uses) and this just attaches the two
// resulting Asset ids to the FilmCharacter row. No generation, no credit
// charge — genuinely free and fully functional today, unlike the
// AI-variations route next to it.
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
    const data = faceUploadSchema.parse(body);

    const [sideAsset, frontAsset] = await Promise.all([
      prisma.asset.findFirst({ where: { id: data.sideAssetId, userId: session.user.id, kind: "IMAGE", status: "READY" } }),
      prisma.asset.findFirst({ where: { id: data.frontAssetId, userId: session.user.id, kind: "IMAGE", status: "READY" } }),
    ]);
    if (!sideAsset || !frontAsset) {
      return apiError("ERR_VALIDATION", "Both photos must finish uploading first.", 400);
    }

    const updated = await prisma.filmCharacter.update({
      where: { id: characterId },
      data: {
        faceUploadSideAssetId: sideAsset.id,
        faceUploadFrontAssetId: frontAsset.id,
        status: "FACE_UPLOADED",
      },
    });

    return apiSuccess({ character: updated });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the uploaded photos and try again.", 400, { issues: err.issues });
    }
    console.error("POST /api/videos/film/[id]/characters/[characterId]/face-upload failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong saving the uploaded photos.", 500);
  }
}
