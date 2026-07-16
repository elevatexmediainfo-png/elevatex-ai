"use client";

import * as React from "react";
import {
  AudioLines,
  Blend,
  Bookmark,
  Captions,
  Combine,
  Copy,
  Eye,
  EyeOff,
  Film,
  Group,
  GripVertical,
  Layers,
  Loader2,
  Lock,
  Mic,
  MoreHorizontal,
  Music,
  Plus,
  Redo2,
  Scissors,
  Sparkles,
  Trash2,
  Type as TypeIcon,
  Undo2,
  Ungroup as UngroupIcon,
  Unlock,
  Upload,
  Volume2,
  VolumeX,
  Waves,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useEditorStore, useEditorStoreApi } from "./store";
import {
  useAddClipMutation,
  useAddMarkerMutation,
  useAddTrackMutation,
  useAddTransitionMutation,
  useRestoreTransitionMutation,
  useDeleteClipMutation,
  useDuplicateClipMutation,
  useEditorAssetsQuery,
  useGroupClipsMutation,
  useMaterializeStockAssetMutation,
  useRemoveMarkerMutation,
  useRemoveTrackMutation,
  useRemoveTransitionMutation,
  useReorderTrackMutation,
  useReplaceClipSourceMutation,
  useRippleDeleteClipMutation,
  useSplitClipMutation,
  useUngroupClipsMutation,
  useUpdateClipMutation,
  useUpdateTrackMutation,
  useUpdateTransitionMutation,
  type AddClipPatch,
  type AddTransitionPatch,
  type UpdateTransitionPatch,
} from "./queries";
import { toast } from "sonner";
import {
  createAddTrackAndClipCommand,
  createAddTransitionCommand,
  createCompositeCommand,
  createDeleteClipCommand,
  createDuplicateClipCommand,
  createGroupClipsCommand,
  createMoveClipCommand,
  createRemoveTransitionCommand,
  createReorderTrackCommand,
  createReplaceClipSourceCommand,
  createRippleDeleteCommand,
  createSplitClipCommand,
  createTrimClipCommand,
  createUngroupClipsCommand,
  createUpdateContentCommand,
  createUpdateTrackCommand,
  createUpdateTransitionCommand,
  type AddTrackAndClipDeps,
  type ClipCommandDeps,
  type EditorCommand,
  type TrackCommandDeps,
  type TrackReorderDeps,
  type TransitionCommandDeps,
} from "./commands";
import {
  clampMoveStart,
  clampTrimLeftStart,
  clampTrimRightEnd,
  collectSnapCandidates,
  formatTickLabel,
  pickTickIntervalMs,
  snapMoveStart,
  snapTrimEdge,
} from "@/lib/video-editor/timeline-engine";
import { getClipMoveCompatibleTrackKinds, resolveDropTrackKind } from "@/lib/video-editor/drop-track-resolution";
import type { DraggableAssetPayload } from "./creative-studio-sidebar/types";
import { isTextEditableTarget } from "../keyboard-utils";
import { ClipKeyframeTrack } from "./keyframe-track";
import { EmptyState } from "./creative-studio-sidebar/shared/empty-state";
import {
  clipEndMs,
  EDITOR_AUDIO_SUBTYPES,
  EDITOR_TRACK_KINDS,
  type AssetView,
  type ClipContent,
  type ClipView,
  type EditorAudioSubtype,
  type EditorTrackKind,
  type MarkerView,
  type TrackView,
  type TransitionView,
} from "../types";
import { DEFAULT_AUDIO_PROPERTIES, sliceWaveformPeaks } from "@/lib/video-editor/audio";
import { computeVisibleFilmstripFrameIndices, FILMSTRIP_TILE_HEIGHT } from "@/lib/video-editor/filmstrip";
import {
  DEFAULT_TRANSITION_EASING,
  defaultDirectionFor,
  MIN_TRANSITION_MS,
  TRANSITION_TYPE_DEFS,
  type TransitionDirection,
  type TransitionEasing,
  type TransitionEasingPreset,
  type TransitionType,
} from "@/lib/video-editor/transition-engine";

// 140 -> 168 (2026-07-14, full-spec audit) — this exact column previously
// went through a too-compact 92px attempt during earlier iteration (see
// the current spec's own explicit callout); 168px gives the real
// lock/eye/mute/more icon cluster (~14px icons, ~6px gaps) comfortable
// room without crowding, matching the more precise numbers.
const TRACK_HEADER_WIDTH = 168;
// 24 -> 28 (2026-07-14, full-spec audit) — matches the more precise ruler
// height; tick label font size (11px, MarkerTicks/ruler tick rendering
// below) was already correct, untouched.
const RULER_HEIGHT = 28;
const MIN_CLIP_DURATION_MS = 200;
const MIN_TRACK_HEIGHT = 28;
const MAX_TRACK_HEIGHT = 200;
// Default per-track row height (2026-07-14, full-spec audit, flagged not
// silently skipped) — a more precise spec re-stated ~68px; this app's
// default is 64px (`EditorTrack.heightPx`'s Prisma `@default`, prisma/
// schema.prisma), already deliberately tuned in an earlier dedicated pass
// against a CapCut reference. A 4px/6% difference is within the spec's
// own "visually estimated, not exact ground truth" margin, and changing
// it now needs a new migration for a barely-perceptible gain — left as
// 64px rather than churn the schema for this. Real, resizable per-track
// (MIN/MAX above), unaffected either way.
// Exported so bottom-status-bar.tsx's zoom +/- buttons use the exact same
// step as this panel's own +/- keyboard shortcuts, rather than a second
// hardcoded multiplier drifting out of sync with this one. (Ctrl+wheel uses
// its own smaller, smoother 1.08 multiplier in handleWheel below — many
// wheel events fire per gesture, so it needs a gentler per-event step;
// a single button click wants one clearly-perceptible jump instead.)
export const ZOOM_STEP = 1.25;

// Fix (2026-07-12) — shared by every same-track mutation site (drop,
// move, trim-left, trim-right) that needs "every other clip on this
// track, excluding the one(s) being mutated" to feed into
// clampMoveStart/clampTrimLeftStart/clampTrimRightEnd. A plain module-
// level function rather than a component-local one since it's called
// from both TimelinePanel (handleDrop/handleEmptySpaceDrop) and
// ClipBlock (applyVisual/onUp) — two separate component scopes that
// otherwise can't share a closure.
function clipsOnTrackExcluding(clips: ClipView[], trackId: string, excludeIds: Set<string>): ClipView[] {
  return clips.filter((c) => c.trackId === trackId && !excludeIds.has(c.id));
}

// Per-track-kind clip colors — values live in globals.css's @theme block
// (--color-track-*, 2026-07-12 CapCut-Desktop visual-fidelity pass) so the
// palette is tunable from one place instead of hunting these classes.
const TRACK_COLORS: Record<EditorTrackKind, string> = {
  VIDEO: "bg-track-video/90",
  AUDIO: "bg-track-audio/90",
  SUBTITLE: "bg-track-subtitle/90",
  TEXT: "bg-track-text/90",
  OVERLAY: "bg-track-overlay/90",
  EFFECTS: "bg-track-effects/90",
};

// Module 8 — Voice/Music/SFX subtype differentiation (icon/color/label
// only; still `kind: "AUDIO"` — see EditorAudioSubtype's schema comment).
// Distinct clip colors here, not just the header, so it's obvious at a
// glance which subtype a given clip belongs to without reading the label.
const AUDIO_SUBTYPE_LABEL: Record<EditorAudioSubtype, string> = { VOICE: "Voice", MUSIC: "Music", SFX: "SFX" };
const AUDIO_SUBTYPE_COLOR: Record<EditorAudioSubtype, string> = {
  VOICE: "bg-track-voice/90",
  MUSIC: "bg-track-music/90",
  SFX: "bg-track-sfx/90",
};

// Solid (non-/90) dot variants of the same tokens, for TrackHeader's small
// kind-identity dot — a translucent fill reads fine on a full clip body but
// washes out at dot size, so these are the plain solid classes.
const TRACK_DOT_COLOR: Record<EditorTrackKind, string> = {
  VIDEO: "bg-track-video",
  AUDIO: "bg-track-audio",
  SUBTITLE: "bg-track-subtitle",
  TEXT: "bg-track-text",
  OVERLAY: "bg-track-overlay",
  EFFECTS: "bg-track-effects",
};
const AUDIO_SUBTYPE_DOT_COLOR: Record<EditorAudioSubtype, string> = {
  VOICE: "bg-track-voice",
  MUSIC: "bg-track-music",
  SFX: "bg-track-sfx",
};

// Section 5/8 (Track headers, 2026-07-14 premium-editor.jsx rebuild) — a
// DISTINCT icon per track kind, explicitly required per the reference's own
// brief ("not the same icon for every non-text track, that was a real bug
// caught during mockup iteration"): every kind here gets its own icon, and
// AUDIO's 3 real UI subtypes each get their own too rather than all
// inheriting a single generic AUDIO icon.
const TRACK_KIND_ICON: Record<EditorTrackKind, React.ComponentType<{ className?: string }>> = {
  VIDEO: Film,
  // Waves, not AudioLines — an AUDIO track with no subtype (an edge case;
  // every subtype has its own icon below, and AddTrackMenu's real AUDIO
  // creation flow always requires picking one) still needs a DIFFERENT
  // icon from the SFX subtype specifically, not a reused one.
  AUDIO: Waves,
  SUBTITLE: Captions,
  TEXT: TypeIcon,
  OVERLAY: Layers,
  EFFECTS: Sparkles,
};
const AUDIO_SUBTYPE_ICON: Record<EditorAudioSubtype, React.ComponentType<{ className?: string }>> = {
  VOICE: Mic,
  MUSIC: Music,
  SFX: AudioLines,
};

interface TrackLayoutEntry {
  track: TrackView;
  top: number;
  height: number;
}

