import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { runReferenceAnalysis } from "@/lib/admin/reference-library";

// POST /api/admin/reference-library/[id]/reanalyze — retries
// analyzeAssetForLibrary() for a reference stuck at analysisStatus FAILED
// (or to re-run it after a prompt/model change), without re-uploading.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  const { id } = await params;
  const reference = await runReferenceAnalysis(id, session.user.id);
  return apiSuccess({ reference });
}
