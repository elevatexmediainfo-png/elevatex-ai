import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { generateBrandPaletteSchema } from "@/lib/validations/brand-kit";
import { generateBrandPalette } from "@/lib/brand-kit/identity-engine";
import { CreativeToolDisabledError } from "@/lib/creative/engine";
import { InsufficientCreditsError } from "@/lib/credits/engine";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  try {
    const rateLimit = await checkRateLimit("creative_create", session.user.id);
    if (!rateLimit.allowed) {
      return apiError("ERR_RATE_LIMIT", "You've hit the hourly limit for creative generation. Please try again later.", 429, {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const body = await req.json().catch(() => ({}));
    const data = generateBrandPaletteSchema.parse(body);
    const brandKit = await generateBrandPalette(session.user.id, data);

    return apiSuccess({ brandKit }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the form and try again.", 400, { issues: err.issues });
    }
    if (err instanceof CreativeToolDisabledError) {
      return apiError("ERR_TOOL_DISABLED", err.message, 403);
    }
    if (err instanceof InsufficientCreditsError) {
      return apiError(
        "ERR_INSUFFICIENT_CREDITS",
        `You need ${err.required} credit(s) but only have ${err.available}. Buy more credits to continue.`,
        402
      );
    }
    console.error("POST /api/brand-kit/generate/palette failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong generating your palette.", 500);
  }
}
