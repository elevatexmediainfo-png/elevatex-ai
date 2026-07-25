import { describe, expect, it } from "vitest";

import {
  addOrUpdateKeyframe,
  allShareValue,
  ANIMATION_PRESETS,
  applyAnimationPreset,
  composeTransformCss,
  createKeyframe,
  deleteKeyframe,
  DEFAULT_CLIP_TRANSFORM,
  DEFAULT_KEYFRAME_EASING,
  easeSegment,
  findKeyframeAt,
  keyframeableToKeyframed,
  keyframeableToStatic,
  lerpValue,
  moveKeyframe,
  resolveClipTransform,
  resolveTransformValue,
  setKeyframeEasing,
  solveCubicBezier,
  updateKeyframeValue,
  type ClipTransform,
  type EditorKeyframe,
} from "./transform";

describe("resolveTransformValue", () => {
  it("returns the static value when keyframes is null", () => {
    expect(resolveTransformValue({ value: 42, keyframes: null }, 1000)).toBe(42);
  });

  it("returns the static value when keyframes is an empty array", () => {
    expect(resolveTransformValue({ value: 7, keyframes: [] }, 1000)).toBe(7);
  });

  it("returns a single keyframe's value regardless of time", () => {
    const kf = createKeyframe(500, 10);
    expect(resolveTransformValue({ value: 0, keyframes: [kf] }, 0)).toBe(10);
    expect(resolveTransformValue({ value: 0, keyframes: [kf] }, 9999)).toBe(10);
  });

  it("clamps to the first keyframe's value before it and the last keyframe's value after it", () => {
    const keyframes: EditorKeyframe<number>[] = [createKeyframe(100, 0), createKeyframe(200, 100)];
    expect(resolveTransformValue({ value: -1, keyframes }, 0)).toBe(0);
    expect(resolveTransformValue({ value: -1, keyframes }, 500)).toBe(100);
  });

  it("linearly interpolates numbers between two LINEAR keyframes", () => {
    const keyframes: EditorKeyframe<number>[] = [createKeyframe(0, 0), createKeyframe(100, 100)];
    expect(resolveTransformValue({ value: -1, keyframes }, 50)).toBeCloseTo(50, 5);
    expect(resolveTransformValue({ value: -1, keyframes }, 25)).toBeCloseTo(25, 5);
  });

  it("interpolates Point2D and CropRect the same way as numbers", () => {
    const posKeyframes: EditorKeyframe<{ x: number; y: number }>[] = [
      createKeyframe(0, { x: 0, y: 0 }),
      createKeyframe(100, { x: 100, y: -50 }),
    ];
    expect(resolveTransformValue({ value: { x: -1, y: -1 }, keyframes: posKeyframes }, 50)).toEqual({ x: 50, y: -25 });

    const cropKeyframes: EditorKeyframe<{ top: number; right: number; bottom: number; left: number }>[] = [
      createKeyframe(0, { top: 0, right: 0, bottom: 0, left: 0 }),
      createKeyframe(100, { top: 20, right: 40, bottom: 60, left: 80 }),
    ];
    expect(
      resolveTransformValue({ value: { top: -1, right: -1, bottom: -1, left: -1 }, keyframes: cropKeyframes }, 50)
    ).toEqual({ top: 10, right: 20, bottom: 30, left: 40 });
  });

  it("resolves independently across multiple segments (3+ keyframes)", () => {
    const keyframes: EditorKeyframe<number>[] = [createKeyframe(0, 0), createKeyframe(100, 100), createKeyframe(200, 0)];
    expect(resolveTransformValue({ value: -1, keyframes }, 100)).toBe(100);
    expect(resolveTransformValue({ value: -1, keyframes }, 150)).toBeCloseTo(50, 5);
    expect(resolveTransformValue({ value: -1, keyframes }, 50)).toBeCloseTo(50, 5);
  });

  it("sorts out-of-order keyframes before resolving", () => {
    const keyframes: EditorKeyframe<number>[] = [createKeyframe(100, 100), createKeyframe(0, 0)];
    expect(resolveTransformValue({ value: -1, keyframes }, 50)).toBeCloseTo(50, 5);
  });
});

