import { NextRequest } from "next/server";
import { ZodError, z } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getStorageProvider } from "@/lib/providers/storage";
import {
  generateAnimatedPosterVideo,
  AnimatedPosterVideoError,
} from "@/lib/creative/animated-poster-video";
import { InsufficientCreditsError } from "@/lib/credits/engine";
import { InsufficientTierError, UnknownVideoActionError } from "@/lib/credits/video-actions";

const bodySchema = z.object({
  posterAssetId: z.string().min(1),
});

// POST /api/videos/animated-poster — 4-option restructure Step 3. The one
// real gap generateAnimatedPosterVideo() had: it's existed since Phase 1,
// verified live, but had zero HTTP surface — this is the first UI-facing
// route calling it. All credit/tier logic already lives inside that
// function (precheck via checkVideoActionAccess before any render compute
// is spent, charge only after the export actually completes) — this route
// does no credit checking of its own, it just maps each thrown error to a
// response.
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const data = bodySchema.parse(body);

    const result = await generateAnimatedPosterVideo({
      userId: session.user.id,
      posterAssetId: data.posterAssetId,
    });

    const storage = await getStorageProvider();
    return apiSuccess(
      {
        assetId: result.assetId,
        videoUrl: storage.getPublicUrl(result.storageKey),
        creditsCharged: result.creditsCharged,
      },
      201
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please pick a poster to animate.", 400, { issues: err.issues });
    }
    if (err instanceof InsufficientTierError) {
      return apiError("ERR_INSUFFICIENT_TIER", err.message, 403);
    }
    if (err instanceof InsufficientCreditsError) {
      return apiError(
        "ERR_INSUFFICIENT_CREDITS",
        `You need ${err.required} credit(s) but only have ${err.available}. Buy more credits to continue.`,
        402
      );
    }
    if (err instanceof UnknownVideoActionError || err instanceof AnimatedPosterVideoError) {
      return apiError("ERR_INVALID_STATE", err.message, 400);
    }
    console.error("POST /api/videos/animated-poster failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong animating your poster.", 500);
  }
}
