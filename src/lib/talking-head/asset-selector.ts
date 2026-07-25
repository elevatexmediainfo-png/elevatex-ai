import type { SceneVisualType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/admin/config";
import { getStockAssetLibrary } from "@/lib/assets/service";
import type { AssetSourceValue } from "@/lib/assets/service";

// Milestone 11 Part 5 — Intelligent Asset Selection. selectAssetForScene()
// is a pure decision function: given a scene's visual type/tags and the
// candidate pools gathered by resolveSceneAsset() (the thin DB-reading
// wrapper below), it returns exactly one waterfall decision. Never
// generates an expensive AI asset unless every cheaper/reuse tier misses —
// Part 11's cost-optimization rule lives entirely in this one function.

export type AssetSelectionKind = "REUSE_EXISTING" | "REUSE_BRAND" | "REUSE_UPLOADED" | "STOCK" | "AI_IMAGE" | "AI_VIDEO";
export type AssetMediaKind = "IMAGE" | "VIDEO";

export interface AssetCandidate {
  source: AssetSourceValue;
  mediaKind: AssetMediaKind | "STICKER";
  /** Set for a real Asset row (every source except STOCK). */
  storageKey?: string;
  /** Set for a STOCK_ASSET_LIBRARY entry (a static URL, no Asset row). */
  url?: string;
  label: string;
}

export interface AssetSelectionInput {
  visualType: SceneVisualType;
  tags: string[];
  projectAssets: AssetCandidate[];
  brandAssets: AssetCandidate[];
  uploadedAssets: AssetCandidate[];
  stockAssets: AssetCandidate[];
  aiVideoEnabled: boolean;
}

export interface AssetSelectionResult {
  kind: AssetSelectionKind;
  mediaKind: AssetMediaKind;
  candidate?: AssetCandidate;
  reason: string;
}

// B_ROLL/ANIMATION want short video clips; everything else (IMAGE, LOGO,
// SCREENSHOT, WEBSITE, GRAPH, CHART, ICON) wants a still image. FACE_ONLY
// and TEXT_OVERLAY never reach this function (see resolveSceneAsset).
function mediaKindForVisualType(visualType: SceneVisualType): AssetMediaKind {
  return visualType === "B_ROLL" || visualType === "ANIMATION" ? "VIDEO" : "IMAGE";
}

function matchesTags(candidate: AssetCandidate, mediaKind: AssetMediaKind, tags: string[]): boolean {
  if (candidate.mediaKind !== mediaKind) return false;
  if (tags.length === 0) return true;
  const label = candidate.label.toLowerCase();
  return tags.some((tag) => {
    const t = tag.toLowerCase();
    return label.includes(t) || t.includes(label);
  });
}

export function selectAssetForScene(input: AssetSelectionInput): AssetSelectionResult {
  const mediaKind = mediaKindForVisualType(input.visualType);

  // LOGO is special-cased to the Brand Kit specifically — an arbitrary
  // tag-matched stock/project image would defeat the point of a logo slot.
  if (input.visualType === "LOGO") {
    const brandLogo = input.brandAssets.find((a) => a.mediaKind === "IMAGE");
    if (brandLogo) {
      return { kind: "REUSE_BRAND", mediaKind: "IMAGE", candidate: brandLogo, reason: "Brand Kit logo." };
    }
    return { kind: "AI_IMAGE", mediaKind: "IMAGE", reason: "No Brand Kit logo configured." };
  }

  const project = input.projectAssets.find((c) => matchesTags(c, mediaKind, input.tags));
  if (project) {
    return { kind: "REUSE_EXISTING", mediaKind, candidate: project, reason: "Matches an asset already in this project." };
  }

  const brand = input.brandAssets.find((c) => matchesTags(c, mediaKind, input.tags));
  if (brand) {
    return { kind: "REUSE_BRAND", mediaKind, candidate: brand, reason: "Matches a Brand Kit asset." };
  }

  const uploaded = input.uploadedAssets.find((c) => matchesTags(c, mediaKind, input.tags));
  if (uploaded) {
    return { kind: "REUSE_UPLOADED", mediaKind, candidate: uploaded, reason: "Matches a previously uploaded asset." };
  }

  const stock = input.stockAssets.find((c) => matchesTags(c, mediaKind, input.tags));
  if (stock) {
    return { kind: "STOCK", mediaKind, candidate: stock, reason: "Matches a stock library asset." };
  }

  if (mediaKind === "VIDEO") {
    if (input.aiVideoEnabled) {
      return { kind: "AI_VIDEO", mediaKind: "VIDEO", reason: "No reuse/stock match; AI video generation is enabled." };
    }
    // Part 5/11's premium gate: AI video generation is the most expensive
    // tier and is never used unless the admin-configured flag is on —
    // fall back to a generated still image instead of skipping the visual.
    return { kind: "AI_IMAGE", mediaKind: "IMAGE", reason: "No reuse/stock match; AI video generation is disabled." };
  }

  return { kind: "AI_IMAGE", mediaKind: "IMAGE", reason: "No reuse/stock match." };
}

export interface SceneForAssetSelection {
  id: string;
  visualType: SceneVisualType | null;
}

export interface ProjectForAssetSelection {
  id: string;
  userId: string;
}

function assetToCandidate(asset: { source: AssetSourceValue; kind: string; storageKey: string; label: string | null }): AssetCandidate {
  return {
    source: asset.source,
    mediaKind: asset.kind as AssetMediaKind | "STICKER",
    storageKey: asset.storageKey,
    label: asset.label ?? "asset",
  };
}

// Thin wrapper — gathers the real candidate pools (Project Assets, Brand
// Kit, the user's other Uploaded Assets, the admin Stock Library) and the
// premium feature flag, then hands off to the pure selectAssetForScene().
// Returns null for FACE_ONLY/TEXT_OVERLAY, which never need an asset
// decision at all.
export async function resolveSceneAsset(
  scene: SceneForAssetSelection,
  project: ProjectForAssetSelection
): Promise<AssetSelectionResult | null> {
  if (!scene.visualType || scene.visualType === "FACE_ONLY" || scene.visualType === "TEXT_OVERLAY") {
    return null;
  }

  const [segments, projectAssetRows, uploadedAssetRows, brandKit, aiVideoEnabled, stockLibrary] = await Promise.all([
    prisma.transcriptSegment.findMany({ where: { sceneId: scene.id }, select: { analysis: true } }),
    prisma.asset.findMany({ where: { videoProjectId: project.id, kind: { in: ["IMAGE", "VIDEO"] } } }),
    prisma.asset.findMany({
      where: { userId: project.userId, source: "UPLOAD", videoProjectId: null, kind: { in: ["IMAGE", "VIDEO"] } },
    }),
    prisma.brandKit.findUnique({ where: { userId: project.userId } }),
    getConfig("TALKING_HEAD_AI_VIDEO_GENERATION_ENABLED"),
    getStockAssetLibrary(),
  ]);

  const tags = segments.flatMap((s) => {
    const analysis = s.analysis as { tags?: string[] } | null;
    return analysis?.tags ?? [];
  });

  const brandLogo = brandKit?.logoAssetId
    ? await prisma.asset.findUnique({ where: { id: brandKit.logoAssetId } })
    : null;

  return selectAssetForScene({
    visualType: scene.visualType,
    tags,
    projectAssets: projectAssetRows.map(assetToCandidate),
    brandAssets: brandLogo ? [assetToCandidate(brandLogo)] : [],
    uploadedAssets: uploadedAssetRows.map(assetToCandidate),
    stockAssets: stockLibrary
      .filter((s) => s.kind === "IMAGE" || s.kind === "VIDEO")
      .map((s) => ({ source: "STOCK" as const, mediaKind: s.kind as AssetMediaKind, url: s.url, label: s.label })),
    aiVideoEnabled,
  });
}
