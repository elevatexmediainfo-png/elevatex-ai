import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { referenceUploadMetaSchema } from "@/lib/validations/reference-library";
import { ALLOWED_MIME_BY_KIND } from "@/lib/validations/editor";
import { verifyFileSignature } from "@/lib/security/upload-validation";
import { getStorageProvider } from "@/lib/providers/storage";
import { createIndustryReference, runReferenceAnalysis } from "@/lib/admin/reference-library";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = ALLOWED_MIME_BY_KIND.IMAGE!;

// POST /api/admin/reference-library/upload (multipart/form-data: file,
// industry, label?) — Admin Reference Library, Part A. Uploads a curated
// sample, then runs analyzeAssetForLibrary() synchronously (single
// vision-LLM call, same pattern as generateBrandGuidelines — no job queue)
// before responding, so the admin sees analysis status immediately rather
// than polling. Analysis failure doesn't fail the upload — the reference
// is created either way, marked FAILED, and retryable via
// POST .../[id]/reanalyze.
export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return apiError("ERR_VALIDATION", "A file is required.", 400);
    }
    if (file.size === 0) {
      return apiError("ERR_VALIDATION", "The uploaded file is empty.", 400);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return apiError("ERR_VALIDATION", "Files must be 15MB or smaller.", 400);
    }

    const meta = referenceUploadMetaSchema.parse({
      industry: form.get("industry"),
      label: form.get("label") ?? undefined,
    });

    const contentType = file.type || "application/octet-stream";
    if (!ALLOWED_IMAGE_MIME.includes(contentType)) {
      return apiError("ERR_VALIDATION", `Reference images must be one of: ${ALLOWED_IMAGE_MIME.join(", ")}.`, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!(await verifyFileSignature(buffer, ALLOWED_IMAGE_MIME))) {
      return apiError("ERR_VALIDATION", "This file's content doesn't match its declared type.", 400);
    }

    const storage = await getStorageProvider();
    const key = `reference-library/${meta.industry}/${crypto.randomUUID()}`;
    const uploaded = await storage.upload({ key, data: buffer, contentType });

    const created = await createIndustryReference({
      industry: meta.industry,
      storageKey: uploaded.key,
      mimeType: contentType,
      label: meta.label,
      uploadedByUserId: session.user.id,
    });

    const analyzed = await runReferenceAnalysis(created.id, session.user.id);

    return apiSuccess({ reference: analyzed }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the upload fields and try again.", 400, { issues: err.issues });
    }
    console.error("POST /api/admin/reference-library/upload failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}
