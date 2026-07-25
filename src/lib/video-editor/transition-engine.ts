// Pure transition math for the Cloud Video Editor (Module 9) — types, the
// data-driven type/preset table, and the compositor blend function. Framework-
// agnostic (no DB/server-only imports), mirroring transform.ts's split: this
// file is the "what does a transition actually look like at progress t"
// half; lib/video-editor/transitions.ts (the DB service) is the "how does
// adding/resizing/removing one affect clip placement" half.
//
// ---------------------------------------------------------------------
// Overlap model (read this before touching addTransition/updateTransition/
// removeTransition in transitions.ts)
// ---------------------------------------------------------------------
// A transition's duration creates an OVERLAP WINDOW between clipA's tail and
// clipB's head: clipB's startMs is ripple-shifted EARLIER by the
// transition's durationMs (and so is every other clip after it on the same
// track, closing the gap that would otherwise open) — clipA's own
// startMs/durationMs and BOTH clips' trimStartMs are never touched. This is
// the CapCut-style "adding a transition shortens the combined visible
// timeline" model, not Premiere's default "eat into hidden trim handles,
// keep the sequence duration unchanged" model. Deliberately chosen: this
// codebase's trim UI has no concept of "extra untrimmed handle available
// beyond the visible in/out point" as an editable, surfaced idea (Module 2's
// trim handles are bounded by the asset's own duration, not by "how much
// more could a transition eat into"), so implementing Premiere's model would
// mean inventing and exposing that concept for the first time, in the
// transition-duration picker specifically, which the brief doesn't ask for.
// The ripple-shift model reuses machinery this codebase already has
// (computeRippleShift, mirroring computeRippleDelete) and is exactly as
// legitimate a professional NLE convention (DaVinci Resolve and CapCut both
// default to it) — see PROJECT_STATUS.md's Module 9 entry for the full
// write-up.

import { solveCubicBezier, type ResolvedTransform } from "./transform";

export const TRANSITION_TYPES = ["CROSSFADE", "DISSOLVE", "WIPE", "SLIDE", "ZOOM", "FLASH"] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

export const TRANSITION_DIRECTIONS = ["LEFT", "RIGHT", "UP", "DOWN", "IN", "OUT"] as const;
export type TransitionDirection = (typeof TRANSITION_DIRECTIONS)[number];

export const WIPE_SLIDE_DIRECTIONS: TransitionDirection[] = ["LEFT", "RIGHT", "UP", "DOWN"];
export const ZOOM_DIRECTIONS: TransitionDirection[] = ["IN", "OUT"];

export const MIN_TRANSITION_MS = 100;
export const MAX_TRANSITION_MS = 10_000;

// ---------------------------------------------------------------------
// Types/presets — data-driven (a table, not a per-type branch in the UI)
// so a new transition type is added here and in resolveTransitionBlend's
// switch only; nothing in timeline-panel.tsx or preview-window.tsx needs to
// change. Mirrors Module 6's ANIMATION_PRESETS / Module 7's caption preset
// pattern.
// ---------------------------------------------------------------------
export interface TransitionTypeDef {
  id: TransitionType;
  label: string;
  description: string;
  directions: TransitionDirection[] | null; // null = non-directional
  defaultDirection: TransitionDirection | null;
}

export const TRANSITION_TYPE_DEFS: TransitionTypeDef[] = [
  { id: "CROSSFADE", label: "Crossfade", description: "Clip A fades out while clip B fades in.", directions: null, defaultDirection: null },
  {
    id: "DISSOLVE",
    label: "Dissolve",
    description: "A softer crossfade with a brief blur pulse through the midpoint.",
    directions: null,
    defaultDirection: null,
  },
  { id: "WIPE", label: "Wipe", description: "Clip B reveals over clip A along a hard edge.", directions: WIPE_SLIDE_DIRECTIONS, defaultDirection: "LEFT" },
  { id: "SLIDE", label: "Slide", description: "Clip B pushes clip A off-frame.", directions: WIPE_SLIDE_DIRECTIONS, defaultDirection: "LEFT" },
  { id: "ZOOM", label: "Zoom", description: "Clip A zooms into clip B (or out of it).", directions: ZOOM_DIRECTIONS, defaultDirection: "IN" },
  { id: "FLASH", label: "Flash / Whip", description: "A fast white-flash whip cut.", directions: null, defaultDirection: null },
];

