"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { PanelHeader } from "../shared/panel-header";
import { AssetGrid } from "../shared/asset-grid";
import { EmptyState } from "../shared/empty-state";
import { useQuickAddToTimeline } from "../shared/use-quick-add";
import { useLibraryAssetsQuery, type LibraryAssetView } from "../../queries";
import type { GridAssetItem } from "../types";

const SWATCH_FALLBACK = "bg-neutral-700/40";

function toGridItem(asset: LibraryAssetView): GridAssetItem {
  return {
    id: asset.id,
    label: asset.originalFilename,
    swatch: SWATCH_FALLBACK,
    previewUrl: asset.thumbnailUrl ?? (asset.kind === "IMAGE" ? asset.url : undefined),
    assetId: asset.id,
    kind: asset.kind,
    durationMs: asset.durationSeconds ? Math.round(asset.durationSeconds * 1000) : undefined,
    meta: asset.durationSeconds ? `${Math.round(asset.durationSeconds)}s` : undefined,
    libraryCategory: asset.category,
  };
}

// Module 11 — Part B: Templates/Transitions/Effects/Shapes/Stickers/Logos.
// All six are LIBRARY-scope EditorAssets (Milestone 26's Admin Asset
// Library), queried by libraryCategory — no live provider involved, no
// per-provider loading/error UI needed, so this stays a thin wrapper
// around the same AssetGrid every other grid section uses, just fed by a
// real query instead of mock-data.ts. A real asset already exists for
// every item here, so cards are draggable via the plain {assetId,...}
// payload — no materialize-on-drop step (that's stock-search-only).
export function LibraryGridSection({
  category,
  title,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: {
  category: string;
  title: string;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const { data, isLoading } = useLibraryAssetsQuery(category, debouncedSearch);
  const { addAsset } = useQuickAddToTimeline();

  const items = (data?.assets ?? []).map(toGridItem);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={title} searchValue={search} onSearchChange={setSearch} />
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {isLoading ? (
          <p className="p-4 text-caption text-neutral-500">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
        ) : (
          <AssetGrid items={items} onAdd={(item) => addAsset(item, item.label)} />
        )}
      </div>
    </div>
  );
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
