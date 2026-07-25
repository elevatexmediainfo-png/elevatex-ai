import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { confirmEditorAssetUploadSchema } from "@/lib/validations/video-editor";
import { confirmEditorAssetUpload } from "@/lib/video-editor/assets";
import { InvalidStateError, UploadIntegrityError } from "@/lib/video-editor/errors";
import { getStorageProvider } from "@/lib/providers/storage";

// POST /api/editor/assets/[id]/confirm-upload — finalizes a presigned
// upload once the browser's PUT to storage has completed. Flips the
// EditorAsset from PENDING_UPLOAD to READY.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  const { id } = await params;

  try {
    const body = confirmEditorAssetUploadSchema.parse(await req.json().catch(() => ({})));
    const asset = await confirmEditorAssetUpload(id, session.user.id, body);

    const storage = await getStorageProvider();
    return apiSuccess({
      asset: {
        id: asset.id,
        kind: asset.kind,
        status: asset.status,
        url: storage.getPublicUrl(asset.storageKey),
        originalFilename: asset.originalFilename,
        durationSeconds: asset.durationSeconds,
        widthPx: asset.widthPx,
        heightPx: asset.heightPx,
        waveformPeaks: asset.waveformPeaks as number[] | null,
        filmstripUrl: asset.filmstripKey ? storage.getPublicUrl(asset.filmstripKey) : null,
        filmstripFrameCount: asset.filmstripFrameCount,
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
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("POST /api/editor/assets/[id]/confirm-upload failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
