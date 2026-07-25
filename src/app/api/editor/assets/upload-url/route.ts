import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { editorAssetUploadUrlSchema } from "@/lib/validations/video-editor";
import { createPendingEditorAsset } from "@/lib/video-editor/assets";
import { getOwnedProject } from "@/lib/video-editor/projects";
import { InvalidStateError } from "@/lib/video-editor/errors";
import { getStorageProvider } from "@/lib/providers/storage";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getConfig } from "@/lib/admin/config";

const UPLOAD_URL_TTL_SECONDS = 60 * 60;

// POST /api/editor/assets/upload-url — mints a presigned PUT URL + a
// PENDING_UPLOAD EditorAsset row. The browser PUTs bytes directly to
// storage, bypassing the Next.js server entirely — same two-phase flow as
// the existing POST /api/assets/upload-url, reusing the exact same
// StorageProvider, just backed by EditorAsset instead of Asset.
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  try {
    const rateLimit = await checkRateLimit("editor_asset_upload", session.user.id);
    if (!rateLimit.allowed) {
      return apiError("ERR_RATE_LIMIT", "Too many uploads. Please try again later.", 429, {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const body = editorAssetUploadUrlSchema.parse(await req.json());

    // Fix (2026-07-12) — when a projectId is given (the Uploads panel's own
    // uploads; omitted for Brand Kit's intentionally project-independent
    // font uploads — see editorAssetUploadUrlSchema's own doc comment),
    // confirm the caller actually owns that project, the same trust
    // boundary every other project-scoped editor route already
    // establishes (throws InvalidStateError -> 404 below if not).
    if (body.projectId) {
      await getOwnedProject(session.user.id, body.projectId);
    }

    const [allowedMimeTypes, maxUploadSizeBytes] = await Promise.all([
      getConfig("EDITOR_ALLOWED_UPLOAD_MIME_TYPES"),
      getConfig("EDITOR_MAX_UPLOAD_SIZE_BYTES"),
    ]);

    const allowed = allowedMimeTypes[body.kind];
    if (!allowed.includes(body.contentType)) {
      return apiError("ERR_VALIDATION", `${body.kind} uploads must be one of: ${allowed.join(", ")}.`, 400);
    }
    if (body.fileSizeBytes > maxUploadSizeBytes) {
      return apiError("ERR_VALIDATION", `File exceeds the ${Math.round(maxUploadSizeBytes / (1024 * 1024))}MB upload limit.`, 400);
    }

    const storage = await getStorageProvider();
    const key = `editor-uploads/${session.user.id}/${crypto.randomUUID()}-${body.filename.replace(/[^\w.\-]/g, "_")}`;

    const asset = await createPendingEditorAsset({
      userId: session.user.id,
      projectId: body.projectId,
      kind: body.kind,
      storageKey: key,
      originalFilename: body.filename,
      mimeType: body.contentType,
      fileSizeBytes: body.fileSizeBytes,
    });

    const signed = await storage.createSignedUploadUrl(key, body.contentType, UPLOAD_URL_TTL_SECONDS);

    return apiSuccess(
      {
        assetId: asset.id,
        uploadUrl: signed.url,
        expiresAt: signed.expiresAt,
      },
      201
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the upload fields and try again.", 400, { issues: err.issues });
    }
    if (err instanceof InvalidStateError) {
      return apiError("ERR_NOT_FOUND", err.message, 404);
    }
    console.error("POST /api/editor/assets/upload-url failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
