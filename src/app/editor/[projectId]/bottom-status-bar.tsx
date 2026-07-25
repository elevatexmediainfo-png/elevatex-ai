"use client";

import { cn } from "@/lib/utils";
import { useAutosaveStatusDisplay } from "./use-autosave-status";
import { formatTimecode, type ProjectView } from "../types";

// Bottom Status Bar (Milestone 24) — project resolution/fps/duration plus
// real-time autosave status.
//
// Fix (2026-07-12) — the zoom slider + +/- buttons that used to live here
// have moved into the Timeline's own toolbar row (see
// TimelineZoomControl in timeline-panel.tsx) — this footer sat disconnected
// below the entire workspace (sidebar/preview/timeline/properties), separate
// from the Timeline it actually controlled, not matching the reference's
// integrated placement. This bar now only shows read-only project info.
//
// Fix (2026-07-13) — design-token restyle, plus two additions, both real
// data only: fps (ProjectView.fps, already tracked per-project — Module
// 3's frame-step math) and autosave status (same saveStatus/lastSavedAt/
// lastSaveError the top bar shows, via the shared useAutosaveStatusDisplay
// hook — not duplicated logic, and a deliberate second surface for the
// same real signal, a common status-bar convention). Explicitly NOT added,
// per the brief: "GPU ON"/"CPU" (no real GPU/CPU monitoring exists — would
// be fake decorative text), storage usage (checked first — no real per-
// user/per-project storage quota exists anywhere in this app today, see
// PROJECT_STATUS.md), and Credits (irrelevant to a non-AI editing session).
export function BottomStatusBar({ project }: { project: ProjectView }) {
  const { saveStatus, lastSaveError, dotClassName, statusLabel } = useAutosaveStatusDisplay();

  return (
    <footer className="flex h-8 shrink-0 items-center gap-2 border-t border-editor-line bg-editor-panel px-3 text-editor-caption text-neutral-400">
      <span>
        {project.widthPx}×{project.heightPx}
      </span>
      <span className="text-neutral-600">•</span>
      <span>{project.fps}fps</span>
      <span className="text-neutral-600">•</span>
      <span>{formatTimecode(project.durationMs)}</span>

      <div className="flex-1" />

      {/* Dot size 8px -> 6px (2026-07-14, Section 8/8 rebuild) — matches
          TopToolbar's own autosave dot exactly now (top-toolbar.tsx),
          the one visible sizing mismatch between this bar and the rest of
          the now-rebuilt editor for the same real signal shown twice. */}
      <div className="flex shrink-0 items-center gap-1.5" title={saveStatus === "error" ? (lastSaveError ?? undefined) : undefined}>
        <span className={cn("size-1.5 shrink-0 rounded-full", dotClassName)} />
        <span className={saveStatus === "error" ? "text-editor-danger" : undefined}>{statusLabel}</span>
      </div>
    </footer>
  );
}
