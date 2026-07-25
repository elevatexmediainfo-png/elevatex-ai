"use client";

import { PanelTabStrip } from "./tab-strip";
import { PanelSubNav } from "./sub-nav";
import { PANEL_TABS, PANEL_TAB_BY_SECTION_ID, type PanelTabId } from "./panel-tabs";
import { SIDEBAR_SECTION_BY_ID } from "./section-registry";
import { useEditorStore } from "../store";
import { MotionPanelFade } from "../motion-primitives";

// Creative Studio Sidebar — rebuilt (2026-07-14) against premium-editor.jsx,
// which now supersedes the earlier vertical-icon-rail structure (rail.tsx,
// no longer used). "Which section is open" still lives in the shared
// editor store exactly as before (activeSidebarSectionId/
// setActiveSidebarSectionId, unchanged — the Right Properties Panel's
// empty-state "Open media library" action still targets it the same way);
// the tab strip is a purely additive presentation layer on top of that
// same real state (panel-tabs.tsx derives which of the 9 tabs a given
// section belongs to, nothing about section-registry.tsx's own 21 real
// sections changed). Every section is still architecture + UI only per the
// original brief (no API wiring) except Uploads, which keeps its real
// upload functionality.
export function CreativeStudioSidebar() {
  const activeSectionId = useEditorStore((s) => s.activeSidebarSectionId);
  const setActiveSectionId = useEditorStore((s) => s.setActiveSidebarSectionId);
  const activeSection = SIDEBAR_SECTION_BY_ID.get(activeSectionId)!;
  const ActivePanel = activeSection.Component;

  const activeTabId = PANEL_TAB_BY_SECTION_ID.get(activeSectionId) ?? "media";
  const activeTab = PANEL_TABS.find((t) => t.id === activeTabId)!;

  function selectTab(tabId: PanelTabId) {
    const tab = PANEL_TABS.find((t) => t.id === tabId);
    if (!tab || tab.disabled || tab.sectionIds.length === 0) return;
    // Switching tabs always lands on that tab's first section — the same
    // "pick a sensible default" behavior a fresh mount already has.
    setActiveSectionId(tab.sectionIds[0]);
  }

  return (
    // w-[420px] (fixed) -> a CSS variable (2026-07-15, resizable panels) —
    // the variable is set on the workspace root (editor-workspace.tsx)
    // from real Zustand state (leftPanelWidth, itself synced to
    // localStorage), and updated directly by panel-resize-handle.tsx
    // during an active drag; the `420px` fallback matches
    // PANEL_SIZE_LIMITS.leftPanelWidth.default in store.tsx, so this
    // renders correctly even before that variable is set (first paint,
    // or a context this component ever mounts outside the workspace).
    // D1 (2026-07-22) — hidden below `lg` so the Preview pane is actually
    // reachable at real mobile widths (this panel's own min width is
    // 280px, which alone would already crush a 375px viewport). Preview-
    // only on mobile is a deliberate scope choice, not an oversight: full
    // mobile editing (media library, properties) can wait for a real
    // dedicated mobile pass.
    <aside
      className="hidden shrink-0 flex-col border-r border-editor-line bg-editor-panel lg:flex"
      style={{ width: "var(--editor-left-panel-width, 420px)" }}
    >
      <PanelTabStrip activeTabId={activeTabId} onSelect={selectTab} />
      <div className="flex flex-1 overflow-hidden">
        {activeTab.sectionIds.length > 1 && (
          <PanelSubNav sectionIds={activeTab.sectionIds} activeSectionId={activeSectionId} onSelect={setActiveSectionId} />
        )}
        <div className="flex-1 overflow-hidden">
          <MotionPanelFade panelKey={activeSectionId} className="h-full">
            <ActivePanel />
          </MotionPanelFade>
        </div>
      </div>
    </aside>
  );
}
