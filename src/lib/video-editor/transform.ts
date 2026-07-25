// Universal per-clip transform (Module 4) — pure types + math, framework-
// agnostic (no DB/server-only imports) so both the client compositor
// (preview-window.tsx) and a future server-side export compositor can
// share the exact same resolve/compose logic.
//
// Module 6 (Motion Engine) activates the keyframe half of this file:
// `resolveTransformValue()` now does real interpolation instead of always
// returning `.value` — every other function, the Prisma column, and the
// Zod schema's outer shape are unchanged, exactly as planned in Module 4.
// `keyframes: null | []` still means "static value" (Module 4's original
// behavior, preserved as the zero-keyframe case of the same code path).

// Each side of a keyframe's easing is either a named preset or a custom
// single bezier control point. A segment between keyframe A and keyframe B
// is one cubic bezier whose two control points come from two DIFFERENT
// keyframes — A's `out` (how the curve leaves A) and B's `in` (how the
// curve arrives at B) — the same incoming/outgoing-per-keyframe model
// After Effects uses, and exactly what the brief's "two draggable
// control-point handles" UI edits: one handle is A.easing.out, the other
// is B.easing.in.
export type EasingPreset = "LINEAR" | "EASE_IN" | "EASE_OUT" | "EASE_IN_OUT";

export interface EasingControlPoint {
  x: number;
  y: number;
}

export type EasingSide = { type: EasingPreset } | { type: "CUSTOM"; point: EasingControlPoint };

export interface KeyframeEasing {
  in: EasingSide;
  out: EasingSide;
}

export const DEFAULT_KEYFRAME_EASING: KeyframeEasing = {
  in: { type: "LINEAR" },
  out: { type: "LINEAR" },
};

export interface EditorKeyframe<T> {
  id: string;
  timeMs: number;
  value: T;
  easing: KeyframeEasing;
}

