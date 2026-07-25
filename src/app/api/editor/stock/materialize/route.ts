import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { materializeStockAssetSchema } from "@/lib/validations/stock-search";
import { materializeStockAsset } from "@/lib/providers/stock-media/search-service";

// POST /api/editor/stock/materialize — Module 11 Part A: downloads and
// caches a picked (or favorited) stock-search result into a real
// EditorAsset (scope: USER) before it can be dropped onto the timeline or
// favorited — see materializeStockAsset()'s own header comment for why
// this never permanent-hotlinks the provider's CDN URL.
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  try {
    const body = materializeStockAssetSchema.parse(await req.json());
    const asset = await materializeStockAsset(session.user.id, body.providerId, body.category, body.result);
    return apiSuccess({ asset }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the request and try again.", 400, { issues: err.issues });
    }
    console.error("POST /api/editor/stock/materialize failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong while downloading and caching this asset. Please try again.", 500);
  }
}
