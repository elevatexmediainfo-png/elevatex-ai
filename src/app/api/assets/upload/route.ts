import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { requireSession } from "@/lib/auth/guard";
import { apiError, apiSuccess } from "@/lib/api-response";
import { ALLOWED_MIME_BY_KIND, assetUploadMetaSchema } from "@/lib/validations/editor";
import { recordAsset } from "@/lib/assets/service";
import { getStorageProvider } from "@/lib/providers/storage";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { verifyFileSignature } from "@/lib/security/upload-validation";

// Fixed technical ceilings (like ReplicateVideoProvider's POLL_INTERVAL_MS),
// not admin-configurable business rules — a storage/ops safety limit, not a
// pricing/credit/business knob. Files larger than this go through
// POST /api/assets/upload-url's presigned direct-to-storage path instead.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

// POST /api/assets/upload (multipart/form-data: file, kind, source?, label?)
// Media Library's "Upload assets" / "Brand assets". Goes through the SAME
// Storage Provider + recordAsset() as every pipeline-generated asset — a
// second caller, never a second storage mechanism.
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

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return apiError("ERR_VALIDATION", "A file is required.", 400);
    }
    if (file.size === 0) {
      return apiError("ERR_VALIDATION", "The uploaded file is empty.", 400);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return apiError("ERR_VALIDATION", "Files must be 100MB or smaller.", 400);
    }

    const data = assetUploadMetaSchema.parse({
      kind: form.get("kind"),
      source: form.get("source") ?? undefined,
      label: form.get("label") ?? undefined,
    });

    const contentType = file.type || "application/octet-stream";
    const allowed = ALLOWED_MIME_BY_KIND[data.kind];
    if (!allowed.includes(contentType)) {
      return apiError("ERR_VALIDATION", `${data.kind} uploads must be one of: ${allowed.join(", ")}.`, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!(await verifyFileSignature(buffer, allowed))) {
      return apiError("ERR_VALIDATION", "This file's content doesn't match its declared type.", 400);
    }

    const storage = await getStorageProvider();
    // Fixed 2026-07-19 — same doubled-/uploads/uploads/-path bug as
    // upload-url/route.ts (see its comment for the full mechanism); dropped
    // the redundant leading "uploads/" prefix here too, same fix.
    const key = `${session.user.id}/${crypto.randomUUID()}`;
    const uploaded = await storage.upload({ key, data: buffer, contentType });

    const asset = await recordAsset({
      userId: session.user.id,
      kind: data.kind,
      source: data.source,
      storageKey: uploaded.key,
      label: data.label,
    });

    return apiSuccess(
      {
        asset: {
          id: asset.id,
          kind: asset.kind,
          source: asset.source,
          url: storage.getPublicUrl(asset.storageKey),
          label: asset.label,
          createdAt: asset.createdAt,
        },
      },
      201
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the upload fields and try again.", 400, { issues: err.issues });
    }
    console.error("POST /api/assets/upload failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
