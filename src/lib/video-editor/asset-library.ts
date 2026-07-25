import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { verifyFileSignature } from "@/lib/security/upload-validation";
import {
  LIBRARY_ALLOWED_MIME_BY_CATEGORY,
  LIBRARY_CATEGORY_TO_KIND,
  type LibraryAssetCategory,
} from "@/lib/validations/asset-library";
import { generateImageThumbnail, generateVideoThumbnail } from "./thumbnails";
import { decodeAudioToPeaks } from "./server-waveform";
import { InvalidStateError } from "./errors";

// Milestone 26 — Admin Asset Library. Server-side, same-request upload
// (StorageProvider.upload() with bytes already in hand), unlike Module 5's
// two-phase presigned-URL flow for user uploads — an admin batch already
// has every file's bytes on the server by the time this runs, there's no
// browser-PUT round trip to wait on. Deliberately its own file, not added
// to assets.ts: that file's functions are all userId-ownership-scoped by
// design (see its own Milestone 24 header comment); library rows have no
// per-user ownership concept, any admin can list/delete any of them.

// Text-based formats (JSON/SVG) can't be magic-byte-sniffed by
// verifyFileSignature's file-type package — validated by content instead.
// Never trust the client-declared Content-Type alone for these two.
function looksLikeLottieJson(buffer: Buffer): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(buffer.toString("utf8"));
  } catch {
    return false;
  }
  if (typeof parsed !== "object" || parsed === null) return false;
  const obj = parsed as Record<string, unknown>;
  // Lottie's own telltale top-level fields: `v` (format version), `layers`
  // (the animation's layer array), and the `ip`/`op` in/out frame markers.
  return typeof obj.v === "string" && Array.isArray(obj.layers) && "ip" in obj && "op" in obj;
}

function looksLikeSvg(buffer: Buffer): boolean {
  // First 512 bytes is plenty to see past an optional <?xml ...?> prolog
  // into the real root element without reading the whole file for a huge SVG.
  const head = buffer.subarray(0, 512).toString("utf8").trimStart();
  return head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"));
}

async function assertValidContent(buffer: Buffer, mimeType: string, category: LibraryAssetCategory): Promise<void> {
  const allowed = LIBRARY_ALLOWED_MIME_BY_CATEGORY[category];
  if (!allowed.includes(mimeType)) {
    throw new InvalidStateError(`"${mimeType}" is not an allowed content type for category ${category}.`);
  }

  if (category === "ANIMATION" || category === "ANIMATED_ICON") {
    if (!looksLikeLottieJson(buffer)) {
      throw new InvalidStateError("File does not look like a valid Lottie JSON animation.");
    }
    return;
  }
  if (mimeType === "image/svg+xml") {
    // Module 11 — SHAPE/STICKER/LOGO can also be SVG, same content-based
    // check STATIC_ICON already needed (file-type can't magic-byte-sniff
    // text-based SVG) — the check itself is format-driven, not
    // category-driven, so it applies to any category allowing this mime.
    if (!looksLikeSvg(buffer)) {
      throw new InvalidStateError("File does not look like a valid SVG.");
    }
    return;
  }
  // Every remaining category/mime combination is a real binary format
  // file-type can sniff.
  const ok = await verifyFileSignature(buffer, allowed);
  if (!ok) {
    throw new InvalidStateError("File content does not match its declared type.");
  }
}

export interface UploadLibraryAssetInput {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  category: LibraryAssetCategory;
  uploadedByUserId: string;
}

export interface UploadLibraryAssetResult {
  id: string;
  originalFilename: string;
  category: LibraryAssetCategory;
  // Set when the upload itself succeeded but thumbnail/waveform generation
  // failed — the row is still created and usable, just without a preview.
  processingWarning: string | null;
}

