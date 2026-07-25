import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listEnabledProviderConfigs } from "@/lib/providers/credentials";
import { PROVIDER_CATALOGUE } from "@/lib/admin/ai-providers";
import { resolveVideoProviderCredits } from "@/lib/credits/video-actions";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";

// GET /api/videos/providers?baseCredits=20 — real, live-queried list of
// currently enabled VIDEO providers for the user-facing provider selector
// (never hardcoded — a provider disabled in Admin stops appearing here
// automatically, the same instant, no separate list to keep in sync).
// `baseCredits` is the calling flow's own normal cost (e.g. veo_lite's 20,
// film_scene's 131, or a Marketing Template's own creditCost) — this route
// doesn't need to know which flow is asking, only what to fall back to when
// no admin override exists for a given provider.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  const baseCreditsRaw = req.nextUrl.searchParams.get("baseCredits");
  const baseCredits = Number(baseCreditsRaw);
  if (!baseCreditsRaw || !Number.isFinite(baseCredits) || baseCredits < 0) {
    return apiError("ERR_VALIDATION", "baseCredits query param is required and must be a non-negative number.", 400);
  }

  const enabledIds = (await listEnabledProviderConfigs("VIDEO")).filter((id) => id !== MOCK_PROVIDER_ID);

  const providers = await Promise.all(
    enabledIds.map(async (id) => ({
      id,
      label: PROVIDER_CATALOGUE.find((e) => e.category === "VIDEO" && e.providerId === id)?.label ?? id,
      credits: await resolveVideoProviderCredits(baseCredits, id),
    }))
  );

  return apiSuccess({ providers, defaultProviderId: providers[0]?.id ?? null });
}