export interface Keyframeable<T> {
  value: T;
  keyframes: EditorKeyframe<T>[] | null;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface CropRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Real blend modes (2026-07-15) — the "Blend" group used to be Opacity +
// Flip only, no actual blend-mode compositing despite the label; this is
// the CSS `mix-blend-mode` values that map directly onto a per-clip layer
// (the subset that's meaningful for a single clip compositing against
// whatever's beneath it, not the full CSS spec's exhaustive list — no
// `hue`/`saturation`/`color`/`luminosity`, which only make sense for a
// dedicated color-grading tool, not a compositing/blend control).
// Deliberately NOT `Keyframeable<T>` like scale/position/etc. — a mode is
// a discrete choice, not a continuous value CSS (or a user) can
// meaningfully interpolate between, the same reasoning flipH/flipV
// (booleans) already use.
export const BLEND_MODES = ["normal", "multiply", "screen", "overlay", "darken", "lighten"] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

export interface ClipTransform {
  // Percentage, 100 = 100% (native size). Also used as the Y-scale
  // whenever `scaleY` is null (uniform scale) — see the properties
  // panel's uniform/non-uniform toggle.
  scale: Keyframeable<number>;
  // null = uniform (linked to `scale`); non-null = independent Y-scale.
  scaleY: Keyframeable<number> | null;
  // Percentage offset from center (0,0 = no offset), NOT the 0..1
  // fraction-of-frame convention content.x/y (TEXT/OVERLAY) uses — see
  // the EditorClip.transform schema comment for why these stay separate.
  position: Keyframeable<Point2D>;
  // Degrees.
  rotation: Keyframeable<number>;
  // Percentage, 100 = fully opaque.
  opacity: Keyframeable<number>;
  // Percentage insets from each edge, 0..100 — maps 1:1 onto CSS
  // `clip-path: inset(top right bottom left)`.
  crop: Keyframeable<CropRect>;
  flipH: boolean;
  flipV: boolean;
  blendMode: BlendMode;
}

export const DEFAULT_CLIP_TRANSFORM: ClipTransform = {
  scale: { value: 100, keyframes: null },
  scaleY: null,
  position: { value: { x: 0, y: 0 }, keyframes: null },
  rotation: { value: 0, keyframes: null },
  opacity: { value: 100, keyframes: null },
  crop: { value: { top: 0, right: 0, bottom: 0, left: 0 }, keyframes: null },
  flipH: false,
  flipV: false,
  blendMode: "normal",
};

// Standard CSS timing-function control points — each preset already IS a
// 2-control-point cubic bezier over a whole segment; splitting it across
// two keyframe sides just means the "out" side contributes the bezier's
// first control point and the "in" side contributes its second.
const PRESET_OUT_POINT: Record<EasingPreset, EasingControlPoint> = {
  LINEAR: { x: 0, y: 0 },
  EASE_IN: { x: 0.42, y: 0 },
  EASE_OUT: { x: 0, y: 0 },
  EASE_IN_OUT: { x: 0.42, y: 0 },
};
const PRESET_IN_POINT: Record<EasingPreset, EasingControlPoint> = {
  LINEAR: { x: 1, y: 1 },
  EASE_IN: { x: 1, y: 1 },
  EASE_OUT: { x: 0.58, y: 1 },
  EASE_IN_OUT: { x: 0.58, y: 1 },
};

function outControlPoint(side: EasingSide): EasingControlPoint {
  return side.type === "CUSTOM" ? side.point : PRESET_OUT_POINT[side.type];
}
function inControlPoint(side: EasingSide): EasingControlPoint {
  return side.type === "CUSTOM" ? side.point : PRESET_IN_POINT[side.type];
}

// Standard cubic-bezier timing-function evaluation (same algorithm browsers
// use for CSS `cubic-bezier()`): P0=(0,0), P3=(1,1) implied, P1/P2 given.
// Solves x(u) = t for u via Newton-Raphson (falling back to bisection if
// the derivative is ~0), then returns y(u) — i.e. "given how far through
// the segment in time (t), how far through in value (the eased fraction)."
function cubicBezierPoint(u: number, p1: number, p2: number): number {
  const v = 1 - u;
  return 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u;
}
function cubicBezierDerivative(u: number, p1: number, p2: number): number {
  const v = 1 - u;
  return 3 * v * v * p1 + 6 * v * u * (p2 - p1) + 3 * u * u * (1 - p2);
}

export function solveCubicBezier(t: number, x1: number, y1: number, x2: number, y2: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  let u = t;
  for (let i = 0; i < 8; i++) {
    const x = cubicBezierPoint(u, x1, x2) - t;
    const dx = cubicBezierDerivative(u, x1, x2);
    if (Math.abs(dx) < 1e-6) break;
    const next = u - x / dx;
    if (!Number.isFinite(next)) break;
    u = Math.min(1, Math.max(0, next));
  }
  // Bisection cleanup pass — Newton-Raphson can overshoot for extreme
  // (e.g. near-vertical custom) control points; a few bisection steps
  // guarantee convergence regardless.
  let lo = 0;
  let hi = 1;
  let guess = u;
  for (let i = 0; i < 8; i++) {
    const x = cubicBezierPoint(guess, x1, x2);
    if (Math.abs(x - t) < 1e-4) break;
    if (x < t) lo = guess;
    else hi = guess;
    guess = (lo + hi) / 2;
  }
  return cubicBezierPoint(guess, y1, y2);
}

// The eased 0..1 fraction through one keyframe-to-keyframe segment, given
// the departing keyframe's `out` side and the arriving keyframe's `in`
// side (see the KeyframeEasing doc comment above).
export function easeSegment(t: number, fromOut: EasingSide, toIn: EasingSide): number {
  const p1 = outControlPoint(fromOut);
  const p2 = inControlPoint(toIn);
  return solveCubicBezier(t, p1.x, p1.y, p2.x, p2.y);
}

function isPoint2D(v: unknown): v is Point2D {
  return typeof v === "object" && v !== null && "x" in v && "y" in v && !("top" in v);
}
function isCropRect(v: unknown): v is CropRect {
  return typeof v === "object" && v !== null && "top" in v && "right" in v && "bottom" in v && "left" in v;
}

// Generic lerp across every value shape a keyframeable property actually
// uses in this app (number, Point2D, CropRect) — dispatched at runtime
// since TypeScript generics carry no runtime type tag.
export function lerpValue<T>(a: T, b: T, t: number): T {
  if (typeof a === "number" && typeof b === "number") {
    return (a + (b - a) * t) as unknown as T;
  }
  if (isPoint2D(a) && isPoint2D(b)) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t } as unknown as T;
  }
  if (isCropRect(a) && isCropRect(b)) {
    return {
      top: a.top + (b.top - a.top) * t,
      right: a.right + (b.right - a.right) * t,
      bottom: a.bottom + (b.bottom - a.bottom) * t,
      left: a.left + (b.left - a.left) * t,
    } as unknown as T;
  }
  return t < 1 ? a : b;
}