export function transitionTypeDef(type: TransitionType): TransitionTypeDef {
  return TRANSITION_TYPE_DEFS.find((d) => d.id === type)!;
}

export function defaultDirectionFor(type: TransitionType): TransitionDirection | null {
  return transitionTypeDef(type).defaultDirection;
}

// ---------------------------------------------------------------------
// Easing — reuses transform.ts's solveCubicBezier (the exact standard
// cubic-bezier timing-function algorithm Module 6 already built) directly.
// Deliberately NOT KeyframeEasing's two-sided {in, out} shape: a transition
// has exactly one segment (the overlap window), not a chain of keyframes,
// so it stores one full {x1,y1,x2,y2} curve rather than splitting a curve
// across two neighboring keyframes' sides.
// ---------------------------------------------------------------------
export type TransitionEasingPreset = "LINEAR" | "EASE_IN" | "EASE_OUT" | "EASE_IN_OUT";
export type TransitionEasing = { type: TransitionEasingPreset } | { type: "CUSTOM"; x1: number; y1: number; x2: number; y2: number };

export const DEFAULT_TRANSITION_EASING: TransitionEasing = { type: "EASE_IN_OUT" };

const EASING_CURVE: Record<TransitionEasingPreset, [number, number, number, number]> = {
  LINEAR: [0, 0, 1, 1],
  EASE_IN: [0.42, 0, 1, 1],
  EASE_OUT: [0, 0, 0.58, 1],
  EASE_IN_OUT: [0.42, 0, 0.58, 1],
};

export function resolveTransitionProgress(easing: TransitionEasing, t: number): number {
  const [x1, y1, x2, y2] = easing.type === "CUSTOM" ? [easing.x1, easing.y1, easing.x2, easing.y2] : EASING_CURVE[easing.type];
  return solveCubicBezier(t, x1, y1, x2, y2);
}

// ---------------------------------------------------------------------
// Compositor blend — the pure function the Preview Window's render loop
// calls once per active transition per rAF tick. Returns, for EACH of the
// two clips, exactly how much to ADDITIONALLY multiply/offset that clip's
// own already-resolved Module 4/6 transform by — never a replacement. See
// combineResolvedWithTransitionBlend below for how the caller applies this
// on top of resolveClipTransform's output.
// ---------------------------------------------------------------------
export interface TransitionInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TransitionLayerBlend {
  opacityMultiplier: number; // 0..1, multiplies the clip's own resolved opacity
  translateXPercent: number; // added to the clip's own resolved position.x
  translateYPercent: number;
  scaleMultiplier: number; // multiplies the clip's own resolved scaleX/scaleY
  extraInsets: TransitionInsets; // combined via max() with the clip's own crop insets
  blurPx: number;
}

export const NO_TRANSITION_BLEND: TransitionLayerBlend = {
  opacityMultiplier: 1,
  translateXPercent: 0,
  translateYPercent: 0,
  scaleMultiplier: 1,
  extraInsets: { top: 0, right: 0, bottom: 0, left: 0 },
  blurPx: 0,
};

export interface TransitionBlendResult {
  a: TransitionLayerBlend; // the outgoing (earlier) clip
  b: TransitionLayerBlend; // the incoming (later) clip
  // 0 normally; > 0 only for FLASH, peaking at the transition's midpoint —
  // the caller renders one shared full-frame white overlay div at this
  // opacity, above both clip layers.
  flashOverlayOpacity: number;
}

