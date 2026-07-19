import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ALLOWED_MIME_BY_KIND, assetUploadUrlSchema } from "@/lib/validations/editor";
import { createPendingAsset } from "@/lib/assets/service";
import { getStorageProvider } from "@/lib/providers/storage";
import { checkRateLimit } from "@/lib/security/rate-limit";

const UPLOAD_URL_TTL_SECONDS = 60 * 60;

// POST /api/assets/upload-url — mints a presigned PUT URL + a PENDING_UPLOAD
// Asset row. The browser PUTs the file bytes directly to storage (S3/R2, or
// the mock-upload route in dev), bypassing the Next.js server entirely —
// the same Storage Provider and Asset table as POST /api/assets/upload, just
// a second upload *path* for files too large for a serverless body
// (talking-head videos can be multiple GB).
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return apiError("ERR_UNAUTHENTICATED", "You must be signed in.", 401);
  }

  try {
    const rateLimit = await checkRateLimit("asset_upload", session.user.id);
    if (!rateLimit.allowed) {
      return apiError("ERR_RATE_LIMIT", "Too many uploads. Please try again later.", 429, {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const body = assetUploadUrlSchema.parse(await req.json());

    const allowed = ALLOWED_MIME_BY_KIND[body.kind];
    if (!allowed.includes(body.contentType)) {
      return apiError("ERR_VALIDATION", `${body.kind} uploads must be one of: ${allowed.join(", ")}.`, 400);
    }

    const storage = await getStorageProvider();
    // Fixed 2026-07-19 — this used to start with a literal "uploads/"
    // prefix, which MockStorageProvider's getPublicUrl()/upload() (both
    // UPLOAD_ROOT-relative, assuming a bare key) then prepended a SECOND
    // "/uploads/" onto, writing to and serving from the doubled
    // public/uploads/uploads/... path. Harmless today only because read and
    // write were consistently doubled — but every caller of this route
    // (general asset uploads, Talking Head, AI Film face-uploads) inherited
    // it. Dropped the redundant prefix, matching the Cloud Editor's own
    // upload-url route (api/editor/assets/upload-url), which never had this
    // bug since its key already uses a distinct "editor-uploads/" prefix.
    const key = `${session.user.id}/${crypto.randomUUID()}-${body.filename.replace(/[^\w.\-]/g, "_")}`;

    const asset = await createPendingAsset({
      userId: session.user.id,
      kind: body.kind,
      storageKey: key,
      label: body.filename,
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
    console.error("POST /api/assets/upload-url failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
