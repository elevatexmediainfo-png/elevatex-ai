import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api-response";
import { updateBrandKitSchema } from "@/lib/validations/brand-kit";
import { getStorageProvider } from "@/lib/providers/storage";

// GET /api/brand-kit — Milestone 11 Part 9. Per-user Logo/Colors/Fonts/
// Animations/Music/Outro/Watermark, applied automatically wherever the
// Talking Head pipeline needs a default (the Intelligent Asset Selector's
// LOGO tier, the Timeline's default background music) — never a second
// source of truth, just one settings row read from those call sites.
export async function GET() {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const brandKit = await prisma.brandKit.findUnique({ where: { userId: session.user.id } });

  // Milestone 14 — the Brand Kit page renders the generated logo inline, so
  // resolve its storage key to a real URL here rather than making the page
  // do a second lookup.
  let logoUrl: string | null = null;
  if (brandKit?.logoAssetId) {
    const asset = await prisma.asset.findUnique({ where: { id: brandKit.logoAssetId } });
    if (asset) {
      const storage = await getStorageProvider();
      logoUrl = storage.getPublicUrl(asset.storageKey);
    }
  }

  return apiSuccess({ brandKit, logoUrl });
}

// PATCH /api/brand-kit — upserts the caller's Brand Kit. Partial updates:
// only fields present in the body are changed; omitting a field leaves it
// untouched, an empty string clears it.
export async function PATCH(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const data = updateBrandKitSchema.parse(body);

    const fields = {
      logoAssetId: data.logoAssetId === undefined ? undefined : data.logoAssetId || null,
      introAnimationId: data.introAnimationId === undefined ? undefined : data.introAnimationId || null,
      musicAssetId: data.musicAssetId === undefined ? undefined : data.musicAssetId || null,
      outroAssetId: data.outroAssetId === undefined ? undefined : data.outroAssetId || null,
      watermarkAssetId: data.watermarkAssetId === undefined ? undefined : data.watermarkAssetId || null,
      watermarkPosition: data.watermarkPosition,
      primaryColor: data.primaryColor === undefined ? undefined : data.primaryColor || null,
      secondaryColor: data.secondaryColor === undefined ? undefined : data.secondaryColor || null,
      fontFamily: data.fontFamily === undefined ? undefined : data.fontFamily || null,
      contactPhone: data.contactPhone === undefined ? undefined : data.contactPhone || null,
      contactWhatsapp: data.contactWhatsapp === undefined ? undefined : data.contactWhatsapp || null,
      addressLine: data.addressLine === undefined ? undefined : data.addressLine || null,
      websiteOrSocial: data.websiteOrSocial === undefined ? undefined : data.websiteOrSocial || null,
    };

    const brandKit = await prisma.brandKit.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...fields },
      update: fields,
    });

    return apiSuccess({ brandKit });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the Brand Kit fields and try again.", 400, { issues: err.issues });
    }
    console.error("PATCH /api/brand-kit failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