function wipeInsets(direction: TransitionDirection, p: number): TransitionInsets {
  const cut = (1 - p) * 100; // 100 -> 0 as p goes 0 -> 1 (fully hidden -> fully revealed)
  switch (direction) {
    case "RIGHT":
      return { top: 0, right: 0, bottom: 0, left: cut }; // reveals growing from the right edge
    case "UP":
      return { top: 0, right: 0, bottom: cut, left: 0 }; // reveals growing from the top edge
    case "DOWN":
      return { top: cut, right: 0, bottom: 0, left: 0 }; // reveals growing from the bottom edge
    case "LEFT":
    default:
      return { top: 0, right: cut, bottom: 0, left: 0 }; // reveals growing from the left edge
  }
}

// B slides in FROM `direction`'s edge, pushing A out the opposite edge —
// e.g. direction=LEFT: B enters from the left (starts at -100%, animates to
// 0%), A exits to the right (starts at 0%, animates to +100%).
function slideOffsets(direction: TransitionDirection, p: number): { a: { x: number; y: number }; b: { x: number; y: number } } {
  const enter = (1 - p) * 100; // 100 -> 0
  const exit = p * 100; // 0 -> 100
  switch (direction) {
    case "RIGHT":
      return { a: { x: -exit, y: 0 }, b: { x: enter, y: 0 } };
    case "UP":
      return { a: { x: 0, y: exit }, b: { x: 0, y: -enter } };
    case "DOWN":
      return { a: { x: 0, y: -exit }, b: { x: 0, y: enter } };
    case "LEFT":
    default:
      return { a: { x: exit, y: 0 }, b: { x: -enter, y: 0 } };
  }
}

// Pure — given the transition's type/direction/easing and raw progress `t`
// (0 at the overlap window's start i.e. clipB.startMs, 1 at its end i.e.
// clipA's original end — NOT yet eased), returns each clip's blend
// contribution. `t` is clamped to [0,1] defensively (a caller passing a
// playhead slightly outside the window, e.g. from a stale read, still gets
// a sane fully-A or fully-B result instead of an extrapolated one).
export function resolveTransitionBlend(type: TransitionType, direction: TransitionDirection | null, easing: TransitionEasing, t: number): TransitionBlendResult {
  const clampedT = Math.min(1, Math.max(0, t));
  const p = resolveTransitionProgress(easing, clampedT); // eased 0..1: 0 = fully A, 1 = fully B

  switch (type) {
    case "CROSSFADE":
      return {
        a: { ...NO_TRANSITION_BLEND, opacityMultiplier: 1 - p },
        b: { ...NO_TRANSITION_BLEND, opacityMultiplier: p },
        flashOverlayOpacity: 0,
      };
    case "DISSOLVE": {
      // The honest, CSS-only approximation of "dissolve" a DOM-layered
      // compositor can produce: the same opacity crossfade as CROSSFADE,
      // plus a brief blur pulse peaking at the midpoint — a true pixel-grain
      // dissolve needs a canvas/WebGL compositor (out of scope, same class
      // of documented trade-off as Module 7's merged Stroke/Outline).
      const blur = Math.sin(clampedT * Math.PI) * 6;
      return {
        a: { ...NO_TRANSITION_BLEND, opacityMultiplier: 1 - p, blurPx: blur },
        b: { ...NO_TRANSITION_BLEND, opacityMultiplier: p, blurPx: blur },
        flashOverlayOpacity: 0,
      };
    }
    case "WIPE": {
      // Hard edge: A stays fully opaque underneath; B is progressively
      // revealed via a growing inset from the edge opposite `direction`.
      const insets = wipeInsets(direction ?? "LEFT", p);
      return {
        a: { ...NO_TRANSITION_BLEND },
        b: { ...NO_TRANSITION_BLEND, extraInsets: insets },
        flashOverlayOpacity: 0,
      };
    }
    case "SLIDE": {
      const offsets = slideOffsets(direction ?? "LEFT", p);
      return {
        a: { ...NO_TRANSITION_BLEND, translateXPercent: offsets.a.x, translateYPercent: offsets.a.y },
        b: { ...NO_TRANSITION_BLEND, translateXPercent: offsets.b.x, translateYPercent: offsets.b.y },
        flashOverlayOpacity: 0,
      };
    }
    case "ZOOM": {
      const zoomIn = direction !== "OUT";
      // ZOOM IN: A scales up (zooms into frame) while fading out; B scales
      // down from magnified to 1 while fading in. ZOOM OUT: roles reversed.
      const aScale = zoomIn ? 1 + p * 0.6 : 1 - p * 0.4;
      const bScale = zoomIn ? 1.6 - p * 0.6 : 0.6 + p * 0.4;
      return {
        a: { ...NO_TRANSITION_BLEND, opacityMultiplier: 1 - p, scaleMultiplier: aScale },
        b: { ...NO_TRANSITION_BLEND, opacityMultiplier: p, scaleMultiplier: bScale },
        flashOverlayOpacity: 0,
      };
    }
    case "FLASH": {
      // A fast whip: both clips crossfade underneath a white flash overlay
      // that peaks at the midpoint, plus a brief blur spike — the practical
      // CSS approximation of a motion-blur whip-pan (true motion blur needs
      // per-pixel directional sampling, out of scope for a DOM compositor).
      const flash = Math.sin(clampedT * Math.PI); // 0 -> 1 -> 0
      const blur = flash * 10;
      return {
        a: { ...NO_TRANSITION_BLEND, opacityMultiplier: 1 - p, blurPx: blur },
        b: { ...NO_TRANSITION_BLEND, opacityMultiplier: p, blurPx: blur },
        flashOverlayOpacity: flash,
      };
    }
  }
}

