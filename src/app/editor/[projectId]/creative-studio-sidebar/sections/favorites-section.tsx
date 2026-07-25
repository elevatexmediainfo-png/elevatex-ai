"use client";

import * as React from "react";
import { Heart } from "lucide-react";

import { PanelHeader } from "../shared/panel-header";
import { AssetGrid } from "../shared/asset-grid";
import { EmptyState } from "../shared/empty-state";
import { useQuickAddToTimeline } from "../shared/use-quick-add";
import { useFavoritesQuery, useToggleFavoriteMutation } from "../../queries";
import type { AssetView } from "../../../types";
import type { GridAssetItem } from "../types";

const SWATCH_FALLBACK = "bg-neutral-700/40";

function toGridItem(asset: AssetView): GridAssetItem {
  return {
    id: asset.id,
    label: asset.originalFilename,
    swatch: SWATCH_FALLBACK,
    previewUrl: asset.kind === "IMAGE" ? asset.url : undefined,
    assetId: asset.id,
    kind: asset.kind,
    durationMs: asset.durationSeconds ? Math.round(asset.durationSeconds * 1000) : undefined,
    isFavorited: true,
  };
}

// Module 11 — Part D: any asset (user upload, library item, or a
// materialized stock-search result) a user has favorited. Favoriting a raw
// stock result is never a special case here — it's already materialized
// into a real EditorAsset by the time it can be favorited (the heart
// toggle only ever appears on cards that already have a real assetId — see
// AssetGrid/AssetList's onToggleFavorite prop, only wired where an assetId
// exists).
export function FavoritesSection() {
  const [search, setSearch] = React.useState("");
  const { data, isLoading } = useFavoritesQuery();
  const toggleFavorite = useToggleFavoriteMutation();
  const { addAsset } = useQuickAddToTimeline();

  const allItems = (data ?? []).map(toGridItem);
  const items = search.trim() ? allItems.filter((i) => i.label.toLowerCase().includes(search.trim().toLowerCase())) : allItems;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Favorites" searchValue={search} onSearchChange={setSearch} />
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {isLoading ? (
          <p className="p-4 text-caption text-neutral-500">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState icon={Heart} title="No favorites yet" description="Items you favorite across the Creative Studio will appear here." />
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
