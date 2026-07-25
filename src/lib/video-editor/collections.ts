import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";
import { InvalidStateError } from "./errors";
import type { EditorAssetView } from "./assets";

// Module 11 — Part D: user-created named groups of assets. Standard
// many-to-many (EditorCollection <-> EditorAsset via EditorCollectionAsset)
// — every mutation checks userId ownership of the collection itself
// (assets referenced can be USER or LIBRARY scope, same as favorites).

export interface CollectionView {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  assetCount: number;
}

export async function listCollections(userId: string): Promise<CollectionView[]> {
  const rows = await prisma.editorCollection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  return rows.map((c) => ({ id: c.id, name: c.name, createdAt: c.createdAt, updatedAt: c.updatedAt, assetCount: c._count.items }));
}

export async function createCollection(userId: string, name: string): Promise<CollectionView> {
  const c = await prisma.editorCollection.create({ data: { userId, name } });
  return { id: c.id, name: c.name, createdAt: c.createdAt, updatedAt: c.updatedAt, assetCount: 0 };
}

export async function deleteCollection(userId: string, collectionId: string): Promise<void> {
  const claim = await prisma.editorCollection.deleteMany({ where: { id: collectionId, userId } });
  if (claim.count === 0) throw new InvalidStateError("Collection not found.");
}

async function assertOwnsCollection(userId: string, collectionId: string): Promise<void> {
  const collection = await prisma.editorCollection.findFirst({ where: { id: collectionId, userId }, select: { id: true } });
  if (!collection) throw new InvalidStateError("Collection not found.");
}

export async function addAssetToCollection(userId: string, collectionId: string, assetId: string): Promise<void> {
  await assertOwnsCollection(userId, collectionId);
  const asset = await prisma.editorAsset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!asset) throw new InvalidStateError("Asset not found.");
  await prisma.editorCollectionAsset.upsert({
    where: { collectionId_assetId: { collectionId, assetId } },
    create: { collectionId, assetId },
    update: {},
  });
  await prisma.editorCollection.update({ where: { id: collectionId }, data: { updatedAt: new Date() } });
}

export async function removeAssetFromCollection(userId: string, collectionId: string, assetId: string): Promise<void> {
  await assertOwnsCollection(userId, collectionId);
  await prisma.editorCollectionAsset.deleteMany({ where: { collectionId, assetId } });
}

export async function listCollectionAssets(userId: string, collectionId: string): Promise<EditorAssetView[]> {
  await assertOwnsCollection(userId, collectionId);
  const storage = await getStorageProvider();
  const items = await prisma.editorCollectionAsset.findMany({
    where: { collectionId },
    orderBy: { addedAt: "desc" },
    include: { asset: true },
  });
  return items.map(({ asset }) => ({
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
