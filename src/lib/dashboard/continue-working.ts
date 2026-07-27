import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";

// Milestone 14 — one shared "what's in progress" query, feeding both the
// Dashboard Hero's compact recent-activity strip and the full "Continue
// Working" section, so the two never drift to different data sources.

export type ContinueWorkingKind = "VIDEO" | "TALKING_HEAD" | "IMAGE" | "MARKETING_CREATIVE";

export interface ContinueWorkingItem {
  kind: ContinueWorkingKind;
  id: string;
  title: string;
  status: string;
  href: string;
  thumbnailUrl: string | null;
  updatedAt: Date;
}

export interface ContinueWorking {
  videos: ContinueWorkingItem[];
  talkingHeads: ContinueWorkingItem[];
  images: ContinueWorkingItem[];
  marketingCreatives: ContinueWorkingItem[];
  all: ContinueWorkingItem[];
}

export async function getContinueWorking(userId: string, limitPerKind = 5): Promise<ContinueWorking> {
  // RELIABILITY (2026-07-27) — getStorageProvider() can throw for real,
  // recoverable reasons unrelated to this function's actual job (a
  // ProviderConfig row with ciphertext that can't decrypt under the
  // current CREDENTIAL_ENCRYPTION_KEY, or the deliberate
  // StorageProviderUnavailableError when no real provider is configured in
  // production — see lib/providers/storage/index.ts). Confirmed live: this
  // crashed the entire Dashboard for every user, unconditionally, on every
  // load — storage is only actually needed below to resolve a thumbnail
  // URL for CreativeProject results; VideoProject thumbnails already come
  // from a stored URL, no storage call needed. Losing thumbnails for one
  // broken/unconfigured provider is an acceptable, visible degradation;
  // losing the whole Dashboard for it is not.
  let storage: Awaited<ReturnType<typeof getStorageProvider>> | null = null;
  try {
    storage = await getStorageProvider();
  } catch (err) {
    console.error("[Dashboard] Storage provider unavailable — thumbnails will be omitted:", err);
  }

  const [videoProjects, creativeProjects] = await Promise.all([
    prisma.videoProject.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: limitPerKind * 2,
      select: { id: true, title: true, status: true, sourceType: true, previewThumbnailUrl: true, updatedAt: true },
    }),
    prisma.creativeProject.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: limitPerKind * 2,
      select: { id: true, title: true, status: true, kind: true, updatedAt: true, resultAssetId: true },
    }),
  ]);

  const assetIds = creativeProjects.map((p) => p.resultAssetId).filter((id): id is string => Boolean(id));
  const assets = assetIds.length
    ? await prisma.asset.findMany({ where: { id: { in: assetIds } }, select: { id: true, storageKey: true } })
    : [];
  const assetUrlById = new Map(assets.map((a) => [a.id, storage ? storage.getPublicUrl(a.storageKey) : null]));

  const videos: ContinueWorkingItem[] = [];
  const talkingHeads: ContinueWorkingItem[] = [];
  for (const p of videoProjects) {
    const item: ContinueWorkingItem = {
      kind: p.sourceType === "TALKING_HEAD_UPLOAD" ? "TALKING_HEAD" : "VIDEO",
      id: p.id,
      title: p.title,
      status: p.status,
      href: `/videos/${p.id}`,
      thumbnailUrl: p.previewThumbnailUrl,
      updatedAt: p.updatedAt,
    };
    (item.kind === "TALKING_HEAD" ? talkingHeads : videos).push(item);
  }

  const images: ContinueWorkingItem[] = [];
  const marketingCreatives: ContinueWorkingItem[] = [];
  for (const p of creativeProjects) {
    const item: ContinueWorkingItem = {
      kind: p.kind === "AI_IMAGE" ? "IMAGE" : "MARKETING_CREATIVE",
      id: p.id,
      title: p.title,
      status: p.status,
      href:
        p.kind === "AI_IMAGE"
          ? `/images?projectId=${p.id}#${p.id}`
          : `/marketing-creatives?projectId=${p.id}#${p.id}`,
      thumbnailUrl: p.resultAssetId ? assetUrlById.get(p.resultAssetId) ?? null : null,
      updatedAt: p.updatedAt,
    };
    (item.kind === "IMAGE" ? images : marketingCreatives).push(item);
  }

  const trimmed = {
    videos: videos.slice(0, limitPerKind),
    talkingHeads: talkingHeads.slice(0, limitPerKind),
    images: images.slice(0, limitPerKind),
    marketingCreatives: marketingCreatives.slice(0, limitPerKind),
  };

  const all = [...trimmed.videos, ...trimmed.talkingHeads, ...trimmed.images, ...trimmed.marketingCreatives].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );

  return { ...trimmed, all };
}
