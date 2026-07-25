import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import type { EditorAssetView } from "./assets";

// Module 11 — Part D: "Recent" is derived from actual EditorClip usage
// across the user's own projects, not a separately tracked action —
// "auto-populated from actual use" is implemented literally. Deliberately
// no new model: a groupBy over EditorClip, deduped by assetId, ordered by
// most-recent use (MAX(createdAt) per asset), then hydrated against the
// real EditorAsset rows.
export async function listRecentAssets(userId: string, limit = 40): Promise<EditorAssetView[]> {
  const grouped = await prisma.editorClip.groupBy({
    by: ["assetId"],
    where: { assetId: { not: null }, project: { userId } },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: limit,
  });

  const assetIds = grouped.map((g) => g.assetId).filter((id): id is string => id !== null);
  if (assetIds.length === 0) return [];

  const storage = await getStorageProvider();
  const rows = await prisma.editorAsset.findMany({ where: { id: { in: assetIds } } });
  const rowById = new Map(rows.map((r) => [r.id, r]));

  // Re-order to match `grouped`'s most-recent-first order — findMany()
  // doesn't preserve the `in` array's ordering.
  return grouped
    .map((g) => rowById.get(g.assetId!))
    .filter((row): row is NonNullable<typeof row> => !!row)
    .map((asset) => ({
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
