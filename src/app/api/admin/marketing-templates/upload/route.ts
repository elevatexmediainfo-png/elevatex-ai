import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { ALLOWED_MIME_BY_KIND } from "@/lib/validations/editor";
import { verifyFileSignature } from "@/lib/security/upload-validation";
import { getStorageProvider } from "@/lib/providers/storage";
import { prisma } from "@/lib/prisma";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // reference media can be a real video, not just a small image
const ALLOWED_MIME = [...ALLOWED_MIME_BY_KIND.IMAGE!, ...ALLOWED_MIME_BY_KIND.VIDEO!];

// POST /api/admin/marketing-templates/upload (multipart/form-data: file) —
// the admin's own upload of a template's curated reference image/video.
// Same direct-multipart-POST convention as Reference Library's admin
// upload (not the presigned-URL flow user-facing uploads use) — creates a
// real Asset row (the same generic model AI Film's character photos and
// CreativeProject's reference/logo already use), returned so the caller
// can PATCH { referenceMediaAssetId } onto the template.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdminSession();
    if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

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

    const contentType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.includes(contentType)) {
      return apiError("ERR_VALIDATION", `Reference media must be one of: ${ALLOWED_MIME.join(", ")}.`, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!(await verifyFileSignature(buffer, ALLOWED_MIME))) {
      return apiError("ERR_VALIDATION", "This file's content doesn't match its declared type.", 400);
    }

    const kind = ALLOWED_MIME_BY_KIND.IMAGE!.includes(contentType) ? "IMAGE" : "VIDEO";
    const storage = await getStorageProvider();
    const key = `marketing-templates/reference/${crypto.randomUUID()}`;
    const uploaded = await storage.upload({ key, data: buffer, contentType });

    const asset = await prisma.asset.create({
      data: {
        userId: session.user.id,
        kind,
        source: "UPLOAD",
        status: "READY",
        storageKey: uploaded.key,
        mimeType: contentType,
        fileSizeBytes: buffer.byteLength,
        label: "Marketing template reference media",
      },
    });

    return apiSuccess({ asset }, 201);
  } catch (err) {
    console.error("POST /api/admin/marketing-templates/upload failed", err);
    const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return apiError("ERR_INTERNAL", message, 500);
  }
}
