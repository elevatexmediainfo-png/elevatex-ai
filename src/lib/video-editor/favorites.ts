import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { InvalidStateError } from "./errors";
import type { EditorAssetView } from "./assets";

// Module 11 — Part D: favorites. Never a special case for a raw
// stock-search result — the client always materializes it into a real
// EditorAsset (scope: USER) first (see lib/providers/stock-media/
// search-service.ts's materializeStockAsset()), then favorites that real
// asset's id. A favorited asset can be USER-scope (including a
// just-materialized stock result) or LIBRARY-scope — no scope filter here,
// unlike assets.ts's user-facing queries, since favoriting a curated
// library item is equally valid.
export async function toggleFavorite(userId: string, assetId: string): Promise<{ favorited: boolean }> {
  const asset = await prisma.editorAsset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!asset) throw new InvalidStateError("Asset not found.");

  const existing = await prisma.editorAssetFavorite.findUnique({
    where: { userId_assetId: { userId, assetId } },
  });
  if (existing) {
    await prisma.editorAssetFavorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }
  await prisma.editorAssetFavorite.create({ data: { userId, assetId } });
  return { favorited: true };
}

export async function listFavorites(userId: string): Promise<EditorAssetView[]> {
  const storage = await getStorageProvider();
  const favorites = await prisma.editorAssetFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { asset: true },
  });

  return favorites.map(({ asset }) => ({
    id: asset.id,
    kind: asset.kind,
    status: asset.status,
    url: storage.getPublicUrl(asset.storageKey),
    originalFilename: asset.originalFilename,
    durationSeconds: asset.durationSeconds,
    widthPx: asset.widthPx,
    heightPx: asset.heightPx,
    createdAt: asset.createdAt,
    waveformPeaks: (asset.waveformPeaks as number[] | null) ?? null,
    thumbnailUrl: asset.thumbnailKey ? storage.getPublicUrl(asset.thumbnailKey) : null,
    filmstripUrl: asset.filmstripKey ? storage.getPublicUrl(asset.filmstripKey) : null,
    filmstripFrameCount: asset.filmstripFrameCount,
  }));
}
