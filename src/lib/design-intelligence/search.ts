import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/providers/storage";

// Milestone 16 — the Design Intelligence Library's "Reference Search" step.
// No embeddings yet (deferred by explicit decision), so this is recency +
// "has it actually been analyzed" filtering, not similarity ranking — a
// user's own previously-uploaded reference images they can reuse without
// re-uploading, surfaced as a "Recent references" picker in the Creative
// Studio wizard.
export interface RecentReferenceView {
  assetId: string;
  url: string;
  label: string | null;
  industry: string | null;
  category: string | null;
  style: string | null;
  mood: string | null;
  createdAt: Date;
}

export async function listRecentReferences(userId: string, limit = 12): Promise<RecentReferenceView[]> {
  const storage = await getStorageProvider();
  const rows = await prisma.asset.findMany({
    where: { userId, kind: "IMAGE", source: "UPLOAD", status: "READY", analysis: { isNot: null } },
    include: { analysis: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    assetId: row.id,
    url: storage.getPublicUrl(row.storageKey),
    label: row.label,
    industry: row.analysis?.industry ?? null,
    category: row.analysis?.category ?? null,
    style: row.analysis?.style ?? null,
    mood: row.analysis?.mood ?? null,
    createdAt: row.createdAt,
  }));
}
