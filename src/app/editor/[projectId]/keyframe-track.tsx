"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createUpdateTransformCommand, type ClipCommandDeps, type EditorCommand } from "./commands";
import { BezierHandleEditor, EasingDropdownMenu, easingSideToPoint } from "./keyframe-controls";
import {
  addOrUpdateKeyframe,
  DEFAULT_CLIP_TRANSFORM,
  deleteKeyframe,
  moveKeyframe,
  resolveTransformValue,
  setKeyframeEasing,
  type ClipTransform,
  type EasingPreset,
  type EasingSide,
  type EditorKeyframe,
  type Keyframeable,
} from "@/lib/video-editor/transform";
import type { ClipView } from "../types";

const ROW_HEIGHT = 22;

interface PropertyRow {
  key: "scale" | "scaleY" | "position" | "rotation" | "opacity" | "crop";
  label: string;
  prop: Keyframeable<unknown>;
  setProp: (transform: ClipTransform, next: Keyframeable<unknown>) => ClipTransform;
}

function propertyRows(transform: ClipTransform): PropertyRow[] {
  const rows: PropertyRow[] = [
    { key: "scale", label: "Scale", prop: transform.scale, setProp: (t, next) => ({ ...t, scale: next as Keyframeable<number> }) },
    { key: "position", label: "Position", prop: transform.position, setProp: (t, next) => ({ ...t, position: next as Keyframeable<{ x: number; y: number }> }) },
    { key: "rotation", label: "Rotation", prop: transform.rotation, setProp: (t, next) => ({ ...t, rotation: next as Keyframeable<number> }) },
    { key: "opacity", label: "Opacity", prop: transform.opacity, setProp: (t, next) => ({ ...t, opacity: next as Keyframeable<number> }) },
    { key: "crop", label: "Crop", prop: transform.crop, setProp: (t, next) => ({ ...t, crop: next as Keyframeable<{ top: number; right: number; bottom: number; left: number }> }) },
  ];
  if (transform.scaleY) {
    rows.splice(1, 0, { key: "scaleY", label: "Scale Y", prop: transform.scaleY, setProp: (t, next) => ({ ...t, scaleY: next as Keyframeable<number> }) });
  }
  return rows.filter((r) => r.prop.keyframes && r.prop.keyframes.length > 0);
}

// Module 6 — the per-clip keyframe track, rendered below the selected
// clip's block (see timeline-panel.tsx's file header for why this is an
// overlay rather than a true row-pushing expand: this app's track-row
// layout is a flat cumulative-offset list, and dynamically growing one
// row to push every row below it is a substantially bigger layout change
// than this module's scope — the overlay achieves the same "see and edit
// keyframes inline under the clip" outcome). Only rendered for a single
// selected clip, and only shows rows for properties that already have at
// least one keyframe — use the Properties Panel's stopwatch icon to
// animate a property for the first time.
export function ClipKeyframeTrack({
  clip,
  top,
  pxPerSecond,
  getPlayheadMs,
  commandDeps,
  runCommand,
  registry,
}: {
  clip: ClipView;
  top: number;
  pxPerSecond: number;
  getPlayheadMs: () => number;
  commandDeps: ClipCommandDeps;
  runCommand: (command: EditorCommand) => void;
  // Trim-lag fix (2026-07-12) — registers this component's own root div by
  // clip id so ClipBlock's drag handlers (timeline-panel.tsx) can write
  // live style.transform/width to it during a move/trim drag, the same way
  // they already do for the clip body itself and its group-mates. Without
  // this, this component's left/width (computed below from clip.startMs/
  // durationMs, i.e. React props) stays frozen at its pre-drag value for
  // the entire drag gesture — those props don't change until the drag
  // commits and the server round-trip's refetch lands — producing a
  // visible lag between the clip resizing smoothly and this track catching
  // up only after the fact.
  registry: Map<string, HTMLDivElement>;
}) {
  const transform = clip.transform ?? DEFAULT_CLIP_TRANSFORM;
  const rows = propertyRows(transform);
  const left = (clip.startMs / 1000) * pxPerSecond;
  const width = Math.max(4, (clip.durationMs / 1000) * pxPerSecond);
  // Read fresh at click-time (not a passed-down reactive value) — this
  // component only re-renders when TimelinePanel does for other reasons,
  // so a plain prop could be stale by the time the user actually clicks;
  // matches the getPlayheadMs() convention ClipBlock already uses.
  const atMsNow = () => getPlayheadMs() - clip.startMs;

  function commit(next: ClipTransform) {
    runCommand(createUpdateTransformCommand(commandDeps, clip.id, transform, next));
  }

  const rootElRef = React.useRef<HTMLDivElement | null>(null);
  const registerEl = (el: HTMLDivElement | null) => {
    rootElRef.current = el;
    if (el) registry.set(clip.id, el);
    else registry.delete(clip.id);
  };

  // Fix (2026-07-13) — same staleness bug and fix as ClipBlock's own
  // elRef reset (timeline-panel.tsx): this row's root div also receives a
  // live `style.transform` from ClipBlock's syncKeyframeTrack during a
  // move/trim-left drag (see this file's own header comment on why), and
  // like the clip body's, that transform is never part of the JSX-managed
  // `style={{ top, left, width }}` object above — so nothing ever cleared
  // it once the real `clip.startMs` landed and `left` was already
  // correct, and it accumulated across drags exactly the same way.
  React.useEffect(() => {
    const el = rootElRef.current;
    if (el) el.style.transform = "";
  }, [clip.startMs]);

  // Fix (2026-07-13) — this used to render the explanatory sentence
  // permanently, inline, at the clip's full rendered width — for anything
  // but a very short clip that reads as an unstyled black bar spanning (and
  // visually overlapping) the selected clip above it. A real Radix tooltip
  // anchored to a small icon is the same "explain, don't permanently
  // occupy space" pattern the sidebar rail's own icon tooltips already use
  // (rail.tsx) — the row stays its normal compact height, the explanation
  // only appears on hover.
  if (rows.length === 0) {
    return (
      <div
        ref={registerEl}
        className="absolute z-20 flex items-center border border-t-0 border-editor-line bg-black/90 px-2"
        style={{ top, left, width, height: ROW_HEIGHT }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-1 text-nano text-neutral-500">
              <Clock className="size-3" />
              No animated properties
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" align="start">
            Use the stopwatch icons in Properties to animate one.
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      ref={registerEl}
      className="absolute z-20 border border-t-0 border-editor-line bg-black/90"
      style={{ top, left, width }}
      // The Timeline lane's onPointerDown starts a marquee-select/clears
      // selection on ANY pointerdown within it (see handleLanePointerDown)
      // — this overlay sits inside that same lane, so without stopping
      // propagation here, clicking a keyframe row would deselect the very
      // clip whose track this is, before the row's own onClick could add
      // the keyframe. A real bug found during Module 6's live verification.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {rows.map((row) => (
        <KeyframeRow
          key={row.key}
          label={row.label}
          prop={row.prop}
          pxPerSecond={pxPerSecond}
          atMsNow={atMsNow}
          onAddOrMove={(next) => commit(row.setProp(transform, next))}
        />
      ))}
    </div>
  );
}

