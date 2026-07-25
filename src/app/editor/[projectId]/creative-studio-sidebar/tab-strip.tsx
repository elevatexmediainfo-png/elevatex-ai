"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PANEL_TABS, type PanelTabId } from "./panel-tabs";

// Horizontal tool-tab strip (2026-07-14, left panel restructure; tightened
// against premium-editor.jsx, then against a CapCut Desktop screenshot
// reference, both same day) — icon above label. Replaces the old vertical
// SidebarRail entirely; see panel-tabs.tsx's own header comment for why
// there are 9 tabs here, not either reference's 8/11 — one more tab makes
// a real difference at this width. CapCut's own reference fits 11 tabs in
// a ~730px-wide row (~66px/tab); this panel is a fixed 420px, so fitting 9
// tabs at CapCut's actual icon/label/padding density is not achievable
// without either shrinking below CapCut's own spec or accepting overflow —
// chose to honor the spec (20-22px icon, 11-12px label) and let overflow
// happen, same conclusion CapCut's own density math would reach in a
// narrower panel. `overflow-x-auto` remains as the fallback, but the
// default OS/browser scrollbar it produces on Windows Chrome is thick and
// shows arrow buttons, which read as far more prominent than either
// reference's plain compact row. A first attempt used a "thin" custom
// `::-webkit-scrollbar` (translucent hairline thumb) — still showed the
// full native arrow-button scrollbar in a real Windows Chrome window
// (headless-Chromium screenshots don't reliably reproduce native
// scrollbar chrome, so that first attempt looked fixed in this session's
// own headless verification but wasn't in a real browser). Switched
// (2026-07-14) to fully HIDING the scrollbar (`scrollbar-width: none` for
// Firefox, `::-webkit-scrollbar { display: none }` for Chromium/Safari/
// Edge) — no scrollbar can render under any OS/browser configuration this
// way, since there's nothing to render; the strip is still genuinely
// scrollable (wheel/trackpad/click-drag), and the permanent soft edge
// mask is the only visual affordance that more content exists, matching
// CapCut's own plain-row look exactly. `shrink-0` on each tab
// keeps icon+label from getting squashed illegibly as a second line of
// defense; without `overflow-x-auto` at all, excess tabs' real click
// coordinates land over the Preview column next to it, not just "look cut
// off" (confirmed live). No border beneath the row and no background pill
// on the active tab — both per the CapCut reference (row background just
// matches the panel, active state is color-only).
export function PanelTabStrip({ activeTabId, onSelect }: { activeTabId: PanelTabId; onSelect: (id: PanelTabId) => void }) {
  return (
    <div
      className={cn(
        "flex h-[64px] shrink-0 items-center gap-1 overflow-x-auto bg-editor-panel px-2",
        "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        "[mask-image:linear-gradient(to_right,transparent,black_10px,black_calc(100%-10px),transparent)]"
      )}
    >
      {PANEL_TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.id === activeTabId;
        const button = (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            onClick={() => onSelect(tab.id)}
            aria-current={active}
            className={cn(
              "flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-1 text-micro transition-colors",
              active ? "font-semibold" : "font-normal",
              tab.disabled ? "cursor-not-allowed text-neutral-600" : "text-neutral-400 hover:text-white",
              active && !tab.disabled && "text-editor-accent"
            )}
          >
            <Icon className="size-[21px]" strokeWidth={active ? 2 : 1.6} />
            {tab.label}
          </button>
        );
        return tab.disabled ? (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="bottom">{tab.disabledReason}</TooltipContent>
          </Tooltip>
        ) : (
          button
        );
      })}
    </div>
  );
}
