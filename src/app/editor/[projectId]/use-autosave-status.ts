"use client";

import { useEditorStore } from "./store";

function formatClockTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString(undefined, { hour12: false });
}

// Fix (2026-07-13) — extracted out of top-toolbar.tsx so the bottom status
// bar can show the exact same real saveStatus/lastSavedAt/lastSaveError
// state without duplicating the dot-color/label derivation logic.
export function useAutosaveStatusDisplay() {
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const lastSaveError = useEditorStore((s) => s.lastSaveError);

  const dotClassName =
    saveStatus === "saving" ? "bg-amber-500 animate-pulse" : saveStatus === "error" ? "bg-editor-danger" : "bg-success";
  const statusLabel =
    saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Save failed" : lastSavedAt ? `Auto saved: ${formatClockTime(lastSavedAt)}` : "Saved";

  return { saveStatus, lastSaveError, dotClassName, statusLabel };
}
