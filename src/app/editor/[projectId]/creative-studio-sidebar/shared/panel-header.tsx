"use client";

import { SlidersHorizontal } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Shared header for every content-browsing panel — title + an in-memory
// search box (filters the mock dataset client-side; swapping mock-data.ts
// for a real query later needs no change here) + an optional filter toggle.
export function PanelHeader({
  title,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filtersOpen,
  onToggleFilters,
}: {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filtersOpen?: boolean;
  onToggleFilters?: () => void;
}) {
  return (
    // gap-2.5 -> gap-2 (2026-07-15, left-panel density pass) — tighter
    // vertical rhythm between the title and search rows.
    <div className="flex flex-col gap-2 border-b border-editor-line p-3">
      <div className="flex items-center justify-between">
        {/* Fix (2026-07-13) — premium design-token foundation: panel/section
            titles now use the editor's own 16px/600 scale step, distinct
            from the sitewide 14px/600 text-label-md this used to borrow.
            Reduced 16px -> 15px (2026-07-15, left-panel density pass) —
            an explicit size override rather than changing the shared
            `--text-editor-panel-title` token itself, since that token is
            also used by the Right Properties Panel's "Properties" header
            (right-properties-panel.tsx), which wasn't in scope for this
            pass; `font-semibold` re-states the weight the token would
            otherwise have carried bundled with its own size. */}
        <h2 className="text-[15px] font-semibold text-neutral-100">{title}</h2>
      </div>
      <div className="flex items-center gap-1.5">
        {/* text-body-sm (13px) -> text-[12px] (2026-07-15, left-panel
            density pass) — a real browser input can't size its
            placeholder independently of typed text (both always share
            the input's one font-size), so "placeholder ~12px" means the
            whole field's text-size, not just the placeholder string. */}
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder ?? `Search ${title.toLowerCase()}…`}
          className="h-8 rounded-md border-editor-line bg-editor-surface-1 text-[12px] text-neutral-100 placeholder:text-neutral-500"
        />
        {onToggleFilters && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn("shrink-0 rounded-md text-neutral-400 hover:bg-editor-surface-2 hover:text-white", filtersOpen && "bg-editor-surface-2 text-white")}
            onClick={onToggleFilters}
            title="Filters"
          >
            <SlidersHorizontal className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