// Pure — combines a clip's already-resolved Module 4/6 transform (crop,
// keyframes, everything) with a transition's blend contribution for that
// clip. Operates on plain numbers (ResolvedTransform), not CSS strings, so
// it's exactly as testable as transform.ts's own functions — composeTransformCss
// (transform.ts) still does the final stringification, unchanged, AFTER
// this runs.
export function combineResolvedWithTransitionBlend(resolved: ResolvedTransform, blend: TransitionLayerBlend): ResolvedTransform {
  return {
    ...resolved,
    opacity: resolved.opacity * blend.opacityMultiplier,
    scaleX: resolved.scaleX * blend.scaleMultiplier,
    scaleY: resolved.scaleY * blend.scaleMultiplier,
    x: resolved.x + blend.translateXPercent,
    y: resolved.y + blend.translateYPercent,
    crop: {
      top: Math.min(100, Math.max(resolved.crop.top, blend.extraInsets.top)),
      right: Math.min(100, Math.max(resolved.crop.right, blend.extraInsets.right)),
      bottom: Math.min(100, Math.max(resolved.crop.bottom, blend.extraInsets.bottom)),
      left: Math.min(100, Math.max(resolved.crop.left, blend.extraInsets.left)),
    },
  };
}

// Pure — the simpler AUDIO-track treatment: a linear gain crossfade using
// the transition's own eased progress, regardless of `type` (WIPE/SLIDE/
// ZOOM/FLASH don't have a meaningful audio-only interpretation — every
// audio transition in this module is a crossfade, matching how most NLEs
// only offer "audio crossfade" as a single audio transition type distinct
// from their many visual ones).
export function resolveAudioTransitionGain(easing: TransitionEasing, t: number): { gainA: number; gainB: number } {
  const clampedT = Math.min(1, Math.max(0, t));
  const p = resolveTransitionProgress(easing, clampedT);
  return { gainA: 1 - p, gainB: p };
}
