import {
  Captions,
  MoreHorizontal,
  Music,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Sticker,
  Type,
  Upload,
  type LucideIcon,
} from "lucide-react";

import type { SidebarSectionId } from "./types";

// Left panel restructure (2026-07-14) against premium-editor.jsx, the
// founder's approved reference mockup — a horizontal tool-tab strip
// grouping SIDEBAR_SECTIONS (section-registry.tsx, unchanged, still the
// only source of truth for what a section actually IS) rather than
// replacing it. Purely a new presentation layer on top of the same 21 real
// sections.
//
// The mockup's own 8 tabs (Media/Audio/Text/Stickers/Effects/Transitions/
// Captions/Filters) only cover 11 of those 21 sections — building it
// literally would make Templates/Shapes/Icons/Logos/Brand Kit/Projects/
// Favorites/Collections/Recent/Search unreachable, a real functionality
// regression the brief's own "must keep working exactly as today" rule
// forbids. Confirmed with the founder: added a 9th "More" tab holding
// everything else, rather than losing access to real, working sections.
//
// "Captions" has no real feature behind it yet (auto-caption generation is
// a "coming soon" stub elsewhere in this app, see keyframe-track.tsx's own
// existing tooltip) — kept as a visible-but-disabled tab with the same
// "coming soon" language, not a working dead link. The mockup's own
// "Subprojects"/"Spaces" sub-nav items have no comparable real feature to
// anchor to at all and were dropped entirely, also confirmed with the
// founder.
export type PanelTabId = "media" | "audio" | "text" | "stickers" | "effects" | "transitions" | "captions" | "filters" | "more";

export interface PanelTabDef {
  id: PanelTabId;
  label: string;
  icon: LucideIcon;
  sectionIds: SidebarSectionId[];
  disabled?: boolean;
  disabledReason?: string;
}

export const PANEL_TABS: PanelTabDef[] = [
  { id: "media", label: "Media", icon: Upload, sectionIds: ["uploads", "stock-videos", "stock-images"] },
  { id: "audio", label: "Audio", icon: Music, sectionIds: ["stock-music", "sound-effects"] },
  { id: "text", label: "Text", icon: Type, sectionIds: ["text", "fonts"] },
  { id: "stickers", label: "Stickers", icon: Sticker, sectionIds: ["stickers"] },
  { id: "effects", label: "Effects", icon: Sparkles, sectionIds: ["effects"] },
  { id: "transitions", label: "Transitions", icon: Shuffle, sectionIds: ["transitions"] },
  { id: "captions", label: "Captions", icon: Captions, sectionIds: [], disabled: true, disabledReason: "Auto-generate captions — coming soon" },
  { id: "filters", label: "Filters", icon: SlidersHorizontal, sectionIds: ["filters"] },
  {
    id: "more",
    label: "More",
    icon: MoreHorizontal,
    sectionIds: ["templates", "shapes", "icons", "logos", "brand-kit", "projects", "favorites", "collections", "recent", "search"],
  },
];

export const PANEL_TAB_BY_SECTION_ID = new Map<SidebarSectionId, PanelTabId>(
  PANEL_TABS.flatMap((tab) => tab.sectionIds.map((sectionId) => [sectionId, tab.id] as const))
);
