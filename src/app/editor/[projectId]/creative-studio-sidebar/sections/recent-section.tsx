"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import { PanelHeader } from "../shared/panel-header";
import { AssetGrid } from "../shared/asset-grid";
import { EmptyState } from "../shared/empty-state";
import { useQuickAddToTimeline } from "../shared/use-quick-add";
import { useFavoritesQuery, useRecentAssetsQuery, useToggleFavoriteMutation } from "../../queries";
import type { GridAssetItem } from "../types";

const SWATCH_FALLBACK = "bg-neutral-700/40";

// Module 11 — Part D: "Recent" is derived from actual EditorClip usage
// (lib/video-editor/recent-assets.ts) — there's no separate "mark as
// recent" action, this tab just reflects what's genuinely been placed on a
// timeline recently, most-recent-use first.
export function RecentSection() {
  const [search, setSearch] = React.useState("");
  const { data, isLoading } = useRecentAssetsQuery();
  const { data: favorites } = useFavoritesQuery();
  const toggleFavorite = useToggleFavoriteMutation();
  const { addAsset } = useQuickAddToTimeline();

  const favoritedIds = new Set((favorites ?? []).map((a) => a.id));
  const allItems: GridAssetItem[] = (data ?? []).map((a) => ({
    id: a.id,
    label: a.originalFilename,
    swatch: SWATCH_FALLBACK,
    previewUrl: a.kind === "IMAGE" ? a.url : undefined,
    assetId: a.id,
    kind: a.kind,
    durationMs: a.durationSeconds ? Math.round(a.durationSeconds * 1000) : undefined,
    isFavorited: favoritedIds.has(a.id),
  }));
  const items = search.trim() ? allItems.filter((i) => i.label.toLowerCase().includes(search.trim().toLowerCase())) : allItems;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Recent" searchValue={search} onSearchChange={setSearch} />
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {isLoading ? (
          <p className="p-4 text-caption text-neutral-500">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState icon={Clock} title="Nothing used yet" description="Assets you place on the timeline will appear here." />
        ) : (
          <AssetGrid
            items={items}
            onAdd={(item) => addAsset(item, item.label)}
            onToggleFavorite={(item) => item.assetId && toggleFavorite.mutate(item.assetId)}
          />
        )}
      </div>
    </div>
  );
}