// Timeline (Module 2) — split/ripple-delete/duplicate/replace-source,
// multi-select (shift-click + marquee), group/ungroup, magnetic snap,
// markers, zoom/scroll, lock/resize tracks (Part A). Every mutation is
// performed by constructing an EditorCommand (see commands.ts) and running
// it through the store's runCommand (Module 5), which pushes it onto the
// single global undo/redo stack.
//
// Performance: the playhead line (PlayheadLine below) and clip drag/resize
// previews update via direct DOM `style.transform`/`style.width` writes
// batched through requestAnimationFrame, never through React state — so
// dragging a clip or scrubbing playback never re-renders the Timeline's
// React tree. Track resize gets the same live-preview treatment for the
// resized track itself; tracks below it snap to their correct offset on
// commit rather than live-reflowing during the drag (a deliberate scope
// trade-off — see TrackHeader's resize handler). No thumbnails/waveforms
// exist yet, so there's nothing to canvas-render yet; when that data
// exists, it belongs on a <canvas> layer inside ClipBlock, not DOM.
export function TimelinePanel({
  projectId,
  tracks,
  clips,
  markers,
  transitions,
}: {
  projectId: string;
  tracks: TrackView[];
  clips: ClipView[];
  markers: MarkerView[];
  transitions: TransitionView[];
}) {
  const storeApi = useEditorStoreApi();
  // Failure is already surfaced via the store's saveStatus (see
  // top-toolbar.tsx) — this just prevents an unhandled promise rejection
  // for every fire-and-forget call site below.
  function runCommand(command: EditorCommand) {
    void storeApi.getState().runCommand(command).catch(() => {});
  }
  const pxPerSecond = useEditorStore((s) => s.pxPerSecond);
  const setPxPerSecond = useEditorStore((s) => s.setPxPerSecond);
  const setPlayheadMs = useEditorStore((s) => s.setPlayheadMs);
  const selectedClipIds = useEditorStore((s) => s.selectedClipIds);
  const selectClip = useEditorStore((s) => s.selectClip);
  const selectMany = useEditorStore((s) => s.selectMany);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const playing = useEditorStore((s) => s.playing);
  const setPlaying = useEditorStore((s) => s.setPlaying);

  const addTrack = useAddTrackMutation(projectId);
  const updateTrackMutation = useUpdateTrackMutation(projectId);
  const removeTrack = useRemoveTrackMutation(projectId);
  const reorderTrackMutation = useReorderTrackMutation(projectId);
  const reorderTrackDeps: TrackReorderDeps = React.useMemo(
    () => ({ reorderTrack: (input) => reorderTrackMutation.mutateAsync(input) }),
    [reorderTrackMutation]
  );
  const addClipMutation = useAddClipMutation(projectId);
  const materializeStockAssetMutation = useMaterializeStockAssetMutation();
  const updateClipMutation = useUpdateClipMutation(projectId);
  const deleteClipMutation = useDeleteClipMutation(projectId);
  const splitClipMutation = useSplitClipMutation(projectId);
  const rippleDeleteMutation = useRippleDeleteClipMutation(projectId);
  const duplicateClipMutation = useDuplicateClipMutation(projectId);
  const replaceSourceMutation = useReplaceClipSourceMutation(projectId);
  const groupClipsMutation = useGroupClipsMutation(projectId);
  const ungroupClipsMutation = useUngroupClipsMutation(projectId);
  const addMarkerMutation = useAddMarkerMutation(projectId);
  const removeMarkerMutation = useRemoveMarkerMutation(projectId);
  const addTransitionMutation = useAddTransitionMutation(projectId);
  const restoreTransitionMutation = useRestoreTransitionMutation(projectId);
  const updateTransitionMutation = useUpdateTransitionMutation(projectId);
  const removeTransitionMutation = useRemoveTransitionMutation(projectId);
  const assetsQuery = useEditorAssetsQuery();

  const commandDeps: ClipCommandDeps = React.useMemo(
    () => ({
      updateClip: (input) => updateClipMutation.mutateAsync(input),
      deleteClip: (clipId) => deleteClipMutation.mutateAsync(clipId),
      addClip: (patch) => addClipMutation.mutateAsync(patch),
      splitClip: (input) => splitClipMutation.mutateAsync(input),
      rippleDeleteClip: (clipId) => rippleDeleteMutation.mutateAsync(clipId),
      duplicateClip: (clipId) => duplicateClipMutation.mutateAsync(clipId),
      replaceClipSource: (input) => replaceSourceMutation.mutateAsync(input),
      groupClips: (clipIds) => groupClipsMutation.mutateAsync(clipIds),
      ungroupClips: (clipIds) => ungroupClipsMutation.mutateAsync(clipIds),
      // Move/Trim's own undo needs this to restore a transition pruned as a
      // side effect of the move/trim it's reversing (2026-07-16 fix, see
      // createMoveClipCommand's doc comment) — a DIFFERENT server operation
      // from transitionCommandDeps.addTransition below, not the same
      // mutation reused.
      restoreTransition: (patch) => restoreTransitionMutation.mutateAsync(patch),
    }),
    [
      updateClipMutation,
      deleteClipMutation,
      addClipMutation,
      splitClipMutation,
      rippleDeleteMutation,
      duplicateClipMutation,
      replaceSourceMutation,
      groupClipsMutation,
      ungroupClipsMutation,
      restoreTransitionMutation,
    ]
  );
  const trackCommandDeps: TrackCommandDeps = React.useMemo(
    () => ({ updateTrack: (input) => updateTrackMutation.mutateAsync(input) }),
    [updateTrackMutation]
  );
  // Smart track creation on drop (2026-07-12) — createAddTrackAndClipCommand
  // needs addTrack/removeTrack alongside the existing ClipCommandDeps, which
  // no other command in this file has needed before now (see that command's
  // own doc comment in commands.ts for why it can't reuse trackCommandDeps
  // above, which only ever exposed updateTrack).
  const addTrackAndClipDeps: AddTrackAndClipDeps = React.useMemo(
    () => ({
      ...commandDeps,
      addTrack: (input) => addTrack.mutateAsync(input),
      removeTrack: (trackId) => removeTrack.mutateAsync(trackId),
    }),
    [commandDeps, addTrack, removeTrack]
  );
  const transitionCommandDeps: TransitionCommandDeps = React.useMemo(
    () => ({
      addTransition: (patch) => addTransitionMutation.mutateAsync(patch),
      updateTransition: (input) => updateTransitionMutation.mutateAsync(input),
      removeTransition: (transitionId) => removeTransitionMutation.mutateAsync(transitionId),
    }),
    [addTransitionMutation, updateTransitionMutation, removeTransitionMutation]
  );

  const laneRef = React.useRef<HTMLDivElement | null>(null);
  const clipElRegistry = React.useRef(new Map<string, HTMLDivElement>());
  const trackRowElRegistry = React.useRef(new Map<string, HTMLDivElement>());
  const marqueeElRef = React.useRef<HTMLDivElement | null>(null);
  // Trim-lag fix (2026-07-12) — ClipKeyframeTrack (the diamond-marker lane
  // shown under a selected keyframed clip) computes its own left/width
  // purely from React props (clip.startMs/durationMs), so it never
  // participated in ClipBlock's live rAF-driven drag visual (see
  // applyVisual() below) — it stayed frozen at its pre-drag size for the
  // whole gesture, only snapping to the correct size once the trim
  // committed and the server round-trip's refetch landed. Same registry
  // pattern as clipElRegistry (used for group-mate live moves): the
  // keyframe track's own root div registers itself here by clip id so
  // ClipBlock's drag handlers can write live style.transform/width to it
  // too, exactly mirroring what they already do to the clip body itself.
  const keyframeTrackElRegistry = React.useRef(new Map<string, HTMLDivElement>());

  // Bug #3 fix — see TrimHandleOverlay's file header. `trimHandlerRegistry`
  // holds each ClipBlock's own resize-start closures (registered in that
  // component); `hoveredEdge`/`draggingClipId` decide which clip(s) the
  // overlay currently renders handles for.
  const trimHandlerRegistry = React.useRef(new Map<string, TrimHandlers>());
  const [hoveredEdge, setHoveredEdge] = React.useState<{ clipId: string; edge: "left" | "right" } | null>(null);
  const [draggingClipId, setDraggingClipId] = React.useState<string | null>(null);

  // A grouped-clip drag fires onCommitMove once (the dragged clip) then
  // onCommitGroupMove once per group mate, all synchronously within the
  // same pointer-up handler. Buffering them and flushing on a microtask
  // (which always runs after the current synchronous call stack) wraps the
  // whole gesture into ONE composite undo-stack entry instead of one per
  // clip — matching Ctrl+Z's "undo the true last action" semantics.
  const pendingMoveCommandsRef = React.useRef<EditorCommand[]>([]);
  const moveFlushScheduledRef = React.useRef(false);
  function scheduleMoveFlush() {
    if (moveFlushScheduledRef.current) return;
    moveFlushScheduledRef.current = true;
    queueMicrotask(() => {
      moveFlushScheduledRef.current = false;
      const commands = pendingMoveCommandsRef.current;
      pendingMoveCommandsRef.current = [];
      if (commands.length === 0) return;
      const command = commands.length === 1 ? commands[0] : createCompositeCommand("Move Clips", commands);
      runCommand(command);
    });
  }
  const snapGuideElRef = React.useRef<HTMLDivElement | null>(null);

  const orderedTracks = React.useMemo(() => [...tracks].sort((a, b) => a.order - b.order), [tracks]);
  const trackById = React.useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);

  // Track drag-to-reorder (2026-07-15) — `originalTrackLayout` is a STABLE
  // reference frame (built from the real, non-preview `orderedTracks`)
  // that the drag's own hit-testing math is always computed against, so
  // the "which row is the pointer over" answer doesn't shift out from
  // under itself as the live preview below reorders things mid-drag —
  // computing hit-tests against the PREVIEW layout instead would create a
  // feedback loop (each move recomputed against a base that had just
  // moved because of the previous move).
  const originalTrackLayout = React.useMemo<TrackLayoutEntry[]>(() => {
    let top = 0;
    return orderedTracks.map((track) => {
      const entry: TrackLayoutEntry = { track, top, height: track.heightPx };
      top += track.heightPx;
      return entry;
    });
  }, [orderedTracks]);
  const [trackReorderPreview, setTrackReorderPreview] = React.useState<{ trackId: string; targetIndex: number } | null>(null);
  const trackReorderStartRef = React.useRef<{ trackId: string; startClientY: number; startIndex: number } | null>(null);

  // The actual RENDER order — reflects the live drag preview when one is
  // active, otherwise identical to `orderedTracks`. Deliberately a plain
  // React-state-driven re-render (not the rAF-direct-DOM-write pattern
  // every other Timeline drag uses) because reordering reflows an
  // arbitrary number of variable-height rows at once, not one element's
  // own position — letting the browser's normal layout engine handle
  // "everything else shifts" via a real re-render is far simpler and less
  // error-prone than hand-computing N rows' transforms, and the state
  // update is still throttled to once per animation frame (see
  // TrackHeader's own onReorderPointerMove below), so it's "rAF-driven"
  // in the sense that matters — never more than one update per paint.
  const displayOrderedTracks = React.useMemo(() => {
    if (!trackReorderPreview) return orderedTracks;
    const fromIndex = orderedTracks.findIndex((t) => t.id === trackReorderPreview.trackId);
    if (fromIndex === -1) return orderedTracks;
    const clampedTarget = Math.max(0, Math.min(orderedTracks.length - 1, trackReorderPreview.targetIndex));
    const next = [...orderedTracks];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(clampedTarget, 0, moved);
    return next;
  }, [orderedTracks, trackReorderPreview]);

  const trackLayout = React.useMemo<TrackLayoutEntry[]>(() => {
    let top = 0;
    return displayOrderedTracks.map((track) => {
      const entry: TrackLayoutEntry = { track, top, height: track.heightPx };
      top += track.heightPx;
      return entry;
    });
  }, [displayOrderedTracks]);
  const trackLayoutById = React.useMemo(() => new Map(trackLayout.map((e) => [e.track.id, e])), [trackLayout]);
  const contentHeight = trackLayout.reduce((sum, e) => sum + e.height, 0);

  function computeReorderTargetIndex(trackId: string, clientY: number): number {
    const start = trackReorderStartRef.current;
    if (!start) return 0;
    const deltaY = clientY - start.startClientY;
    const draggedEntry = originalTrackLayout.find((e) => e.track.id === trackId);
    if (!draggedEntry) return start.startIndex;
    const virtualCenter = draggedEntry.top + draggedEntry.height / 2 + deltaY;
    for (let i = 0; i < originalTrackLayout.length; i++) {
      const entry = originalTrackLayout[i];
      if (virtualCenter < entry.top + entry.height) return i;
    }
    return originalTrackLayout.length - 1;
  }
  function handleTrackReorderStart(trackId: string, clientY: number) {
    const startIndex = orderedTracks.findIndex((t) => t.id === trackId);
    if (startIndex === -1) return;
    trackReorderStartRef.current = { trackId, startClientY: clientY, startIndex };
  }
  function handleTrackReorderMove(trackId: string, clientY: number) {
    setTrackReorderPreview({ trackId, targetIndex: computeReorderTargetIndex(trackId, clientY) });
  }
  function handleTrackReorderEnd(trackId: string, clientY: number) {
    const start = trackReorderStartRef.current;
    setTrackReorderPreview(null);
    if (!start) {
      trackReorderStartRef.current = null;
      return;
    }
    // Real bug found live (2026-07-15) — computeReorderTargetIndex reads
    // trackReorderStartRef.current itself (needed so handleTrackReorderMove
    // can call it too, mid-drag, without threading `start` through every
    // caller); clearing the ref before this final call made it always
    // read null and short-circuit to index 0, so the drop always looked
    // like "dropped back where it started" and silently never committed.
    // The ref must stay live for this LAST read.
    const targetIndex = computeReorderTargetIndex(trackId, clientY);
    trackReorderStartRef.current = null;
    if (targetIndex === start.startIndex) return; // dropped back where it started — nothing to commit
    runCommand(createReorderTrackCommand(reorderTrackDeps, trackId, start.startIndex, targetIndex));
  }

  const selectedClips = React.useMemo(() => clips.filter((c) => selectedClipIds.has(c.id)), [clips, selectedClipIds]);
  const isClipLocked = React.useCallback((clip: ClipView) => Boolean(trackById.get(clip.trackId)?.isLocked), [trackById]);
  const hasLockedSelection = selectedClips.some(isClipLocked);

  // ---- Playhead line: transient DOM updates, no React re-render per tick.
  React.useEffect(() => {
    const el = laneRef.current;
    return storeApi.subscribe(
      (s) => s.playheadMs,
      (playheadMs) => {
        const scroller = el?.closest("[data-timeline-scroll]") as HTMLElement | null;
        if (!scroller) return;
        const px = (playheadMs / 1000) * pxPerSecond;
        // Auto-scroll to keep the playhead in view during playback.
        if (storeApi.getState().playing) {
          const visibleLeft = scroller.scrollLeft;
          const visibleRight = visibleLeft + scroller.clientWidth - TRACK_HEADER_WIDTH;
          if (px < visibleLeft || px > visibleRight) scroller.scrollLeft = Math.max(0, px - 40);
        }
      },
      { fireImmediately: true }
    );
  }, [storeApi, pxPerSecond]);

  // ---- Keyboard shortcuts.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Only defer to native text-editing for genuinely text-editable
      // controls — a bare tagName==="INPUT" check would also block every
      // shortcut here (Delete/Space/S/Ctrl+D/Ctrl+G/M/+/-/Home/End)
      // whenever a <input type="range"> (the Preview Window's seek bar, or
      // any Transform/Crop/Blend slider) happens to have focus, which is a
      // completely ordinary thing to have just clicked.
      if (isTextEditableTarget(e.target)) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedClipIds.size > 0 && !hasLockedSelection) {
          runDelete(selectedClips);
        }
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying(!playing);
        // Real bug found and fixed (2026-07-15) — an ArrowLeft/ArrowRight
        // branch used to live here too, DUPLICATING the exact same real
        // handler preview-window.tsx already registers on `window` (both
        // mount for the whole editor session, so a single keypress fired
        // BOTH, moving the playhead double the intended distance —
        // confirmed live: one ArrowRight press moved ~66ms, not ~33ms;
        // one Shift+ArrowRight moved 2.00s, not 1.00s). This component
        // was also missing a real `frameMs` of its own — TimelinePanel
        // has no `project.fps` prop, unlike PreviewWindow — so an earlier
        // pass had patched THAT gap with a hardcoded 30fps guess rather
        // than noticing the branch was a duplicate that should be
        // deleted outright, which is what this pass does instead.
        // preview-window.tsx's own handler (real fps-derived, not
        // guessed) is the single source of truth for this shortcut,
        // already correctly global regardless of which panel has focus.
      } else if (e.key === "s" && selectedClips.length === 1 && !hasLockedSelection) {
        const clip = selectedClips[0];
        const playheadMs = storeApi.getState().playheadMs;
        if (playheadMs > clip.startMs && playheadMs < clipEndMs(clip)) {
          runSplit(clip, playheadMs - clip.startMs);
        }
      } else if ((e.key === "d" || e.key === "D") && (e.ctrlKey || e.metaKey) && selectedClips.length === 1 && !hasLockedSelection) {
        e.preventDefault();
        runDuplicate(selectedClips[0].id);
      } else if ((e.key === "g" || e.key === "G") && (e.ctrlKey || e.metaKey) && !hasLockedSelection) {
        e.preventDefault();
        if (e.shiftKey) runUngroup();
        else runGroup();
      } else if (e.key === "m" || e.key === "M") {
        addMarkerMutation.mutate(storeApi.getState().playheadMs);
      } else if (e.key === "+" || e.key === "=") {
        setPxPerSecond((v) => v * ZOOM_STEP);
      } else if (e.key === "-" || e.key === "_") {
        setPxPerSecond((v) => v / ZOOM_STEP);
      } else if (e.key === "Home") {
        setPlayheadMs(0);
      } else if (e.key === "End") {
        setPlayheadMs(clips.reduce((max, c) => Math.max(max, clipEndMs(c)), 0));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClipIds, selectedClips, hasLockedSelection, playing, clips]);

  function msAtClientX(clientX: number): number {
    const lane = laneRef.current;
    if (!lane) return 0;
    const rect = lane.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left) / (pxPerSecond / 1000));
  }

  // Bug #3 fix — determines which clip's edge TrimHandleOverlay renders
  // handles for, using pure coordinate math against each clip's OWN known
  // layout rather than the browser's native hit-testing. That distinction
  // matters: native hover (mouseenter/mouseleave) resolves to whichever
  // element is topmost in PAINT order, which is exactly the thing an
  // active transition's overlap window gets wrong (see this file's header
  // comment on TrimHandleOverlay) — computing it ourselves from `clips` +
  // `trackLayout` sidesteps DOM paint order entirely, so hovering near
  // clipA's buried right edge still correctly resolves to clipA, not
  // whichever clip happens to be on top there.
  function handleLaneHover(e: React.PointerEvent) {
    if (draggingClipId) return; // an active drag owns the visual state; don't fight it.
    const lane = laneRef.current;
    if (!lane) return;
    const rect = lane.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const EDGE_ZONE_PX = 10;
    let best: { clipId: string; edge: "left" | "right" } | null = null;
    let bestDistance = Infinity;
    for (const clip of clips) {
      if (isClipLocked(clip)) continue;
      const layout = trackLayoutById.get(clip.trackId);
      if (!layout || relY < layout.top || relY > layout.top + layout.height) continue;
      const left = (clip.startMs / 1000) * pxPerSecond;
      const width = Math.max(4, (clip.durationMs / 1000) * pxPerSecond);
      const distToLeft = Math.abs(relX - left);
      const distToRight = Math.abs(relX - (left + width));
      if (distToLeft <= EDGE_ZONE_PX && distToLeft < bestDistance) {
        best = { clipId: clip.id, edge: "left" };
        bestDistance = distToLeft;
      }
      if (distToRight <= EDGE_ZONE_PX && distToRight < bestDistance) {
        best = { clipId: clip.id, edge: "right" };
        bestDistance = distToRight;
      }
    }
    // Bail out to the SAME object reference when nothing logically
    // changed — `best` is a fresh object every call, so without this a
    // plain `setHoveredEdge(best)` would re-render on every single
    // pointermove event, not just when the hovered clip/edge actually
    // changes.
    setHoveredEdge((prev) => (prev?.clipId === best?.clipId && prev?.edge === best?.edge ? prev : best));
  }

  // Delegates to the target clip's OWN registered resize-start closure
  // (ClipBlock's `startDrag("resize-left"/"resize-right")`, unchanged) —
  // the overlay itself holds no trim logic of its own, only enough to find
  // the right handler and keep it visually active for the drag's duration.
  function startTrimFromOverlay(clipId: string, edge: "left" | "right", e: React.PointerEvent) {
    const handlers = trimHandlerRegistry.current.get(clipId);
    if (!handlers) return;
    setDraggingClipId(clipId);
    handlers[edge](e);
    function clearDragging() {
      setDraggingClipId(null);
      window.removeEventListener("pointerup", clearDragging);
    }
    window.addEventListener("pointerup", clearDragging);
  }

  // Module 11 — async since a raw stock-search result (no EditorAsset row
  // yet) needs a materialize-then-add round trip before the clip can be
  // created. `e.dataTransfer.getData(...)` is still read SYNCHRONOUSLY,
  // before any `await` — that's the one part of the native DnD contract
  // that must happen inside the event's own call stack; everything after
  // parsing that string is free to be async. Existing {assetId,...} drops
  // (uploads, library items, favorites, recent, already-materialized stock
  // results) are unchanged — this only adds a second legal payload shape.
  function parseDragPayload(e: React.DragEvent): DraggableAssetPayload | null {
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null; // Ignore malformed drag payloads (e.g. a drop from outside this app).
    }
  }

  // Resolves a drag payload into a real, already-materialized assetId +
  // durationMs — shared by the per-existing-track drop handler and the
  // empty-space auto-create-track handler below, so "materialize a stock
  // result if needed" isn't duplicated between them.
  async function resolveDroppedAsset(data: DraggableAssetPayload): Promise<{ assetId: string; durationMs: number } | null> {
    if (!data.assetId && data.stockResult) {
      const toastId = toast.loading(`Adding ${data.stockResult.title}…`);
      try {
        const { asset } = await materializeStockAssetMutation.mutateAsync({
          providerId: data.providerId!,
          category: data.stockCategory!,
          result: data.stockResult,
        });
        const durationMs = data.stockResult.durationSeconds ? Math.round(data.stockResult.durationSeconds * 1000) : (data.durationMs ?? 3000);
        toast.success(`Added ${data.stockResult.title}`, { id: toastId });
        return { assetId: asset.id, durationMs };
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add this item.", { id: toastId });
        return null;
      }
    }
    if (!data.assetId) return null;
    return { assetId: data.assetId, durationMs: data.durationMs ?? 3000 };
  }

  // Smart track creation on drop (2026-07-12) — shared by both a genuine
  // empty-space drop AND (2026-07-15 fix, see handleDrop below) a drop
  // landing on an existing track whose OWN kind doesn't match the dragged
  // asset. Reuses an existing unlocked track of the right kind (topmost in
  // `orderedTracks`, never a lower one) if one exists; only auto-creates a
  // new track + clip (as one undo-able gesture, createAddTrackAndClipCommand)
  // when nothing suitable is there.
  async function dropAssetOntoSuitableTrack(data: DraggableAssetPayload, startMs: number) {
    const targetKind = resolveDropTrackKind({ assetKind: data.kind, libraryCategory: data.libraryCategory });
    if (!targetKind) return; // No defined rule for this asset kind — don't guess.

    // TEXT has no backing asset — it's authored in-editor (same
    // asset-less content shape TrackHeader's own "+" add-clip button
    // already uses for a brand-new TEXT track), unlike every other kind
    // here which needs a real, possibly just-materialized, asset id.
    let clipPatch: Omit<AddClipPatch, "trackId">;
    if (targetKind === "TEXT" && !data.assetId && !data.stockResult) {
      clipPatch = { startMs, durationMs: 3000, content: { text: "New Text", fontSize: 48, color: "#FFFFFF" } };
    } else {
      const resolved = await resolveDroppedAsset(data);
      if (!resolved) return;
      clipPatch = { assetId: resolved.assetId, startMs, durationMs: resolved.durationMs };
    }

    const existing = orderedTracks.find((t) => t.kind === targetKind && !t.isLocked);
    if (existing) {
      // Fix (2026-07-12) — same overlap-prevention as handleDrop's
      // direct-onto-a-track-row case; this branch reuses an existing track
      // that may already have clips near the drop point.
      const clampedStartMs = clampMoveStart(clipPatch.startMs, clipPatch.durationMs, clipsOnTrackExcluding(clips, existing.id, new Set()));
      addClipMutation.mutate({ trackId: existing.id, ...clipPatch, startMs: clampedStartMs });
      return;
    }

    const command = createAddTrackAndClipCommand(addTrackAndClipDeps, { kind: targetKind }, clipPatch);
    runCommand(command);
  }

  async function handleDrop(e: React.DragEvent, trackId: string) {
    e.preventDefault();
    // Smart track creation fix (2026-07-12) — without this, a drop landing
    // squarely on an existing track row would also bubble up to the
    // empty-space fallback handler on the scroller below, potentially
    // auto-creating a redundant second track for the very asset that just
    // landed correctly on this one.
    e.stopPropagation();
    const track = trackById.get(trackId);
    if (track?.isLocked) return; // Part A — block dropping new clips onto a locked track.
    const data = parseDragPayload(e);
    if (!data) return;
    const rawStartMs = Math.round(msAtClientX(e.clientX) / 100) * 100;

    // Real bug fix (2026-07-15, found via reproduction) — this used to add
    // the clip to `trackId` unconditionally, with no check that the
    // dragged asset's resolved target kind actually matched THIS track's
    // own kind: confirmed live, dropping a VIDEO asset onto an existing
    // AUDIO track's empty space silently created a VIDEO clip on that
    // AUDIO track. A mismatch now routes through the exact same
    // reuse-or-create resolution a genuine empty-space drop already uses,
    // instead of forcing the asset onto the wrong-kind track.
    const targetKind = resolveDropTrackKind({ assetKind: data.kind, libraryCategory: data.libraryCategory });
    if (track && targetKind && track.kind !== targetKind) {
      await dropAssetOntoSuitableTrack(data, rawStartMs);
      return;
    }

    const resolved = await resolveDroppedAsset(data);
    if (!resolved) return;
    // Fix (2026-07-12) — a drop landing on/near an existing clip used to
    // silently create an overlapping row (this track never had same-track
    // collision handling); clamp to the nearest non-overlapping slot near
    // the drop point instead, same convention move/trim now both use.
    const startMs = clampMoveStart(rawStartMs, resolved.durationMs, clipsOnTrackExcluding(clips, trackId, new Set()));
    addClipMutation.mutate({ trackId, assetId: resolved.assetId, startMs, durationMs: resolved.durationMs });
  }

  // Fallback for a drop that didn't land on any existing track row
  // (handleDrop above always stops propagation once it handles one, so
  // this only ever fires for a genuine empty-space drop, including a
  // brand-new project with zero tracks) — see dropAssetOntoSuitableTrack
  // above for the actual reuse-or-create resolution, shared with
  // handleDrop's own wrong-kind-track case.
  async function handleEmptySpaceDrop(e: React.DragEvent) {
    e.preventDefault();
    const data = parseDragPayload(e);
    if (!data) return;
    const startMs = Math.round(msAtClientX(e.clientX) / 100) * 100;
    await dropAssetOntoSuitableTrack(data, startMs);
  }

  // ---- Command runners. Every one goes through the store's runCommand so
  // it lands on the single global undo/redo stack (Module 5) instead of
  // just firing its mutation.
  function runSplit(clip: ClipView, offsetMs: number) {
    if (isClipLocked(clip)) return;
    // Rounded — offsetMs is derived from playheadMs, which can be
    // fractional mid-playback (the rAF clock advances by a float delta;
    // see preview-window.tsx), but the API requires an integer (same class
    // of bug as pxToMs above).
    const command = createSplitClipCommand(commandDeps, clip.id, Math.round(offsetMs), clip.durationMs);
    runCommand(command);
  }
  function runDuplicate(clipId: string) {
    const command = createDuplicateClipCommand(commandDeps, clipId);
    runCommand(command);
  }
  function runRippleDelete(clip: ClipView) {
    if (isClipLocked(clip)) return;
    const trackClipsBefore = clips.filter((c) => c.trackId === clip.trackId);
    const command = createRippleDeleteCommand(commandDeps, clip, trackClipsBefore);
    runCommand(command);
    clearSelection();
  }
  // Known Issue #17 fix — the one entry point every clip-delete affordance
  // (toolbar button, context menu, Delete/Backspace) now goes through,
  // replacing what used to be a direct `deleteClipMutation.mutate(id)` call
  // at each of those three sites (bypassing the Command pattern entirely,
  // the one Timeline mutation that was never undo-able). A multi-clip
  // delete (toolbar/keyboard with >1 selected) is wrapped in the same
  // createCompositeCommand every other multi-select gesture already uses
  // (see runUngroup above), so one Ctrl+Z undoes the whole gesture at once.
  function runDelete(clipsToDelete: ClipView[]) {
    const deletable = clipsToDelete.filter((c) => !isClipLocked(c));
    if (deletable.length === 0) return;
    const perClipCommands = deletable.map((c) => createDeleteClipCommand(commandDeps, c));
    const command = perClipCommands.length === 1 ? perClipCommands[0] : createCompositeCommand("Delete Clips", perClipCommands);
    runCommand(command);
    clearSelection();
  }
  function runReplaceSource(clipId: string, previousAssetId: string | null, newAssetId: string) {
    const command = createReplaceClipSourceCommand(commandDeps, clipId, previousAssetId, newAssetId);
    runCommand(command);
  }
  function runGroup() {
    if (selectedClips.length < 2 || hasLockedSelection) return;
    const command = createGroupClipsCommand(
      commandDeps,
      selectedClips.map((c) => c.id)
    );
    runCommand(command);
  }
  function runUngroup() {
    if (hasLockedSelection) return;
    const groupIds = new Set(selectedClips.map((c) => c.groupId).filter((g): g is string => Boolean(g)));
    // One user gesture can ungroup several distinct groups (a selection that
    // spans multiple groups) — wrap them as one composite so a single
    // Ctrl+Z undoes all of them, not one group at a time.
    const perGroupCommands = [...groupIds].map((groupId) => {
      const memberIds = clips.filter((c) => c.groupId === groupId).map((c) => c.id);
      return createUngroupClipsCommand(commandDeps, memberIds);
    });
    if (perGroupCommands.length === 0) return;
    const command = perGroupCommands.length === 1 ? perGroupCommands[0] : createCompositeCommand("Ungroup Clips", perGroupCommands);
    runCommand(command);
  }
  function runToggleLock(track: TrackView) {
    const command = createUpdateTrackCommand(trackCommandDeps, track.id, { isLocked: track.isLocked }, { isLocked: !track.isLocked });
    runCommand(command);
  }
  function runResizeCommit(track: TrackView, newHeightPx: number) {
    const command = createUpdateTrackCommand(trackCommandDeps, track.id, { heightPx: track.heightPx }, { heightPx: newHeightPx });
    runCommand(command);
  }

  // Module 9 — Transitions.
  function runAddTransition(input: AddTransitionPatch) {
    runCommand(createAddTransitionCommand(transitionCommandDeps, input));
  }
  function runUpdateTransition(transitionId: string, previous: UpdateTransitionPatch, next: UpdateTransitionPatch) {
    runCommand(createUpdateTransitionCommand(transitionCommandDeps, transitionId, previous, next));
  }
  function runRemoveTransition(transition: TransitionView) {
    runCommand(createRemoveTransitionCommand(transitionCommandDeps, transition));
  }

  // ---- Marquee (rubber-band) selection, on the lane background only.
  const marqueeDragRef = React.useRef<null | { startX: number; startY: number; additive: boolean }>(null);

  function handleLanePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    clearSelectionUnlessAdditive(e.shiftKey);
    const rect = laneRef.current!.getBoundingClientRect();
    marqueeDragRef.current = { startX: e.clientX - rect.left, startY: e.clientY - rect.top, additive: e.shiftKey };
    window.addEventListener("pointermove", onMarqueeMove);
    window.addEventListener("pointerup", onMarqueeUp);
  }
  function clearSelectionUnlessAdditive(additive: boolean) {
    if (!additive) clearSelection();
  }

  function onMarqueeMove(e: PointerEvent) {
    const drag = marqueeDragRef.current;
    const lane = laneRef.current;
    const marqueeEl = marqueeElRef.current;
    if (!drag || !lane || !marqueeEl) return;
    const rect = lane.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;
    const left = Math.min(drag.startX, curX);
    const top = Math.min(drag.startY, curY);
    const width = Math.abs(curX - drag.startX);
    const height = Math.abs(curY - drag.startY);
    marqueeEl.style.display = "block";
    marqueeEl.style.left = `${left}px`;
    marqueeEl.style.top = `${top}px`;
    marqueeEl.style.width = `${width}px`;
    marqueeEl.style.height = `${height}px`;
  }

  function onMarqueeUp(e: PointerEvent) {
    window.removeEventListener("pointermove", onMarqueeMove);
    window.removeEventListener("pointerup", onMarqueeUp);
    const drag = marqueeDragRef.current;
    marqueeDragRef.current = null;
    const marqueeEl = marqueeElRef.current;
    if (marqueeEl) marqueeEl.style.display = "none";
    if (!drag) return;

    const lane = laneRef.current;
    if (!lane) return;
    const rect = lane.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;
    const msLeft = Math.min(drag.startX, curX) / (pxPerSecond / 1000);
    const msRight = Math.max(drag.startX, curX) / (pxPerSecond / 1000);
    const yTop = Math.min(drag.startY, curY);
    const yBottom = Math.max(drag.startY, curY);

    if (Math.abs(curX - drag.startX) < 4 && Math.abs(curY - drag.startY) < 4) return; // plain click, not a drag

    const hitIds: string[] = [];
    for (const clip of clips) {
      const layout = trackLayoutById.get(clip.trackId);
      if (!layout) continue;
      const rowOverlaps = layout.top + layout.height > yTop && layout.top < yBottom;
      const timeOverlaps = clipEndMs(clip) > msLeft && clip.startMs < msRight;
      if (rowOverlaps && timeOverlaps) hitIds.push(clip.id);
    }
    if (hitIds.length > 0) selectMany(hitIds, drag.additive ? "add" : "replace");
  }

  // ---- Ruler scrubbing (2026-07-15, real bug found via reproduction) —
  // the ruler previously only wired `onClick`, which fires once on
  // mouseup at the release position: a real click-and-drag gesture across
  // it left the playhead (and therefore the Preview Window, which reads
  // playheadMs reactively) completely frozen for the whole drag, then
  // jumped straight to the final position — confirmed live via a real
  // recorded mousedown/move/move/up sequence (timecode stayed at 0:00.00
  // through every intermediate move, only updating after mouseup). Same
  // window-pointermove/pointerup pattern as the marquee drag above,
  // calling the ordinary reactive `setPlayheadMs` on every move — cheap
  // and already proven live-sync-correct by the Preview Window's own seek
  // bar, which updates continuously through an identical mechanism (a
  // native range input's onChange firing on every drag step).
  const rulerScrubbingRef = React.useRef(false);
  function handleRulerPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    rulerScrubbingRef.current = true;
    setPlayheadMs(msAtClientX(e.clientX));
    window.addEventListener("pointermove", onRulerScrubMove);
    window.addEventListener("pointerup", onRulerScrubUp);
  }
  function onRulerScrubMove(e: PointerEvent) {
    if (!rulerScrubbingRef.current) return;
    setPlayheadMs(msAtClientX(e.clientX));
  }
  function onRulerScrubUp() {
    rulerScrubbingRef.current = false;
    window.removeEventListener("pointermove", onRulerScrubMove);
    window.removeEventListener("pointerup", onRulerScrubUp);
  }

  // ---- Zoom (Ctrl/Cmd+wheel) / horizontal scroll (plain wheel).
  function handleWheel(e: React.WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setPxPerSecond((v) => (e.deltaY < 0 ? v * 1.08 : v / 1.08));
      return;
    }
    const scroller = e.currentTarget;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scroller.scrollLeft += e.deltaY;
    }
  }

  const totalDurationMs = React.useMemo(() => clips.reduce((max, c) => Math.max(max, clipEndMs(c)), 0), [clips]);
  const timelineWidthMs = Math.max(totalDurationMs + 5000, 10000);
  const timelineWidthPx = (timelineWidthMs / 1000) * pxPerSecond;

  return (
    // Fix (2026-07-13) — proportions pass against a CapCut Desktop
    // reference: the Timeline read as visually small relative to the
    // Preview stage above it — in the reference, the toolbar+ruler+tracks
    // region is roughly 40% of the window's vertical space, well above
    // this panel's prior 320px (h-80). Raised to 420px so multiple tracks
    // at their existing 64px default height are comfortably visible
    // without scrolling, matching the reference's fuller feel — the
    // default per-track height itself (already tuned in the Timeline
    // visual-weight pass) and RULER_HEIGHT/SelectionToolbar's own h-9 are
    // unchanged, this is purely giving them more room to breathe in.
    // `min-h-[180px]` (2026-07-14, real bug found via reproduction) — this
    // panel's h-420px was an un-shrinkable floor of its own, so on a short
    // window it and the row above it (editor-workspace.tsx's own
    // min-h-[460px]) were both demanding fixed minimums that don't fit
    // every real window — this panel's own floor is deliberately smaller
    // (enough for the 44px toolbar + 28px ruler + a bit over one 64px
    // track row) so on a genuinely short window THIS shrinks before
    // Preview does, matching the "Preview is the thing you're actually
    // looking at" priority.
    //
    // h-[420px] (fixed) -> a CSS variable (2026-07-15, resizable panels) —
    // `min-h-[180px]` STAYS a real CSS min-height (not a variable) since
    // it's a fixed safety floor, not something the user adjusts; the
    // `420px` fallback matches PANEL_SIZE_LIMITS.timelineHeight.default.
    <div
      className="flex min-h-[180px] flex-col border-t border-editor-line bg-editor-panel"
      style={{ height: "var(--editor-timeline-height, 420px)" }}
    >
      <SelectionToolbar
        selectedClips={selectedClips}
        hasLockedSelection={hasLockedSelection}
        onSplit={() => {
          if (selectedClips.length !== 1 || hasLockedSelection) return;
          const clip = selectedClips[0];
          const playheadMs = storeApi.getState().playheadMs;
          if (playheadMs > clip.startMs && playheadMs < clipEndMs(clip)) runSplit(clip, playheadMs - clip.startMs);
        }}
        onDuplicate={() => selectedClips.length === 1 && runDuplicate(selectedClips[0].id)}
        onRippleDelete={() => selectedClips.length === 1 && !hasLockedSelection && runRippleDelete(selectedClips[0])}
        onDelete={() => {
          if (hasLockedSelection) return;
          runDelete(selectedClips);
        }}
        onGroup={runGroup}
        onUngroup={runUngroup}
        onAddMarker={() => addMarkerMutation.mutate(storeApi.getState().playheadMs)}
        addTrackMenu={<AddTrackMenu onAdd={(kind, audioSubtype) => addTrack.mutate({ kind, audioSubtype })} pending={addTrack.isPending} />}
      />

      <div
        className="flex-1 overflow-auto"
        data-timeline-scroll
        onWheel={handleWheel}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleEmptySpaceDrop}
      >
        <div style={{ width: timelineWidthPx + TRACK_HEADER_WIDTH }}>
          <div className="sticky top-0 z-10 flex bg-editor-surface-1">
            <div style={{ width: TRACK_HEADER_WIDTH }} className="shrink-0" />
            <div
              className="relative flex-1 cursor-pointer border-b border-editor-line"
              style={{ height: RULER_HEIGHT }}
              onPointerDown={handleRulerPointerDown}
            >
              {/* Zoom/precision fix (2026-07-12) — tick interval now adapts
                  to pxPerSecond (see pickTickIntervalMs's own doc comment)
                  instead of always being exactly one tick per whole second
                  regardless of zoom. Trim itself was already millisecond-
                  precise (pxToMs/snapTrimEdge above); this was purely a
                  ruler-display limitation that made it look and feel like
                  trim couldn't reach sub-second positions. */}
              {(() => {
                const tickIntervalMs = pickTickIntervalMs(pxPerSecond);
                const tickCount = Math.ceil(timelineWidthMs / tickIntervalMs) + 1;
                return Array.from({ length: tickCount }, (_, i) => i * tickIntervalMs).map((tickMs) => (
                  <div key={tickMs} className="absolute top-0 h-full border-l border-editor-line text-nano text-neutral-500" style={{ left: (tickMs / 1000) * pxPerSecond }}>
                    <span className="ml-0.5">{formatTickLabel(tickMs, tickIntervalMs)}</span>
                  </div>
                ));
              })()}
              <MarkerTicks markers={markers} pxPerSecond={pxPerSecond} onRemove={(id) => removeMarkerMutation.mutate(id)} />
            </div>
          </div>

          <div className="flex">
            <div style={{ width: TRACK_HEADER_WIDTH }} className="shrink-0">
              {trackLayout.map(({ track, height }) => (
                <TrackHeader
                  key={track.id}
                  track={track}
                  height={height}
                  onUpdateTrack={(patch) => updateTrackMutation.mutate({ trackId: track.id, patch })}
                  onRemoveTrack={() => removeTrack.mutate(track.id)}
                  onToggleLock={() => runToggleLock(track)}
                  onResizeCommit={(newHeight) => runResizeCommit(track, newHeight)}
                  rowElRegistry={trackRowElRegistry.current}
                  onReorderStart={(clientY) => handleTrackReorderStart(track.id, clientY)}
                  onReorderMove={(clientY) => handleTrackReorderMove(track.id, clientY)}
                  onReorderEnd={(clientY) => handleTrackReorderEnd(track.id, clientY)}
                  onAddClip={
                    track.kind === "TEXT" || track.kind === "SUBTITLE"
                      ? () => {
                          const playheadMs = storeApi.getState().playheadMs;
                          const startMs = Math.round(playheadMs / 100) * 100;
                          addClipMutation.mutate({
                            trackId: track.id,
                            startMs,
                            durationMs: 3000,
                            content:
                              track.kind === "SUBTITLE"
                                ? { text: "Subtitle text", fontSize: 28, color: "#FFFFFF" }
                                : { text: "New Text", fontSize: 48, color: "#FFFFFF" },
                          });
                        }
                      : undefined
                  }
                />
              ))}
            </div>

            <div
              ref={laneRef}
              className="relative flex-1"
              style={{ height: contentHeight }}
              onPointerDown={handleLanePointerDown}
              onPointerMove={handleLaneHover}
              onPointerLeave={() => {
                if (!draggingClipId) setHoveredEdge(null);
              }}
            >
              {/* Fix (2026-07-13) — a project with zero clips used to just
                  render empty track lanes with no messaging at all (a
                  plain black gap), the one genuinely missing empty state
                  found in this pass's sweep (every sidebar section already
                  had one). pointer-events-none on the wrapper so the
                  icon/title/description never block dropping a clip onto
                  the real track lanes underneath — EmptyState's own action
                  button re-opts into pointer-events itself (see that
                  component), nothing else in this block does. z-20 to sit
                  above the (empty, at this point) track lanes; found live
                  via a first attempt at z-0 that let a track lane's own
                  stacking silently cover the button. */}
              {clips.length === 0 && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                  <EmptyState
                    icon={Upload}
                    title="No clips yet"
                    description="Drop video, audio, or image files onto a track, or upload media to get started."
                    actionLabel="Open media library"
                    onAction={() => storeApi.getState().setActiveSidebarSectionId("uploads")}
                  />
                </div>
              )}
              {trackLayout.map(({ track, top, height }) => (
                <div
                  key={track.id}
                  ref={(el) => {
                    if (el) trackRowElRegistry.current.set(track.id, el);
                    else trackRowElRegistry.current.delete(track.id);
                  }}
                  data-track-id={track.id}
                  className={cn("absolute inset-x-0 border-b border-editor-line", track.isLocked && "bg-white/[0.02]")}
                  style={{ top, height }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, track.id)}
                >
                  {clips
                    .filter((c) => c.trackId === track.id)
                    .map((clip) => (
                      <ClipBlock
                        key={clip.id}
                        clip={clip}
                        allClips={clips}
                        // Fix (2026-07-13) — a clip with an active transition is
                        // SUPPOSED to overlap its transition partner (the
                        // transition ripple-shifts the incoming clip earlier to
                        // open a real crossfade overlap window, see
                        // transitions.ts) — the new same-track overlap clamp
                        // must not fight that, or it clamps the clip right back
                        // down to the partner's edge and the transition's own
                        // invariant check then prunes it. Excluded from the
                        // neighbor list the clamp uses, nothing else.
                        transitionPartnerIds={
                          new Set(
                            transitions
                              .filter((t) => t.clipAId === clip.id || t.clipBId === clip.id)
                              .map((t) => (t.clipAId === clip.id ? t.clipBId : t.clipAId))
                          )
                        }
                        markers={markers}
                        assets={assetsQuery.data ?? []}
                        trackKind={track.kind}
                        pxPerSecond={pxPerSecond}
                        snapThresholdPx={storeApi.getState().snapThresholdPx}
                        color={track.audioSubtype ? AUDIO_SUBTYPE_COLOR[track.audioSubtype] : TRACK_COLORS[track.kind]}
                        selected={selectedClipIds.has(clip.id)}
                        locked={track.isLocked}
                        registry={clipElRegistry.current}
                        keyframeTrackElRegistry={keyframeTrackElRegistry.current}
                        trimHandlerRegistry={trimHandlerRegistry.current}
                        trackRowElRegistry={trackRowElRegistry.current}
                        tracksById={trackById}
                        getPlayheadMs={() => storeApi.getState().playheadMs}
                        snapGuideElRef={snapGuideElRef}
                        onSelect={(mode) => selectClip(clip.id, mode)}
                        onCommitMove={(previousStartMs, newStartMs, trackChange) => {
                          pendingMoveCommandsRef.current.push(createMoveClipCommand(commandDeps, clip.id, previousStartMs, newStartMs, trackChange));
                          scheduleMoveFlush();
                        }}
                        onCommitGroupMove={(otherClipId, previousStartMs, newStartMs) => {
                          pendingMoveCommandsRef.current.push(createMoveClipCommand(commandDeps, otherClipId, previousStartMs, newStartMs));
                          scheduleMoveFlush();
                        }}
                        onCommitTrim={(previous, next) => {
                          runCommand(createTrimClipCommand(commandDeps, clip.id, previous, next));
                        }}
                        onCommitContent={(previous, next) => {
                          runCommand(createUpdateContentCommand(commandDeps, clip.id, previous, next));
                        }}
                        onSplitAtPlayhead={() => {
                          const playheadMs = storeApi.getState().playheadMs;
                          if (playheadMs > clip.startMs && playheadMs < clipEndMs(clip)) runSplit(clip, playheadMs - clip.startMs);
                        }}
                        onDuplicate={() => runDuplicate(clip.id)}
                        onRippleDelete={() => runRippleDelete(clip)}
                        onDelete={() => runDelete([clip])}
                        onReplaceSource={(assetId) => runReplaceSource(clip.id, clip.assetId, assetId)}
                        onGroup={runGroup}
                        onUngroup={runUngroup}
                        canGroup={selectedClipIds.has(clip.id) && selectedClips.length >= 2}
                      />
                    ))}

                  {/* Module 9 — a small icon/handle at the boundary between
                      two adjacent clips on THIS track (not its own track
                      row) — see TransitionBoundaries' doc comment. */}
                  {!track.isLocked && (
                    <TransitionBoundaries
                      trackId={track.id}
                      clipsOnTrack={clips.filter((c) => c.trackId === track.id)}
                      transitions={transitions}
                      pxPerSecond={pxPerSecond}
                      rowHeight={height}
                      onAdd={runAddTransition}
                      onUpdate={runUpdateTransition}
                      onRemove={runRemoveTransition}
                    />
                  )}
                </div>
              ))}

              <PlayheadLine pxPerSecond={pxPerSecond} />

              {/* Module 6 — the selected clip's keyframe track, an overlay
                  positioned directly below its track row (see
                  keyframe-track.tsx's file header for why this is an
                  overlay rather than a true row-pushing expand). Only
                  single-clip selection shows it. */}
              {selectedClips.length === 1 &&
                (() => {
                  const clip = selectedClips[0];
                  const layout = trackLayoutById.get(clip.trackId);
                  if (!layout) return null;
                  return (
                    <ClipKeyframeTrack
                      clip={clip}
                      top={layout.top + layout.height}
                      pxPerSecond={pxPerSecond}
                      getPlayheadMs={() => storeApi.getState().playheadMs}
                      commandDeps={commandDeps}
                      runCommand={runCommand}
                      registry={keyframeTrackElRegistry.current}
                    />
                  );
                })()}

              {/* Marquee selection overlay — direct style writes only, see onMarqueeMove/Up. */}
              <div
                ref={marqueeElRef}
                className="pointer-events-none absolute z-20 hidden rounded-sm border border-editor-accent bg-editor-accent/10"
              />
              {/* Snap guide — direct style writes only, from ClipBlock's drag handlers. */}
              <div
                ref={snapGuideElRef}
                className="pointer-events-none absolute top-0 z-20 hidden h-full w-px bg-white"
              />

              {/* Bug #3 fix — see TrimHandleOverlay's own file header. */}
              <TrimHandleOverlay
                clips={clips}
                trackById={trackById}
                trackLayoutById={trackLayoutById}
                pxPerSecond={pxPerSecond}
                selectedClipIds={selectedClipIds}
                hoveredClipId={hoveredEdge?.clipId ?? null}
                draggingClipId={draggingClipId}
                isClipLocked={isClipLocked}
                onHandlePointerDown={startTrimFromOverlay}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Bug #3 fix — trim-handle hit-targets rendered as a SINGLE top-level
