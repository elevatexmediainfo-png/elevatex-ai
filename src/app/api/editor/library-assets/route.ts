import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { listLibraryAssetsQuerySchema } from "@/lib/validations/asset-library";
import { listLibraryAssets } from "@/lib/video-editor/asset-library";

// GET /api/editor/library-assets?q=&category=&page=&limit= — Module 11's
// user-facing (not admin-gated) read over the Bulk Asset Library, for the
// Creative Studio Sidebar's Templates/Transitions/Effects/Shapes/Stickers/
// Logos tabs. Deliberately a second thin route over the SAME
// listLibraryAssets() the admin route already uses (src/app/api/admin/
// asset-library/route.ts) — no new business logic, just a different auth
// guard (any signed-in user, not admin-only) for a read-only endpoint.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  try {
    const url = new URL(req.url);
    const query = listLibraryAssetsQuerySchema.parse({
      q: url.searchParams.get("q") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const result = await listLibraryAssets(query);
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the query parameters and try again.", 400, { issues: err.issues });
    }
    console.error("GET /api/editor/library-assets failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
