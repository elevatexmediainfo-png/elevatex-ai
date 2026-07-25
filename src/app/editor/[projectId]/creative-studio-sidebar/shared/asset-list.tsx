import { Copyright, Heart, Plus, Volume2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ListAssetItem } from "../types";
import { setDragPayload } from "./drag-payload";

// Row-based layout shared by audio/text-metadata sections (Stock Music,
// Sound Effects, Fonts, Text). `fontFamily`, when set, previews the label
// rendered in that font. Module 11 — same real drag/add/favorite wiring as
// AssetGrid (see that file's header comment); a row with `fontFamily` set
// is a click-only font row (fonts apply to the selected text clip, they
// don't drop onto the timeline), so it's never made draggable regardless
// of onAdd/assetId.
export function AssetList({
  items,
  previewGlyph = "Aa",
  onAdd,
  onToggleFavorite,
  onRowClick,
}: {
  items: ListAssetItem[];
  previewGlyph?: string;
  onAdd?: (item: ListAssetItem) => void;
  onToggleFavorite?: (item: ListAssetItem) => void;
  onRowClick?: (item: ListAssetItem) => void;
}) {
  return (
    <div className="flex flex-col divide-y divide-white/5 p-1">
      {items.map((item) => {
        const isFontRow = !!item.fontFamily;
        const draggable = !isFontRow && !!(item.assetId || item.stockResult);
        return (
          <div
            key={item.id}
            className={cn("group flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-editor-surface-1", onRowClick && "cursor-pointer")}
            draggable={draggable}
            onClick={onRowClick ? () => onRowClick(item) : undefined}
            onDragStart={
              draggable
                ? (e) =>
                    setDragPayload(e, {
                      assetId: item.assetId,
                      kind: item.kind,
                      durationMs: item.durationMs,
                      stockResult: item.stockResult,
                      providerId: item.providerId,
                      stockCategory: item.stockCategory,
                      libraryCategory: item.libraryCategory,
                    })
                : undefined
            }
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-editor-surface-1 text-label-sm text-neutral-300"
              style={item.fontFamily ? { fontFamily: item.fontFamily } : undefined}
            >
              {item.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl} alt={item.label} className="size-full object-cover" />
              ) : item.fontFamily ? (
                previewGlyph
              ) : (
                <Volume2 className="size-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-body-sm text-neutral-200"
                style={item.fontFamily ? { fontFamily: item.fontFamily } : undefined}
              >
                {item.label}
              </p>
              {item.meta && <p className="truncate text-caption text-neutral-500">{item.meta}</p>}
            </div>
            {item.attributionRequired && (
              <span
                className="shrink-0 text-amber-400"
                title={item.attribution ? `Attribution required: ${item.attribution}` : "Attribution required by this source's license"}
              >
                <Copyright className="size-3.5" />
              </span>
            )}
            {onToggleFavorite && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(item);
                }}
                className={cn(
                  "shrink-0 rounded-full p-1 text-neutral-400 hover:text-white",
                  item.isFavorited ? "block" : "hidden group-hover:block"
                )}
                title={item.isFavorited ? "Remove from favorites" : "Add to favorites"}
              >
                <Heart className={cn("size-3.5", item.isFavorited && "fill-current text-editor-danger")} />
              </button>
            )}
            {onAdd && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(item);
                }}
                className="hidden shrink-0 rounded-full p-1 text-neutral-400 hover:text-white group-hover:block"
                title="Add to timeline"
              >
                <Plus className="size-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