// sibling of every clip in the lane, not nested inside any individual
// clip. Same principle Module 4 already uses for the Preview Window's
// crop handles (see CropHandles in preview-window.tsx: an unclipped
// interaction layer floating above clipped/isolated visual layers),
// applied to the Timeline.
//
// Why this is necessary rather than a z-index tweak: every clip's own
// root div sets `will-change-transform`, which makes it establish its OWN
// CSS stacking context. A resize handle rendered as that div's CHILD can
// only ever out-rank the OTHER CHILDREN of that same clip — never a
// SIBLING clip, no matter how high its z-index. During an active
// transition's overlap window, two clips' boxes genuinely overlap by
// design (Module 9's ripple-shift moves clipB's start earlier than
// clipA's end), and whichever clip is later in DOM order paints over the
// earlier one's ENTIRE subtree — handles included — regardless of any
// z-index set on the handle itself. Rendering handles at THIS level
// instead sidesteps the problem entirely: there's no per-clip stacking
// context here to be trapped inside.
//
// Only renders handles for clips that are hovered, selected, or actively
// being dragged — not every clip at once. "Hovered" is computed by
// TimelinePanel's handleLaneHover via pure coordinate math against each
// clip's own known layout, deliberately NOT the browser's native
// mouseenter/mouseleave — native hover resolves to whichever element is
// topmost in PAINT order, which is exactly the thing this component
// exists to route around.
function TrimHandleOverlay({
  clips,
  trackById,
  trackLayoutById,
  pxPerSecond,
  selectedClipIds,
  hoveredClipId,
  draggingClipId,
  isClipLocked,
  onHandlePointerDown,
}: {
  clips: ClipView[];
  trackById: Map<string, TrackView>;
  trackLayoutById: Map<string, TrackLayoutEntry>;
  pxPerSecond: number;
  selectedClipIds: Set<string>;
  hoveredClipId: string | null;
  draggingClipId: string | null;
  isClipLocked: (clip: ClipView) => boolean;
  onHandlePointerDown: (clipId: string, edge: "left" | "right", e: React.PointerEvent) => void;
}) {
  const activeIds = new Set<string>(selectedClipIds);
  if (hoveredClipId) activeIds.add(hoveredClipId);
  if (draggingClipId) activeIds.add(draggingClipId);
  if (activeIds.size === 0) return null;

  const activeClips = clips.filter((c) => activeIds.has(c.id) && !isClipLocked(c));
  if (activeClips.length === 0) return null;

  return (
    <>
      {activeClips.map((clip) => {
        const layout = trackLayoutById.get(clip.trackId);
        if (!layout) return null;
        const left = (clip.startMs / 1000) * pxPerSecond;
        const width = Math.max(4, (clip.durationMs / 1000) * pxPerSecond);
        const top = layout.top + 1;
        const height = Math.max(0, layout.height - 2);

        // An audio clip's own fade-handle nub (rendered inside ClipBlock,
        // z-30) sits at the exact clip edge when that side's fade is
        // still 0ms — and is now trapped in ITS OWN stacking context
        // exactly like the old trim handles were, unable to out-rank this
        // overlay via z-index. Since we're unconditionally on top now, WE
        // yield to it instead: inset our own hit-zone past the fade nub's
        // ~5px radius rather than fighting a z-index battle neither side
        // could structurally win.
        const isAudioClip = trackById.get(clip.trackId)?.kind === "AUDIO";
        const fadeInMs = isAudioClip ? (clip.content?.fadeInMs ?? DEFAULT_AUDIO_PROPERTIES.fadeInMs) : -1;
        const fadeOutMs = isAudioClip ? (clip.content?.fadeOutMs ?? DEFAULT_AUDIO_PROPERTIES.fadeOutMs) : -1;
        const leftHandleX = left + (fadeInMs === 0 ? 6 : 0);
        const rightHandleX = left + width - 8 - (fadeOutMs === 0 ? 6 : 0);

        return (
          <React.Fragment key={clip.id}>
            <div
              data-resize-handle="left"
              data-overlay-for-clip={clip.id}
              className="absolute z-40 w-2 cursor-ew-resize"
              style={{ left: leftHandleX, top, width: 8, height }}
              onPointerDown={(e) => onHandlePointerDown(clip.id, "left", e)}
            />
            <div
              data-resize-handle="right"
              data-overlay-for-clip={clip.id}
              className="absolute z-40 w-2 cursor-ew-resize"
              style={{ left: rightHandleX, top, width: 8, height }}
              onPointerDown={(e) => onHandlePointerDown(clip.id, "right", e)}
            />
          </React.Fragment>
        );
      })}
    </>
  );
}