let keyframeIdCounter = 0;
// cuid()-style ids need a real generator server-side; keyframes never hit
// the DB as their own row (they're nested inside the clip's `transform`
// Json blob), so a simple, collision-safe-within-one-clip counter is
// sufficient here — mirrors how `groupId` etc. are treated as opaque
// client-assignable strings elsewhere in this module.
export function createKeyframeId(): string {
  keyframeIdCounter += 1;
  return `kf_${Date.now().toString(36)}_${keyframeIdCounter}`;
}

export function createKeyframe<T>(timeMs: number, value: T, easing: KeyframeEasing = DEFAULT_KEYFRAME_EASING): EditorKeyframe<T> {
  return { id: createKeyframeId(), timeMs, value, easing };
}

// The one function Module 6 exists to build. `atMs` is clip-relative
// (callers pass `atMs - clip.startMs`, i.e. 0 at the clip's own start) —
// keyframe `timeMs` values are likewise clip-relative, so retiming a clip
// (moving its startMs) never needs to rewrite its keyframes.
export function resolveTransformValue<T>(prop: Keyframeable<T>, atMs: number): T {
  const keyframes = prop.keyframes;
  if (!keyframes || keyframes.length === 0) return prop.value;
  if (keyframes.length === 1) return keyframes[0].value;

  // Keyframes are stored in whatever order they were created; sort
  // defensively rather than trusting every writer to maintain order.
  const sorted = [...keyframes].sort((a, b) => a.timeMs - b.timeMs);

  if (atMs <= sorted[0].timeMs) return sorted[0].value;
  const last = sorted[sorted.length - 1];
  if (atMs >= last.timeMs) return last.value;

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    if (atMs >= from.timeMs && atMs <= to.timeMs) {
      const span = to.timeMs - from.timeMs;
      const t = span <= 0 ? 1 : (atMs - from.timeMs) / span;
      const eased = easeSegment(t, from.easing.out, to.easing.in);
      return lerpValue(from.value, to.value, eased);
    }
  }
  // Unreachable given the bounds checks above; satisfies the type checker.
  return last.value;
}

// Exact match only — the Properties Panel uses this to decide whether the
// current playhead position is editable (sitting exactly on a keyframe) or
// read-only (in between, showing the interpolated value).
export function findKeyframeAt<T>(prop: Keyframeable<T>, atMs: number): EditorKeyframe<T> | null {
  return prop.keyframes?.find((k) => k.timeMs === atMs) ?? null;
}

// Pure keyframe CRUD, shared by the Properties Panel's stopwatch/edit
// controls and the Timeline's keyframe track — every one of these returns
// a NEW Keyframeable<T>, never mutates `prop`, so callers just plug the
// result into a createUpdateTransformCommand exactly like every other
// Module 4 field edit.

// Stopwatch-on: bakes the CURRENT resolved value (== prop.value, since
// nothing is keyframed yet) as the first keyframe.
export function keyframeableToKeyframed<T>(prop: Keyframeable<T>, atMs: number): Keyframeable<T> {
  if (prop.keyframes && prop.keyframes.length > 0) return prop;
  return { value: prop.value, keyframes: [createKeyframe(atMs, prop.value)] };
}

// Stopwatch-off: bakes whatever value was showing at `atMs` as the new
// static value and discards every keyframe.
export function keyframeableToStatic<T>(prop: Keyframeable<T>, atMs: number): Keyframeable<T> {
  return { value: resolveTransformValue(prop, atMs), keyframes: null };
}

