import { Copyright, Heart, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { GridAssetItem } from "../types";
import { setDragPayload } from "./drag-payload";
import { MotionCard } from "../../motion-primitives";

// Thumbnail-grid layout shared by every visually-browsable section (Stock
// Videos/Images, Templates, Shapes, Icons, Stickers, Transitions, Effects,
// Favorites, Collections). Module 11 — the hover "+" affordance and
// drag-and-drop are now real: any item carrying `assetId` or `stockResult`
// (see types.ts's DraggableAssetPayload) is draggable, and `onAdd` (if
// provided) wires the same "+" button as a click-to-add fallback for
// non-drag interactions. `onToggleFavorite`/`onRemove` are optional and
// distinct — a favorite heart is never repurposed as a collection "remove"
// action, they're different semantics even though both are per-card icon
// buttons.
export function AssetGrid({
  items,
  onAdd,
  onToggleFavorite,
  onRemove,
}: {
  items: GridAssetItem[];
  onAdd?: (item: GridAssetItem) => void;
  onToggleFavorite?: (item: GridAssetItem) => void;
  onRemove?: (item: GridAssetItem) => void;
}) {
  // grid-cols-3 (fixed) -> auto-fill/minmax (2026-07-15, resizable panels)
  // — same reasoning as uploads-section.tsx's own AssetThumb grid: the
  // Left Panel's width is now user-adjustable, so a hardcoded column
  // count would crowd or waste space depending on the chosen width.
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2 p-3">
      {items.map((item) => (
        <AssetCard key={item.id} item={item} onAdd={onAdd} onToggleFavorite={onToggleFavorite} onRemove={onRemove} />
      ))}
    </div>
  );
}

function AssetCard({
  item,
  onAdd,
  onToggleFavorite,
  onRemove,
}: {
  item: GridAssetItem;
  onAdd?: (item: GridAssetItem) => void;
  onToggleFavorite?: (item: GridAssetItem) => void;
  onRemove?: (item: GridAssetItem) => void;
}) {
  const draggable = !!(item.assetId || item.stockResult);

  return (
    <MotionCard
      className="overflow-hidden rounded-editor-card border border-editor-line bg-editor-surface-1 shadow-editor-card transition-colors duration-200 hover:border-editor-border-hover"
      draggable={draggable}
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
      <div className={cn("relative flex aspect-square items-center justify-center overflow-hidden", !item.previewUrl && item.swatch)}>
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt={item.label} className="size-full object-cover" />
        ) : (
          <span className="text-caption font-medium text-white/70">{item.label.slice(0, 2).toUpperCase()}</span>
        )}
        {item.meta && (
          <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 py-0.5 text-nano leading-none text-white">{item.meta}</span>
        )}
        {item.attributionRequired && (
          <span
            className="absolute top-1 left-1 rounded-full bg-black/70 p-0.5 text-amber-300"
            title={item.attribution ? `Attribution required: ${item.attribution}` : "Attribution required by this source's license"}
          >
            <Copyright className="size-3" />
          </span>
        )}
      </div>
      <div className="px-1.5 py-1">
        <p className="truncate text-micro text-neutral-300">{item.label}</p>
      </div>
      {onToggleFavorite && (
        <button
          type="button"
          onClick={() => onToggleFavorite(item)}
          className={cn(
            "absolute top-1 left-1 rounded-full bg-black/60 p-1 text-white",
            item.isFavorited ? "block" : "hidden group-hover:block"
          )}
          title={item.isFavorited ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={cn("size-3", item.isFavorited && "fill-current text-editor-danger")} />
        </button>
      )}
      {onAdd && (
        <button
          type="button"
          onClick={() => onAdd(item)}
          className="absolute top-1 right-1 hidden rounded-full bg-black/60 p-1 text-white group-hover:block"
          title="Add to timeline"
        >
          <Plus className="size-3" />
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(item)}
          className="absolute right-1 bottom-1 hidden rounded-full bg-black/60 p-1 text-white hover:text-editor-danger group-hover:block"
          title="Remove from collection"
        >
          <X className="size-3" />
        </button>
      )}
    </MotionCard>
  );
}
