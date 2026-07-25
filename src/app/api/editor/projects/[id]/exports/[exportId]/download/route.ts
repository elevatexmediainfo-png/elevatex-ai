import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getExport } from "@/lib/video-editor/exports";
import { InvalidStateError } from "@/lib/video-editor/errors";
import { getStorageProvider } from "@/lib/providers/storage";

const SIGNED_URL_TTL_SECONDS = 300;

// GET /api/editor/projects/[id]/exports/[exportId]/download — mints a
// short-lived signed URL for a COMPLETED export's output file. Mirrors
// billing/invoices/[id]/pdf's exact pattern.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; exportId: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id, exportId } = await params;

  try {
    const exportRow = await getExport(id, session.user.id, exportId);
    if (exportRow.status !== "COMPLETED" || !exportRow.outputKey) {
      return apiError("ERR_INVALID_STATE", "This export hasn't finished rendering yet.", 409);
    }

    const storage = await getStorageProvider();
    const signed = await storage.getSignedDownloadUrl(exportRow.outputKey, SIGNED_URL_TTL_SECONDS);
    return apiSuccess({ url: signed.url, expiresAt: signed.expiresAt });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("GET /api/editor/projects/[id]/exports/[exportId]/download failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