// Adds a keyframe at `atMs` with `value` — or, if one already exists at
// that exact time, replaces its value (moving the playhead to an existing
// keyframe and editing is handled by the caller directly, not this
// function, but re-clicking "add" on top of one is a reasonable no-surprise
// upsert rather than a duplicate).
export function addOrUpdateKeyframe<T>(prop: Keyframeable<T>, atMs: number, value: T): Keyframeable<T> {
  const existing = prop.keyframes ?? [];
  const withoutThisTime = existing.filter((k) => k.timeMs !== atMs);
  const replaced = existing.find((k) => k.timeMs === atMs);
  const next = [...withoutThisTime, createKeyframe(atMs, value, replaced?.easing ?? DEFAULT_KEYFRAME_EASING)];
  next.sort((a, b) => a.timeMs - b.timeMs);
  return { value: prop.value, keyframes: next };
}

// Updates one existing keyframe's value in place (used when the playhead
// sits exactly on a keyframe and the Properties Panel field is edited).
export function updateKeyframeValue<T>(prop: Keyframeable<T>, keyframeId: string, value: T): Keyframeable<T> {
  if (!prop.keyframes) return prop;
  return { value: prop.value, keyframes: prop.keyframes.map((k) => (k.id === keyframeId ? { ...k, value } : k)) };
}

// Retimes one keyframe (Timeline drag-to-retime), re-sorted afterward.
export function moveKeyframe<T>(prop: Keyframeable<T>, keyframeId: string, newTimeMs: number): Keyframeable<T> {
  if (!prop.keyframes) return prop;
  const next = prop.keyframes.map((k) => (k.id === keyframeId ? { ...k, timeMs: Math.max(0, newTimeMs) } : k));
  next.sort((a, b) => a.timeMs - b.timeMs);
  return { value: prop.value, keyframes: next };
}

// Changes one keyframe's easing on the given side (Timeline right-click
// menu / bezier editor).
export function setKeyframeEasing<T>(prop: Keyframeable<T>, keyframeId: string, side: "in" | "out", easing: EasingSide): Keyframeable<T> {
  if (!prop.keyframes) return prop;
  return {
    value: prop.value,
    keyframes: prop.keyframes.map((k) => (k.id === keyframeId ? { ...k, easing: { ...k.easing, [side]: easing } } : k)),
  };
}

// Deletes one keyframe. Dropping to zero keyframes bakes in that
// keyframe's own value as the new static value rather than leaving an
// empty array (equivalent to a stopwatch-off at the moment of deletion —
// the property doesn't visually jump).
export function deleteKeyframe<T>(prop: Keyframeable<T>, keyframeId: string): Keyframeable<T> {
  if (!prop.keyframes) return prop;
  const deleted = prop.keyframes.find((k) => k.id === keyframeId);
  const remaining = prop.keyframes.filter((k) => k.id !== keyframeId);
  if (remaining.length === 0) return { value: deleted ? deleted.value : prop.value, keyframes: null };
  return { value: prop.value, keyframes: remaining };
}

export interface ResolvedTransform {
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  crop: CropRect;
  flipH: boolean;
  flipV: boolean;
  blendMode: BlendMode;
}

// Pure — resolves every property of a clip's transform at once. `transform`
// is nullable (an EditorClip with no transform row yet uses every default).
export function resolveClipTransform(transform: ClipTransform | null, atMs: number): ResolvedTransform {
  const t = transform ?? DEFAULT_CLIP_TRANSFORM;
  const scaleX = resolveTransformValue(t.scale, atMs);
  const position = resolveTransformValue(t.position, atMs);
  return {
    scaleX,
    scaleY: t.scaleY ? resolveTransformValue(t.scaleY, atMs) : scaleX,
    x: position.x,
    y: position.y,
    rotation: resolveTransformValue(t.rotation, atMs),
    opacity: resolveTransformValue(t.opacity, atMs),
    crop: resolveTransformValue(t.crop, atMs),
    flipH: t.flipH,
    flipV: t.flipV,
    // Explicit fallback, not just relying on CSS's own "no mix-blend-mode
    // property set = normal" default — a stored clip.transform predating
    // this field is a plain JSON blob with no `blendMode` key at all
    // (`t.blendMode` reads `undefined`), same "null/undefined means every
    // property's default, no backfill needed" convention this field's own
    // sibling (`scaleY`) and DEFAULT_CLIP_TRANSFORM itself already use.
    blendMode: t.blendMode ?? "normal",
  };
}

