import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

// Creative Studio Sidebar — architecture only, no API wiring yet (per the
// brief). Every section is a registry entry (types.ts + section-registry.ts)
// rather than a hardcoded switch, so adding a 20th section later is "add one
// entry to SIDEBAR_SECTIONS," never a change to the rail or the shell.

export const SIDEBAR_SECTION_IDS = [
  "uploads",
  "stock-videos",
  "stock-images",
  "stock-music",
  "sound-effects",
  "fonts",
  "text",
  "templates",
  "transitions",
  "effects",
  "shapes",
  "icons",
  "stickers",
  // Module 11 — Part B's 6th library-only tab (Templates/Transitions/
  // Effects/Shapes/Stickers/Logos) — no prior "logos" tab existed.
  "logos",
  "brand-kit",
  "projects",
  "favorites",
  "collections",
  // Module 11 — Part D's "auto-populated from actual use" tab.
  "recent",
  "search",
  "filters",
] as const;

export type SidebarSectionId = (typeof SIDEBAR_SECTION_IDS)[number];

// Purely a rail-grouping/divider concern — has no bearing on how a section
// renders its own panel.
export type SidebarSectionGroup = "add" | "stock" | "design" | "workspace" | "tools";

export interface SidebarSectionDef {
  id: SidebarSectionId;
  label: string;
  icon: LucideIcon;
  group: SidebarSectionGroup;
  Component: ComponentType;
}

// Module 11 — the drag-to-timeline payload every real card now carries.
// Two legal shapes: a real, already-existing asset (assetId set — uploads,
// library items, favorites, recent, already-materialized stock results),
// or a raw stock-search result with no EditorAsset row yet (stockResult
// set instead) — timeline-panel.tsx's handleDrop() materializes the
// latter into a real asset before adding the clip. Exactly one of
// `assetId` / `stockResult` is set on any real item.
export interface DraggableAssetPayload {
  assetId?: string;
  kind?: string;
  durationMs?: number;
  stockResult?: { externalId: string; title: string; previewUrl: string; downloadUrl: string; kind: string; durationSeconds?: number };
  providerId?: string;
  stockCategory?: "STOCK_MEDIA" | "ICON";
  // Smart track creation on drop (2026-07-12) — the curated Library tabs'
  // own LibraryAssetCategory (e.g. "STICKER"/"LOGO"/"SHAPE"), forwarded so
  // handleDrop() can tell "this IMAGE came from a decorative-overlay
  // category" apart from "this IMAGE came from Uploads/Stock search" and
  // default it to the right track kind — see resolveDropTrackKind in
  // timeline-panel.tsx. Undefined for every non-library-tab source.
  libraryCategory?: string;
}

// Shared item shapes the grid/list panel engines target. `swatch` is the
// placeholder fallback color (Tailwind bg-* class) used only when
// `previewUrl` isn't available (still true for a few not-yet-thumbnailed
// mock sections during Module 11's migration) — a real thumbnail always
// wins once a section is wired to its API.
// Stock providers expansion (2026-07-18) — display-only, not part of the
// drag-to-timeline payload (materializeStockAsset already gets the real
// attribution data via the full stockResult object DraggableAssetPayload
// already carries) — these two exist purely so AssetCard/AssetList can
// show a "credit required" indicator before the user even adds the item.
interface AttributionDisplay {
  attribution?: string;
  attributionRequired?: boolean;
}

export interface GridAssetItem extends DraggableAssetPayload, AttributionDisplay {
  id: string;
  label: string;
  meta?: string;
  swatch: string;
  previewUrl?: string;
  isFavorited?: boolean;
}

export interface ListAssetItem extends DraggableAssetPayload, AttributionDisplay {
  id: string;
  label: string;
  meta?: string; // e.g. a duration string, a font-family sample
  fontFamily?: string; // Fonts/Text sections render the label in-font as its own preview
  previewUrl?: string;
  isFavorited?: boolean;
}
