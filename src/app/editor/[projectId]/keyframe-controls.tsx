"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EasingPreset, EasingSide } from "@/lib/video-editor/transform";

// Shared keyframe UI pieces (Module 6) — used by both the Right Properties
// Panel (stopwatch toggle) and the Timeline's keyframe track (right-click
// easing menu + custom bezier editor), so the two surfaces stay visually
// and behaviorally consistent rather than growing two separate
// implementations.

export function StopwatchToggle({
  keyframed,
  onToggle,
  title,
}: {
  keyframed: boolean;
  onToggle: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={title ?? (keyframed ? "Remove animation (bake current value)" : "Animate this property")}
      className={
        keyframed
          ? "flex size-5 shrink-0 items-center justify-center rounded text-editor-accent"
          : "flex size-5 shrink-0 items-center justify-center rounded text-neutral-600 hover:text-neutral-300"
      }
    >
      <Clock className="size-3.5" />
    </button>
  );
}

const EASING_PRESET_LABELS: Record<EasingPreset, string> = {
  LINEAR: "Linear",
  EASE_IN: "Ease In",
  EASE_OUT: "Ease Out",
  EASE_IN_OUT: "Ease In-Out",
};
export const EASING_PRESETS: EasingPreset[] = ["LINEAR", "EASE_IN", "EASE_OUT", "EASE_IN_OUT"];

// Right-click menu on a keyframe diamond — easing presets for both sides
// (in = incoming segment, out = outgoing segment) plus "Custom..." (opens
// BezierEditorPopover) and Delete. Rendered as DropdownMenuContent so the
// caller can drive it from either a real right-click (onContextMenu) or a
// controlled open state.
export function KeyframeEasingMenuItems({
  onSetEasing,
  onOpenCustom,
  onDelete,
}: {
  onSetEasing: (side: "in" | "out", preset: EasingPreset) => void;
  onOpenCustom: (side: "in" | "out") => void;
  onDelete: () => void;
}) {
  return (
    <>
      <DropdownMenuItem disabled className="text-neutral-500">
        Incoming easing
      </DropdownMenuItem>
      {EASING_PRESETS.map((preset) => (
        <DropdownMenuItem key={`in-${preset}`} onClick={() => onSetEasing("in", preset)}>
          {EASING_PRESET_LABELS[preset]}
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem onClick={() => onOpenCustom("in")}>Custom…</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled className="text-neutral-500">
        Outgoing easing
      </DropdownMenuItem>
      {EASING_PRESETS.map((preset) => (
        <DropdownMenuItem key={`out-${preset}`} onClick={() => onSetEasing("out", preset)}>
          {EASING_PRESET_LABELS[preset]}
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem onClick={() => onOpenCustom("out")}>Custom…</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onDelete} className="text-editor-danger">
        Delete Keyframe
      </DropdownMenuItem>
    </>
  );
}

// Controlled `open` (rather than a plain click-triggered DropdownMenu) so
// the caller can open this from a right-click (`onContextMenu`) on an
// arbitrary element instead of Radix's default left-click trigger — the
// brief's "right-click for easing preset menu."
export function EasingDropdownMenu({
  trigger,
  open,
  onOpenChange,
  onSetEasing,
  onOpenCustom,
  onDelete,
}: {
  trigger: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetEasing: (side: "in" | "out", preset: EasingPreset) => void;
  onOpenCustom: (side: "in" | "out") => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <KeyframeEasingMenuItems onSetEasing={onSetEasing} onOpenCustom={onOpenCustom} onDelete={onDelete} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// The custom cubic-bezier editor: a small square (0..1 x 0..1) with ONE
// draggable handle (this popover edits a single EasingSide's control
// point — the brief's "two draggable control-point handles" refers to the
// TWO handles that together form one segment's curve, i.e. one keyframe's
// `out` handle + the next keyframe's `in` handle, each edited via its own
// instance of this same popover — see transform.ts's KeyframeEasing doc
// comment for why a segment is built from two different keyframes' sides).
export function BezierHandleEditor({
  point,
  onChange,
}: {
  point: { x: number; y: number };
  onChange: (point: { x: number; y: number }) => void;
}) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const SIZE = 160;
  const PAD = 16;

  function toSvg(p: { x: number; y: number }) {
    // y is inverted (SVG y grows downward; easing y grows upward, and can
    // go outside [0,1] for an overshoot curve — clamp the DISPLAY only).
    const clampedY = Math.min(1.4, Math.max(-0.4, p.y));
    return { x: PAD + p.x * SIZE, y: PAD + SIZE - (clampedY + 0.4) * (SIZE / 1.8) };
  }
  function fromSvg(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return point;
    const rect = svg.getBoundingClientRect();
    const px = (clientX - rect.left - PAD) / SIZE;
    const pySvg = (clientY - rect.top - PAD) / (SIZE / 1.8);
    const py = 1.4 - pySvg - 0.4 + 0.4; // inverse of toSvg's y mapping
    return { x: Math.min(1, Math.max(0, px)), y: Math.round(py * 100) / 100 };
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (e.buttons !== 1) return;
    onChange(fromSvg(e.clientX, e.clientY));
  }

  const p0 = { x: 0, y: 0 };
  const p3 = { x: 1, y: 1 };
  const handle = toSvg(point);
  const start = toSvg(p0);
  const end = toSvg(p3);

  return (
    <div className="space-y-2 p-2">
      <svg
        ref={svgRef}
        width={SIZE + PAD * 2}
        height={SIZE + PAD * 2}
        className="rounded bg-black/40"
        onPointerMove={onPointerMove}
      >
        <line x1={start.x} y1={start.y} x2={handle.x} y2={handle.y} stroke="#f97316" strokeWidth={1.5} />
        <circle cx={start.x} cy={start.y} r={3} fill="#666" />
        <circle cx={end.x} cy={end.y} r={3} fill="#666" />
        <circle
          cx={handle.x}
          cy={handle.y}
          r={6}
          fill="#f97316"
          className="cursor-grab"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        />
      </svg>
      <div className="flex items-center gap-2 text-caption text-neutral-400">
        <span>x</span>
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={Math.round(point.x * 100) / 100}
          onChange={(e) => onChange({ ...point, x: Math.min(1, Math.max(0, Number(e.target.value))) })}
          className="w-14 rounded border border-editor-line bg-editor-surface-1 px-1 py-0.5 text-neutral-100"
        />
        <span>y</span>
        <input
          type="number"
          step={0.01}
          value={Math.round(point.y * 100) / 100}
          onChange={(e) => onChange({ ...point, y: Number(e.target.value) })}
          className="w-14 rounded border border-editor-line bg-editor-surface-1 px-1 py-0.5 text-neutral-100"
        />
      </div>
    </div>
  );
}

export function easingSideToPoint(side: EasingSide): { x: number; y: number } {
  if (side.type === "CUSTOM") return side.point;
  // A reasonable starting handle position when switching a preset to
  // custom — the preset's own control point, so the curve doesn't jump.
  const defaults: Record<EasingPreset, { x: number; y: number }> = {
    LINEAR: { x: 0.33, y: 0.33 },
    EASE_IN: { x: 0.42, y: 0 },
    EASE_OUT: { x: 0, y: 0 },
    EASE_IN_OUT: { x: 0.42, y: 0 },
  };
  return defaults[side.type];
}
