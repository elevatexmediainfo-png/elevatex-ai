import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getExport, InvalidStateError } from "@/lib/export/service";

// GET /api/videos/[id]/exports/[exportId] — Export System's status poll
// (PENDING/PROCESSING/COMPLETED/FAILED) while Background Rendering runs.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; exportId: string }> }
) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, exportId } = await params;

  try {
    const exportRow = await getExport(id, session.user.id, exportId);
    return apiSuccess({ export: exportRow });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("GET /api/videos/[id]/exports/[exportId] failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
