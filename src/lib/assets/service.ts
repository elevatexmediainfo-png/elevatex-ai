import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { getStorageProvider } from "@/lib/providers/storage";

// Fix (2026-07-13) — same real bug, same fix as
// lib/video-editor/assets.ts's UploadIntegrityError: a silently-truncated
// upload (a proxy/middleware body-size cap cutting a PUT off mid-transfer)
// used to sail through confirmAssetUpload() straight to READY with no
// error anywhere, since a completed PUT response only proves the request
// finished, not that every byte arrived. A distinct type (not a generic
// Error) so the route can return a real 409 instead of guessing from a
// message string.
export class UploadIntegrityError extends Error {}

// Asset Library (Milestone 8, extended Milestone 9) — bookkeeping on top of
// uploads that already happen in lib/render/pipeline.ts (scene render +
// merge), PLUS (Milestone 9) a genuine second source: user uploads via
// POST /api/assets/upload. Both still go through the same Storage Provider —
// never a second storage mechanism, just a second caller of recordAsset().
// "Music" has no per-user rows — it's the admin-configured
// BACKGROUND_MUSIC_LIBRARY content list; "Stock" similarly has no per-user
// rows for the admin-curated STOCK_ASSET_LIBRARY — both exposed through the
// same API for a unified library UI.

type Db = Prisma.TransactionClient | typeof prisma;

export type AssetKindValue = "IMAGE" | "VIDEO" | "VOICE" | "STICKER";
export type AssetSourceValue = "AI_GENERATED" | "UPLOAD" | "STOCK" | "BRAND";

export interface RecordAssetInput {
  userId: string;
  kind: AssetKindValue;
  source?: AssetSourceValue;
  storageKey: string;
  label?: string;
  videoProjectId?: string;
  sceneId?: string;
  // Milestone 14 — mirrors videoProjectId, for assets produced by the new
  // standalone Image/Social Media/Marketing Creative pipelines.
  creativeProjectId?: string;
}

export async function recordAsset(input: RecordAssetInput, db: Db = prisma) {
  return db.asset.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      source: input.source ?? "AI_GENERATED",
      storageKey: input.storageKey,
      label: input.label,
      videoProjectId: input.videoProjectId,
      sceneId: input.sceneId,
      creativeProjectId: input.creativeProjectId,
    },
  });
}

export interface CreatePendingAssetInput {
  userId: string;
  kind: AssetKindValue;
  storageKey: string;
  label?: string;
  mimeType: string;
  fileSizeBytes: number;
}

// Milestone 11 — the Asset row minted alongside a presigned upload URL,
// before the browser has actually PUT any bytes. Kept PENDING_UPLOAD until
// confirmAssetUpload() flips it to READY, so nothing downstream (Media
// Library listings, the talking-head pipeline) treats it as usable too
// early.
export async function createPendingAsset(input: CreatePendingAssetInput, db: Db = prisma) {
  return db.asset.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      source: "UPLOAD",
      status: "PENDING_UPLOAD",
      storageKey: input.storageKey,
      label: input.label,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
    },
  });
}

export async function confirmAssetUpload(
  assetId: string,
  userId: string,
  durationSeconds?: number,
  db: Db = prisma
) {
  const asset = await db.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) return null;
  if (asset.status === "READY") return asset;

  // Compares the object's real stored size against what the client
  // declared at upload-url time — this Asset model has no FAILED status
  // (unlike EditorAsset), so a mismatch simply leaves the row at
  // PENDING_UPLOAD (never silently promoted to READY) and throws, rather
  // than adding a new enum value for a status this model never otherwise
  // needed.
  if (asset.fileSizeBytes !== null) {
    const storage = await getStorageProvider();
    const actualSize = await storage.getObjectSize(asset.storageKey);
    if (actualSize === null) {
      throw new UploadIntegrityError("The uploaded file could not be found in storage. Please try uploading again.");
    }
    if (actualSize !== asset.fileSizeBytes) {
      throw new UploadIntegrityError(
        `The uploaded file is incomplete (expected ${asset.fileSizeBytes} bytes, received ${actualSize}). Please try uploading again.`
      );
    }
  }

  return db.asset.update({
    where: { id: assetId },
    data: { status: "READY", durationSeconds: durationSeconds ?? asset.durationSeconds },
  });
}

export interface AssetView {
  id: string;
  kind: AssetKindValue;
  source: AssetSourceValue;
  url: string;
  label: string | null;
  videoProjectId: string | null;
  sceneId: string | null;
  createdAt: Date;
}

export async function listAssets(
  userId: string,
  kind: AssetKindValue | undefined,
  limit = 100,
  source?: AssetSourceValue
): Promise<AssetView[]> {
  const storage = await getStorageProvider();
  const rows = await prisma.asset.findMany({
    where: { userId, ...(kind ? { kind } : {}), ...(source ? { source } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    source: row.source,
    url: storage.getPublicUrl(row.storageKey),
    label: row.label,
    videoProjectId: row.videoProjectId,
    sceneId: row.sceneId,
    createdAt: row.createdAt,
  }));
}

export interface MusicLibraryEntry {
  id: string;
  label: string;
  url: string;
}

export async function getMusicLibrary(): Promise<MusicLibraryEntry[]> {
  return getConfig("BACKGROUND_MUSIC_LIBRARY");
}

export interface StockAssetEntry {
  id: string;
  label: string;
  kind: "IMAGE" | "VIDEO" | "STICKER";
  url: string;
}

export async function getStockAssetLibrary(): Promise<StockAssetEntry[]> {
  return getConfig("STOCK_ASSET_LIBRARY");
}
