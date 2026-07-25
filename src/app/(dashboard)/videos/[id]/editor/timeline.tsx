"use client";

import * as React from "react";
import { Combine, Copy, Eye, EyeOff, Scissors, Trash2, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clipEndMs, useEditor, type ClipView, type TrackView } from "./editor-types";

const TRACK_HEADER_WIDTH = 140;
const TRACK_ROW_HEIGHT = 56;
const MIN_CLIP_DURATION_MS = 200;

const TRACK_COLORS: Record<string, string> = {
  VIDEO: "bg-brand-navy/80",
  IMAGE: "bg-sky-500/80",
  TEXT: "bg-amber-500/80",
  CAPTION: "bg-purple-500/80",
  STICKER: "bg-pink-500/80",
  AUDIO: "bg-emerald-500/80",
  MUSIC: "bg-teal-500/80",
};

// Multi-track Timeline (Milestone 9) — drag-to-move and drag-edge-to-resize
// are hand-rolled pointer events rather than dnd-kit: dnd-kit's sortable
// strategy is built for reorderable lists, not freeform pixel positioning +
// resize on a time axis. The Layers panel (track add/remove/reorder-free
// list) is the part of this UI that genuinely fits dnd-kit's pattern — see
// scene-editor.tsx's identical drag handle for the prior art this mirrors.
export function Timeline() {
  const {
    tracks,
    clips,
    pxPerSecond,
    playheadMs,
    setPlayheadMs,
    selectedClipId,
    setSelectedClipId,
    updateClip,
    deleteClip,
    splitClip,
    mergeClips,
    duplicateClip,
    addClip,
    updateTrack,
    totalDurationMs,
  } = useEditor();

  const laneRef = React.useRef<HTMLDivElement | null>(null);
  const orderedTracks = React.useMemo(() => [...tracks].sort((a, b) => a.order - b.order), [tracks]);
  const selectedClip = clips.find((c) => c.id === selectedClipId) ?? null;
  const adjacentNext = selectedClip
    ? clips.find(
        (c) =>
          c.trackId === selectedClip.trackId &&
          c.sceneId === selectedClip.sceneId &&
          c.assetId === selectedClip.assetId &&
          c.startMs === clipEndMs(selectedClip)
      ) ?? null
    : null;

  function msAtClientX(clientX: number): number {
    const lane = laneRef.current;
    if (!lane) return 0;
    const rect = lane.getBoundingClientRect();
    const x = clientX - rect.left + lane.scrollLeft;
    return Math.max(0, (x / pxPerSecond) * 1000);
  }

  function handleDrop(e: React.DragEvent, trackId: string) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as {
        assetId?: string;
        sceneId?: string;
        durationMs?: number;
        content?: { sourceUrl?: string };
      };
      const startMs = Math.round(msAtClientX(e.clientX) / 100) * 100;
      void addClip({
        trackId,
        assetId: data.assetId,
        sceneId: data.sceneId,
        startMs,
        durationMs: data.durationMs ?? 3000,
        content: data.content,
      });
    } catch {
      // Ignore malformed drag payloads (e.g. a drop from outside this app).
    }
  }

  const timelineWidthMs = Math.max(totalDurationMs + 5000, 10000);
  const timelineWidthPx = (timelineWidthMs / 1000) * pxPerSecond;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-label-md text-neutral-700">Timeline</p>
        {selectedClip && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Split at playhead (S)"
              disabled={!(playheadMs > selectedClip.startMs && playheadMs < clipEndMs(selectedClip))}
              onClick={() => splitClip(selectedClip.id, playheadMs - selectedClip.startMs)}
            >
              <Scissors className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" title="Duplicate (Ctrl/Cmd+D)" onClick={() => duplicateClip(selectedClip.id)}>
              <Copy className="size-4" />
            </Button>
            {adjacentNext && (
              <Button type="button" variant="ghost" size="icon-sm" title="Merge with next clip" onClick={() => mergeClips(selectedClip.id, adjacentNext.id)}>
                <Combine className="size-4" />
              </Button>
            )}
            <Button type="button" variant="ghost" size="icon-sm" title="Delete (Del)" onClick={() => deleteClip(selectedClip.id)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <div style={{ width: timelineWidthPx + TRACK_HEADER_WIDTH }}>
          <div className="flex">
            <div style={{ width: TRACK_HEADER_WIDTH }} className="shrink-0" />
            <div
              ref={laneRef}
              className="relative h-6 flex-1 cursor-pointer border-b border-neutral-200"
              onClick={(e) => setPlayheadMs(msAtClientX(e.clientX))}
            >
              {Array.from({ length: Math.ceil(timelineWidthMs / 1000) + 1 }, (_, i) => i).map((s) => (
                <div
                  key={s}
                  className="absolute top-0 h-full border-l border-neutral-100 text-[10px] text-neutral-400"
                  style={{ left: s * pxPerSecond }}
                >
                  <span className="ml-0.5">{s}s</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            {orderedTracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                clips={clips.filter((c) => c.trackId === track.id)}
                pxPerSecond={pxPerSecond}
                selectedClipId={selectedClipId}
                onSelectClip={setSelectedClipId}
                onUpdateClip={updateClip}
                onUpdateTrack={updateTrack}
                onDrop={(e) => handleDrop(e, track.id)}
              />
            ))}
            <div
              className="pointer-events-none absolute top-0 z-10 h-full w-px bg-error"
              style={{ left: (playheadMs / 1000) * pxPerSecond }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackRow({
  track,
  clips,
  pxPerSecond,
  selectedClipId,
  onSelectClip,
  onUpdateClip,
  onUpdateTrack,
  onDrop,
}: {
  track: TrackView;
  clips: ClipView[];
  pxPerSecond: number;
  selectedClipId: string | null;
  onSelectClip: (id: string) => void;
  onUpdateClip: (
    clipId: string,
    patch: Partial<Pick<ClipView, "startMs" | "durationMs" | "trimStartMs">>
  ) => void;
  onUpdateTrack: (trackId: string, patch: { isMuted?: boolean; isHidden?: boolean }) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div className="flex border-b border-neutral-100" style={{ height: TRACK_ROW_HEIGHT }}>
      <div
        style={{ width: TRACK_HEADER_WIDTH }}
        className="flex shrink-0 items-center justify-between gap-1 border-r border-neutral-100 px-2"
      >
        <p className="truncate text-[11px] font-medium text-neutral-600">{track.kind}</p>
        <div className="flex items-center gap-0.5">
          {(track.kind === "AUDIO" || track.kind === "MUSIC") && (
            <button
              type="button"
              onClick={() => onUpdateTrack(track.id, { isMuted: !track.isMuted })}
              className="text-neutral-400 hover:text-neutral-700"
              title={track.isMuted ? "Unmute" : "Mute"}
            >
              {track.isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => onUpdateTrack(track.id, { isHidden: !track.isHidden })}
            className="text-neutral-400 hover:text-neutral-700"
            title={track.isHidden ? "Show" : "Hide"}
          >
            {track.isHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
      </div>
      <div className="relative flex-1" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        {clips.map((c) => (
          <ClipBlock
            key={c.id}
            clip={c}
            pxPerSecond={pxPerSecond}
            color={TRACK_COLORS[track.kind] ?? "bg-neutral-400"}
            selected={selectedClipId === c.id}
            onSelect={() => onSelectClip(c.id)}
            onUpdateClip={onUpdateClip}
          />
        ))}
      </div>
    </div>
  );
}

interface DragState {
  mode: "move" | "resize-left" | "resize-right";
  startX: number;
  deltaMs: number;
}

function ClipBlock({
  clip,
  pxPerSecond,
  color,
  selected,
  onSelect,
  onUpdateClip,
}: {
  clip: ClipView;
  pxPerSecond: number;
  color: string;
  selected: boolean;
  onSelect: () => void;
  onUpdateClip: (
    clipId: string,
    patch: Partial<Pick<ClipView, "startMs" | "durationMs" | "trimStartMs">>
  ) => void;
}) {
  // A ref (not state) holds the live drag delta so onUp — attached at
  // pointerdown time and therefore a "stale" closure by the time the user
  // releases — still reads the LATEST delta: refs are mutated in place, so
  // every onMove call updates the same object onUp eventually reads.
  const dragRef = React.useRef<DragState | null>(null);
  const [, forceRender] = React.useState(0);

  function pxToMs(px: number) {
    return (px / pxPerSecond) * 1000;
  }

  function startDrag(mode: DragState["mode"]) {
    return (e: React.PointerEvent) => {
      e.stopPropagation();
      onSelect();
      dragRef.current = { mode, startX: e.clientX, deltaMs: 0 };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };
  }

  function onMove(e: PointerEvent) {
    if (!dragRef.current) return;
    dragRef.current = { ...dragRef.current, deltaMs: pxToMs(e.clientX - dragRef.current.startX) };
    forceRender((t) => t + 1);
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    const drag = dragRef.current;
    dragRef.current = null;
    forceRender((t) => t + 1);
    if (!drag || Math.abs(drag.deltaMs) < 50) return;

    const snapped = Math.round(drag.deltaMs / 100) * 100;
    if (drag.mode === "move") {
      onUpdateClip(clip.id, { startMs: Math.max(0, clip.startMs + snapped) });
    } else if (drag.mode === "resize-right") {
      onUpdateClip(clip.id, { durationMs: Math.max(MIN_CLIP_DURATION_MS, clip.durationMs + snapped) });
    } else {
      const maxDelta = clip.durationMs - MIN_CLIP_DURATION_MS;
      const minDelta = -clip.trimStartMs;
      const clamped = Math.max(minDelta, Math.min(maxDelta, snapped));
      onUpdateClip(clip.id, {
        startMs: Math.max(0, clip.startMs + clamped),
        durationMs: clip.durationMs - clamped,
        trimStartMs: clip.trimStartMs + clamped,
      });
    }
  }

  const drag = dragRef.current;
  let visualStartMs = clip.startMs;
  let visualDurationMs = clip.durationMs;
  if (drag?.mode === "move") {
    visualStartMs = Math.max(0, clip.startMs + drag.deltaMs);
  } else if (drag?.mode === "resize-right") {
    visualDurationMs = Math.max(MIN_CLIP_DURATION_MS, clip.durationMs + drag.deltaMs);
  } else if (drag?.mode === "resize-left") {
    const maxDelta = clip.durationMs - MIN_CLIP_DURATION_MS;
    const minDelta = -clip.trimStartMs;
    const clamped = Math.max(minDelta, Math.min(maxDelta, drag.deltaMs));
    visualStartMs = Math.max(0, clip.startMs + clamped);
    visualDurationMs = clip.durationMs - clamped;
  }

  const left = (visualStartMs / 1000) * pxPerSecond;
  const width = Math.max(4, (visualDurationMs / 1000) * pxPerSecond);

  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 cursor-grab overflow-hidden rounded-md border-2 px-1.5 text-[11px] text-white select-none",
        color,
        selected ? "border-white ring-2 ring-brand-navy" : "border-transparent"
      )}
      style={{ left, width }}
      onPointerDown={startDrag("move")}
    >
      <div className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" onPointerDown={startDrag("resize-left")} />
      <div className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" onPointerDown={startDrag("resize-right")} />
      <p className="truncate pt-1">{clip.content?.text ?? clip.id.slice(-6)}</p>
    </div>
  );
}
