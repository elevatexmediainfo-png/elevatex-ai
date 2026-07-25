"use client";

import * as React from "react";
import { Smile } from "lucide-react";

import { PanelHeader } from "../shared/panel-header";
import { AssetGrid } from "../shared/asset-grid";
import { EmptyState } from "../shared/empty-state";
import { useQuickAddToTimeline } from "../shared/use-quick-add";
import { useStockSearchQuery, type StockSearchResultView } from "../../queries";
import type { GridAssetItem } from "../types";

const SWATCH_FALLBACK = "bg-neutral-700/40";

function toGridItem(result: StockSearchResultView, providerId: string, typeLabel: string): GridAssetItem {
  return {
    id: `${providerId}:${result.externalId}`,
    label: result.title,
    meta: typeLabel,
    swatch: SWATCH_FALLBACK,
    previewUrl: result.previewUrl,
    kind: result.kind,
    stockResult: result,
    providerId,
    stockCategory: "ICON",
  };
}

// Module 11 — Part A: the Icons tab covers BOTH plain icons AND Lottie
// animations via IconScout (see IconScoutAdapter — asset=icon vs.
// asset=lottie, same one adapter/key), per the founder's confirmed tab
// sourcing. Two parallel searches (one per `type`), merged into one grid —
// kept as its own small component rather than widening
// StockSearchGridSection's `type` prop to accept an array, since no other
// tab needs more than one type at once.
export function IconsSection() {
  const [query, setQuery] = React.useState("");
  const iconsQuery = useStockSearchQuery("ICON", query, { type: "icon" });
  const animationsQuery = useStockSearchQuery("ICON", query, { type: "animation" });
  const { addAsset } = useQuickAddToTimeline();

  const isLoading = iconsQuery.isLoading || animationsQuery.isLoading;
  const iconOutcomes = iconsQuery.data?.outcomes ?? [];
  const animationOutcomes = animationsQuery.data?.outcomes ?? [];

  const items: GridAssetItem[] = [
    ...iconOutcomes.flatMap((o) => o.results.map((r) => toGridItem(r, o.providerId, "Icon"))),
    ...animationOutcomes.flatMap((o) => o.results.map((r) => toGridItem(r, o.providerId, "Animation"))),
  ];
  const failedProviders = [...iconOutcomes, ...animationOutcomes].filter((o) => o.error);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Icons" searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search icons & animations…" />
      {failedProviders.length > 0 && (
        <div className="border-b border-editor-line px-3 py-1.5">
          {failedProviders.map((o, i) => (
            <p key={`${o.providerId}-${i}`} className="text-caption text-warning">
              {o.providerId}: {o.error}
            </p>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {!query.trim() ? (
          <EmptyState icon={Smile} title="Icons" description="Type a search term to find icons and animations." />
        ) : isLoading ? (
          <p className="p-4 text-caption text-neutral-500">Searching…</p>
        ) : items.length === 0 ? (
          <EmptyState icon={Smile} title="No results found" description="Try a different search term." />
        ) : (
          <AssetGrid items={items} onAdd={(item) => addAsset(item, item.label)} />
        )}
      </div>
    </div>
  );
}
