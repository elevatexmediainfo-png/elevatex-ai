import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { listIndustryReferences } from "@/lib/admin/reference-library";
import { INDUSTRY_POSTER_META } from "@/lib/creative/poster-prompt";
import type { BusinessVertical } from "@/generated/prisma/enums";

// GET /api/admin/reference-library?industry=DENTAL_DIAGNOSTIC — Admin
// Reference Library, Part A. Lists curated samples, optionally filtered to
// one industry (the admin page's per-industry tab). Not wired into poster
// generation (Part B).
export async function GET(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const industryParam = req.nextUrl.searchParams.get("industry");
  if (industryParam && !(industryParam in INDUSTRY_POSTER_META)) {
    return apiError("ERR_VALIDATION", "Unknown industry.", 400);
  }

  const references = await listIndustryReferences(industryParam ? (industryParam as BusinessVertical) : undefined);
  return apiSuccess({ references });
}
