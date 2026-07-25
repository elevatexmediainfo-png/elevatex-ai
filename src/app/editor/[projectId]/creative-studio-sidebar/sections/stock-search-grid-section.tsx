"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { PanelHeader } from "../shared/panel-header";
import { AssetGrid } from "../shared/asset-grid";
import { EmptyState } from "../shared/empty-state";
import { useQuickAddToTimeline } from "../shared/use-quick-add";
import { useStockSearchQuery, type StockSearchResultView } from "../../queries";
import type { GridAssetItem } from "../types";

const SWATCH_FALLBACK = "bg-neutral-700/40";

function toGridItem(result: StockSearchResultView, providerId: string, stockCategory: "STOCK_MEDIA" | "ICON"): GridAssetItem {
  return {
    id: `${providerId}:${result.externalId}`,
    label: result.title,
    meta: providerId,
    swatch: SWATCH_FALLBACK,
    previewUrl: result.previewUrl,
    kind: result.kind,
    durationMs: result.durationSeconds ? Math.round(result.durationSeconds * 1000) : undefined,
    stockResult: result,
    providerId,
    stockCategory,
    attribution: result.attribution,
    attributionRequired: result.attributionRequired,
  };
}

// Module 11 — Part A: live search grid (Stock Videos/Images, and Icons —
// icons+animations via IconScout). A thin wrapper around the shared
// AssetGrid, distinct from LibraryGridSection because it owns per-provider
// loading/error state (searchStockMedia()'s `outcomes`) that a curated
// library query never has — "if a provider errors, fail gracefully and
// still show other providers' results" is rendered here as a small error
// strip per failed provider, not a failed whole-panel state.
export function StockSearchGridSection({
  category,
  type,
  title,
  emptyIcon,
}: {
  category: "STOCK_MEDIA" | "ICON";
  type?: string;
  title: string;
  emptyIcon: LucideIcon;
}) {
  const [query, setQuery] = React.useState("");
  const { data, isLoading } = useStockSearchQuery(category, query, { type });
  const { addAsset } = useQuickAddToTimeline();

  const outcomes = data?.outcomes ?? [];
  const items: GridAssetItem[] = outcomes.flatMap((o) => o.results.map((r) => toGridItem(r, o.providerId, category)));
  const failedProviders = outcomes.filter((o) => o.error);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={title} searchValue={query} onSearchChange={setQuery} searchPlaceholder={`Search ${title.toLowerCase()}…`} />
      {failedProviders.length > 0 && (
        <div className="border-b border-editor-line px-3 py-1.5">
          {failedProviders.map((o) => (
            <p key={o.providerId} className="text-caption text-warning">
              {o.providerId}: {o.error}
            </p>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {!query.trim() ? (
          <EmptyState icon={emptyIcon} title={title} description="Type a search term to find content." />
        ) : isLoading ? (
          <p className="p-4 text-caption text-neutral-500">Searching…</p>
        ) : items.length === 0 ? (
          <EmptyState icon={emptyIcon} title="No results found" description="Try a different search term." />
        ) : (
          <AssetGrid items={items} onAdd={(item) => addAsset(item, item.label)} />
        )}
      </div>
    </div>
  );
}