describe("solveCubicBezier / easeSegment", () => {
  it("is the identity function for the LINEAR preset's control points (0,0)-(1,1)", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(solveCubicBezier(t, 0, 0, 1, 1)).toBeCloseTo(t, 3);
    }
  });

  it("clamps outside [0,1]", () => {
    expect(solveCubicBezier(-1, 0.42, 0, 0.58, 1)).toBe(0);
    expect(solveCubicBezier(2, 0.42, 0, 0.58, 1)).toBe(1);
  });

  it("EASE_IN starts slower than linear (eased value < t for small t)", () => {
    const eased = easeSegment(0.25, { type: "EASE_IN" }, { type: "EASE_IN" });
    expect(eased).toBeLessThan(0.25);
  });

  it("EASE_OUT starts faster than linear (eased value > t for small t)", () => {
    const eased = easeSegment(0.25, { type: "EASE_OUT" }, { type: "EASE_OUT" });
    expect(eased).toBeGreaterThan(0.25);
  });

  it("endpoints are always exactly 0 and 1 regardless of easing", () => {
    for (const side of [{ type: "LINEAR" }, { type: "EASE_IN" }, { type: "EASE_OUT" }, { type: "EASE_IN_OUT" }] as const) {
      expect(easeSegment(0, side, side)).toBeCloseTo(0, 5);
      expect(easeSegment(1, side, side)).toBeCloseTo(1, 5);
    }
  });

  it("supports a CUSTOM control point on either side", () => {
    const custom = easeSegment(0.5, { type: "CUSTOM", point: { x: 0.9, y: 0.1 } }, { type: "CUSTOM", point: { x: 0.1, y: 0.9 } });
    expect(custom).toBeGreaterThanOrEqual(0);
    expect(custom).toBeLessThanOrEqual(1);
  });

  it("blends asymmetric in/out sides from two different keyframes", () => {
    // A departs with EASE_IN (slow start), B arrives with EASE_OUT (slow
    // end) — the segment should be slower at both ends than pure linear.
    const eased = easeSegment(0.1, { type: "EASE_IN" }, { type: "EASE_OUT" });
    expect(eased).toBeLessThan(0.1);
  });
});

describe("lerpValue", () => {
  it("interpolates numbers", () => {
    expect(lerpValue(0, 10, 0.5)).toBe(5);
  });
  it("interpolates Point2D", () => {
    expect(lerpValue({ x: 0, y: 10 }, { x: 10, y: 0 }, 0.5)).toEqual({ x: 5, y: 5 });
  });
  it("interpolates CropRect", () => {
    expect(lerpValue({ top: 0, right: 0, bottom: 0, left: 0 }, { top: 10, right: 20, bottom: 30, left: 40 }, 0.5)).toEqual({
      top: 5,
      right: 10,
      bottom: 15,
      left: 20,
    });
  });
});

describe("createKeyframe", () => {
  it("assigns a unique id and defaults to linear easing", () => {
    const a = createKeyframe(0, 1);
    const b = createKeyframe(0, 1);
    expect(a.id).not.toBe(b.id);
    expect(a.easing).toEqual(DEFAULT_KEYFRAME_EASING);
  });
});

describe("ANIMATION_PRESETS / applyAnimationPreset", () => {
  it("every preset has a unique id", () => {
    const ids = ANIMATION_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fade-in writes opacity keyframes from 0 to 100 and leaves other properties untouched", () => {
    const next = applyAnimationPreset(DEFAULT_CLIP_TRANSFORM, "fade-in", 4000);
    expect(next.opacity.keyframes).not.toBeNull();
    expect(next.opacity.keyframes![0].value).toBe(0);
    expect(next.opacity.keyframes![next.opacity.keyframes!.length - 1].value).toBe(100);
    expect(next.position).toEqual(DEFAULT_CLIP_TRANSFORM.position);
    expect(next.scale).toEqual(DEFAULT_CLIP_TRANSFORM.scale);
  });

  it("clamps preset keyframe times into a short clip's duration", () => {
    const next = applyAnimationPreset(DEFAULT_CLIP_TRANSFORM, "fade-in", 100);
    for (const kf of next.opacity.keyframes!) {
      expect(kf.timeMs).toBeGreaterThanOrEqual(0);
      expect(kf.timeMs).toBeLessThanOrEqual(100);
    }
  });

  it("slide-in-left writes position keyframes starting off-frame", () => {
    const next = applyAnimationPreset(DEFAULT_CLIP_TRANSFORM, "slide-in-left", 4000);
    expect(next.position.keyframes![0].value.x).toBeLessThan(0);
    expect(next.position.keyframes![next.position.keyframes!.length - 1].value).toEqual({ x: 0, y: 0 });
  });

  it("is a no-op for an unknown preset id", () => {
    expect(applyAnimationPreset(DEFAULT_CLIP_TRANSFORM, "not-a-real-preset", 4000)).toEqual(DEFAULT_CLIP_TRANSFORM);
  });

  it("resolveTransformValue interpolates smoothly through an applied preset (not just at keyframe points)", () => {
    const next = applyAnimationPreset(DEFAULT_CLIP_TRANSFORM, "fade-in", 4000);
    const quarter = resolveTransformValue(next.opacity, 125);
    expect(quarter).toBeGreaterThan(0);
    expect(quarter).toBeLessThan(100);
  });
});

