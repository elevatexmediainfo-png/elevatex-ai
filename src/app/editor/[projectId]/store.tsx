"use client";

import * as React from "react";
import { createStore, useStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { ClipTransform } from "@/lib/video-editor/transform";
import type { EditorCommand } from "./commands";
import type { SidebarSectionId } from "./creative-studio-sidebar/types";

// Ephemeral, client-only editor UI state (Milestone 24/Module 2) —
// selection, playhead, zoom, play/pause, snap threshold. Deliberately NOT
// server data (tracks/clips/assets live in TanStack Query instead, see
// queries.ts) — this store never touches the network. A fresh store per
// workspace mount (via EditorStoreProvider, created in useState) rather
// than one module-level store, so navigating from one project to another
// never leaks the previous project's selection/playhead into the new one.
//
// Two ways to read this store, on purpose:
//  - useEditorStore(selector) — the normal reactive hook, re-renders the
//    caller on change. Fine for anything that doesn't run every animation
//    frame (toolbars, panels, buttons).
//  - useEditorStoreApi() — the raw Zustand store object, for imperative
//    `.subscribe()`/`.getState()` access that does NOT trigger a React
//    render. The Timeline's playhead line and clip drag-preview use this —
//    see their "transient updates" comments — to satisfy the "playhead and
//    drag-preview positions update via rAF + transform, never via
//    per-frame React state" performance requirement.

export type SelectionMode = "replace" | "toggle" | "add";

// Module 3 — preview-only playback rate; deliberately NOT a Command (per
// the brief: "affects preview playback only, not an editing operation, so
// no Command/undo needed for this one").
export const PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

// Module 3 — preview compositing-surface resolution cap. "AUTO" fills the
// available space at the project's native aspect ratio; the presets cap
// the stage's rendered pixel height. This resizes the compositing surface
// (a real, if modest, paint/compositing cost reduction for the DOM-layered
// preview) — it is NOT separate lower-bitrate proxy files, which would
// need backend transcoding this module doesn't add (see preview-window.tsx).
export const PREVIEW_QUALITIES = ["AUTO", "R1080P", "R720P", "R480P"] as const;
export type PreviewQuality = (typeof PREVIEW_QUALITIES)[number];

// Module 4 — while a Transform/Crop/Blend panel control is being
// dragged/typed, the Preview Window must show the LIVE value without a
// mutation firing (and thus without a server round-trip) on every pixel of
// a drag. `liveClipOverride` is that transient value: the Properties
// Panel writes to it (rAF-batched, same pattern as the Timeline's clip
// drag), PreviewWindow reads it for whichever clip it names instead of
// that clip's server-confirmed `transform`, and it's cleared once the
// commit's mutation actually resolves (not immediately on pointerup) so
// there's no visible flash back to the pre-drag value while the query
// refetches.
export interface LiveClipOverride {
  clipId: string;
  transform: ClipTransform;
}

// Module 5 — the ONE global undo/redo stack every module's Command goes
// through, so Ctrl+Z always undoes the true last action regardless of
// which panel/module produced it (Timeline moves/trims/splits, Properties
// Panel transform edits, track lock/resize, ...). Bounded so a long
// session doesn't grow this unboundedly — the oldest entry is dropped once
// the stack exceeds MAX_HISTORY, matching how most editors cap undo depth.
const MAX_HISTORY = 100;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

// Panel-size prefs (2026-07-15) — resizable Left/Right/Timeline panels.
// Persisted to localStorage, this app's only existing UI-preference
// pattern (theme-provider.tsx's own comment: "persists to localStorage
// like next-themes default... wired to user preferences once the backend
// milestone lands" — no UserPreference DB model exists yet, so this
// follows the same established precedent rather than inventing a second
// one). Deliberately ONE shared key across every project, not
// per-project — "how wide do I like my panels" is a per-user editor
// layout preference, not project data, matching how real desktop editors
// remember panel layout globally.
const PANEL_SIZES_STORAGE_KEY = "elevatex-editor-panel-sizes";
export const PANEL_SIZE_LIMITS = {
  leftPanelWidth: { min: 280, max: 600, default: 420 },
  rightPanelWidth: { min: 220, max: 480, default: 256 },
  timelineHeight: { min: 180, max: 640, default: 420 },
} as const;

interface PanelSizes {
  leftPanelWidth: number;
  rightPanelWidth: number;
  timelineHeight: number;
}

export function loadPanelSizes(): PanelSizes {
  const defaults: PanelSizes = {
    leftPanelWidth: PANEL_SIZE_LIMITS.leftPanelWidth.default,
    rightPanelWidth: PANEL_SIZE_LIMITS.rightPanelWidth.default,
    timelineHeight: PANEL_SIZE_LIMITS.timelineHeight.default,
  };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(PANEL_SIZES_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PanelSizes>;
    return {
      leftPanelWidth: clampPanelSize("leftPanelWidth", parsed.leftPanelWidth ?? defaults.leftPanelWidth),
      rightPanelWidth: clampPanelSize("rightPanelWidth", parsed.rightPanelWidth ?? defaults.rightPanelWidth),
      timelineHeight: clampPanelSize("timelineHeight", parsed.timelineHeight ?? defaults.timelineHeight),
    };
  } catch {
    return defaults; // corrupt/blocked storage — fall back silently, not a real error state
  }
}

function savePanelSizes(sizes: PanelSizes) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PANEL_SIZES_STORAGE_KEY, JSON.stringify(sizes));
  } catch {
    // Storage full/blocked (private browsing) — sizing still works for
    // this session via in-memory state, just won't persist. Not worth
    // surfacing as a user-facing error for a cosmetic preference.
  }
}

