import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { stockSearchQuerySchema } from "@/lib/validations/stock-search";
import { searchStockMedia } from "@/lib/providers/stock-media/search-service";

// GET /api/editor/stock/search?category=&query=&type=&page= — Module 11
// Part A: fans out to every ENABLED provider in the category (Pexels/
// Pixabay for STOCK_MEDIA, IconScout for ICON) in parallel, returning one
// outcome per provider so a single provider erroring never hides the
// others' results — see searchStockMedia()'s own header comment.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);

  try {
    const url = new URL(req.url);
    const query = stockSearchQuerySchema.parse({
      category: url.searchParams.get("category"),
      query: url.searchParams.get("query"),
      type: url.searchParams.get("type") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
    });
    const result = await searchStockMedia(query.category, query.query, { type: query.type, page: query.page });
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the search parameters and try again.", 400, { issues: err.issues });
    }
    console.error("GET /api/editor/stock/search failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
