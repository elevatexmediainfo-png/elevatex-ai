import { NextRequest } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { InsufficientCreditsError } from "@/lib/credits/engine";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import {
  generateFromMarketingTemplate,
  MarketingTemplateNotReadyError,
  MarketingTemplateMockFallbackError,
  MissingUserAssetError,
} from "@/lib/marketing-templates/generate";

// Migration v3 (2026-08-02) — no more filledFields/preferredProviderId. The
// Master Prompt is never user-editable, and the provider is always
// admin-locked to the template (Primary -> Fallback -> Error, resolved
// entirely server-side) — the user only ever supplies their own asset.
const generateSchema = z.object({
  userAssetId: z.string().trim().min(1).optional(),
});

// POST /api/marketing-templates/[id]/generate — real generation: sends the
// template's own Master Prompt verbatim, conditions on the template's
// ordered reference assets + the user's own uploaded asset, calls the
// real generation provider (Primary, then Fallback), lands the output as a
// real EditorAsset. Hard-fails on a mock-fallback result (same standard as
// VIDEO/VOICE/FILM this session) rather than silently persisting
// placeholder content.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "Invalid request.", 400, { issues: parsed.error.issues });
  }

  try {
    const result = await generateFromMarketingTemplate({
      userId: session.user.id,
      templateId: id,
      userAssetId: parsed.data.userAssetId,
    });

    // Resolved here (not inside generateFromMarketingTemplate() itself) —
    // that function's return value is a clean domain result, resolving a
    // display URL is this HTTP layer's own concern.
    const editorAsset = await prisma.editorAsset.findUniqueOrThrow({ where: { id: result.editorAssetId }, select: { storageKey: true } });
    const storage = await getStorageProvider();
    const resultUrl = storage.getPublicUrl(editorAsset.storageKey);

    return apiSuccess({ ...result, resultUrl }, 201);
  } catch (err) {
    if (err instanceof MarketingTemplateNotReadyError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    if (err instanceof MissingUserAssetError) {
      return apiError("ERR_VALIDATION", err.message, 400);
    }
    if (err instanceof InsufficientCreditsError) {
      return apiError("ERR_INSUFFICIENT_CREDITS", err.message, 402);
    }
    if (err instanceof MarketingTemplateMockFallbackError) {
      return apiError("ERR_MOCK_FALLBACK", err.message, 502);
    }
    console.error(`POST /api/marketing-templates/${id}/generate failed`, err);
    // Real bug fix (2026-07-25) — this used to be a hardcoded generic
    // string, which live-hid a real, actionable error (e.g. "All IMAGE
    // providers failed... Request blocked for an unspecified policy
    // reason") behind "Something went wrong generating this. Please try
    // again." with the real cause only reachable via server logs/DB, not
    // the user. Same fix already applied to FILM's generate-scene.ts for
    // the identical pattern — surface the real message when there is one.
    const message = err instanceof Error ? err.message : "Something went wrong generating this. Please try again.";
    return apiError("ERR_INTERNAL", message, 500);
  }
}