function clampPanelSize(key: keyof typeof PANEL_SIZE_LIMITS, value: number): number {
  const { min, max } = PANEL_SIZE_LIMITS[key];
  return Math.min(max, Math.max(min, value));
}

export interface EditorUiState {
  selectedClipIds: Set<string>;
  playheadMs: number;
  playing: boolean;
  playbackRate: PlaybackRate;
  previewQuality: PreviewQuality;
  pxPerSecond: number;
  snapThresholdPx: number;
  liveClipOverride: LiveClipOverride | null;
  leftPanelWidth: number;
  rightPanelWidth: number;
  timelineHeight: number;
  // Fix (2026-07-13) — lifted out of CreativeStudioSidebar's own local
  // state so the Right Properties Panel's empty-state "Open media library"
  // action can genuinely switch the sidebar to Uploads (a real cross-panel
  // action, not a fake button) rather than only being settable from within
  // the sidebar itself.
  activeSidebarSectionId: SidebarSectionId;

  undoStack: EditorCommand[];
  redoStack: EditorCommand[];
  historyBusy: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  lastSaveError: string | null;

  selectClip: (id: string, mode?: SelectionMode) => void;
  selectMany: (ids: string[], mode?: Extract<SelectionMode, "replace" | "add">) => void;
  clearSelection: () => void;
  setPlayheadMs: (value: number | ((prev: number) => number)) => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackRate: (rate: PlaybackRate) => void;
  setPreviewQuality: (quality: PreviewQuality) => void;
  setPxPerSecond: (value: number | ((prev: number) => number)) => void;
  setLiveClipOverride: (override: LiveClipOverride | null) => void;
  setActiveSidebarSectionId: (id: SidebarSectionId) => void;
  // Committed panel-size setters — called once, on pointerup, at the end
  // of a resize drag (see panel-resize.tsx). Persists to localStorage.
  // The LIVE value during the drag itself is a direct DOM write to a CSS
  // custom property, bypassing React/this store entirely, same
  // "transient visual state during the gesture, committed state on
  // release" split the Timeline's own clip-drag already established.
  setLeftPanelWidth: (value: number) => void;
  setRightPanelWidth: (value: number) => void;
  setTimelineHeight: (value: number) => void;