export interface ComposedTransformCss {
  transform: string;
  clipPath: string;
  opacity: number;
  mixBlendMode: BlendMode;
}

// Pure — a ResolvedTransform to CSS. Order is translate → rotate → scale
// deliberately: translate (a percentage of the element's own box) and
// rotate happen in the pre-scale coordinate system, so neither one's
// magnitude is warped by the current scale factor — the intuitive
// behavior when a user drags Position or Rotation independently of Scale.
// Crop is a separate `clip-path`, not part of `transform`, so it clips the
// clip's native box BEFORE translate/scale/rotate visually move the
// (already-cropped) result — "crop is a pre-transform effect," the same
// semantic every mainstream NLE uses.
export function composeTransformCss(resolved: ResolvedTransform): ComposedTransformCss {
  const scaleX = (resolved.scaleX / 100) * (resolved.flipH ? -1 : 1);
  const scaleY = (resolved.scaleY / 100) * (resolved.flipV ? -1 : 1);
  const { top, right, bottom, left } = resolved.crop;

  return {
    transform: `translate(${resolved.x}%, ${resolved.y}%) rotate(${resolved.rotation}deg) scale(${scaleX}, ${scaleY})`,
    clipPath: `inset(${top}% ${right}% ${bottom}% ${left}%)`,
    opacity: Math.min(1, Math.max(0, resolved.opacity / 100)),
    // Real multi-mode blending (2026-07-15) — CSS mix-blend-mode applied
    // per-layer, output by this SAME shared function every preview AND
    // export frame already goes through (compositor-stage.tsx, unchanged
    // between the two render paths), so parity between preview and export
    // is automatic — no separate export-side work, the same reasoning
    // every other property here already relies on.
    mixBlendMode: resolved.blendMode,
  };
}

// Pure — true when every value in `transforms` is deep-equal for the given
// property accessor. Used by the Properties Panel's multi-select
// mixed-state display ("show a value only when every selected clip
// shares it, otherwise show Mixed").
export function allShareValue<T>(values: T[]): boolean {
  if (values.length <= 1) return true;
  const first = JSON.stringify(values[0]);
  return values.every((v) => JSON.stringify(v) === first);
}

// ---------------------------------------------------------------------
// Animation presets (Module 6) — a small starter set, stored as DATA (a
// keyframe-set generator keyed by clip duration) rather than hardcoded
// per-preset logic, so adding a new preset later never touches
// right-properties-panel.tsx or the compositor — only this table.
// ---------------------------------------------------------------------

export type AnimatableProperty = "scale" | "position" | "rotation" | "opacity";

export interface AnimationPreset {
  id: string;
  label: string;
  description: string;
  // Given the clip's duration, build the keyframe set(s) this preset
  // writes. Times are clip-relative ms, clamped to [0, durationMs] by the
  // caller. Returning a partial record lets a preset touch only the
  // properties it needs (e.g. a fade only needs `opacity`).
  build: (durationMs: number) => Partial<Record<AnimatableProperty, EditorKeyframe<unknown>[]>>;
}

const POP_HOLD_MS = 120;

