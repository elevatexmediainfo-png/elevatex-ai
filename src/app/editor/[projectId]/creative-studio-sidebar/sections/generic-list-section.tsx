"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { PanelHeader } from "../shared/panel-header";
import { AssetList } from "../shared/asset-list";
import { EmptyState } from "../shared/empty-state";
import { MOCK_LIST_ITEMS } from "../shared/mock-data";
import type { SidebarSectionId } from "../types";

// Generic engine behind every row-list section (Stock Music, Sound Effects,
// Fonts, Text) — mirrors generic-grid-section.tsx's one-engine-many-configs
// approach for the sections whose content reads better as rows than tiles.
export function GenericListSection({
  sectionId,
  title,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  previewGlyph,
}: {
  sectionId: SidebarSectionId;
  title: string;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  previewGlyph?: string;
}) {
  const [search, setSearch] = React.useState("");
  const allItems = MOCK_LIST_ITEMS[sectionId] ?? [];
  const items = search.trim()
    ? allItems.filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase()))
    : allItems;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={title} searchValue={search} onSearchChange={setSearch} />
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {items.length === 0 ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
        ) : (
          <AssetList items={items} previewGlyph={previewGlyph} />
        )}
      </div>
    </div>
  );
}