  // Executes a command and, on success, pushes it onto the undo stack
  // (clearing redo — a fresh action invalidates whatever was previously
  // redoable). Every call site that used to do `void command.execute()`
  // directly goes through this instead.
  runCommand: (command: EditorCommand) => Promise<void>;
  // For actions that already executed by the time they're ready to enter
  // history (Version History's "Restore" button calls the restore API
  // directly to get back the pre-restore version id it needs to construct
  // the command — see version-history-panel.tsx) — records the command
  // without calling .execute() again.
  pushCommand: (command: EditorCommand) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const MIN_PX_PER_SECOND = 10;
// Raised from 300 (2026-07-12, zoom/precision fix) — at the old max, the
// ruler's finest reachable "nice" tick interval (see pickTickIntervalMs in
// timeline-engine.ts) bottomed out at 200ms; 600 reaches 100ms, matching
// the ask for frame-accurate trim work (30fps ≈ 33ms/frame — 100ms ticks
// put every ~3rd frame on a labeled gridline, well within reach of a
// precise drag between ticks).
const MAX_PX_PER_SECOND = 600;

function createEditorStore(initial: { snapThresholdPx: number }) {
  return createStore<EditorUiState>()(subscribeWithSelector((set, get) => ({
    selectedClipIds: new Set(),
    playheadMs: 0,
    playing: false,
    playbackRate: 1,
    previewQuality: "AUTO",
    pxPerSecond: 60,
    snapThresholdPx: initial.snapThresholdPx,
    liveClipOverride: null,
    // Plain defaults here, NOT loadPanelSizes()'s localStorage read — this
    // initializer runs synchronously during React.useState(), which fires
    // on BOTH the server render and the client's hydration render; reading
    // localStorage here would make the client's first render disagree with
    // the server-rendered HTML (a real hydration mismatch, not a
    // hypothetical one). The actual localStorage hydration happens in
    // EditorStoreProvider's own useEffect, AFTER hydration completes —
    // same "default first, sync from storage post-mount" trade-off
    // next-themes itself makes for the same class of problem.
    leftPanelWidth: PANEL_SIZE_LIMITS.leftPanelWidth.default,
    rightPanelWidth: PANEL_SIZE_LIMITS.rightPanelWidth.default,
    timelineHeight: PANEL_SIZE_LIMITS.timelineHeight.default,
    activeSidebarSectionId: "uploads",

    undoStack: [],
    redoStack: [],
    historyBusy: false,
    saveStatus: "idle",
    lastSavedAt: null,
    lastSaveError: null,

    selectClip: (id, mode = "replace") =>
      set((state) => {
        if (mode === "replace") return { selectedClipIds: new Set([id]) };
        const next = new Set(state.selectedClipIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { selectedClipIds: next };
      }),
    selectMany: (ids, mode = "replace") =>
      set((state) => ({
        selectedClipIds: mode === "add" ? new Set([...state.selectedClipIds, ...ids]) : new Set(ids),
      })),
    clearSelection: () => set({ selectedClipIds: new Set() }),

    setPlayheadMs: (value) =>
      set((state) => ({ playheadMs: Math.max(0, typeof value === "function" ? value(state.playheadMs) : value) })),
    setPlaying: (playing) => set({ playing }),
    setPlaybackRate: (rate) => set({ playbackRate: rate }),
    setPreviewQuality: (quality) => set({ previewQuality: quality }),
    setLiveClipOverride: (override) => set({ liveClipOverride: override }),
    setActiveSidebarSectionId: (id) => set({ activeSidebarSectionId: id }),
    setLeftPanelWidth: (value) => {
      const clamped = clampPanelSize("leftPanelWidth", value);
      set({ leftPanelWidth: clamped });
      savePanelSizes({ leftPanelWidth: clamped, rightPanelWidth: get().rightPanelWidth, timelineHeight: get().timelineHeight });
    },
    setRightPanelWidth: (value) => {
      const clamped = clampPanelSize("rightPanelWidth", value);
      set({ rightPanelWidth: clamped });
      savePanelSizes({ leftPanelWidth: get().leftPanelWidth, rightPanelWidth: clamped, timelineHeight: get().timelineHeight });
    },
    setTimelineHeight: (value) => {
      const clamped = clampPanelSize("timelineHeight", value);
      set({ timelineHeight: clamped });
      savePanelSizes({ leftPanelWidth: get().leftPanelWidth, rightPanelWidth: get().rightPanelWidth, timelineHeight: clamped });
    },
    setPxPerSecond: (value) =>
      set((state) => ({
        pxPerSecond: Math.min(
          MAX_PX_PER_SECOND,
          Math.max(MIN_PX_PER_SECOND, typeof value === "function" ? value(state.pxPerSecond) : value)
        ),
      })),

    pushCommand: (command) =>
      set((state) => ({
        undoStack: [...state.undoStack, command].slice(-MAX_HISTORY),
        redoStack: [],
      })),

    runCommand: async (command) => {
      set({ saveStatus: "saving" });
      try {
        await command.execute();
        set((state) => ({
          undoStack: [...state.undoStack, command].slice(-MAX_HISTORY),
          redoStack: [],
          saveStatus: "saved",
          lastSavedAt: Date.now(),
          lastSaveError: null,
        }));
      } catch (err) {
        set({ saveStatus: "error", lastSaveError: err instanceof Error ? err.message : "Save failed." });
        throw err;
      }
    },

    undo: async () => {
      const state = get();
      if (state.historyBusy) return;
      const command = state.undoStack[state.undoStack.length - 1];
      if (!command) return;

      set({ historyBusy: true, saveStatus: "saving", undoStack: state.undoStack.slice(0, -1) });
      try {
        await command.undo();
        set((s) => ({
          redoStack: [...s.redoStack, command],
          historyBusy: false,
          saveStatus: "saved",
          lastSavedAt: Date.now(),
          lastSaveError: null,
        }));
      } catch (err) {
        // Undo failed server-side — leave it off both stacks (we don't know
        // whether the server made partial progress, so re-offering it as
        // undoable or redoable could compound the problem) and surface the
        // failure via saveStatus instead.
        set({ historyBusy: false, saveStatus: "error", lastSaveError: err instanceof Error ? err.message : "Undo failed." });
      }
    },

    redo: async () => {
      const state = get();
      if (state.historyBusy) return;
      const command = state.redoStack[state.redoStack.length - 1];
      if (!command) return;

      set({ historyBusy: true, saveStatus: "saving", redoStack: state.redoStack.slice(0, -1) });
      try {
        await command.execute();
        set((s) => ({
          undoStack: [...s.undoStack, command].slice(-MAX_HISTORY),
          historyBusy: false,
          saveStatus: "saved",
          lastSavedAt: Date.now(),
          lastSaveError: null,
        }));
      } catch (err) {
        set({ historyBusy: false, saveStatus: "error", lastSaveError: err instanceof Error ? err.message : "Redo failed." });
      }
    },
  })));
}

type EditorStoreApi = ReturnType<typeof createEditorStore>;

const EditorStoreContext = React.createContext<EditorStoreApi | null>(null);

export function EditorStoreProvider({
  children,
  snapThresholdPx,
}: {
  children: React.ReactNode;
  snapThresholdPx: number;
}) {
  const [store] = React.useState(() => createEditorStore({ snapThresholdPx }));

  // Post-mount localStorage hydration (2026-07-15) — see the panel-size
  // state's own comment above for why this can't happen during the
  // synchronous store initializer. Runs once; `setState` directly (not
  // the individual setLeftPanelWidth/etc. setters) since this is
  // hydrating already-saved, already-clamped values, not a user
  // action — going through the setters would immediately re-save the
  // exact values just read, a harmless but pointless localStorage write.
  React.useEffect(() => {
    const saved = loadPanelSizes();
    store.setState(saved);
  }, [store]);

  return <EditorStoreContext.Provider value={store}>{children}</EditorStoreContext.Provider>;
}

export function useEditorStore<T>(selector: (state: EditorUiState) => T): T {
  const store = React.useContext(EditorStoreContext);
  if (!store) throw new Error("useEditorStore must be used within an EditorStoreProvider.");
  return useStore(store, selector);
}

// The raw store, for imperative subscribe()/getState() access outside
// React's render cycle. See the file header comment. Typed as
// EditorStoreApi (not the plain StoreApi<EditorUiState>) so callers keep
// the subscribeWithSelector-enhanced `.subscribe(selector, listener, opts)`
// overload, not just the whole-state one.
export function useEditorStoreApi(): EditorStoreApi {
  const store = React.useContext(EditorStoreContext);
  if (!store) throw new Error("useEditorStoreApi must be used within an EditorStoreProvider.");
  return store;
}
