"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { PanelHeader } from "../shared/panel-header";
import { AssetList } from "../shared/asset-list";
import { EmptyState } from "../shared/empty-state";
import { useQuickAddToTimeline } from "../shared/use-quick-add";
import { useStockSearchQuery, type StockSearchResultView } from "../../queries";
import type { ListAssetItem } from "../types";

function toListItem(result: StockSearchResultView, providerId: string, stockCategory: "STOCK_MEDIA" | "ICON"): ListAssetItem {
  return {
    id: `${providerId}:${result.externalId}`,
    label: result.title,
    meta: result.durationSeconds ? `${Math.round(result.durationSeconds)}s · ${providerId}` : providerId,
    kind: result.kind,
    durationMs: result.durationSeconds ? Math.round(result.durationSeconds * 1000) : undefined,
    stockResult: result,
    providerId,
    stockCategory,
    attribution: result.attribution,
    attributionRequired: result.attributionRequired,
  };
}

// Module 11 — Part A: live search list (Stock Music, Sound Effects). Same
// per-provider error/loading pattern as StockSearchGridSection, list
// layout instead of grid. Note: neither Pexels nor Pixabay's public API
// documents an audio search endpoint (both adapters return [] for
// type: "audio", see pexels.adapter.ts/pixabay.adapter.ts's own comments)
// — this tab will legitimately show "no results" until a future provider
// adds real audio search, an honest pre-existing gap, not something faked
// here with placeholder data.
export function StockSearchListSection({
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
  const items: ListAssetItem[] = outcomes.flatMap((o) => o.results.map((r) => toListItem(r, o.providerId, category)));
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
          <AssetList items={items} onAdd={(item) => addAsset(item, item.label)} />
        )}
      </div>
    </div>
  );
}
