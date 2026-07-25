import type { ListAssetItem, SidebarSectionId } from "../types";

// Module 11 — every OTHER section that used to source from this file
// (stock-videos/images/music, sound-effects, templates/transitions/
// effects/shapes/icons/stickers/logos, fonts, favorites/collections/
// recent) is now wired to real data — see section-registry.tsx. Only
// `text` (text style presets: Heading/Subheading/Body/etc.) remains
// placeholder-only; it's explicitly out of scope for this module (not
// named in any of Parts A-E) and stays on GenericListSection until it gets
// its own real design-preset system.
const TEXT_PRESETS = [
  { label: "Heading", fontFamily: "inherit", meta: "Bold · 48px" },
  { label: "Subheading", fontFamily: "inherit", meta: "Semibold · 28px" },
  { label: "Body Text", fontFamily: "inherit", meta: "Regular · 16px" },
  { label: "Caption", fontFamily: "inherit", meta: "Regular · 12px" },
  { label: "Bold Statement", fontFamily: "inherit", meta: "Black · 36px" },
  { label: "Elegant Script", fontFamily: "cursive", meta: "Italic · 32px" },
];

export const MOCK_LIST_ITEMS: Partial<Record<SidebarSectionId, ListAssetItem[]>> = {
  text: TEXT_PRESETS.map((t, i) => ({ id: `text-${i}`, label: t.label, fontFamily: t.fontFamily, meta: t.meta })),
};
