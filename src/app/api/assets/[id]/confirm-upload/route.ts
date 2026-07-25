import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { confirmAssetUploadSchema } from "@/lib/validations/editor";
import { confirmAssetUpload, UploadIntegrityError } from "@/lib/assets/service";
import { getStorageProvider } from "@/lib/providers/storage";

// POST /api/assets/[id]/confirm-upload — finalizes a presigned upload once
// the browser's PUT to storage has completed (checked client-side via the
// PUT response). Flips the Asset from PENDING_UPLOAD to READY.
//
// Fix (2026-07-13) — a completed PUT response only proves the *request*
// finished, not that every byte arrived intact (a real, confirmed bug: a
// proxy/middleware body-size cap silently truncated large uploads mid-
// transfer with the PUT itself still reporting success). confirmAssetUpload
// now compares the object's real stored size against the client-declared
// size before ever marking it READY — see UploadIntegrityError below.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const body = confirmAssetUploadSchema.parse(await req.json().catch(() => ({})));

    const asset = await confirmAssetUpload(id, session.user.id, body.durationSeconds);
    if (!asset) {
      return apiError("ERR_NOT_FOUND", "Asset not found.", 404);
    }

    const storage = await getStorageProvider();
    return apiSuccess({
      asset: {
        id: asset.id,
        kind: asset.kind,
        source: asset.source,
        status: asset.status,
        url: storage.getPublicUrl(asset.storageKey),
        label: asset.label,
        durationSeconds: asset.durationSeconds,
        mimeType: asset.mimeType,
        fileSizeBytes: asset.fileSizeBytes,
        createdAt: asset.createdAt,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the request body and try again.", 400, { issues: err.issues });
    }
    if (err instanceof UploadIntegrityError) {
      return apiError("ERR_UPLOAD_INCOMPLETE", err.message, 409);
    }
    console.error("POST /api/assets/[id]/confirm-upload failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