function KeyframeRow({
  label,
  prop,
  pxPerSecond,
  atMsNow,
  onAddOrMove,
}: {
  label: string;
  prop: Keyframeable<unknown>;
  pxPerSecond: number;
  atMsNow: () => number;
  onAddOrMove: (next: Keyframeable<unknown>) => void;
}) {
  const keyframes = prop.keyframes ?? [];

  // Per the brief: clicking empty track space adds a keyframe AT THE
  // CURRENT PLAYHEAD position (not at the clicked x) — park the playhead,
  // then click to drop a keyframe there, the same two-step gesture every
  // mainstream NLE uses.
  function onRowClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).dataset.keyframeDiamond) return;
    const atMs = atMsNow();
    const value = resolveTransformValue(prop, atMs);
    onAddOrMove(addOrUpdateKeyframe(prop, atMs, value));
  }

  return (
    <div
      onClick={onRowClick}
      className="relative cursor-copy border-b border-editor-line last:border-b-0"
      style={{ height: ROW_HEIGHT }}
      title={`${label} — click to add a keyframe at the playhead`}
    >
      <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-neutral-500">{label}</span>
      {keyframes.map((kf) => (
        <KeyframeDiamond
          key={kf.id}
          keyframe={kf}
          pxPerSecond={pxPerSecond}
          onMove={(newTimeMs) => onAddOrMove(moveKeyframe(prop, kf.id, newTimeMs))}
          onSetEasing={(side, easing) => onAddOrMove(setKeyframeEasing(prop, kf.id, side, easing))}
          onDelete={() => onAddOrMove(deleteKeyframe(prop, kf.id))}
        />
      ))}
    </div>
  );
}

function KeyframeDiamond({
  keyframe,
  pxPerSecond,
  onMove,
  onSetEasing,
  onDelete,
}: {
  keyframe: EditorKeyframe<unknown>;
  pxPerSecond: number;
  onMove: (newTimeMs: number) => void;
  onSetEasing: (side: "in" | "out", easing: EasingSide) => void;
  onDelete: () => void;
}) {
  const dragRef = React.useRef<{ startClientX: number; startTimeMs: number } | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [bezierTarget, setBezierTarget] = React.useState<"in" | "out" | null>(null);
  const left = (keyframe.timeMs / 1000) * pxPerSecond;

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    if (e.button !== 0) return;
    dragRef.current = { startClientX: e.clientX, startTimeMs: keyframe.timeMs };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }
  function onPointerMove(e: PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaMs = Math.round(((e.clientX - drag.startClientX) / pxPerSecond) * 1000);
    onMove(Math.max(0, drag.startTimeMs + deltaMs));
  }
  function onPointerUp() {
    dragRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }

  return (
    <>
      <EasingDropdownMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        trigger={
          <div
            data-keyframe-diamond="true"
            onPointerDown={onPointerDown}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(true);
            }}
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-ew-resize border border-black/40 bg-editor-accent"
            style={{ left }}
            title={`t=${keyframe.timeMs}ms — drag to retime, right-click for easing`}
          />
        }
        onSetEasing={(side, preset: EasingPreset) => onSetEasing(side, { type: preset })}
        onOpenCustom={(side) => setBezierTarget(side)}
        onDelete={onDelete}
      />
      {bezierTarget && (
        <div
          className="absolute top-full z-30 mt-1 rounded-md border border-editor-line bg-surface-1 text-white shadow-xl"
          style={{ left }}
        >
          <div className="flex items-center justify-between px-2 pt-2">
            <p className="text-caption text-neutral-400">Custom {bezierTarget} easing</p>
            <button type="button" className="text-caption text-neutral-500 hover:text-white" onClick={() => setBezierTarget(null)}>
              Done
            </button>
          </div>
          <BezierHandleEditor
            point={easingSideToPoint(keyframe.easing[bezierTarget])}
            onChange={(point) => onSetEasing(bezierTarget, { type: "CUSTOM", point })}
          />
        </div>
      )}
    </>
  );
}