// Transient-subscribes to the store (no React re-render) and writes
// `style.transform` directly — see the file header's performance comment.
function PlayheadLine({ pxPerSecond }: { pxPerSecond: number }) {
  const storeApi = useEditorStoreApi();
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    return storeApi.subscribe(
      (s) => s.playheadMs,
      (playheadMs) => {
        const el = ref.current;
        if (el) el.style.transform = `translateX(${(playheadMs / 1000) * pxPerSecond}px)`;
      },
      { fireImmediately: true }
    );
  }, [storeApi, pxPerSecond]);

  // Fix (2026-07-13) — recolored again, from the neutral white line the
  // 2026-07-12 visual-fidelity pass used (back when orange was the one
  // interactive accent app-wide) to the new editor-scoped accent
  // (--color-editor-accent, blue-violet) with a subtle glow. That earlier
  // collision concern no longer applies: this accent is editor-scoped only
  // (confirmed with the founder before the global token swap), so "current
  // playback position" and "selected/active" sharing one accent hue is a
  // deliberate, current design choice, not a regression of the old one.
  return (
    <div ref={ref} className="pointer-events-none absolute top-0 z-10 h-full w-px bg-editor-accent shadow-[0_0_6px_1px_rgba(91,124,250,0.7)] will-change-transform">
      <div className="absolute top-0 left-1/2 h-2 w-2.5 -translate-x-1/2 rounded-[1px] bg-editor-accent shadow-[0_0_6px_1px_rgba(91,124,250,0.7)]" />
    </div>
  );
}

