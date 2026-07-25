"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Clapperboard, Film, History, Redo2, Sparkles, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useUpdateProjectName } from "./use-update-project-name";
import { useEditorStore, useEditorStoreApi } from "./store";
import { useAutosaveStatusDisplay } from "./use-autosave-status";
import { VersionHistoryPanel } from "./version-history-panel";
import { ExportPanel } from "./export-panel";
import { AiAutoEditPanel } from "./ai-auto-edit-panel";
import { isTextEditableTarget } from "../keyboard-utils";
import type { ProjectView } from "../types";

// Top Toolbar — rebuilt (2026-07-13) against premium-editor.jsx, the
// founder's approved reference mockup, which now supersedes every earlier
// piecemeal top-bar prompt (76px 4-item layout, "Projects" text link,
// etc.). Height 76px -> 60px, name goes back to a click-to-reveal-input
// (plain text at rest, a real <Input> only while editing) matching the
// mockup's own pattern more literally than the prior "always an Input"
// approach — same useUpdateProjectName commit-on-blur/Enter logic
// underneath, unchanged.
//
// Two deliberate deviations from the mockup's own JSX, both flagged to the
// founder rather than silently decided:
//  1. The mockup's top bar has no "Projects" entry at all, and the brief
//     marks it optional ("if wanted") — dropped it; Logo still links to
//     /dashboard, same as before. If back-to-project-browser navigation
//     from the top bar is wanted, that's a one-line addition, just ask.
//  2. Version History (the "History" button) isn't in the mockup's top
//     bar either, but it's real, working, previously-built-and-verified
//     functionality (version snapshots + restore) — the brief's own
//     principle elsewhere ("only include entries with real backing
//     functionality") argues for keeping a real feature, not cutting it
//     because a quick mockup omitted it. Kept, positioned before Export.
//  Share/AI Assistant/Credits/Notifications/Search were NOT added, per
// the brief's explicit list — none of those have a real feature behind
// them yet either.
export function TopToolbar({ project }: { project: ProjectView }) {
  const { name, setName, commit } = useUpdateProjectName(project);
  const [editingName, setEditingName] = React.useState(false);
  const storeApi = useEditorStoreApi();

  const canUndo = useEditorStore((s) => s.undoStack.length > 0);
  const canRedo = useEditorStore((s) => s.redoStack.length > 0);
  const historyBusy = useEditorStore((s) => s.historyBusy);
  const { saveStatus, lastSaveError, dotClassName, statusLabel } = useAutosaveStatusDisplay();
  const [versionPanelOpen, setVersionPanelOpen] = React.useState(false);
  const [exportPanelOpen, setExportPanelOpen] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Fix (2026-07-18) — /create/ai-auto-edit lands a fresh project here with
  // ?aiAutoEdit=1 so the panel opens immediately, no extra click needed
  // past the /create tile. Read once at mount (lazy initializer, not an
  // effect) — this is a one-time "arrived here to run AI Auto-Edit" intent,
  // not something that should re-trigger on every re-render.
  const [aiAutoEditPanelOpen, setAiAutoEditPanelOpen] = React.useState(() => searchParams.get("aiAutoEdit") === "1");

  React.useEffect(() => {
    if (searchParams.get("aiAutoEdit") !== "1") return;
    // Strip the query param once consumed so a later refresh/back-nav
    // doesn't keep forcing the panel back open against the user's wishes.
    const params = new URLSearchParams(searchParams);
    params.delete("aiAutoEdit");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Only defer to the browser's native text-undo for genuinely
      // text-editable controls — a <input type="range"> (every Transform/
      // Crop/Blend slider) has no native undo of its own, so leaving focus
      // on one after a drag shouldn't silently swallow Ctrl+Z.
      if (isTextEditableTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) void storeApi.getState().redo();
      else void storeApi.getState().undo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [storeApi]);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-editor-line bg-editor-bg px-4">
      {/* Left cluster (2026-07-14, full-spec pass) — Logo unchanged; no
          "Menu" dropdown next to it despite the reference showing one —
          this app has no real File/Preferences/Settings menu to back it
          (confirmed via a repo-wide search), so per the no-fake-UI rule
          it's flagged here and left out rather than built as a dead
          button. Autosave now sits where the reference puts it: directly
          after the logo, not pushed to the right edge. */}
      <Link href="/dashboard" title="Elevatex AI" className="flex shrink-0 items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(140deg,var(--color-editor-accent)_0%,#4057af_100%)] text-white shadow-[0_4px_14px_rgba(91,124,250,0.45)]">
          <Clapperboard className="size-3" />
        </span>
        <span className="text-editor-caption font-semibold text-white">Elevatex AI</span>
      </Link>

      <div className="h-4 w-px shrink-0 bg-editor-line" />

      {/* Autosave status — real saveStatus/lastSavedAt/lastSaveError state,
          unchanged (see use-autosave-status.ts). The success state now
          shows an actual checkmark icon (matching the reference literally)
          instead of a plain colored dot; saving/error keep a colored dot
          since neither has a natural "checkmark" reading. */}
      <div className="flex shrink-0 items-center gap-1.5 text-[12px] text-neutral-400" title={saveStatus === "error" ? (lastSaveError ?? undefined) : undefined}>
        {saveStatus === "saved" || saveStatus === "idle" ? (
          <Check className="size-3 shrink-0 text-success" />
        ) : (
          <span className={cn("size-1.5 shrink-0 rounded-full", dotClassName)} />
        )}
        <span className={saveStatus === "error" ? "text-editor-danger" : undefined}>{statusLabel}</span>
      </div>

      <div className="flex-1" />

      {/* Project name — centered, persistent pill (was left-aligned plain
          text before this pass). Same click-to-reveal-input behavior and
          the same useUpdateProjectName commit-on-blur/Enter logic
          underneath, unchanged — only the at-rest shape/position differ:
          a ~280px rounded-full pill so it reads as a real named field even
          before you click into it, centered in the header per the
          reference rather than left-aligned next to the logo. */}
      {editingName ? (
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            commit();
            setEditingName(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className={cn(
            "h-7 w-[280px] shrink-0 rounded-full border-transparent bg-editor-surface-2 px-3 text-center text-[13px] text-white",
            "shadow-[0_0_0_1px_rgba(91,124,250,0.6),0_0_14px_-2px_rgba(91,124,250,0.55)]"
          )}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingName(true)}
          title="Click to rename"
          className="h-7 w-[280px] shrink-0 truncate rounded-full bg-editor-surface-1 px-3 text-center text-[13px] font-medium text-white transition-colors hover:bg-editor-surface-2"
        >
          {name}
        </button>
      )}

      <div className="flex-1" />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-neutral-300 hover:text-white disabled:opacity-30"
        title="Undo (Ctrl+Z)"
        disabled={!canUndo || historyBusy}
        onClick={() => void storeApi.getState().undo()}
      >
        <Undo2 className="size-[18px]" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-neutral-300 hover:text-white disabled:opacity-30"
        title="Redo (Ctrl+Shift+Z)"
        disabled={!canRedo || historyBusy}
        onClick={() => void storeApi.getState().redo()}
      >
        <Redo2 className="size-[18px]" />
      </Button>
      <div className="mx-1 h-4 w-px shrink-0 bg-editor-line" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-neutral-300 hover:text-white"
        title="AI Auto-Edit"
        onClick={() => setAiAutoEditPanelOpen(true)}
      >
        <Sparkles className="size-4" />
        AI Auto-Edit
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-neutral-300 hover:text-white"
        title="Version history"
        onClick={() => setVersionPanelOpen(true)}
      >
        <History className="size-4" />
        History
      </Button>
      {/* Export — compact ~80x30 filled-accent button matching the
          reference's own top-bar sizing, distinct from the 44px
          editorPrimary height used elsewhere (Uploads/export-panel CTAs) —
          same real command underneath (opens the real Export panel), just
          a size override for this specific top-bar context.
          Fixed clipping (2026-07-15) — TWO stacked bugs, not one. (1) The
          editorPrimary variant bakes in `min-w-[120px]`/`px-5`, and a
          plain `w-20` doesn't cancel a `min-w` (different tailwind-merge
          classGroup, so both survive and min-width wins as a floor).
          (2) `MotionPrimaryButton` (motion-primitives.tsx) applies its
          `className` prop to the OUTER `motion.div` wrapper only — the
          actual `<button>` inside always gets a hardcoded `"w-full"` with
          nothing else, so no size override passed through it EVER reached
          the real button at all (the exact same conflict already found
          and fixed for the Uploads "Import" button earlier this session).
          Switched to the plain `Button` component directly — no hover/tap
          micro-animation on this one instance, same trade-off already
          accepted for Import, in exchange for the size override actually
          working. */}
      <Button
        type="button"
        variant="editorPrimary"
        size="none"
        className="ml-1 h-[30px] w-20 min-w-0 gap-1.5 rounded-lg px-3 text-[13px]"
        title="Export"
        onClick={() => setExportPanelOpen(true)}
      >
        <Film className="size-3" />
        Export
      </Button>

      <VersionHistoryPanel projectId={project.id} open={versionPanelOpen} onOpenChange={setVersionPanelOpen} />
      <ExportPanel projectId={project.id} project={project} open={exportPanelOpen} onOpenChange={setExportPanelOpen} />
      <AiAutoEditPanel projectId={project.id} project={project} open={aiAutoEditPanelOpen} onOpenChange={setAiAutoEditPanelOpen} />
    </header>
  );
}
