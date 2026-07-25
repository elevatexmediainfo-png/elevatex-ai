import { NextRequest } from "next/server";
import { ZodError } from "zod";

import { apiError, apiSuccess } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/admin/guard";
import { uploadLibraryAssetBatchSchema, type LibraryAssetCategory } from "@/lib/validations/asset-library";
import { uploadLibraryAsset } from "@/lib/video-editor/asset-library";
import { extractZipEntries, ZipExtractionError } from "@/lib/video-editor/zip-extract";
import { InvalidStateError } from "@/lib/video-editor/errors";

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

interface PendingFile {
  filename: string;
  buffer: Buffer;
  mimeType: string;
}

// POST /api/admin/asset-library/upload (multipart/form-data) — accepts
// either multiple `files` entries or one `zip` entry, plus a batch-default
// `category` and an optional per-filename `categories` JSON override.
// Each file is processed independently: one bad file (wrong content for
// its declared category, etc.) is reported in `failed` without failing the
// rest of the batch — same "don't lose 19 good uploads over 1 bad one"
// reasoning as any other bulk-import endpoint.
export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return apiError("ERR_FORBIDDEN", "Admin access required.", 403);

  try {
    const form = await req.formData();
    const categoriesRaw = form.get("categories");
    const meta = uploadLibraryAssetBatchSchema.parse({
      category: form.get("category"),
      categories: categoriesRaw ? JSON.parse(String(categoriesRaw)) : undefined,
    });

    const pending: PendingFile[] = [];

    const looseFiles = form.getAll("files");
    for (const entry of looseFiles) {
      if (!(entry instanceof Blob)) continue;
      const filename = (entry instanceof File ? entry.name : null) ?? "upload";
      if (entry.size === 0 || entry.size > MAX_UPLOAD_BYTES) continue;
      pending.push({ filename, buffer: Buffer.from(await entry.arrayBuffer()), mimeType: entry.type || "application/octet-stream" });
    }

    const zipEntry = form.get("zip");
    if (zipEntry instanceof Blob && zipEntry.size > 0) {
      if (zipEntry.size > MAX_UPLOAD_BYTES) {
        return apiError("ERR_VALIDATION", "Zip archive is too large.", 400);
      }
      const zipBuffer = Buffer.from(await zipEntry.arrayBuffer());
      const entries = await extractZipEntries(zipBuffer);
      for (const entry of entries) {
        // No per-entry MIME header inside a zip — inferred from extension
        // as a starting point, then validated for real (magic bytes /
        // content check) inside uploadLibraryAsset regardless.
        pending.push({ filename: entry.filename, buffer: entry.buffer, mimeType: guessMimeFromFilename(entry.filename) });
      }
    }

    if (pending.length === 0) {
      return apiError("ERR_VALIDATION", "No files provided (use \"files\" for individual uploads or \"zip\" for an archive).", 400);
    }

    const created: Awaited<ReturnType<typeof uploadLibraryAsset>>[] = [];
    const failed: { filename: string; error: string }[] = [];

    for (const file of pending) {
      const category: LibraryAssetCategory = meta.categories?.[file.filename] ?? meta.category;
      try {
        const result = await uploadLibraryAsset({
          buffer: file.buffer,
          originalFilename: file.filename,
          mimeType: file.mimeType,
          category,
          uploadedByUserId: session.user.id,
        });
        created.push(result);
      } catch (err) {
        failed.push({ filename: file.filename, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return apiSuccess({ created, failed }, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError("ERR_VALIDATION", "Please check the upload fields and try again.", 400, { issues: err.issues });
    }
    if (err instanceof ZipExtractionError || err instanceof InvalidStateError) {
      return apiError("ERR_VALIDATION", err.message, 400);
    }
    console.error("POST /api/admin/asset-library/upload failed", err);
    return apiError("ERR_INTERNAL", "Something went wrong. Please try again.", 500);
  }
}

function guessMimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "m4a":
      return "audio/mp4";
    case "json":
      return "application/json";
    default:
      return "application/octet-stream";
  }
}
