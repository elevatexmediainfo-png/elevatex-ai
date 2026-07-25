import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { searchUserContent } from "@/lib/search/service";

// GET /api/search?q= — the Dashboard's search bar. Real substring search,
// not "AI search" (no semantic search infra exists).
export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = await searchUserContent(session.user.id, q);
  return apiSuccess({ results });
}
