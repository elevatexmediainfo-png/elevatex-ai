import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { resolveProviderCredentials } from "@/lib/providers/credentials";
import { testProviderConnection, type TestConnectionResult } from "@/lib/providers/test-connection";

// Milestone 12 — "Storage Monitoring" without inventing a second mechanism:
// S3/R2/MinIO support already shipped in Milestone 4/10 (lib/providers/storage),
// and the per-vendor reachability check already exists (test-connection.ts).
// This is a read-only aggregation of the Asset table (already populated by
// every upload/generation call site) plus that existing reachability check.

export interface StorageUsageGroup {
  group: string;
  count: number;
  totalBytes: number;
}

export interface StorageUsageSummary {
  byKind: StorageUsageGroup[];
  bySource: StorageUsageGroup[];
  totalAssets: number;
  // Only direct-uploaded assets (Milestone 9/11's upload routes) currently
  // populate Asset.fileSizeBytes — AI-generated assets don't probe their own
  // output size today, so this is a lower bound, not the true bucket size.
  totalKnownBytes: number;
  reachability: TestConnectionResult | null;
}

export async function getStorageUsageSummary(): Promise<StorageUsageSummary> {
  const [byKindRaw, bySourceRaw, totalAssets, totalKnownBytesAgg] = await Promise.all([
    prisma.asset.groupBy({ by: ["kind"], _count: { _all: true }, _sum: { fileSizeBytes: true } }),
    prisma.asset.groupBy({ by: ["source"], _count: { _all: true }, _sum: { fileSizeBytes: true } }),
    prisma.asset.count(),
    prisma.asset.aggregate({ _sum: { fileSizeBytes: true } }),
  ]);

  const providerId = await getConfig("PROVIDER_STORAGE");
  const reachability =
    providerId === "mock"
      ? { ok: true, message: "Mock storage provider — always reachable, no real bucket configured." }
      : await testProviderConnection("STORAGE", providerId, await resolveProviderCredentials("STORAGE", providerId));

  return {
    byKind: byKindRaw.map((r) => ({ group: r.kind, count: r._count._all, totalBytes: r._sum.fileSizeBytes ?? 0 })),
    bySource: bySourceRaw.map((r) => ({ group: r.source, count: r._count._all, totalBytes: r._sum.fileSizeBytes ?? 0 })),
    totalAssets,
    totalKnownBytes: totalKnownBytesAgg._sum.fileSizeBytes ?? 0,
    reachability,
  };
}
