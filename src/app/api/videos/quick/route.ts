import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getStorageProvider } from "@/lib/providers/storage";
import { createQuickVideoProjectSchema } from "@/lib/validations/video";
import { buildQuickVideoPrompt } from "@/lib/creative/quick-video-prompt";
import { generateVeoLiteVideo, VeoLiteVideoError } from "@/lib/creative/veo-lite-video";
import { InsufficientCreditsError } from "@/lib/credits/engine";
import { InsufficientTierError, UnknownVideoActionError } from "@/lib/credits/video-actions";

// POST /api/videos/quick — 4-option restructure Step 3. The 5-question
// Quick Video form's only server step: build a natural-sentence prompt from
// the answers, then call generateVeoLiteVideo() as-is (same function AI
// Video's old wizard used per-scene) — no VideoProject/Scene/Template
// involved, same "just an Asset" shape as generateAnimatedPosterVideo(),
// whose route this one mirrors exactly. All credit/tier logic already lives
// inside generateVeoLiteVideo() (checkVideoActionAccess precheck, charge
// only after a real render succeeds) — this route does no credit checking
// of its own, it just maps each thrown error to a response.
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const data = createQuickVideoProjectSchema.parse(body);

    const { prompt, negativePrompt } = buildQuickVideoPrompt(data);

    const result = await generateVeoLiteVideo({
      userId: session.user.id,
      prompt,
      negativePrompt,
      aspectRatio: data.aspectRatio,
      preferredProviderId: typeof body.preferredProviderId === "string" ? body.preferredProviderId : undefined,
      spokenLine: data.speechEnabled && data.spokenLine ? data.spokenLine : undefined,
    });

    const storage = await getStorageProvider();
    return apiSuccess(
      {
        assetId: result.assetId,
        videoUrl: storage.getPublicUrl(result.storageKey),
        creditsCharged: result.creditsCharged,
        isMockFallback: result.isMockFallback,
        providerId: result.providerId,
        // Real-resilience signal (2026-07-25) — non-null when speech was
        // requested but no real VOICE provider could produce it, so the
        // client can show an honest "no narration" notice instead of
        // silently treating a voice-less video as fully successful.
        narrationSkippedReason: result.narrationSkippedReason,
      },
      201
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please tell us what the video is about.", 400, { issues: err.issues });
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
    if (err instanceof UnknownVideoActionError || err instanceof VeoLiteVideoError) {
      return apiError("ERR_INVALID_STATE", err.message, 400);
    }
    console.error("POST /api/videos/quick failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong generating your video.", 500);
  }
}
