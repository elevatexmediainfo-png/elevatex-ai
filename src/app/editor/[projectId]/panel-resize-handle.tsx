"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PANEL_SIZE_LIMITS, useEditorStoreApi } from "./store";

// Resizable panel dividers (2026-07-15) — same rAF-batched, direct-DOM-
// write-during-drag / commit-on-release discipline as the Timeline's own
// clip drag (timeline-panel.tsx's ClipBlock startDrag/onMove/onUp): while
// dragging, this writes a CSS custom property straight onto the DOM via
// `document.documentElement.style.setProperty()`, bypassing React/Zustand
// entirely so a fast drag never waits on a render; only on pointerup does
// it commit the final clamped value into the store (which persists it to
// localStorage — see store.tsx's setLeftPanelWidth/etc.). The panels that
// read these variables (creative-studio-sidebar/index.tsx,
// right-properties-panel.tsx, timeline-panel.tsx) size themselves via
// `style={{ width: "var(--editor-left-panel-width)" }}` with a CSS
// fallback matching the store's own default, so they render correctly
// even before the store's real value is read on mount.
type PanelSizeKey = keyof typeof PANEL_SIZE_LIMITS;

const CSS_VAR_BY_KEY: Record<PanelSizeKey, string> = {
  leftPanelWidth: "--editor-left-panel-width",
  rightPanelWidth: "--editor-right-panel-width",
  timelineHeight: "--editor-timeline-height",
};

const SETTER_BY_KEY: Record<PanelSizeKey, "setLeftPanelWidth" | "setRightPanelWidth" | "setTimelineHeight"> = {
  leftPanelWidth: "setLeftPanelWidth",
  rightPanelWidth: "setRightPanelWidth",
  timelineHeight: "setTimelineHeight",
};

interface DragState {
  startClientPos: number;
  startSize: number;
  invert: boolean;
  rafScheduled: boolean;
  pendingSize: number;
}

function usePanelResize(sizeKey: PanelSizeKey, axis: "x" | "y", invert: boolean) {
  const storeApi = useEditorStoreApi();
  const dragRef = React.useRef<DragState | null>(null);
  const cssVar = CSS_VAR_BY_KEY[sizeKey];
  const { min, max } = PANEL_SIZE_LIMITS[sizeKey];

  function applyVisual(size: number) {
    document.documentElement.style.setProperty(cssVar, `${size}px`);
  }

  function scheduleFrame() {
    const drag = dragRef.current;
    if (!drag || drag.rafScheduled) return;
    drag.rafScheduled = true;
    requestAnimationFrame(() => {
      const current = dragRef.current;
      if (!current) return;
      current.rafScheduled = false;
      applyVisual(current.pendingSize);
    });
  }

  function onMove(e: PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const clientPos = axis === "x" ? e.clientX : e.clientY;
    const rawDelta = clientPos - drag.startClientPos;
    const delta = drag.invert ? -rawDelta : rawDelta;
    drag.pendingSize = Math.min(max, Math.max(min, drag.startSize + delta));
    scheduleFrame();
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    // Commit — the store's own setter re-clamps and persists to
    // localStorage; applyVisual already left the DOM showing this exact
    // value, so there's no flash when the committed state's re-render
    // catches up (same "held visual until the real value matches"
    // approach ClipBlock's own onUp uses).
    storeApi.getState()[SETTER_BY_KEY[sizeKey]](drag.pendingSize);
  }

  function startDrag(e: React.PointerEvent, cursor: string) {
    e.preventDefault();
    const startSize = storeApi.getState()[sizeKey];
    dragRef.current = {
      startClientPos: axis === "x" ? e.clientX : e.clientY,
      startSize,
      invert,
      rafScheduled: false,
      pendingSize: startSize,
    };
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return startDrag;
}

// Vertical divider (drag left/right) — used between Left Panel/Preview and
// Preview/Right Panel. `invert` flips which direction growth means for a
// handle whose panel sits on the RIGHT of the drag point (Right Panel
// shrinks when dragged right, unlike Left Panel which grows).
export function VerticalPanelResizeHandle({ sizeKey, invert = false, className }: { sizeKey: PanelSizeKey; invert?: boolean; className?: string }) {
  const startDrag = usePanelResize(sizeKey, "x", invert);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={(e) => startDrag(e, "col-resize")}
      className={cn(
        "group relative w-1 shrink-0 cursor-col-resize touch-none select-none",
        "before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-editor-line",
        "hover:before:bg-editor-accent/60 active:before:bg-editor-accent",
        className
      )}
    />
  );
}

// Horizontal divider (drag up/down) — used between the Left/Preview/Right
// row and the Timeline below it. Growing the Timeline (dragging up) means
// a NEGATIVE clientY delta maps to a POSITIVE size delta, hence invert.
export function HorizontalPanelResizeHandle({ sizeKey, invert = false }: { sizeKey: PanelSizeKey; invert?: boolean }) {
  const startDrag = usePanelResize(sizeKey, "y", invert);
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      onPointerDown={(e) => startDrag(e, "row-resize")}
      className={cn(
        "group relative h-1 shrink-0 cursor-row-resize touch-none select-none",
        "before:absolute before:inset-x-0 before:top-1/2 before:h-px before:-translate-y-1/2 before:bg-editor-line",
        "hover:before:bg-editor-accent/60 active:before:bg-editor-accent"
      )}
    />
  );
}