describe("resolveClipTransform", () => {
  it("returns every default when transform is null", () => {
    const resolved = resolveClipTransform(null, 0);
    expect(resolved).toEqual({
      scaleX: 100,
      scaleY: 100,
      x: 0,
      y: 0,
      rotation: 0,
      opacity: 100,
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      flipH: false,
      flipV: false,
      blendMode: "normal",
    });
  });

  it("uses scale for scaleY when scaleY is null (uniform)", () => {
    const t: ClipTransform = { ...DEFAULT_CLIP_TRANSFORM, scale: { value: 150, keyframes: null } };
    expect(resolveClipTransform(t, 0).scaleY).toBe(150);
  });

  it("uses scaleY independently when set (non-uniform)", () => {
    const t: ClipTransform = {
      ...DEFAULT_CLIP_TRANSFORM,
      scale: { value: 150, keyframes: null },
      scaleY: { value: 80, keyframes: null },
    };
    const resolved = resolveClipTransform(t, 0);
    expect(resolved.scaleX).toBe(150);
    expect(resolved.scaleY).toBe(80);
  });

  it("resolves position/rotation/opacity/crop/flip from the given transform", () => {
    const t: ClipTransform = {
      scale: { value: 100, keyframes: null },
      scaleY: null,
      position: { value: { x: 12, y: -8 }, keyframes: null },
      rotation: { value: 45, keyframes: null },
      opacity: { value: 60, keyframes: null },
      crop: { value: { top: 5, right: 10, bottom: 5, left: 10 }, keyframes: null },
      flipH: true,
      flipV: false,
      blendMode: "multiply",
    };
    expect(resolveClipTransform(t, 0)).toEqual({
      scaleX: 100,
      scaleY: 100,
      x: 12,
      y: -8,
      rotation: 45,
      opacity: 60,
      crop: { top: 5, right: 10, bottom: 5, left: 10 },
      flipH: true,
      flipV: false,
      blendMode: "multiply",
    });
  });
});

describe("composeTransformCss", () => {
  it("composes an identity transform for the default resolved values", () => {
    const css = composeTransformCss(resolveClipTransform(null, 0));
    expect(css.transform).toBe("translate(0%, 0%) rotate(0deg) scale(1, 1)");
    expect(css.clipPath).toBe("inset(0% 0% 0% 0%)");
    expect(css.opacity).toBe(1);
    expect(css.mixBlendMode).toBe("normal");
  });

  it("passes the resolved blend mode through to mixBlendMode", () => {
    const css = composeTransformCss(resolveClipTransform({ ...DEFAULT_CLIP_TRANSFORM, blendMode: "multiply" }, 0));
    expect(css.mixBlendMode).toBe("multiply");
  });

  it("negates scale on the flipped axis", () => {
    const resolved = resolveClipTransform({ ...DEFAULT_CLIP_TRANSFORM, flipH: true, flipV: true }, 0);
    const css = composeTransformCss(resolved);
    expect(css.transform).toBe("translate(0%, 0%) rotate(0deg) scale(-1, -1)");
  });

  it("converts opacity percentage to a 0..1 CSS value, clamped", () => {
    expect(composeTransformCss(resolveClipTransform({ ...DEFAULT_CLIP_TRANSFORM, opacity: { value: 50, keyframes: null } }, 0)).opacity).toBe(0.5);
    expect(composeTransformCss(resolveClipTransform({ ...DEFAULT_CLIP_TRANSFORM, opacity: { value: 150, keyframes: null } }, 0)).opacity).toBe(1);
    expect(composeTransformCss(resolveClipTransform({ ...DEFAULT_CLIP_TRANSFORM, opacity: { value: -20, keyframes: null } }, 0)).opacity).toBe(0);
  });

  it("maps crop insets onto clip-path inset() in top/right/bottom/left order", () => {
    const resolved = resolveClipTransform(
      { ...DEFAULT_CLIP_TRANSFORM, crop: { value: { top: 1, right: 2, bottom: 3, left: 4 }, keyframes: null } },
      0
    );
    expect(composeTransformCss(resolved).clipPath).toBe("inset(1% 2% 3% 4%)");
  });
});

describe("allShareValue", () => {
  it("is true for an empty or single-element array", () => {
    expect(allShareValue([])).toBe(true);
    expect(allShareValue([5])).toBe(true);
  });

  it("is true when every value is deep-equal", () => {
    expect(allShareValue([{ x: 1, y: 2 }, { x: 1, y: 2 }])).toBe(true);
  });

  it("is false when any value differs", () => {
    expect(allShareValue([{ x: 1, y: 2 }, { x: 1, y: 3 }])).toBe(false);
    expect(allShareValue([100, 100, 90])).toBe(false);
  });
});