export const ANIMATION_PRESETS: AnimationPreset[] = [
  {
    id: "fade-in",
    label: "Fade In",
    description: "Opacity 0 → 100% over the first half-second.",
    build: (durationMs) => {
      const end = Math.min(500, durationMs);
      return { opacity: [createKeyframe(0, 0), createKeyframe(end, 100)] };
    },
  },
  {
    id: "fade-out",
    label: "Fade Out",
    description: "Opacity 100 → 0% over the last half-second.",
    build: (durationMs) => {
      const start = Math.max(0, durationMs - 500);
      return { opacity: [createKeyframe(start, 100), createKeyframe(durationMs, 0)] };
    },
  },
  {
    id: "slide-in-left",
    label: "Slide In (Left)",
    description: "Enters from off-frame left over the first half-second.",
    build: (durationMs) => {
      const end = Math.min(500, durationMs);
      return {
        position: [
          createKeyframe(0, { x: -120, y: 0 }, { in: { type: "LINEAR" }, out: { type: "EASE_OUT" } }),
          createKeyframe(end, { x: 0, y: 0 }, { in: { type: "EASE_OUT" }, out: { type: "LINEAR" } }),
        ],
      };
    },
  },
  {
    id: "slide-in-right",
    label: "Slide In (Right)",
    description: "Enters from off-frame right over the first half-second.",
    build: (durationMs) => {
      const end = Math.min(500, durationMs);
      return {
        position: [
          createKeyframe(0, { x: 120, y: 0 }, { in: { type: "LINEAR" }, out: { type: "EASE_OUT" } }),
          createKeyframe(end, { x: 0, y: 0 }, { in: { type: "EASE_OUT" }, out: { type: "LINEAR" } }),
        ],
      };
    },
  },
  {
    id: "zoom-in",
    label: "Zoom In",
    description: "Scales up from 60% to 100% over the first half-second.",
    build: (durationMs) => {
      const end = Math.min(500, durationMs);
      return {
        scale: [
          createKeyframe(0, 60, { in: { type: "LINEAR" }, out: { type: "EASE_OUT" } }),
          createKeyframe(end, 100, { in: { type: "EASE_OUT" }, out: { type: "LINEAR" } }),
        ],
      };
    },
  },
  {
    id: "zoom-out",
    label: "Zoom Out",
    description: "Scales down from 100% to 60% over the last half-second.",
    build: (durationMs) => {
      const start = Math.max(0, durationMs - 500);
      return {
        scale: [
          createKeyframe(start, 100, { in: { type: "LINEAR" }, out: { type: "EASE_IN" } }),
          createKeyframe(durationMs, 60, { in: { type: "EASE_IN" }, out: { type: "LINEAR" } }),
        ],
      };
    },
  },
  {
    id: "pop",
    label: "Pop",
    description: "A quick overshoot-scale entrance: 0 → 115% → 100%.",
    build: (durationMs) => {
      const mid = Math.min(250, Math.max(POP_HOLD_MS, Math.round(durationMs * 0.15)));
      const end = Math.min(mid + 150, durationMs);
      return {
        scale: [
          createKeyframe(0, 0, { in: { type: "LINEAR" }, out: { type: "EASE_OUT" } }),
          createKeyframe(mid, 115, { in: { type: "EASE_OUT" }, out: { type: "EASE_IN_OUT" } }),
          createKeyframe(end, 100, { in: { type: "EASE_IN_OUT" }, out: { type: "LINEAR" } }),
        ],
      };
    },
  },
];

// Pure — applies a preset by id to a transform, returning a NEW transform
// (never mutates `current`). Unaffected properties are left exactly as
// they were. Keyframe times are clamped into [0, durationMs] so a preset
// built for a longer clip never places a keyframe past a short clip's end.
export function applyAnimationPreset(current: ClipTransform, presetId: string, durationMs: number): ClipTransform {
  const preset = ANIMATION_PRESETS.find((p) => p.id === presetId);
  if (!preset) return current;
  const built = preset.build(durationMs);
  const clamp = (ms: number) => Math.min(durationMs, Math.max(0, ms));

  const next: ClipTransform = { ...current };
  if (built.opacity) {
    next.opacity = { value: current.opacity.value, keyframes: built.opacity.map((k) => ({ ...k, timeMs: clamp(k.timeMs) })) as EditorKeyframe<number>[] };
  }
  if (built.position) {
    next.position = {
      value: current.position.value,
      keyframes: built.position.map((k) => ({ ...k, timeMs: clamp(k.timeMs) })) as EditorKeyframe<Point2D>[],
    };
  }
  if (built.rotation) {
    next.rotation = { value: current.rotation.value, keyframes: built.rotation.map((k) => ({ ...k, timeMs: clamp(k.timeMs) })) as EditorKeyframe<number>[] };
  }
  if (built.scale) {
    next.scale = { value: current.scale.value, keyframes: built.scale.map((k) => ({ ...k, timeMs: clamp(k.timeMs) })) as EditorKeyframe<number>[] };
  }
  return next;
}