// Fix (2026-07-12) — this row used to render NOTHING but the "Add Track"
// menu whenever nothing was selected: every action button lived inside a
// single `{hasSelection && (...)}` block, so the whole cluster was absent
// from the DOM, not just visually inert, until a clip was selected —
// exactly the "toolbar disappears when nothing is selected" bug. Every
// action button is now unconditionally rendered; only each one's own
// `disabled` state reflects whether the current selection satisfies its
// precondition, matching the reference's always-visible/greyed-when-
// inapplicable convention. Add Marker is new here (previously reachable
// only via the "M" keyboard shortcut, wired to the exact same
// addMarkerMutation call) since it doesn't depend on clip selection at all
// and the reference shows a marker icon in this same row. Crop/Rotate are
// deliberately NOT added: unlike marker-add, neither has a discrete,
// already-working action to wire a button to in this app's architecture
// (crop is a drag-handle overlay on the Preview Window, rotate is a
// Properties-panel slider, not a toolbar click-action) — adding either
// here would be new functional scope, not a visibility fix.
//
// Density (2026-07-14, full-spec audit) — height 36px (h-9) -> 44px
// (h-11), icon-to-icon gap within a group 4px (gap-1) -> 8px (gap-2),
// divider margin 4px/side (mx-1, 8px total) -> 6px/side (mx-1.5, 12px
// total) — matches a more precise CapCut-screenshot-derived spec's own
// numbers for this row. Icon size (16px, size-4) was already within the
// spec's own 16-18px range, left unchanged.
//
// Reordered/extended (2026-07-14, Section 4/8 rebuild against
// premium-editor.jsx) — Undo/Redo added as a second real entry point to
// the same command-stack action top-toolbar.tsx already exposes (see this
// function's own body for the wiring), positioned right after Add Track
// per the reference's own grouping. The reference's remaining slots —
// a Select-tool dropdown (this app has no distinct tool-mode to switch
// between; selection is always active), Flip/Rotate as toolbar buttons
// (real properties, but Properties-panel-only today, same "not a toolbar
// click-action" reasoning as Crop above), Enhance/Adjust and Mic (no such
// features exist anywhere in this app), and Magnetic-snap/Link-Sync
// toggles (snapping is real but always-on with an admin-configured
// threshold, no per-session on/off switch exists; clip linking IS covered
// by the real Group/Ungroup buttons already in this row) — are
// deliberately not built, same "only if real, don't invent new
// functionality in a visual-restructure pass" boundary as everywhere else
// in this rebuild.
function SelectionToolbar({
  selectedClips,
  hasLockedSelection,
  onSplit,
  onDuplicate,
  onRippleDelete,
  onDelete,
  onGroup,
  onUngroup,
  onAddMarker,
  addTrackMenu,
}: {
  selectedClips: ClipView[];
  hasLockedSelection: boolean;
  onSplit: () => void;
  onDuplicate: () => void;
  onRippleDelete: () => void;
  onDelete: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onAddMarker: () => void;
  addTrackMenu: React.ReactNode;
}) {
  const hasSelection = selectedClips.length > 0;
  const single = selectedClips.length === 1;
  const canGroup = selectedClips.length >= 2;
  const canUngroup = selectedClips.some((c) => c.groupId);

  // Undo/Redo (2026-07-14, Section 4/8 timeline-toolbar rebuild against
  // premium-editor.jsx) — the reference places these in the timeline
  // toolbar, not just the top bar; this is the exact same real
  // undo()/redo() command-stack action top-toolbar.tsx already exposes
  // (storeApi.getState().undo/redo, same canUndo/canRedo/historyBusy
  // state), just a second real entry point to it, not a new feature or
  // duplicated logic. Ctrl+Z/Ctrl+Shift+Z keep working regardless — that
  // listener lives in top-toolbar.tsx and isn't scoped to focus.
  const storeApi = useEditorStoreApi();
  const canUndo = useEditorStore((s) => s.undoStack.length > 0);
  const canRedo = useEditorStore((s) => s.redoStack.length > 0);
  const historyBusy = useEditorStore((s) => s.historyBusy);

  return (
    // `overflow-x-auto` + a hairline scrollbar (2026-07-14, defensive fix
    // for a reported "zoom control missing, large empty gap" symptom) —
    // this row previously had no horizontal overflow handling at all;
    // `justify-between` pushes TimelineZoomControl to the far right, and
    // if the left icon cluster's own width (fixed regardless of window
    // size — icons/dividers don't shrink) ever exceeds the available
    // toolbar width, the zoom control would be pushed completely outside
    // the visible viewport with no way to scroll to it, reading as
    // "missing" rather than "off-screen." Same hairline-scrollbar pattern
    // PanelTabStrip already established for exactly this class of issue.
    <div
      className={cn(
        "flex h-11 shrink-0 items-center justify-between overflow-x-auto border-b border-editor-line px-3",
        "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      )}
    >
      <div className="flex shrink-0 items-center gap-2">
        {addTrackMenu}
        <div className="mx-1.5 h-4 w-px shrink-0 bg-editor-line" />
        <Button type="button" variant="ghost" size="icon-sm" className="text-neutral-300 hover:text-white" title="Undo (Ctrl+Z)" disabled={!canUndo || historyBusy} onClick={() => void storeApi.getState().undo()}>
          <Undo2 className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" className="text-neutral-300 hover:text-white" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo || historyBusy} onClick={() => void storeApi.getState().redo()}>
          <Redo2 className="size-4" />
        </Button>
        <div className="mx-1.5 h-4 w-px shrink-0 bg-editor-line" />
        {hasLockedSelection && <span className="mr-1 text-caption text-neutral-500">Track locked</span>}
        <Button type="button" variant="ghost" size="icon-sm" className="text-neutral-300 hover:text-white" title="Split at playhead (S)" onClick={onSplit} disabled={!single || hasLockedSelection}>
          <Scissors className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-neutral-300 hover:text-editor-danger"
          title="Delete (Del)"
          onClick={onDelete}
          disabled={!hasSelection || hasLockedSelection}
        >
          <Trash2 className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" className="text-neutral-300 hover:text-white" title="Add marker at playhead (M)" onClick={onAddMarker}>
          <Bookmark className="size-4" />
        </Button>
        {/* Fix (2026-07-13) — visual grouping dividers between logical
            clusters (split/delete/marker match the reference's own named
            cluster; duplicate/ripple-delete edit one clip's own placement;
            group/ungroup are structural), matching the reference's own
            clustered-icon convention. */}
        <div className="mx-1.5 h-4 w-px shrink-0 bg-editor-line" />
        <Button type="button" variant="ghost" size="icon-sm" className="text-neutral-300 hover:text-white" title="Duplicate (Ctrl/Cmd+D)" onClick={onDuplicate} disabled={!single}>
          <Copy className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-neutral-300 hover:text-white"
          title="Ripple delete"
          onClick={onRippleDelete}
          disabled={!single || hasLockedSelection}
        >
          <Combine className="size-4" />
        </Button>
        <div className="mx-1.5 h-4 w-px shrink-0 bg-editor-line" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-neutral-300 hover:text-white"
          title="Group (Ctrl/Cmd+G)"
          onClick={onGroup}
          disabled={!canGroup || hasLockedSelection}
        >
          <Group className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-neutral-300 hover:text-white"
          title="Ungroup (Ctrl/Cmd+Shift+G)"
          onClick={onUngroup}
          disabled={!canUngroup || hasLockedSelection}
        >
          <UngroupIcon className="size-4" />
        </Button>
      </div>
      <TimelineZoomControl />
    </div>
  );
}

// Fix (2026-07-12) — the zoom slider + +/- buttons used to live in
// bottom-status-bar.tsx, a full-width footer BELOW the entire workspace
// (sidebar/preview/timeline/properties row), disconnected from the
// Timeline it actually controls. Moved into this same toolbar row, on the
// far right (mirroring the reference's integrated placement) — reads/
// writes pxPerSecond directly via the store rather than through props,
// since it's a self-contained control with no dependency on this
// component's own selection state.
function TimelineZoomControl() {
  const pxPerSecond = useEditorStore((s) => s.pxPerSecond);
  const setPxPerSecond = useEditorStore((s) => s.setPxPerSecond);

  return (
    <div className="flex w-40 shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-6 shrink-0 text-neutral-500 hover:text-white"
        title="Zoom out"
        onClick={() => setPxPerSecond((v) => v / ZOOM_STEP)}
      >
        <ZoomOut className="size-3.5" />
      </Button>
      <Slider
        min={10}
        max={600}
        step={5}
        value={[pxPerSecond]}
        onValueChange={([v]) => setPxPerSecond(v)}
        // Per-call-site override, not a shared-component edit (same
        // convention as Button's dark-mode overrides elsewhere in this
        // file) — targets Slider's own data-slot children directly since
        // it exposes no track/range/thumb className props of its own.
        className={cn(
          "w-24",
          '[&_[data-slot="slider-track"]]:h-1.5 [&_[data-slot="slider-track"]]:bg-editor-line',
          '[&_[data-slot="slider-range"]]:bg-editor-accent',
          '[&_[data-slot="slider-thumb"]]:size-3.5 [&_[data-slot="slider-thumb"]]:border-editor-accent [&_[data-slot="slider-thumb"]]:bg-editor-accent [&_[data-slot="slider-thumb"]]:ring-editor-accent/30'
        )}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-6 shrink-0 text-neutral-500 hover:text-white"
        title="Zoom in"
        onClick={() => setPxPerSecond((v) => v * ZOOM_STEP)}
      >
        <ZoomIn className="size-3.5" />
      </Button>
    </div>
  );
}

// Module 8 — AUDIO gets a Voice/Music/SFX submenu instead of a single
// generic item, since that's the only track kind this module gives a UI
// subtype tag to (see EditorAudioSubtype's schema doc comment: still just
// `kind: "AUDIO"` under the hood).
// `pending` (2026-07-15, real gap found live) — addTrack's `order` is
// computed server-side with prepend/append + collision-retry logic (see
// tracks.ts's own addTrack, already the fix for a real prior bug), so an
// optimistic client-side insert risks guessing the wrong position and
// flashing the new track in the wrong spot before snapping to its real
// one — worse than the delay it'd fix. Cheaper, safe fix for the same
// "does this feel responsive" complaint: an immediate spinner on the
// trigger itself, so the click visibly registers even though the track
// row doesn't appear until the round trip lands (measured live: 1.2-3.9s
// even once the route was warm — a real, not just cold-start, gap).
function AddTrackMenu({ onAdd, pending }: { onAdd: (kind: EditorTrackKind, audioSubtype?: EditorAudioSubtype) => void; pending: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-neutral-300 hover:text-white" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add Track
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {EDITOR_TRACK_KINDS.map((kind) =>
          kind === "AUDIO" ? (
            <DropdownMenuSub key={kind}>
              <DropdownMenuSubTrigger>AUDIO</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {EDITOR_AUDIO_SUBTYPES.map((subtype) => (
                  <DropdownMenuItem key={subtype} onClick={() => onAdd("AUDIO", subtype)}>
                    {AUDIO_SUBTYPE_LABEL[subtype]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
            <DropdownMenuItem key={kind} onClick={() => onAdd(kind)}>
              {kind}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface TrackResizeDrag {
  startY: number;
  startHeight: number;
  deltaPx: number;
  rafScheduled: boolean;
}

// Perf pass (2026-07-16) — memoized with a CUSTOM comparator, not a bare
// React.memo(TrackHeader). Every callback prop here (onUpdateTrack,
// onRemoveTrack, onToggleLock, onResizeCommit, onReorderStart/Move/End,
// onAddClip) is a fresh inline closure built in TimelinePanel's own
// `.map()` on every one of ITS renders — a bare shallow-compare memo would
// never actually skip a re-render, since those references always differ.
// Excluding them from the comparator is safe: each is reconstructed the
// same way from the same `track.id` every time, so an "old" closure kept
// alive by a skipped render behaves identically to a fresh one. Only
// `track`/`height`/`rowElRegistry` (a stable ref-backed Map, see
// TimelinePanel's own `trackRowElRegistry.current`) actually determine
// this component's rendered output. Found and fixed after the Performance
// & Scale stress-test pass measured EVERY TrackHeader (all 8-10 tracks)
// re-rendering from selecting a single clip on an unrelated track — see
// PROJECT_STATUS.md's 2026-07-16 entry for the live before/after numbers.
const TrackHeader = React.memo(function TrackHeader({
  track,
  height,
  onUpdateTrack,
  onRemoveTrack,
  onToggleLock,
  onResizeCommit,
  rowElRegistry,
  onAddClip,
  onReorderStart,
  onReorderMove,
  onReorderEnd,
}: {
  track: TrackView;
  height: number;
  onUpdateTrack: (patch: { isMuted?: boolean; isHidden?: boolean; soloed?: boolean }) => void;
  onRemoveTrack: () => void;
  onToggleLock: () => void;
  onResizeCommit: (newHeightPx: number) => void;
  rowElRegistry: Map<string, HTMLDivElement>;
  onAddClip?: () => void;
  // Drag-to-reorder (2026-07-15) — the discrete "which index does this
  // correspond to" math lives in the parent (it has every track's layout,
  // not just this one), so this component only reports raw clientY at
  // each stage; the parent computes the live preview index and, on end,
  // constructs the actual undo-able command. This component keeps its
  // OWN direct-DOM-transform drag feel (matching the resize handle right
  // below it) for the dragged row itself following the cursor smoothly —
  // the parent's re-render only handles the OTHER rows shifting out of
  // the way.
  onReorderStart: (clientY: number) => void;
  onReorderMove: (clientY: number) => void;
  onReorderEnd: (clientY: number) => void;
}) {
  const headerElRef = React.useRef<HTMLDivElement | null>(null);
  const resizeDragRef = React.useRef<TrackResizeDrag | null>(null);
  const reorderDragRef = React.useRef<{ startClientY: number; pendingClientY: number; rafScheduled: boolean } | null>(null);

  function applyHeight(h: number) {
    if (headerElRef.current) headerElRef.current.style.height = `${h}px`;
    const row = rowElRegistry.get(track.id);
    if (row) row.style.height = `${h}px`;
  }

  function onReorderPointerMove(e: PointerEvent) {
    const drag = reorderDragRef.current;
    if (!drag) return;
    drag.pendingClientY = e.clientY;
    if (drag.rafScheduled) return;
    drag.rafScheduled = true;
    requestAnimationFrame(() => {
      const current = reorderDragRef.current;
      if (!current) return;
      current.rafScheduled = false;
      if (headerElRef.current) {
        headerElRef.current.style.transform = `translateY(${current.pendingClientY - current.startClientY}px)`;
        headerElRef.current.style.zIndex = "30";
        headerElRef.current.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
      }
      onReorderMove(current.pendingClientY);
    });
  }
  function onReorderPointerUp(e: PointerEvent) {
    window.removeEventListener("pointermove", onReorderPointerMove);
    window.removeEventListener("pointerup", onReorderPointerUp);
    const drag = reorderDragRef.current;
    reorderDragRef.current = null;
    if (headerElRef.current) {
      headerElRef.current.style.transform = "";
      headerElRef.current.style.zIndex = "";
      headerElRef.current.style.boxShadow = "";
    }
    if (!drag) return;
    onReorderEnd(e.clientY);
  }
  function startReorderDrag(e: React.PointerEvent) {
    e.stopPropagation();
    reorderDragRef.current = { startClientY: e.clientY, pendingClientY: e.clientY, rafScheduled: false };
    onReorderStart(e.clientY);
    window.addEventListener("pointermove", onReorderPointerMove);
    window.addEventListener("pointerup", onReorderPointerUp);
  }

  function onResizeMove(e: PointerEvent) {
    const drag = resizeDragRef.current;
    if (!drag) return;
    drag.deltaPx = e.clientY - drag.startY;
    if (drag.rafScheduled) return;
    drag.rafScheduled = true;
    requestAnimationFrame(() => {
      const current = resizeDragRef.current;
      if (!current) return;
      current.rafScheduled = false;
      applyHeight(Math.min(MAX_TRACK_HEIGHT, Math.max(MIN_TRACK_HEIGHT, current.startHeight + current.deltaPx)));
    });
  }

  function onResizeUp() {
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup", onResizeUp);
    const drag = resizeDragRef.current;
    resizeDragRef.current = null;
    if (!drag) return;
    const newHeight = Math.min(MAX_TRACK_HEIGHT, Math.max(MIN_TRACK_HEIGHT, drag.startHeight + drag.deltaPx));
    if (Math.abs(newHeight - drag.startHeight) >= 2) onResizeCommit(newHeight);
    else applyHeight(drag.startHeight); // snap back — not a real resize
  }

  function startResize(e: React.PointerEvent) {
    e.stopPropagation();
    resizeDragRef.current = { startY: e.clientY, startHeight: height, deltaPx: 0, rafScheduled: false };
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", onResizeUp);
  }

  // Section 5/8 (2026-07-14, premium-editor.jsx rebuild) — compact
  // icon-only identity, replacing the plain text label: a small dot in the
  // track's own color (same TRACK_DOT_COLOR/AUDIO_SUBTYPE_DOT_COLOR tokens
  // ClipBlock's own fills use, so a track's header and its clips visually
  // match) plus a distinct per-kind icon. The kind/subtype name still
  // reaches the user via the icon's `title` tooltip — nothing lost, just a
  // different modality, matching the reference's own icon-only headers.
  const KindIcon = track.audioSubtype ? AUDIO_SUBTYPE_ICON[track.audioSubtype] : TRACK_KIND_ICON[track.kind];
  const dotColor = track.audioSubtype ? AUDIO_SUBTYPE_DOT_COLOR[track.audioSubtype] : TRACK_DOT_COLOR[track.kind];
  const kindLabel = track.audioSubtype ? AUDIO_SUBTYPE_LABEL[track.audioSubtype] : track.kind;

  return (
    <div ref={headerElRef} data-track-id={track.id} className="group relative flex items-center justify-between gap-1 border-r border-b border-editor-line px-2" style={{ height }}>
      <div className="flex min-w-0 shrink-0 items-center gap-1">
        {/* Drag-to-reorder handle (2026-07-15) — always enabled, including
            for locked and AUDIO tracks. Locked only blocks CONTENT edits
            (clips/drop/trim), and repositioning a track isn't one; AUDIO
            tracks have no compositor stacking role but users still
            legitimately want to organize them (e.g. Voice grouped above
            Music) — no reason to special-case either out of a generic
            "arrange the track panel" gesture. */}
        <span
          className="shrink-0 cursor-grab touch-none text-neutral-600 hover:text-neutral-300 active:cursor-grabbing"
          title="Drag to reorder track"
          onPointerDown={startReorderDrag}
        >
          <GripVertical className="size-3" />
        </span>
        <div className="flex min-w-0 items-center gap-1.5" title={kindLabel}>
          <span className={cn("size-1.5 shrink-0 rounded-full", dotColor)} />
          <KindIcon className="size-3.5 shrink-0 text-neutral-400" />
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        {onAddClip && (
          // TEXT/SUBTITLE clips are authored in-editor, not asset-backed —
          // they have no drag source in the Uploads panel (Module 2's
          // clip-add path is drag-a-media-asset-onto-a-track only), so this
          // is the only creation entry point for either kind. Adds a
          // default no-asset clip at the current playhead.
          <Button type="button" variant="ghost" size="icon-xs" onClick={onAddClip} className="text-neutral-500 hover:text-white" title={`Add ${track.kind === "SUBTITLE" ? "subtitle" : "text"} clip`}>
            <Plus className="size-3.5" />
          </Button>
        )}
        {track.kind === "SUBTITLE" && (
          // Module 7, Part E — Phase 12's AI auto-captions hook. Disabled
          // (not hidden) so the feature is discoverable now; no
          // transcription logic lives behind it yet. Button's own
          // disabled:opacity-40 (2026-07-15, shared-Button migration)
          // replaces the old hand-rolled cursor-not-allowed/text-neutral-700
          // — same dimmed-and-inert treatment SelectionToolbar's own
          // disabled buttons already get from the shared component.
          <Button type="button" variant="ghost" size="icon-xs" disabled className="text-neutral-500" title="Auto-generate captions — coming soon">
            <Captions className="size-3.5" />
          </Button>
        )}
        {(track.kind === "AUDIO" || track.kind === "VIDEO") && (
          <>
            {/* Accent color on the active state (2026-07-15) — Mute only
                relied on the icon shape (Volume2 vs VolumeX) with no color
                change, inconsistent with Solo/Lock right next to it, which
                both get this same accent highlight. At size-3.5 (14px) a
                shape-only change is easy to miss at a glance; matching
                Solo/Lock's treatment here for one consistent "this is
                active" visual language across all four track toggles. */}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => onUpdateTrack({ isMuted: !track.isMuted })}
              className={cn("text-neutral-500 hover:text-white", track.isMuted && "text-editor-accent hover:text-editor-accent")}
              title={track.isMuted ? "Unmute" : "Mute"}
            >
              {track.isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </Button>
            {/* Module 8 (Part C) — standard DAW solo: soloing this track
                silences every OTHER track in the project regardless of
                their own mute state (see lib/video-editor/audio.ts's
                isTrackAudible()), applied live in preview-window.tsx. */}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => onUpdateTrack({ soloed: !track.soloed })}
              className={cn("text-nano font-bold text-neutral-500 hover:text-white", track.soloed && "text-editor-accent hover:text-editor-accent")}
              title={track.soloed ? "Unsolo" : "Solo"}
            >
              S
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onUpdateTrack({ isHidden: !track.isHidden })}
          className={cn("text-neutral-500 hover:text-white", track.isHidden && "text-editor-accent hover:text-editor-accent")}
          title={track.isHidden ? "Show" : "Hide"}
        >
          {track.isHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onToggleLock}
          className={cn("text-neutral-500 hover:text-white", track.isLocked && "text-editor-accent hover:text-editor-accent")}
          title={track.isLocked ? "Unlock track" : "Lock track"}
        >
          {track.isLocked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
        </Button>
        {/* "More" overflow (2026-07-14, Section 5/8 rebuild) — the
            reference's own track-header icon set is Lock/Eye/More, not a
            bare always-hover-visible trash icon; "Remove track" (the only
            real track-level action beyond what's already exposed above)
            now lives behind it. Same onRemoveTrack callback, same
            hover-to-reveal visibility — just a menu wrapper, not new
            functionality. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" className="hidden text-neutral-500 hover:text-white group-hover:inline-flex" title="More">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={onRemoveTrack}>
              <Trash2 className="size-3.5" />
              Remove track
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Resize handle — Part A. Live height preview on this track's own
          header+row via applyHeight(); tracks below it snap to their new
          offset on commit (re-render), not live during the drag — see the
          file header's performance comment for why. */}
      <div className="absolute inset-x-0 bottom-0 h-1 cursor-ns-resize hover:bg-editor-accent/60" onPointerDown={startResize} />
    </div>
  );
}, (prev, next) => prev.track === next.track && prev.height === next.height && prev.rowElRegistry === next.rowElRegistry);

function MarkerTicks({ markers, pxPerSecond, onRemove }: { markers: MarkerView[]; pxPerSecond: number; onRemove: (id: string) => void }) {
  return (
    <>
      {markers.map((marker) => (
        <button
          key={marker.id}
          type="button"
          className="group absolute top-0 z-10 flex h-full w-3 -translate-x-1/2 items-start justify-center"
          style={{ left: (marker.timeMs / 1000) * pxPerSecond }}
          title="Marker (click to remove)"
          // Ruler scrubbing (below) listens on onPointerDown, which fires
          // and bubbles before this button's own onClick — stopping only
          // the click, not the pointerdown, would let a marker click also
          // seek the playhead to that position as an unwanted side effect.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(marker.id);
          }}
        >
          <span className="mt-0.5 size-2 rotate-45 bg-editor-accent group-hover:bg-editor-danger" />
        </button>
      ))}
    </>
  );
}

interface DragState {
  mode: "move" | "resize-left" | "resize-right";
  startClientX: number;
  deltaMs: number;
  rafScheduled: boolean;
  // Cross-track drag (2026-07-15) — only meaningful for mode "move".
  // Raw viewport clientY (not a delta) since hover-track hit-testing
  // compares directly against each track row's own getBoundingClientRect(),
  // which already accounts for the Timeline's current scroll position —
  // computing a delta against scrollable content coordinates would drift
  // as soon as the user scrolled mid-drag.
  clientY: number;
}

// Module 10 (Bug #3 fix) — each ClipBlock registers its own trim-start
// closures here instead of rendering the resize-handle hit-targets itself.
// See TrimHandleOverlay's file header for why: a clip's own `will-change-
// transform` makes it a separate stacking context, so a handle rendered as
// ITS OWN CHILD can never out-rank a SIBLING clip that happens to be later
// in DOM order — which is exactly what happens during an active
// transition's overlap window, where two clips' boxes genuinely overlap by
// design. The registered closures are the SAME, already-tested drag-start
// logic ClipBlock always had; only WHO calls them (the overlay, not a
// child of the clip itself) changes.
interface TrimHandlers {
  left: (e: React.PointerEvent) => void;
  right: (e: React.PointerEvent) => void;
}

// Fix (2026-07-13) — Timeline filmstrip rendering. Module-level, keyed by
// URL: multiple clips (and multiple re-renders of the same clip) commonly
// reference the same asset's sprite sheet, and there's no reason to decode
// it more than once per page load. The browser's own HTTP cache already
// makes a repeat `fetch`/`Image.src` for the same URL cheap, but this
// still saves the repeat *decode* and gives every caller the same
// already-resolved HTMLImageElement instead of a fresh Image() + load
// event each time.
const filmstripImageCache = new Map<string, Promise<HTMLImageElement>>();
function loadFilmstripImage(url: string): Promise<HTMLImageElement> {
  let cached = filmstripImageCache.get(url);
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load filmstrip sprite: ${url}`));
      img.src = url;
    });
    filmstripImageCache.set(url, cached);
  }
  return cached;
}

// Perf pass (2026-07-16) — memoized with a CUSTOM comparator, same
// reasoning as TrackHeader's own doc comment just above: every onXxx
// callback here is a fresh closure from TimelinePanel's `.map()`, always
// derived the same way from this exact `clip.id`, so excluding them from
// the comparator is safe. `registry`/`keyframeTrackElRegistry`/
// `trimHandlerRegistry`/`trackRowElRegistry`/`snapGuideElRef` are all
// ref-backed (`.current` Maps/refs from TimelinePanel's own useRefs) and
// already reference-stable across renders regardless. `transitionPartnerIds`
// IS compared, but by content (it's rebuilt as a `new Set(...)` on every
// TimelinePanel render even when the actual partner set didn't change).
// `tracksById` is `React.useMemo`'d in TimelinePanel (keyed on `tracks`),
// so reference equality is meaningful, not accidentally-always-different.
const ClipBlock = React.memo(function ClipBlock({
  clip,
  allClips,
  transitionPartnerIds,
  markers,
  assets,
  trackKind,
  pxPerSecond,
  snapThresholdPx,
  color,
  selected,
  locked,
  registry,
  keyframeTrackElRegistry,
  trimHandlerRegistry,
  trackRowElRegistry,
  tracksById,
  getPlayheadMs,
  snapGuideElRef,
  onSelect,
  onCommitMove,
  onCommitGroupMove,
  onCommitTrim,
  onCommitContent,
  onSplitAtPlayhead,
  onDuplicate,
  onRippleDelete,
  onDelete,
  onReplaceSource,
  onGroup,
  onUngroup,
  canGroup,
}: {
  clip: ClipView;
  allClips: ClipView[];
  transitionPartnerIds: Set<string>;
  markers: MarkerView[];
  assets: AssetView[];
  trackKind: EditorTrackKind;
  pxPerSecond: number;
  snapThresholdPx: number;
  color: string;
  selected: boolean;
  locked: boolean;
  registry: Map<string, HTMLDivElement>;
  keyframeTrackElRegistry: Map<string, HTMLDivElement>;
  trimHandlerRegistry: Map<string, TrimHandlers>;
  // Cross-track drag (2026-07-15) — trackRowElRegistry's DOM rects are how
  // a drag's clientY is hit-tested against "which track row is the
  // pointer over right now" (see findHoveredTrackId below); tracksById is
  // how that candidate track's own kind/isLocked get checked against
  // getClipMoveCompatibleTrackKinds before it's treated as a valid target.
  trackRowElRegistry: Map<string, HTMLDivElement>;
  tracksById: Map<string, TrackView>;
  getPlayheadMs: () => number;
  snapGuideElRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (mode: "replace" | "toggle") => void;
  onCommitMove: (previousStartMs: number, newStartMs: number, trackChange?: { previousTrackId: string; newTrackId: string }) => void;
  onCommitGroupMove: (otherClipId: string, previousStartMs: number, newStartMs: number) => void;
  onCommitTrim: (previous: { startMs: number; durationMs: number; trimStartMs: number }, next: { startMs: number; durationMs: number; trimStartMs: number }) => void;
  onCommitContent: (previous: ClipContent | null, next: ClipContent) => void;
  onSplitAtPlayhead: () => void;
  onDuplicate: () => void;
  onRippleDelete: () => void;
  onDelete: () => void;
  onReplaceSource: (assetId: string) => void;
  onGroup: () => void;
  onUngroup: () => void;
  canGroup: boolean;
}) {
  const elRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const groupMateIdsRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    const el = elRef.current;
    if (el) registry.set(clip.id, el);
    return () => {
      registry.delete(clip.id);
    };
  }, [clip.id, registry]);

  // Rounded to a whole ms — startMs/durationMs/trimStartMs are all `int` in
  // the schema (Zod `.int()`), and pxPerSecond rarely divides 1000 evenly
  // (e.g. 60px/s → 16.67ms/px), so an unrounded value here would 400 at the
  // API boundary on an otherwise-ordinary drag. A pre-existing gap surfaced
  // by Module 5's live verification, not something new to this module.
  function pxToMs(px: number) {
    return Math.round((px / pxPerSecond) * 1000);
  }
  function thresholdMs() {
    return (snapThresholdPx / pxPerSecond) * 1000;
  }

  function computeCandidates(excludeIds: Set<string>) {
    return collectSnapCandidates({
      clips: allClips,
      excludeClipIds: excludeIds,
      markerTimesMs: markers.map((m) => m.timeMs),
      playheadMs: getPlayheadMs(),
    });
  }


  function showSnapGuide(atMs: number | null) {
    const guide = snapGuideElRef.current;
    if (!guide) return;
    if (atMs === null) {
      guide.style.display = "none";
      return;
    }
    guide.style.display = "block";
    guide.style.left = `${(atMs / 1000) * pxPerSecond}px`;
  }

  // Cross-track drag — which track row (if any) a given viewport clientY
  // currently sits inside. Bounding-rect hit-testing rather than
  // trackLayout's top/height (content-relative, would drift as soon as
  // the Timeline scrolled mid-drag) — getBoundingClientRect() is always
  // viewport-relative, matching the pointer event's own clientY exactly.
  function findHoveredTrackId(clientY: number): string | null {
    for (const [trackId, el] of trackRowElRegistry) {
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY < rect.bottom) return trackId;
    }
    return null;
  }

  // Resolves what this clip is ALLOWED to move onto — the clip's own
  // asset kind if it has one (VIDEO/AUDIO/IMAGE), or null for a
  // content-only TEXT/SUBTITLE clip, matching
  // getClipMoveCompatibleTrackKinds' own documented contract.
  function ownAssetKind(): string | null {
    if (!clip.assetId) return null;
    return assets.find((a) => a.id === clip.assetId)?.kind ?? null;
  }

  // Cross-track drag is scoped to a single, ungrouped clip — see this
  // module's own investigation notes (2026-07-15): a group can legitimately
  // span different track kinds (e.g. a video+text pair grouped together),
  // so forcing every member onto ONE destination track is often impossible
  // by kind alone, and even when kind-compatible, multiple members can't
  // literally occupy the same single destination track's time slot at
  // once. Same conservative precedent Module 2 already set for raw
  // multi-selection drag ("group first, or move one at a time").
  function crossTrackEligible(): boolean {
    return groupMateIdsRef.current.length === 0;
  }

  function startDrag(mode: DragState["mode"]) {
    return (e: React.PointerEvent) => {
      e.stopPropagation();
      onSelect(e.shiftKey ? "toggle" : "replace");
      groupMateIdsRef.current = clip.groupId ? allClips.filter((c) => c.groupId === clip.groupId && c.id !== clip.id).map((c) => c.id) : [];
      dragRef.current = { mode, startClientX: e.clientX, deltaMs: 0, rafScheduled: false, clientY: e.clientY };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };
  }

  // Bug #3 fix — register this clip's own resize-start closures for
  // TrimHandleOverlay to call. No dependency array: `startDrag` closes
  // over this render's `clip`/`onCommitTrim`/etc, and re-registering on
  // every render (a cheap Map.set) is the simplest way to guarantee the
  // overlay always invokes the CURRENT closure rather than one holding
  // stale props from an earlier render.
  React.useEffect(() => {
    if (locked) {
      trimHandlerRegistry.delete(clip.id);
      return;
    }
    trimHandlerRegistry.set(clip.id, { left: startDrag("resize-left"), right: startDrag("resize-right") });
    return () => {
      trimHandlerRegistry.delete(clip.id);
    };
  });

  // Part A — a locked track's clips are selectable (to view Properties)
  // but not draggable/editable: no move/resize listeners attached.
  function selectOnly(e: React.PointerEvent) {
    e.stopPropagation();
    onSelect(e.shiftKey ? "toggle" : "replace");
  }

  function scheduleFrame() {
    const drag = dragRef.current;
    if (!drag || drag.rafScheduled) return;
    drag.rafScheduled = true;
    requestAnimationFrame(() => {
      const current = dragRef.current;
      if (!current) return;
      current.rafScheduled = false;
      applyVisual(current);
    });
  }

  // Trim-lag fix — this clip's own keyframe track (if it's the currently
  // selected clip and has one mounted, see keyframe-track.tsx) uses the
  // EXACT same left/width formula as this clip's own body, so every delta/
  // width value already computed below for `el` applies identically to it.
  // `transformCss`/`widthPx` of `null` means "leave that property alone"
  // (mirrors this function's own callers, which don't always touch both).
  function syncKeyframeTrack(transformCss: string | null, widthPx: number | null) {
    const kfEl = keyframeTrackElRegistry.get(clip.id);
    if (!kfEl) return;
    if (transformCss !== null) kfEl.style.transform = transformCss;
    if (widthPx !== null) kfEl.style.width = `${widthPx}px`;
  }

  // Cross-track drag — resolves what the hovered track means for THIS
  // gesture: null when cross-track isn't in play at all (grouped clip, no
  // hover, or hovering the clip's own track), otherwise whether that
  // specific track is a legal drop target right now.
  function resolveHoverTarget(clientY: number): { trackId: string; track: TrackView; valid: boolean } | null {
    if (!crossTrackEligible()) return null;
    const hoveredTrackId = findHoveredTrackId(clientY);
    if (!hoveredTrackId || hoveredTrackId === clip.trackId) return null;
    const hoveredTrack = tracksById.get(hoveredTrackId);
    if (!hoveredTrack) return null;
    const compatibleKinds = getClipMoveCompatibleTrackKinds(ownAssetKind(), trackKind);
    const valid = compatibleKinds.includes(hoveredTrack.kind) && !hoveredTrack.isLocked;
    return { trackId: hoveredTrackId, track: hoveredTrack, valid };
  }

  function applyVisual(drag: DragState) {
    const el = elRef.current;
    if (!el) return;
    const excludeIds = new Set([clip.id, ...groupMateIdsRef.current]);
    const candidates = computeCandidates(excludeIds);
    const thr = thresholdMs();
    // Only resize-left/resize-right (never cross-track) use this — the
    // "move" branch below computes its own neighbor list per hover case,
    // since which track's clips matter depends on where the pointer is.
    const neighbors = clipsOnTrackExcluding(allClips, clip.trackId, new Set([...excludeIds, ...transitionPartnerIds]));

    if (drag.mode === "move") {
      const hover = resolveHoverTarget(drag.clientY);

      if (hover && hover.valid) {
        // Snap/collision-clamp against the HOVERED track's own clips, not
        // the clip's current track — it's tentatively relocating there.
        const destNeighbors = clipsOnTrackExcluding(allClips, hover.trackId, new Set([...excludeIds, ...transitionPartnerIds]));
        const rawStart = Math.max(0, clip.startMs + drag.deltaMs);
        const snapped = clampMoveStart(snapMoveStart(rawStart, clip.durationMs, candidates, thr), clip.durationMs, destNeighbors);
        const deltaPx = ((snapped - clip.startMs) / 1000) * pxPerSecond;
        const currentRowRect = trackRowElRegistry.get(clip.trackId)?.getBoundingClientRect();
        const hoveredRowRect = trackRowElRegistry.get(hover.trackId)?.getBoundingClientRect();
        const deltaY = currentRowRect && hoveredRowRect ? hoveredRowRect.top - currentRowRect.top : 0;
        el.style.transform = `translateX(${deltaPx}px) translateY(${deltaY}px)`;
        el.style.borderColor = "var(--color-editor-accent)";
        el.style.opacity = "0.85";
        showSnapGuide(snapped !== rawStart ? snapped : null);
      } else if (hover && !hover.valid) {
        // Incompatible kind or locked destination — follow the cursor
        // directly (no snap/collision math against a target that's never
        // going to be committed to) with a clear "this won't work" tint,
        // matching the reject/snap-back requirement.
        const currentRowRect = trackRowElRegistry.get(clip.trackId)?.getBoundingClientRect();
        const hoveredRowRect = trackRowElRegistry.get(hover.trackId)?.getBoundingClientRect();
        const deltaY = currentRowRect && hoveredRowRect ? hoveredRowRect.top - currentRowRect.top : 0;
        const deltaPx = (drag.deltaMs / 1000) * pxPerSecond;
        el.style.transform = `translateX(${deltaPx}px) translateY(${deltaY}px)`;
        el.style.borderColor = "var(--color-editor-danger)";
        el.style.opacity = "0.6";
        showSnapGuide(null);
      } else {
        // Same-track move — unchanged from before cross-track drag existed.
        const rawStart = Math.max(0, clip.startMs + drag.deltaMs);
        const snapped = clampMoveStart(snapMoveStart(rawStart, clip.durationMs, candidates, thr), clip.durationMs, neighbors);
        const deltaPx = ((snapped - clip.startMs) / 1000) * pxPerSecond;
        el.style.transform = `translateX(${deltaPx}px)`;
        el.style.borderColor = "";
        el.style.opacity = "";
        syncKeyframeTrack(`translateX(${deltaPx}px)`, null);
        for (const mateId of groupMateIdsRef.current) {
          const mateEl = registry.get(mateId);
          if (mateEl) mateEl.style.transform = `translateX(${deltaPx}px)`;
        }
        showSnapGuide(snapped !== rawStart ? snapped : null);
      }
    } else if (drag.mode === "resize-right") {
      const rawEnd = clip.startMs + Math.max(MIN_CLIP_DURATION_MS, clip.durationMs + drag.deltaMs);
      const snappedEnd = clampTrimRightEnd(clip.startMs, snapTrimEdge(rawEnd, candidates, thr), neighbors);
      const widthPx = Math.max(4, ((snappedEnd - clip.startMs) / 1000) * pxPerSecond);
      el.style.width = `${widthPx}px`;
      syncKeyframeTrack(null, widthPx);
      showSnapGuide(snappedEnd !== rawEnd ? snappedEnd : null);
    } else {
      const maxDelta = clip.durationMs - MIN_CLIP_DURATION_MS;
      const minDelta = -clip.trimStartMs;
      const rawStart = clip.startMs + Math.max(minDelta, Math.min(maxDelta, drag.deltaMs));
      const snappedStart = clampTrimLeftStart(clipEndMs(clip), snapTrimEdge(rawStart, candidates, thr), neighbors);
      const deltaPx = ((snappedStart - clip.startMs) / 1000) * pxPerSecond;
      const widthPx = Math.max(4, ((clipEndMs(clip) - snappedStart) / 1000) * pxPerSecond);
      el.style.transform = `translateX(${deltaPx}px)`;
      el.style.width = `${widthPx}px`;
      syncKeyframeTrack(`translateX(${deltaPx}px)`, widthPx);
      showSnapGuide(snappedStart !== rawStart ? snappedStart : null);
    }
  }

  function onMove(e: PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    drag.deltaMs = pxToMs(e.clientX - drag.startClientX);
    drag.clientY = e.clientY;
    scheduleFrame();
  }

  // Sets a group-mate's visual transform directly (mirrors the main clip's
  // own handling below) — used both to revert on a cancelled drag and to
  // hold the committed position steady on a real move.
  function setMateTransformPx(mateId: string, deltaPx: number | null) {
    const mateEl = registry.get(mateId);
    if (mateEl) mateEl.style.transform = deltaPx === null ? "" : `translateX(${deltaPx}px)`;
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    const drag = dragRef.current;
    dragRef.current = null;
    showSnapGuide(null);

    const el = elRef.current;
    // Cross-track drag (2026-07-15) — a move that lands on a valid
    // different-track target commits even with near-zero horizontal
    // movement (repositioning a PIP straight down into another track at
    // the same time position is a real, common gesture); an INVALID
    // hover (incompatible kind or locked) always snap-backs regardless of
    // horizontal distance, since it was never going anywhere.
    const hoverAtDrop = drag && drag.mode === "move" ? resolveHoverTarget(drag.clientY) : null;
    const committing = drag && ((hoverAtDrop?.valid ?? false) || (!hoverAtDrop && Math.abs(drag.deltaMs) >= 50));

    if (!committing) {
      // Nothing to commit — revert the drag-time inline overrides.
      // `transform` is never part of React's own `style={{left, width}}`
      // object, so clearing it to "" is always safe (React never manages
      // it, so there's nothing for React to "forget" to rewrite). `width`
      // IS one of React's managed style properties, though: if we clear it
      // to "" here while `clip.durationMs` is UNCHANGED (nothing
      // committed), React's reconciler sees the same width value on the
      // next render and skips writing it back to the DOM — leaving
      // `width` unset, so the box collapses to fit its own content (the
      // label text) until something UNRELATED eventually forces a
      // re-render. Setting it back to the real, current numeric value
      // (not blank) avoids that gap entirely.
      if (el) {
        el.style.transform = "";
        el.style.width = `${width}px`;
        el.style.borderColor = "";
        el.style.opacity = "";
      }
      syncKeyframeTrack("", width);
      for (const mateId of groupMateIdsRef.current) setMateTransformPx(mateId, null);
      return;
    }

    const excludeIds = new Set([clip.id, ...groupMateIdsRef.current]);
    const candidates = computeCandidates(excludeIds);
    const thr = thresholdMs();
    const neighbors = clipsOnTrackExcluding(allClips, clip.trackId, new Set([...excludeIds, ...transitionPartnerIds]));

    if (drag.mode === "move") {
      if (el) {
        el.style.borderColor = "";
        el.style.opacity = "";
      }
      if (hoverAtDrop && hoverAtDrop.valid) {
        // Committing onto a DIFFERENT track — clamp/snap against that
        // track's own clips, not the clip's current one.
        const destNeighbors = clipsOnTrackExcluding(allClips, hoverAtDrop.trackId, new Set([...excludeIds, ...transitionPartnerIds]));
        const rawStart = Math.max(0, clip.startMs + drag.deltaMs);
        const snapped = clampMoveStart(snapMoveStart(rawStart, clip.durationMs, candidates, thr), clip.durationMs, destNeighbors);
        const currentRowRect = trackRowElRegistry.get(clip.trackId)?.getBoundingClientRect();
        const hoveredRowRect = trackRowElRegistry.get(hoverAtDrop.trackId)?.getBoundingClientRect();
        const deltaY = currentRowRect && hoveredRowRect ? hoveredRowRect.top - currentRowRect.top : 0;
        if (el) el.style.transform = `translateX(${((snapped - clip.startMs) / 1000) * pxPerSecond}px) translateY(${deltaY}px)`;
        syncKeyframeTrack(`translateX(${((snapped - clip.startMs) / 1000) * pxPerSecond}px)`, null);
        onCommitMove(clip.startMs, snapped, { previousTrackId: clip.trackId, newTrackId: hoverAtDrop.trackId });
        // Group mates never cross tracks alongside the dragged clip
        // (crossTrackEligible() is false whenever mates exist, so
        // hoverAtDrop.valid can only be true here when there are none) —
        // nothing to iterate.
        return;
      }

      const rawStart = Math.max(0, clip.startMs + drag.deltaMs);
      const snapped = clampMoveStart(snapMoveStart(rawStart, clip.durationMs, candidates, thr), clip.durationMs, neighbors);
      const appliedDelta = snapped - clip.startMs;
      // Hold the visual at the just-committed position (not a blank
      // transform) until the mutation round-trip lands and `clip.startMs`
      // itself updates — same "React won't rewrite an apparently-
      // unchanged style" reasoning as the width case above applies to a
      // premature reset here too, just manifesting as a snap back to the
      // stale pre-drag position instead of a content-size collapse.
      if (el) el.style.transform = `translateX(${(appliedDelta / 1000) * pxPerSecond}px)`;
      syncKeyframeTrack(`translateX(${(appliedDelta / 1000) * pxPerSecond}px)`, null);
      onCommitMove(clip.startMs, snapped);
      for (const mateId of groupMateIdsRef.current) {
        const mate = allClips.find((c) => c.id === mateId);
        if (!mate) continue;
        const mateNewStart = Math.max(0, mate.startMs + appliedDelta);
        setMateTransformPx(mateId, ((mateNewStart - mate.startMs) / 1000) * pxPerSecond);
        onCommitGroupMove(mateId, mate.startMs, mateNewStart);
      }
    } else if (drag.mode === "resize-right") {
      const rawEnd = clip.startMs + Math.max(MIN_CLIP_DURATION_MS, clip.durationMs + drag.deltaMs);
      const snappedEnd = clampTrimRightEnd(clip.startMs, snapTrimEdge(rawEnd, candidates, thr), neighbors);
      if (el) el.style.width = `${Math.max(4, ((snappedEnd - clip.startMs) / 1000) * pxPerSecond)}px`;
      syncKeyframeTrack(null, Math.max(4, ((snappedEnd - clip.startMs) / 1000) * pxPerSecond));
      onCommitTrim(
        { startMs: clip.startMs, durationMs: clip.durationMs, trimStartMs: clip.trimStartMs },
        { startMs: clip.startMs, durationMs: snappedEnd - clip.startMs, trimStartMs: clip.trimStartMs }
      );
    } else {
      const maxDelta = clip.durationMs - MIN_CLIP_DURATION_MS;
      const minDelta = -clip.trimStartMs;
      const rawStart = clip.startMs + Math.max(minDelta, Math.min(maxDelta, drag.deltaMs));
      const snappedStart = clampTrimLeftStart(clipEndMs(clip), snapTrimEdge(rawStart, candidates, thr), neighbors);
      const appliedClamped = snappedStart - clip.startMs;
      if (el) {
        el.style.transform = `translateX(${(appliedClamped / 1000) * pxPerSecond}px)`;
        el.style.width = `${Math.max(4, ((clipEndMs(clip) - snappedStart) / 1000) * pxPerSecond)}px`;
      }
      syncKeyframeTrack(
        `translateX(${(appliedClamped / 1000) * pxPerSecond}px)`,
        Math.max(4, ((clipEndMs(clip) - snappedStart) / 1000) * pxPerSecond)
      );
      onCommitTrim(
        { startMs: clip.startMs, durationMs: clip.durationMs, trimStartMs: clip.trimStartMs },
        { startMs: snappedStart, durationMs: clip.durationMs - appliedClamped, trimStartMs: clip.trimStartMs + appliedClamped }
      );
    }
  }

  const left = (clip.startMs / 1000) * pxPerSecond;
  const width = Math.max(4, (clip.durationMs / 1000) * pxPerSecond);

  // Fix (2026-07-13) — urgent regression: a real, confirmed bug, not a
  // reported-but-unreproducible one. onUp() (move / resize-left) holds the
  // clip's visual position with `el.style.transform = translateX(...)`
  // until the server-confirmed `clip.startMs` catches up and this re-
  // renders with a new `left`. `width` is inside the JSX-managed
  // `style={{ left, width }}` object, so React itself overwrites it on
  // every render — but `transform` never is, so nothing ever clears the
  // held offset once `left` genuinely reflects the committed position.
  // Every subsequent move/trim-left on the same clip then stacks another
  // uncleared offset on top of the last one, so the clip drifts further
  // from its true position with each drag — accumulating quickly enough,
  // confirmed live via a real 2-drag repro (a clip's rendered position was
  // measured 120px off from where its own committed startMs said it
  // should be, after exactly one prior drag). Reset here, keyed on the
  // real value `left` is derived from: the instant `clip.startMs` updates,
  // `left` is already correct, so any leftover transform is stale by
  // definition and safe to always clear.
  React.useEffect(() => {
    const el = elRef.current;
    if (el) el.style.transform = "";
  }, [clip.startMs]);
  // Real bug fix (2026-07-15, found via investigation) — "Replace source"
  // used to list every READY asset with no kind check at all, letting an
  // AUDIO asset be picked for a VIDEO clip; the compositor's VideoLayer
  // only renders `if (asset?.kind === "VIDEO")`, so that produced a
  // silently blank frame with no error. Reuses resolveDropTrackKind (the
  // SAME rule a fresh drop onto this track already goes through) rather
  // than a new narrower "identical kind" rule — an IMAGE asset stays a
  // legal replacement for a VIDEO-track clip, exactly like a fresh drop
  // of an IMAGE onto a VIDEO track already is. `libraryCategory` is
  // always undefined here: this list only ever contains USER-scope
  // assets (see listEditorAssets' own `scope: "USER"` filter), and
  // libraryCategory is null on every USER-scope row by schema.
  const [replaceSourceSearch, setReplaceSourceSearch] = React.useState("");
  const readyAssets = assets.filter(
    (a) => a.status === "READY" && resolveDropTrackKind({ assetKind: a.kind, libraryCategory: undefined }) === trackKind
  );
  const filteredReadyAssets = replaceSourceSearch.trim()
    ? readyAssets.filter((a) => a.originalFilename.toLowerCase().includes(replaceSourceSearch.trim().toLowerCase()))
    : readyAssets;

  // Module 8 (Part A/B) — waveform + fade handles, AUDIO tracks only. A
  // VIDEO clip's own embedded audio isn't independently editable this
  // module (see PROJECT_STATUS.md's Module 8 entry) so it never renders
  // these.
  const isAudioClip = trackKind === "AUDIO";
  // Section 6/8 (2026-07-14) — reuses TrackHeader's own per-kind icon map
  // (module-scope, defined once). AUDIO clips never read this (isAudioClip
  // always short-circuits the one place it's used below), so the
  // AUDIO->Waves entry is only ever relevant for TrackHeader itself.
  const NonMediaKindIcon = TRACK_KIND_ICON[trackKind];
  const asset = clip.assetId ? assets.find((a) => a.id === clip.assetId) : undefined;
  const waveformCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [fadeDraft, setFadeDraft] = React.useState<{ fadeInMs: number; fadeOutMs: number } | null>(null);
  const fadeDraftRef = React.useRef<{ fadeInMs: number; fadeOutMs: number } | null>(null);
  const fadeInMs = fadeDraft?.fadeInMs ?? clip.content?.fadeInMs ?? DEFAULT_AUDIO_PROPERTIES.fadeInMs;
  const fadeOutMs = fadeDraft?.fadeOutMs ?? clip.content?.fadeOutMs ?? DEFAULT_AUDIO_PROPERTIES.fadeOutMs;

  // Redraws on commit (trim/resize) and on every fade-handle drag frame —
  // NOT during a move/resize drag, which (like every other clip drag in
  // this file) mutates the DOM directly via applyVisual() rather than
  // re-rendering, so the waveform intentionally only catches up once that
  // drag commits. Fade-handle drags are the one exception: a live curve
  // preview needs an actual canvas repaint, which inherently requires a
  // React re-render of this ClipBlock (scoped to just this one clip, not
  // the whole Timeline).
  React.useEffect(() => {
    if (!isAudioClip) return;
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = Math.max(1, Math.round(width));
    const cssHeight = 40;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const peaks =
      asset?.waveformPeaks && asset.durationSeconds
        ? sliceWaveformPeaks(asset.waveformPeaks, asset.durationSeconds * 1000, clip.trimStartMs, clip.durationMs)
        : [];
    const mid = cssHeight / 2;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    if (peaks.length > 0) {
      const barWidth = cssWidth / peaks.length;
      peaks.forEach((p, i) => {
        const barHeight = Math.max(1, p * (cssHeight - 4));
        ctx.fillRect(i * barWidth, mid - barHeight / 2, Math.max(1, barWidth - 0.5), barHeight);
      });
    } else {
      // No peaks yet (asset still processing, or predates Module 8) — a
      // flat placeholder line beats an empty-looking clip.
      ctx.fillRect(0, mid - 1, cssWidth, 2);
    }

    // Fade curve overlay — a diagonal cut + dark triangle over the region
    // each fade attenuates, the standard NLE/DAW convention.
    const fadeInPx = fadeInMs > 0 ? (fadeInMs / clip.durationMs) * cssWidth : 0;
    const fadeOutPx = fadeOutMs > 0 ? (fadeOutMs / clip.durationMs) * cssWidth : 0;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    if (fadeInPx > 0) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(fadeInPx, 0);
      ctx.lineTo(0, cssHeight);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, cssHeight);
      ctx.lineTo(fadeInPx, 0);
      ctx.stroke();
    }
    if (fadeOutPx > 0) {
      ctx.beginPath();
      ctx.moveTo(cssWidth, 0);
      ctx.lineTo(cssWidth - fadeOutPx, 0);
      ctx.lineTo(cssWidth, cssHeight);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cssWidth - fadeOutPx, 0);
      ctx.lineTo(cssWidth, cssHeight);
      ctx.stroke();
    }
  }, [isAudioClip, asset?.waveformPeaks, asset?.durationSeconds, clip.trimStartMs, clip.durationMs, width, fadeInMs, fadeOutMs]);

  // Fix (2026-07-13) — Timeline filmstrip (Part B Step 2). Real per-
  // position video frames tiled across the clip's rendered width, via
  // <canvas> (never per-frame DOM elements — a wide, heavily-zoomed clip
  // could otherwise mean dozens of <img> nodes per clip). Mirrors the
  // waveform effect above: redraws on commit/trim/resize, not during a
  // live move/resize drag (those mutate the DOM directly via
  // applyVisual(), same as everywhere else in this file). VIDEO clips
  // only — an AUDIO clip's own embedded video frames (if any) are
  // irrelevant to its waveform-only visual.
  const filmstripCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const hasFilmstrip = !isAudioClip && !!asset?.filmstripUrl && !!asset.filmstripFrameCount && !!asset.durationSeconds;

  React.useEffect(() => {
    if (!hasFilmstrip) return;
    const canvas = filmstripCanvasRef.current;
    if (!canvas || !asset?.filmstripUrl || !asset.filmstripFrameCount || !asset.durationSeconds) return;

    let cancelled = false;
    loadFilmstripImage(asset.filmstripUrl).then((img) => {
      if (cancelled) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const cssWidth = Math.max(1, Math.round(width));
      const cssHeight = canvas.clientHeight || FILMSTRIP_TILE_HEIGHT;
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const frameCount = asset.filmstripFrameCount!;
      const assetDurationMs = asset.durationSeconds! * 1000;
      const tileSrcWidth = img.naturalWidth / frameCount;
      const tileSrcHeight = img.naturalHeight;

      const visibleIndices = computeVisibleFilmstripFrameIndices(frameCount, assetDurationMs, clip.trimStartMs, clip.durationMs);
      const destTileWidth = cssWidth / visibleIndices.length;
      visibleIndices.forEach((frameIndex, slot) => {
        ctx.drawImage(
          img,
          frameIndex * tileSrcWidth,
          0,
          tileSrcWidth,
          tileSrcHeight,
          slot * destTileWidth,
          0,
          // +1px overdraw avoids a hairline gap between tiles from
          // subpixel destTileWidth rounding.
          destTileWidth + 1,
          cssHeight
        );
      });
    });

    return () => {
      cancelled = true;
    };
  }, [hasFilmstrip, asset?.filmstripUrl, asset?.filmstripFrameCount, asset?.durationSeconds, clip.trimStartMs, clip.durationMs, width]);

  // Fade handle drag — the live draft is tracked in a ref (mirroring
  // `dragRef` above), not read back out of `setFadeDraft`'s own functional
  // updater: `onUp` used to call `onCommitContent` (which cascades into the
  // store's `runCommand` -> Zustand `set()`, re-rendering TopToolbar) from
  // *inside* a `setFadeDraft(draft => ...)` updater. React can invoke a
  // functional updater synchronously while computing THIS component's own
  // pending state during its render pass, so that side effect was firing
  // mid-render and tripping React's "Cannot update a component while
  // rendering a different component" warning on every fade-drag release.
  // Reading the ref instead keeps `setFadeDraft` calls side-effect-free and
  // moves the store commit to a plain top-level statement in the handler.
  function startFadeDrag(edge: "in" | "out") {
    return (e: React.PointerEvent) => {
      e.stopPropagation();
      const startClientX = e.clientX;
      const startFadeInMs = clip.content?.fadeInMs ?? DEFAULT_AUDIO_PROPERTIES.fadeInMs;
      const startFadeOutMs = clip.content?.fadeOutMs ?? DEFAULT_AUDIO_PROPERTIES.fadeOutMs;
      function onMove(ev: PointerEvent) {
        const deltaMs = ((ev.clientX - startClientX) / pxPerSecond) * 1000;
        const draft =
          edge === "in"
            ? { fadeInMs: Math.max(0, Math.min(clip.durationMs, Math.round(startFadeInMs + deltaMs))), fadeOutMs: fadeDraftRef.current?.fadeOutMs ?? startFadeOutMs }
            : { fadeInMs: fadeDraftRef.current?.fadeInMs ?? startFadeInMs, fadeOutMs: Math.max(0, Math.min(clip.durationMs, Math.round(startFadeOutMs - deltaMs))) };
        fadeDraftRef.current = draft;
        setFadeDraft(draft);
      }
      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const draft = fadeDraftRef.current;
        fadeDraftRef.current = null;
        setFadeDraft(null);
        if (draft) {
          const previous = clip.content ?? null;
          const next: ClipContent = { ...(previous ?? {}), fadeInMs: draft.fadeInMs, fadeOutMs: draft.fadeOutMs };
          onCommitContent(previous, next);
        }
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };
  }

  const clipBody = (
    <div
      ref={elRef}
      data-clip-id={clip.id}
      className={cn(
        // rounded-editor-button (14px, shared with real buttons) ->
        // rounded-editor-clip (4px, 2026-07-15) — the CapCut reference's
        // own clip corners are subtle, not the pronounced rounded-pill
        // look a button-sized radius gave them; see globals.css's own
        // comment on --radius-editor-clip for why this is a dedicated
        // token, not a reused one.
        "absolute top-1 bottom-1 overflow-hidden rounded-editor-clip border-2 px-1.5 text-micro text-white select-none will-change-transform",
        locked ? "cursor-not-allowed opacity-70" : "cursor-grab",
        color,
        selected ? "border-white ring-2 ring-editor-accent" : "border-transparent",
        clip.groupId && "outline outline-dashed outline-1 outline-white/40"
      )}
      style={{ left, width }}
      onPointerDown={locked ? selectOnly : startDrag("move")}
    >
      {/* Fix (2026-07-13) — real per-position video frames (see the
          filmstripCanvasRef effect above), not the single static repeated
          frame the 2026-07-12 visual-fidelity pass used. Falls back to
          that same single-tile approximation for assets that don't have a
          filmstrip yet (admin-library/stock assets — filmstrip generation
          is only wired into the plain "Upload media" confirm-upload flow
          so far), then to no image at all — same three-tier fallback
          thumbnailUrl's own doc comment already described, just with a
          real filmstrip now sitting above the old approximation. */}
      {hasFilmstrip ? (
        <canvas ref={filmstripCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" style={{ width }} />
      ) : (
        !isAudioClip &&
        asset?.thumbnailUrl && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: `url(${asset.thumbnailUrl})`, backgroundRepeat: "repeat-x", backgroundSize: "auto 100%" }}
          />
        )
      )}
      {isAudioClip && (
        <canvas ref={waveformCanvasRef} className="pointer-events-none absolute inset-x-0 top-0 h-10 w-full" style={{ width, height: 40 }} />
      )}
      {/* Section 6/8 (2026-07-14, premium-editor.jsx rebuild) — gradient
          label scrim: real media (filmstrip/thumbnail/waveform) can render
          bright content right where the label sits, so a drop-shadow alone
          wasn't always enough contrast; a bottom-anchored gradient behind
          the label reads more premium and is more reliably legible.
          Layered UNDER the label (z-[5] vs. the label's z-10) and only
          shown where there's real media behind it — a plain color clip's
          own flat background is already legible with no scrim needed. */}
      {(isAudioClip || hasFilmstrip || (!isAudioClip && asset?.thumbnailUrl)) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-5 bg-gradient-to-t from-black/75 to-transparent" />
      )}
      {/* Bug #3 fix — the resize-left/resize-right hit-targets used to
          render here as this div's own children. They no longer do: see
          TrimHandleOverlay (rendered once, as a true top-level sibling of
          every clip in the lane) and this component's own
          trimHandlerRegistry registration effect above. */}
      {/* Real data only — a clip only gets this badge when it genuinely has
          word/character/karaoke reveal configured (ClipContent.reveal, see
          text-style.ts's RevealConfig), never as a decorative default. No
          "AI" badge exists anywhere: no clip carries an AI-generation
          marker today, so there's nothing real to badge. */}
      {clip.content?.reveal && clip.content.reveal.mode !== "NONE" && (
        <span className="absolute top-1 left-1 z-10" title="Word-by-word / karaoke reveal">
          <Captions className="size-2.5 text-white/80 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
        </span>
      )}
      {locked && <Lock className="absolute top-1 right-1 size-2.5 text-white/70" />}
      <div
        className={cn(
          "relative z-10 flex items-center gap-1 truncate pt-1",
          (isAudioClip || hasFilmstrip || (!isAudioClip && asset?.thumbnailUrl)) && "drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
        )}
      >
        {/* Track-color kind icon (2026-07-14, Section 6/8) — clips with no
            real media backing (TEXT/SUBTITLE/OVERLAY/EFFECTS) are just a
            flat color block otherwise; a small kind icon next to the label
            makes it identifiable at a glance without reading the text,
            reusing the exact same TRACK_KIND_ICON map TrackHeader's own
            per-kind icons use (Section 5/8) so a track's header and its
            clips agree on one icon per kind. VIDEO/AUDIO clips never hit
            this branch in practice (they always have a filmstrip, a
            fallback thumbnail, or — for AUDIO — the waveform canvas). */}
        {!isAudioClip && !hasFilmstrip && !asset?.thumbnailUrl && (
          <NonMediaKindIcon className="size-3 shrink-0 text-white/85" />
        )}
        <p className="truncate">{clip.content?.text ?? asset?.originalFilename ?? clip.id.slice(-6)}</p>
      </div>
    </div>
  );

  // Fade handle nubs used to render as clipBody's own children. That div is
  // `overflow-hidden` (to clip the waveform/label to the clip's bounds) —
  // fine for content that's meant to stay inside, but each nub is a 10px
  // circle centered ON the clip edge via `-translate-x-1/2`, so ~5px of it
  // is always meant to overhang past `left:0`/`left:width`. overflow-hidden
  // clipped that overhang, leaving only 2-3px of the fade-out handle
  // clickable/visible at the right edge. Same interaction-overlay
  // extraction pattern as TrimHandleOverlay's own Bug #3 fix (see that
  // component's header comment): pull the interactive bit out of the
  // clipped/stacking-context-bound container and render it as a sibling
  // instead, positioned with the same left/width basis. Unlike
  // TrimHandleOverlay this doesn't need to be lifted all the way to a
  // single lane-level component — each track row here has no
  // overflow-hidden of its own and clips don't overlap along the same
  // track, so a per-clip sibling (still owned by this ClipBlock instance,
  // same startFadeDrag closure) is sufficient to escape the clipping.
  const fadeHandles = isAudioClip && !locked && (
    <div className="pointer-events-none absolute top-1 bottom-1" style={{ left, width }}>
      <div
        className="pointer-events-auto absolute top-0 z-30 size-2.5 -translate-x-1/2 cursor-ew-resize rounded-full border border-black/40 bg-white shadow"
        style={{ left: fadeInMs > 0 ? (fadeInMs / clip.durationMs) * width : 0 }}
        onPointerDown={startFadeDrag("in")}
        title={`Fade in: ${fadeInMs}ms`}
      />
      <div
        className="pointer-events-auto absolute top-0 z-30 size-2.5 -translate-x-1/2 cursor-ew-resize rounded-full border border-black/40 bg-white shadow"
        style={{ left: fadeOutMs > 0 ? width - (fadeOutMs / clip.durationMs) * width : width }}
        onPointerDown={startFadeDrag("out")}
        title={`Fade out: ${fadeOutMs}ms`}
      />
    </div>
  );

  if (locked) return clipBody; // no context menu of mutating actions on a locked clip

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{clipBody}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onSplitAtPlayhead}>
          <Scissors className="size-3.5" /> Split at playhead
        </ContextMenuItem>
        <ContextMenuItem onClick={onDuplicate}>
          <Copy className="size-3.5" /> Duplicate
        </ContextMenuItem>
        <ContextMenuItem onClick={onRippleDelete}>
          <Combine className="size-3.5" /> Ripple delete
        </ContextMenuItem>
        {readyAssets.length > 0 && (
          <ContextMenuSub onOpenChange={(open) => { if (!open) setReplaceSourceSearch(""); }}>
            <ContextMenuSubTrigger>Replace source</ContextMenuSubTrigger>
            <ContextMenuSubContent className="max-h-80 w-56 overflow-y-auto">
              {/* Search (2026-07-15) — the "show every project's uploads"
                  scoping decision stays as-is (deliberate, documented in
                  listEditorAssets' own comment), so this list can still be
                  long; makes it searchable instead, matching the sidebar
                  Uploads tab's own search box. stopPropagation on keydown
                  is required — Radix's menu content otherwise intercepts
                  every keystroke for its own typeahead/arrow-key
                  navigation before it ever reaches this input. */}
              <div className="p-1">
                <Input
                  autoFocus
                  value={replaceSourceSearch}
                  onChange={(e) => setReplaceSourceSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Search assets…"
                  className="h-7 rounded-md border-editor-line bg-editor-surface-1 text-[12px] text-neutral-100 placeholder:text-neutral-500"
                />
              </div>
              {filteredReadyAssets.length === 0 ? (
                <div className="px-2 py-1.5 text-caption text-neutral-500">No matching assets</div>
              ) : (
                filteredReadyAssets.map((asset) => (
                  <ContextMenuItem key={asset.id} onClick={() => onReplaceSource(asset.id)}>
                    {asset.originalFilename}
                  </ContextMenuItem>
                ))
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        <ContextMenuSeparator />
        {canGroup && (
          <ContextMenuItem onClick={onGroup}>
            <Group className="size-3.5" /> Group
          </ContextMenuItem>
        )}
        {clip.groupId && (
          <ContextMenuItem onClick={onUngroup}>
            <UngroupIcon className="size-3.5" /> Ungroup
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <X className="size-3.5" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
      </ContextMenu>
      {fadeHandles}
    </>
  );
}, (prev, next) => {
  return (
    prev.clip === next.clip &&
    prev.allClips === next.allClips &&
    prev.markers === next.markers &&
    prev.assets === next.assets &&
    prev.trackKind === next.trackKind &&
    prev.pxPerSecond === next.pxPerSecond &&
    prev.snapThresholdPx === next.snapThresholdPx &&
    prev.color === next.color &&
    prev.selected === next.selected &&
    prev.locked === next.locked &&
    prev.tracksById === next.tracksById &&
    prev.canGroup === next.canGroup &&
    setsHaveSameMembers(prev.transitionPartnerIds, next.transitionPartnerIds)
  );
});

function setsHaveSameMembers(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

const TRANSITION_EASING_PRESETS: TransitionEasingPreset[] = ["LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_OUT"];
const TRANSITION_EASING_LABEL: Record<TransitionEasingPreset, string> = {
  LINEAR: "Linear",
  EASE_IN: "Ease In",
  EASE_OUT: "Ease Out",
  EASE_IN_OUT: "Ease In/Out",
};

// Module 9 — walks one track's clips (already sorted by startMs elsewhere;
// sorted defensively again here) and, for every pair of consecutive clips
// that are either EXACTLY adjacent (no gap — eligible for a new transition)
// or already joined by one (rendered as a resizable badge over their
// overlap window), renders a TransitionBoundary. A gap, or an overlap with
// no transition row backing it, renders nothing — there's no meaningful
// action to offer there.
function TransitionBoundaries({
  trackId,
  clipsOnTrack,
  transitions,
  pxPerSecond,
  rowHeight,
  onAdd,
  onUpdate,
  onRemove,
}: {
  trackId: string;
  clipsOnTrack: ClipView[];
  transitions: TransitionView[];
  pxPerSecond: number;
  rowHeight: number;
  onAdd: (input: AddTransitionPatch) => void;
  onUpdate: (transitionId: string, previous: UpdateTransitionPatch, next: UpdateTransitionPatch) => void;
  onRemove: (transition: TransitionView) => void;
}) {
  const trackTransitions = transitions.filter((t) => t.trackId === trackId);
  const sorted = [...clipsOnTrack].sort((a, b) => a.startMs - b.startMs);
  const entries: { prevClip: ClipView; nextClip: ClipView; transition: TransitionView | null }[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const prevClip = sorted[i];
    const nextClip = sorted[i + 1];
    const transition = trackTransitions.find((t) => t.clipAId === prevClip.id && t.clipBId === nextClip.id) ?? null;
    if (transition || nextClip.startMs === clipEndMs(prevClip)) {
      entries.push({ prevClip, nextClip, transition });
    }
  }

  return (
    <>
      {entries.map(({ prevClip, nextClip, transition }) => (
        <TransitionBoundary
          key={`${prevClip.id}-${nextClip.id}`}
          trackId={trackId}
          prevClip={prevClip}
          nextClip={nextClip}
          transition={transition}
          pxPerSecond={pxPerSecond}
          rowHeight={rowHeight}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
    </>
  );
}

interface TransitionResizeDrag {
  startClientX: number;
  startDurationMs: number;
  moved: boolean;
}

function TransitionBoundary({
  trackId,
  prevClip,
  nextClip,
  transition,
  pxPerSecond,
  rowHeight,
  onAdd,
  onUpdate,
  onRemove,
}: {
  trackId: string;
  prevClip: ClipView;
  nextClip: ClipView;
  transition: TransitionView | null;
  pxPerSecond: number;
  rowHeight: number;
  onAdd: (input: AddTransitionPatch) => void;
  onUpdate: (transitionId: string, previous: UpdateTransitionPatch, next: UpdateTransitionPatch) => void;
  onRemove: (transition: TransitionView) => void;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const elRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<TransitionResizeDrag | null>(null);

  // clipA's end is the one fixed reference point throughout a resize drag —
  // clipA's own span never changes when a transition is added/resized/
  // removed, only clipB's startMs does (see transitions.ts's overlap model).
  const boundaryMs = clipEndMs(prevClip);
  const maxDurationMs = Math.min(prevClip.durationMs, nextClip.durationMs);

  function widthPxFor(durationMs: number) {
    return Math.max(6, (durationMs / 1000) * pxPerSecond);
  }
  function leftPxFor(durationMs: number) {
    return ((boundaryMs - durationMs) / 1000) * pxPerSecond;
  }

  function startResize(e: React.PointerEvent) {
    if (!transition) return;
    e.stopPropagation();
    dragRef.current = { startClientX: e.clientX, startDurationMs: transition.durationMs, moved: false };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onMove(e: PointerEvent) {
    const drag = dragRef.current;
    const el = elRef.current;
    if (!drag || !el || !transition) return;
    const deltaPx = e.clientX - drag.startClientX;
    if (Math.abs(deltaPx) > 3) drag.moved = true;
    // Dragging the handle LEFT (negative deltaPx) grows the overlap
    // (clipB's start moves further before clipA's end); dragging RIGHT
    // shrinks it — the mirror image of a left-edge trim handle.
    const deltaMs = (deltaPx / pxPerSecond) * 1000;
    const nextDuration = Math.max(MIN_TRANSITION_MS, Math.min(maxDurationMs, drag.startDurationMs - deltaMs));
    el.style.left = `${leftPxFor(nextDuration)}px`;
    el.style.width = `${widthPxFor(nextDuration)}px`;
  }

  function onUp(e: PointerEvent) {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    const drag = dragRef.current;
    dragRef.current = null;
    const el = elRef.current;
    if (!drag || !transition) return;

    if (!drag.moved) {
      // A plain click (no meaningful drag) — open the picker instead of
      // committing a resize.
      setPickerOpen(true);
      if (el) {
        el.style.left = `${leftPxFor(transition.durationMs)}px`;
        el.style.width = `${widthPxFor(transition.durationMs)}px`;
      }
      return;
    }

    const deltaPx = e.clientX - drag.startClientX;
    const deltaMs = (deltaPx / pxPerSecond) * 1000;
    const nextDuration = Math.round(Math.max(MIN_TRANSITION_MS, Math.min(maxDurationMs, drag.startDurationMs - deltaMs)));
    if (nextDuration !== transition.durationMs) {
      onUpdate(transition.id, { durationMs: transition.durationMs }, { durationMs: nextDuration });
    } else if (el) {
      el.style.left = `${leftPxFor(transition.durationMs)}px`;
      el.style.width = `${widthPxFor(transition.durationMs)}px`;
    }
  }

  const anchorTop = rowHeight / 2;

  if (!transition) {
    // Exactly adjacent, no transition yet — a small "+" seam to add one.
    return (
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        {/* This sits centered on two clips' shared boundary, exactly where
            each clip's own 8px resize-left/resize-right hit-zone also
            lives — those handles are CHILDREN of the clip body, which
            establishes its own stacking context via `will-change-transform`
            (see ClipBlock), so no z-index on the handles alone can out-rank
            an external sibling like this one; only a real, disjoint hit
            area avoids the conflict. The visible "+" dot (pointer-events
            disabled) is purely decorative/anchoring; the two invisible
            strips flanking it are the real click targets, each starting
            8px out from the boundary — outside the resize handles' own
            8px-each-side zone — so trim/move always wins right at the
            edge, and this stays reachable just past it. */}
        <div
          className="pointer-events-none absolute flex -translate-x-1/2 items-center justify-center"
          style={{ left: (boundaryMs / 1000) * pxPerSecond, top: anchorTop - 8, width: 16, height: 16 }}
        >
          <span className="flex size-4 items-center justify-center rounded-full border border-white/20 bg-editor-surface-1 text-neutral-400 opacity-40">
            <Plus className="size-3" />
          </span>
        </div>
        <PopoverAnchor asChild>
          <button
            type="button"
            className="absolute z-10 hover:[&>span]:opacity-100"
            style={{ left: (boundaryMs / 1000) * pxPerSecond - 16, top: anchorTop - 16, width: 8, height: 32 }}
            title="Add transition"
            onClick={(e) => {
              e.stopPropagation();
              setPickerOpen(true);
            }}
          >
            <span className="absolute inset-0 rounded-l-full bg-editor-surface-2 opacity-0" />
          </button>
        </PopoverAnchor>
        <button
          type="button"
          className="absolute z-10 hover:[&>span]:opacity-100"
          style={{ left: (boundaryMs / 1000) * pxPerSecond + 8, top: anchorTop - 16, width: 8, height: 32 }}
          title="Add transition"
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen(true);
          }}
        >
          <span className="absolute inset-0 rounded-r-full bg-editor-surface-2 opacity-0" />
        </button>
        <PopoverContent side="top" align="center" className="w-64" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <TransitionPicker
            maxDurationMs={maxDurationMs}
            onAdd={(input) => {
              onAdd({ trackId, clipAId: prevClip.id, clipBId: nextClip.id, ...input });
              setPickerOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // The badge's own width can be as small as ~6px (a near-minimum-duration
  // transition at low zoom) and, even at a typical 500ms default, is often
  // only ~30px — comfortably within range of BOTH neighboring clips' own
  // 8px trim handles at the shared boundary. Insetting the INTERACTIVE hit
  // region by 8px from each side (clamped so it never goes negative — see
  // ClipBlock's own z-index comment for why a z-index fight can't win this
  // instead) leaves trim always reachable at the exact edge, while the
  // badge's own drag-to-resize/click-to-edit stay usable via its middle.
  const badgeWidthPx = widthPxFor(transition.durationMs);
  const badgeLeftPx = leftPxFor(transition.durationMs);
  const insetPerSide = Math.min(8, badgeWidthPx / 3);

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverAnchor asChild>
        <div
          ref={elRef}
          data-transition-id={transition.id}
          className="pointer-events-none absolute flex items-center justify-center rounded border border-editor-accent/70 bg-editor-accent/25"
          style={{ left: badgeLeftPx, width: badgeWidthPx, top: anchorTop - 8, height: 16 }}
          title={`${TRANSITION_TYPE_DEFS.find((d) => d.id === transition.type)?.label ?? transition.type} — ${transition.durationMs}ms (drag to resize, click to edit)`}
        >
          <Blend className="size-3 text-white" />
        </div>
      </PopoverAnchor>
      <div
        className="absolute z-10 cursor-ew-resize hover:bg-editor-accent/20"
        style={{ left: badgeLeftPx + insetPerSide, width: Math.max(2, badgeWidthPx - insetPerSide * 2), top: anchorTop - 8, height: 16 }}
        onPointerDown={startResize}
      />
      <PopoverContent side="top" align="center" className="w-64" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <TransitionPicker
          transition={transition}
          maxDurationMs={maxDurationMs}
          onUpdate={(patch) => {
            const previous: UpdateTransitionPatch = {};
            for (const key of Object.keys(patch) as (keyof UpdateTransitionPatch)[]) {
              (previous as Record<string, unknown>)[key] = transition[key as keyof TransitionView];
            }
            onUpdate(transition.id, previous, patch);
          }}
          onRemove={() => {
            onRemove(transition);
            setPickerOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// Module 9 — the transition picker popover body. Two modes: "create" (no
// `transition` prop — shows an "Add Transition" confirm button) and "edit"
// (a `transition` prop — every field commits immediately on change, the
// house rule's controlled-input pattern, plus a Remove button). Type/
// Direction/Easing use DropdownMenu (matching AddTrackMenu's established
// pattern in this same file) rather than introducing a native <select>.
function TransitionPicker({
  transition,
  maxDurationMs,
  onAdd,
  onUpdate,
  onRemove,
}: {
  transition?: TransitionView;
  maxDurationMs: number;
  onAdd?: (input: { type: TransitionType; direction?: TransitionDirection; durationMs: number; easing: TransitionEasing }) => void;
  onUpdate?: (patch: UpdateTransitionPatch) => void;
  onRemove?: () => void;
}) {
  const isEdit = Boolean(transition);
  const [draftType, setDraftType] = React.useState<TransitionType>(transition?.type ?? "CROSSFADE");
  const [draftDirection, setDraftDirection] = React.useState<TransitionDirection | null>(transition?.direction ?? defaultDirectionFor(draftType));
  const [draftDurationMs, setDraftDurationMs] = React.useState(transition?.durationMs ?? Math.min(500, maxDurationMs));
  const [draftEasing, setDraftEasing] = React.useState<TransitionEasing>(transition?.easing ?? DEFAULT_TRANSITION_EASING);

  const typeDef = TRANSITION_TYPE_DEFS.find((d) => d.id === draftType)!;

  function commitType(type: TransitionType) {
    const nextDirection = defaultDirectionFor(type);
    setDraftType(type);
    setDraftDirection(nextDirection);
    if (isEdit) onUpdate?.({ type, direction: nextDirection });
  }
  function commitDirection(direction: TransitionDirection) {
    setDraftDirection(direction);
    if (isEdit) onUpdate?.({ direction });
  }
  function commitEasing(easing: TransitionEasing) {
    setDraftEasing(easing);
    if (isEdit) onUpdate?.({ easing });
  }
  function commitDuration(durationMs: number) {
    const clamped = Math.max(MIN_TRANSITION_MS, Math.min(maxDurationMs, durationMs));
    setDraftDurationMs(clamped);
    if (isEdit) onUpdate?.({ durationMs: clamped });
  }

  const easingLabel = draftEasing.type === "CUSTOM" ? "Custom" : TRANSITION_EASING_LABEL[draftEasing.type];

  return (
    <div className="space-y-2.5">
      <p className="text-label-sm text-neutral-300">{isEdit ? "Edit Transition" : "Add Transition"}</p>

      <div className="space-y-1">
        <span className="text-caption text-neutral-500">Type</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="w-full justify-start">
              {typeDef.label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {TRANSITION_TYPE_DEFS.map((def) => (
              <DropdownMenuItem key={def.id} onClick={() => commitType(def.id)}>
                {def.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {typeDef.directions && (
        <div className="space-y-1">
          <span className="text-caption text-neutral-500">Direction</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="w-full justify-start">
                {draftDirection ?? typeDef.directions[0]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {typeDef.directions.map((dir) => (
                <DropdownMenuItem key={dir} onClick={() => commitDirection(dir)}>
                  {dir}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="space-y-1">
        <span className="text-caption text-neutral-500">Duration ({draftDurationMs}ms, max {maxDurationMs}ms)</span>
        <input
          type="range"
          aria-label="Transition duration"
          min={MIN_TRANSITION_MS}
          max={maxDurationMs}
          step={10}
          value={draftDurationMs}
          onChange={(e) => setDraftDurationMs(Number(e.target.value))}
          onPointerUp={(e) => commitDuration(Number((e.target as HTMLInputElement).value))}
          className="w-full accent-editor-accent"
        />
      </div>

      <div className="space-y-1">
        <span className="text-caption text-neutral-500">Easing</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="w-full justify-start">
              {easingLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {TRANSITION_EASING_PRESETS.map((preset) => (
              <DropdownMenuItem key={preset} onClick={() => commitEasing({ type: preset })}>
                {TRANSITION_EASING_LABEL[preset]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isEdit ? (
        <Button type="button" variant="destructive" size="sm" className="w-full" onClick={onRemove}>
          <Trash2 className="size-3.5" /> Remove Transition
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={() =>
            onAdd?.({
              type: draftType,
              direction: draftDirection ?? undefined,
              durationMs: draftDurationMs,
              easing: draftEasing,
            })
          }
        >
          <Plus className="size-3.5" /> Add Transition
        </Button>
      )}
    </div>
  );
}
