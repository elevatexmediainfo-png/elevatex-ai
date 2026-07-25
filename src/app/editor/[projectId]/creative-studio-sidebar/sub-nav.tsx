"use client";

import { cn } from "@/lib/utils";
import { SIDEBAR_SECTION_BY_ID } from "./section-registry";
import type { SidebarSectionId } from "./types";

// Secondary nav column (2026-07-14, left panel restructure) — only
// rendered for tabs with more than one real section behind them (Media,
// Audio, Text, More); a single-section tab (Stickers/Effects/Transitions/
// Filters) has nothing to sub-navigate, so PanelTabStrip's own onSelect
// jumps straight to that one section and this column never mounts for it.
// Real section labels only (SIDEBAR_SECTION_BY_ID, unchanged) — no
// "Import"/"Subprojects"/"Yours"/"Spaces"/"Library" placeholders from the
// mockup, since none of those map to anything real here (confirmed with
// the founder).
//
// `overflow-y-auto [scrollbar-gutter:stable]` added (2026-07-14) — this
// column had no overflow handling at all, so on a short viewport the
// 10-item "More" tab's list would hard-clip past the visible bounds with
// no way to reach the rest (worse than the media-grid sections, which at
// least scrolled). Scrollbar itself fully hidden (2026-07-14, second pass
// — same reasoning as PanelTabStrip's own header comment: a "thin" custom
// scrollbar still showed the native arrow-button chrome in a real Windows
// Chrome window, and specifically here was reported cutting across the
// tab-strip/sub-nav boundary and clipping the "Stock Images" label).
// `scrollbar-gutter:stable` is kept regardless — reserves the gutter's
// width up front so content never visibly shifts/gets clipped if a scroll
// state toggles, even though nothing ever renders into that reserved
// space now.
//
// Active-item styling (2026-07-14, CapCut reference pass) — color-only, no
// background pill on active OR hover, matching the reference's own plain
// text-nav treatment (was a filled pill on both states before this pass).
//
// Width kept at 128px (2026-07-14, full-spec audit) — a second, more
// precise spec re-stated ~155px for this column, but that number is the
// reference's own raw pixel value from a ~763px-wide panel; this app's
// panel is a fixed 420px (already a deliberate, previously-justified
// decision — see index.tsx). Applying the reference's OWN internal ratio
// (155:608 nav:grid, ~20% of its total width) to a 420px panel would give
// ~85px, narrower than today, not wider — and real content here (labels
// like "Stock Videos"/"Brand Kit") needs more room than that to read
// cleanly. Kept at 128px, which already fits every real label without
// wrapping; flagging this rather than blindly copying either number.
export function PanelSubNav({
  sectionIds,
  activeSectionId,
  onSelect,
}: {
  sectionIds: SidebarSectionId[];
  activeSectionId: SidebarSectionId;
  onSelect: (id: SidebarSectionId) => void;
}) {
  return (
    <div
      className={cn(
        "flex w-32 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-editor-line px-2 py-3 [scrollbar-gutter:stable]",
        "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      )}
    >
      {sectionIds.map((id) => {
        const section = SIDEBAR_SECTION_BY_ID.get(id);
        if (!section) return null;
        const active = id === activeSectionId;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-current={active}
            className={cn(
              "rounded-md px-3 py-2 text-left text-editor-caption transition-colors",
              active ? "font-semibold text-editor-accent" : "text-neutral-400 hover:text-white"
            )}
          >
            {section.label}
          </button>
        );
      })}
    </div>
  );
}