export async function uploadLibraryAsset(input: UploadLibraryAssetInput): Promise<UploadLibraryAssetResult> {
  await assertValidContent(input.buffer, input.mimeType, input.category);

  const kind = LIBRARY_CATEGORY_TO_KIND[input.category];
  const storage = await getStorageProvider();
  const key = `library/${input.category.toLowerCase()}/${randomUUID()}-${input.originalFilename.replace(/[^\w.-]/g, "_")}`;
  await storage.upload({ key, data: input.buffer, contentType: input.mimeType });

  const asset = await prisma.editorAsset.create({
    data: {
      userId: input.uploadedByUserId,
      scope: "LIBRARY",
      kind,
      libraryCategory: input.category,
      status: "READY",
      storageKey: key,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      fileSizeBytes: input.buffer.byteLength,
    },
  });

  // Best-effort post-processing — mirrors the Admin Reference Library's
  // precedent (src/app/api/admin/reference-library/upload/route.ts):
  // the row is already created and the upload already succeeded, so a
  // thumbnail/waveform failure here is logged, not thrown, and doesn't
  // fail the batch this file is part of.
  let processingWarning: string | null = null;
  try {
    if (kind === "IMAGE") {
      const thumb = await generateImageThumbnail(input.buffer);
      const thumbKey = `${key}.thumb.jpg`;
      await storage.upload({ key: thumbKey, data: thumb, contentType: "image/jpeg" });
      await prisma.editorAsset.update({ where: { id: asset.id }, data: { thumbnailKey: thumbKey } });
    } else if (kind === "VIDEO") {
      const thumb = await generateVideoThumbnail(input.buffer);
      const thumbKey = `${key}.thumb.jpg`;
      await storage.upload({ key: thumbKey, data: thumb, contentType: "image/jpeg" });
      await prisma.editorAsset.update({ where: { id: asset.id }, data: { thumbnailKey: thumbKey } });
    } else if (kind === "AUDIO") {
      const peaks = await decodeAudioToPeaks(input.buffer);
      await prisma.editorAsset.update({ where: { id: asset.id }, data: { waveformPeaks: peaks } });
    }
    // ANIMATION — no thumbnail generated (see thumbnails.ts's header comment).
  } catch (err) {
    processingWarning = err instanceof Error ? err.message : String(err);
    console.error(`[asset-library] thumbnail/waveform generation failed for ${asset.id}:`, err);
  }

  return { id: asset.id, originalFilename: asset.originalFilename, category: input.category, processingWarning };
}

export interface LibraryAssetView {
  id: string;
  kind: "VIDEO" | "AUDIO" | "IMAGE" | "ANIMATION";
  category: LibraryAssetCategory;
  // Upload normalization (2026-07-19) — widened for structural
  // compatibility with the full EditorAssetStatus enum; a LIBRARY-scope
  // row never actually passes through confirmEditorAssetUpload (this
  // file creates them straight to READY), so QUEUED_FOR_NORMALIZATION/
  // NORMALIZING never occur here in practice.
  status: "PENDING_UPLOAD" | "QUEUED_FOR_NORMALIZATION" | "NORMALIZING" | "READY" | "FAILED";
  url: string;
  thumbnailUrl: string | null;
  originalFilename: string;
  fileSizeBytes: number;
  durationSeconds: number | null;
  widthPx: number | null;
  heightPx: number | null;
  waveformPeaks: number[] | null;
  createdAt: Date;
}

export interface ListLibraryAssetsInput {
  q?: string;
  category?: LibraryAssetCategory;
  page?: number;
  limit?: number;
}

export async function listLibraryAssets(input: ListLibraryAssetsInput = {}): Promise<{ assets: LibraryAssetView[]; total: number }> {
  const page = input.page ?? 1;
  const limit = input.limit ?? 40;
  const storage = await getStorageProvider();

  const where = {
    scope: "LIBRARY" as const,
    ...(input.category ? { libraryCategory: input.category } : {}),
    ...(input.q ? { originalFilename: { contains: input.q, mode: "insensitive" as const } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.editorAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.editorAsset.count({ where }),
  ]);

  return {
    total,
    assets: rows.map((row) => ({
      id: row.id,
      kind: row.kind as LibraryAssetView["kind"],
      category: row.libraryCategory as LibraryAssetCategory,
      status: row.status,
      url: storage.getPublicUrl(row.storageKey),
      thumbnailUrl: row.thumbnailKey ? storage.getPublicUrl(row.thumbnailKey) : null,
      originalFilename: row.originalFilename,
      fileSizeBytes: row.fileSizeBytes,
      durationSeconds: row.durationSeconds,
      widthPx: row.widthPx,
      heightPx: row.heightPx,
      waveformPeaks: (row.waveformPeaks as number[] | null) ?? null,
      createdAt: row.createdAt,
    })),
  };
}

// No userId ownership check, unlike assets.ts's deleteEditorAsset — any
// admin can delete any library asset, since these rows belong to the
// library as a whole, not to whichever admin happened to upload them.
export async function deleteLibraryAsset(assetId: string): Promise<void> {
  const claim = await prisma.editorAsset.deleteMany({ where: { id: assetId, scope: "LIBRARY" } });
  if (claim.count === 0) throw new InvalidStateError("Library asset not found.");
}
