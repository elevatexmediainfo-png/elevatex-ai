import { NextRequest } from "next/server";
import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { listEnabledProviderConfigs } from "@/lib/providers/credentials";
import { PROVIDER_CATALOGUE } from "@/lib/admin/ai-providers";
import { MOCK_PROVIDER_ID } from "@/lib/generation/types";

const querySchema = z.object({ outputType: z.enum(["IMAGE", "VIDEO"]) });

// GET /api/admin/marketing-templates/providers?outputType=IMAGE|VIDEO —
// real, live-queried list of currently enabled providers for the admin's
// Primary/Fallback provider selects (Migration v3, 2026-08-02). Mirrors
// GET /api/videos/providers's own "never hardcoded" convention exactly —
// a provider disabled in Admin -> AI Providers stops appearing here the
// next fetch, automatically.
export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const parsed = querySchema.safeParse({ outputType: req.nextUrl.searchParams.get("outputType") });
  if (!parsed.success) {
    return apiError("ERR_VALIDATION", "outputType query param is required and must be IMAGE or VIDEO.", 400);
  }

  const enabledIds = (await listEnabledProviderConfigs(parsed.data.outputType)).filter((id) => id !== MOCK_PROVIDER_ID);
  const providers = enabledIds.map((id) => ({
    id,
    label: PROVIDER_CATALOGUE.find((e) => e.category === parsed.data.outputType && e.providerId === id)?.label ?? id,
  }));

  return apiSuccess({ providers });
}