describe("keyframe CRUD helpers", () => {
  it("keyframeableToKeyframed bakes the current static value as the first keyframe", () => {
    const next = keyframeableToKeyframed({ value: 42, keyframes: null }, 300);
    expect(next.keyframes).toHaveLength(1);
    expect(next.keyframes![0]).toMatchObject({ timeMs: 300, value: 42 });
  });

  it("keyframeableToKeyframed is a no-op when already keyframed", () => {
    const kf = createKeyframe(0, 1);
    const prop = { value: 1, keyframes: [kf] };
    expect(keyframeableToKeyframed(prop, 500)).toBe(prop);
  });

  it("keyframeableToStatic bakes the interpolated value at atMs and drops keyframes", () => {
    const keyframes: EditorKeyframe<number>[] = [createKeyframe(0, 0), createKeyframe(100, 100)];
    const next = keyframeableToStatic({ value: -1, keyframes }, 50);
    expect(next.keyframes).toBeNull();
    expect(next.value).toBeCloseTo(50, 5);
  });

  it("addOrUpdateKeyframe inserts a new keyframe in sorted order", () => {
    const keyframes: EditorKeyframe<number>[] = [createKeyframe(0, 0), createKeyframe(100, 100)];
    const next = addOrUpdateKeyframe({ value: 0, keyframes }, 50, 25);
    expect(next.keyframes!.map((k) => k.timeMs)).toEqual([0, 50, 100]);
    expect(next.keyframes![1].value).toBe(25);
  });

  it("addOrUpdateKeyframe replaces the value at an existing exact time instead of duplicating", () => {
    const keyframes: EditorKeyframe<number>[] = [createKeyframe(0, 0), createKeyframe(100, 100)];
    const next = addOrUpdateKeyframe({ value: 0, keyframes }, 100, 999);
    expect(next.keyframes).toHaveLength(2);
    expect(next.keyframes!.find((k) => k.timeMs === 100)?.value).toBe(999);
  });

  it("addOrUpdateKeyframe on a static (null-keyframes) property starts a fresh array", () => {
    const next = addOrUpdateKeyframe({ value: 5, keyframes: null }, 0, 5);
    expect(next.keyframes).toHaveLength(1);
  });

  it("updateKeyframeValue only touches the matching id", () => {
    const a = createKeyframe(0, 1);
    const b = createKeyframe(100, 2);
    const next = updateKeyframeValue({ value: 0, keyframes: [a, b] }, b.id, 99);
    expect(next.keyframes!.find((k) => k.id === a.id)?.value).toBe(1);
    expect(next.keyframes!.find((k) => k.id === b.id)?.value).toBe(99);
  });

  it("moveKeyframe retimes and re-sorts", () => {
    const a = createKeyframe(0, "a");
    const b = createKeyframe(100, "b");
    const next = moveKeyframe({ value: "a", keyframes: [a, b] }, b.id, 10);
    expect(next.keyframes!.map((k) => k.timeMs)).toEqual([0, 10]);
  });

  it("moveKeyframe clamps to a minimum of 0", () => {
    const a = createKeyframe(50, "a");
    const next = moveKeyframe({ value: "a", keyframes: [a] }, a.id, -30);
    expect(next.keyframes![0].timeMs).toBe(0);
  });

  it("setKeyframeEasing updates only the given side", () => {
    const a = createKeyframe(0, 1);
    const next = setKeyframeEasing({ value: 1, keyframes: [a] }, a.id, "out", { type: "EASE_OUT" });
    expect(next.keyframes![0].easing.out).toEqual({ type: "EASE_OUT" });
    expect(next.keyframes![0].easing.in).toEqual({ type: "LINEAR" });
  });

  it("deleteKeyframe removes the matching keyframe", () => {
    const a = createKeyframe(0, 1);
    const b = createKeyframe(100, 2);
    const next = deleteKeyframe({ value: 1, keyframes: [a, b] }, a.id);
    expect(next.keyframes).toHaveLength(1);
    expect(next.keyframes![0].id).toBe(b.id);
  });

  it("deleteKeyframe bakes the deleted keyframe's value as static when it was the last one", () => {
    const a = createKeyframe(50, 77);
    const next = deleteKeyframe({ value: 0, keyframes: [a] }, a.id);
    expect(next.keyframes).toBeNull();
    expect(next.value).toBe(77);
  });

  it("findKeyframeAt matches only an exact time", () => {
    const a = createKeyframe(50, 1);
    expect(findKeyframeAt({ value: 0, keyframes: [a] }, 50)).toBe(a);
    expect(findKeyframeAt({ value: 0, keyframes: [a] }, 51)).toBeNull();
    expect(findKeyframeAt({ value: 0, keyframes: null }, 50)).toBeNull();
  });
});
