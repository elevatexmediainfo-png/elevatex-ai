import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { listLibraryAssetsQuerySchema } from "@/lib/validations/asset-library";
import { listLibraryAssets } from "@/lib/video-editor/asset-library";

// GET /api/admin/asset-library?q=&category=&page=&limit= — search/filter
// list for the Admin Asset Library's own browser (separate from the live
// provider search Module 11 will build against lib/providers/stock-media/).
export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

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
    console.error("GET /api/admin/asset-library failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
