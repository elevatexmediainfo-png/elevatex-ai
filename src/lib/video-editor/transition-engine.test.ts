import { describe, expect, it } from "vitest";

import {
  combineResolvedWithTransitionBlend,
  DEFAULT_TRANSITION_EASING,
  defaultDirectionFor,
  resolveAudioTransitionGain,
  resolveTransitionBlend,
  resolveTransitionProgress,
  TRANSITION_TYPE_DEFS,
  type TransitionEasing,
} from "./transition-engine";
import { DEFAULT_CLIP_TRANSFORM, resolveClipTransform, type ResolvedTransform } from "./transform";

const LINEAR: TransitionEasing = { type: "LINEAR" };

function resolved(overrides: Partial<ResolvedTransform> = {}): ResolvedTransform {
  return { ...resolveClipTransform(DEFAULT_CLIP_TRANSFORM, 0), ...overrides };
}

describe("resolveTransitionProgress", () => {
  it("LINEAR passes t through unchanged", () => {
    expect(resolveTransitionProgress(LINEAR, 0)).toBeCloseTo(0);
    expect(resolveTransitionProgress(LINEAR, 0.5)).toBeCloseTo(0.5);
    expect(resolveTransitionProgress(LINEAR, 1)).toBeCloseTo(1);
  });

  it("EASE_IN_OUT is symmetric around the midpoint", () => {
    const p = resolveTransitionProgress({ type: "EASE_IN_OUT" }, 0.5);
    expect(p).toBeCloseTo(0.5, 1);
  });

  it("CUSTOM control points are honored", () => {
    // A custom curve identical to LINEAR's (0,0,1,1) should behave the same.
    const p = resolveTransitionProgress({ type: "CUSTOM", x1: 0, y1: 0, x2: 1, y2: 1 }, 0.3);
    expect(p).toBeCloseTo(0.3, 2);
  });
});

describe("resolveTransitionBlend — CROSSFADE", () => {
  it("at t=0, A is fully opaque and B is fully transparent", () => {
    const blend = resolveTransitionBlend("CROSSFADE", null, LINEAR, 0);
    expect(blend.a.opacityMultiplier).toBeCloseTo(1);
    expect(blend.b.opacityMultiplier).toBeCloseTo(0);
  });

  it("at t=1, A is fully transparent and B is fully opaque", () => {
    const blend = resolveTransitionBlend("CROSSFADE", null, LINEAR, 1);
    expect(blend.a.opacityMultiplier).toBeCloseTo(0);
    expect(blend.b.opacityMultiplier).toBeCloseTo(1);
  });

  it("at t=0.5 with LINEAR easing, both are at 50% opacity", () => {
    const blend = resolveTransitionBlend("CROSSFADE", null, LINEAR, 0.5);
    expect(blend.a.opacityMultiplier).toBeCloseTo(0.5);
    expect(blend.b.opacityMultiplier).toBeCloseTo(0.5);
  });

  it("clamps t outside [0,1]", () => {
    expect(resolveTransitionBlend("CROSSFADE", null, LINEAR, -0.5).a.opacityMultiplier).toBeCloseTo(1);
    expect(resolveTransitionBlend("CROSSFADE", null, LINEAR, 1.5).b.opacityMultiplier).toBeCloseTo(1);
  });

  it("never touches transform/insets — opacity only", () => {
    const blend = resolveTransitionBlend("CROSSFADE", null, LINEAR, 0.5);
    expect(blend.a.translateXPercent).toBe(0);
    expect(blend.a.scaleMultiplier).toBe(1);
    expect(blend.a.extraInsets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

describe("resolveTransitionBlend — DISSOLVE", () => {
  it("matches CROSSFADE's opacity curve", () => {
    const dissolve = resolveTransitionBlend("DISSOLVE", null, LINEAR, 0.3);
    const crossfade = resolveTransitionBlend("CROSSFADE", null, LINEAR, 0.3);
    expect(dissolve.a.opacityMultiplier).toBeCloseTo(crossfade.a.opacityMultiplier);
    expect(dissolve.b.opacityMultiplier).toBeCloseTo(crossfade.b.opacityMultiplier);
  });

  it("blur peaks at the midpoint and is ~0 at both edges", () => {
    expect(resolveTransitionBlend("DISSOLVE", null, LINEAR, 0).a.blurPx).toBeCloseTo(0, 1);
    expect(resolveTransitionBlend("DISSOLVE", null, LINEAR, 1).a.blurPx).toBeCloseTo(0, 1);
    expect(resolveTransitionBlend("DISSOLVE", null, LINEAR, 0.5).a.blurPx).toBeGreaterThan(3);
  });
});

describe("resolveTransitionBlend — WIPE", () => {
  it("A stays fully opaque and uninset throughout", () => {
    const blend = resolveTransitionBlend("WIPE", "LEFT", LINEAR, 0.5);
    expect(blend.a.opacityMultiplier).toBe(1);
    expect(blend.a.extraInsets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("LEFT direction: B's right inset shrinks from 100 to 0 as t goes 0->1", () => {
    expect(resolveTransitionBlend("WIPE", "LEFT", LINEAR, 0).b.extraInsets.right).toBeCloseTo(100);
    expect(resolveTransitionBlend("WIPE", "LEFT", LINEAR, 1).b.extraInsets.right).toBeCloseTo(0);
    expect(resolveTransitionBlend("WIPE", "LEFT", LINEAR, 0.25).b.extraInsets.right).toBeCloseTo(75);
  });

  it("each direction insets exactly one side", () => {
    expect(resolveTransitionBlend("WIPE", "RIGHT", LINEAR, 0.5).b.extraInsets.left).toBeCloseTo(50);
    expect(resolveTransitionBlend("WIPE", "UP", LINEAR, 0.5).b.extraInsets.bottom).toBeCloseTo(50);
    expect(resolveTransitionBlend("WIPE", "DOWN", LINEAR, 0.5).b.extraInsets.top).toBeCloseTo(50);
  });
});

describe("resolveTransitionBlend — SLIDE", () => {
  it("LEFT: B enters from -100% to 0%, A exits from 0% to +100%", () => {
    expect(resolveTransitionBlend("SLIDE", "LEFT", LINEAR, 0).b.translateXPercent).toBeCloseTo(-100);
    expect(resolveTransitionBlend("SLIDE", "LEFT", LINEAR, 1).b.translateXPercent).toBeCloseTo(0);
    expect(resolveTransitionBlend("SLIDE", "LEFT", LINEAR, 0).a.translateXPercent).toBeCloseTo(0);
    expect(resolveTransitionBlend("SLIDE", "LEFT", LINEAR, 1).a.translateXPercent).toBeCloseTo(100);
  });

  it("does not touch opacity — a hard push, not a fade", () => {
    const blend = resolveTransitionBlend("SLIDE", "LEFT", LINEAR, 0.5);
    expect(blend.a.opacityMultiplier).toBe(1);
    expect(blend.b.opacityMultiplier).toBe(1);
  });

  it("UP/DOWN move on the Y axis, not X", () => {
    const up = resolveTransitionBlend("SLIDE", "UP", LINEAR, 0.5);
    expect(up.b.translateXPercent).toBe(0);
    expect(up.b.translateYPercent).not.toBe(0);
  });
});

describe("resolveTransitionBlend — ZOOM", () => {
  it("IN: A scales up past 100%, B scales down toward 100%", () => {
    const start = resolveTransitionBlend("ZOOM", "IN", LINEAR, 0);
    const end = resolveTransitionBlend("ZOOM", "IN", LINEAR, 1);
    expect(start.a.scaleMultiplier).toBeCloseTo(1);
    expect(end.a.scaleMultiplier).toBeGreaterThan(1);
    expect(start.b.scaleMultiplier).toBeGreaterThan(1);
    expect(end.b.scaleMultiplier).toBeCloseTo(1);
  });

  it("OUT reverses the roles", () => {
    const end = resolveTransitionBlend("ZOOM", "OUT", LINEAR, 1);
    expect(end.a.scaleMultiplier).toBeLessThan(1);
    expect(end.b.scaleMultiplier).toBeCloseTo(1);
  });
});

describe("resolveTransitionBlend — FLASH", () => {
  it("flashOverlayOpacity peaks at the midpoint and is 0 at both edges", () => {
    expect(resolveTransitionBlend("FLASH", null, LINEAR, 0).flashOverlayOpacity).toBeCloseTo(0, 1);
    expect(resolveTransitionBlend("FLASH", null, LINEAR, 1).flashOverlayOpacity).toBeCloseTo(0, 1);
    expect(resolveTransitionBlend("FLASH", null, LINEAR, 0.5).flashOverlayOpacity).toBeCloseTo(1, 1);
  });

  it("every other type has flashOverlayOpacity === 0 always", () => {
    for (const t of [0, 0.3, 0.5, 0.8, 1]) {
      expect(resolveTransitionBlend("CROSSFADE", null, LINEAR, t).flashOverlayOpacity).toBe(0);
      expect(resolveTransitionBlend("WIPE", "LEFT", LINEAR, t).flashOverlayOpacity).toBe(0);
    }
  });
});

describe("combineResolvedWithTransitionBlend", () => {
  it("multiplies opacity and scale, adds translate, on top of the base resolved transform", () => {
    const base = resolved({ opacity: 80, scaleX: 100, scaleY: 100, x: 5, y: -3 });
    const blend = resolveTransitionBlend("ZOOM", "IN", LINEAR, 1);
    const combined = combineResolvedWithTransitionBlend(base, blend.a);
    expect(combined.opacity).toBeCloseTo(80 * blend.a.opacityMultiplier);
    expect(combined.scaleX).toBeCloseTo(100 * blend.a.scaleMultiplier);
    expect(combined.x).toBeCloseTo(5 + blend.a.translateXPercent);
    expect(combined.y).toBeCloseTo(-3 + blend.a.translateYPercent);
  });

  it("combines crop insets via max (the tighter of the two cuts wins per side)", () => {
    const base = resolved({ crop: { top: 0, right: 60, bottom: 0, left: 0 } });
    const blend = resolveTransitionBlend("WIPE", "LEFT", LINEAR, 0.5); // b.extraInsets.right = 50
    const combined = combineResolvedWithTransitionBlend(base, blend.b);
    expect(combined.crop.right).toBe(60); // 60 > 50, existing crop wins
  });

  it("leaves rotation/flip untouched", () => {
    const base = resolved({ rotation: 15, flipH: true });
    const combined = combineResolvedWithTransitionBlend(base, resolveTransitionBlend("CROSSFADE", null, LINEAR, 0.5).a);
    expect(combined.rotation).toBe(15);
    expect(combined.flipH).toBe(true);
  });
});

describe("resolveAudioTransitionGain", () => {
  it("linearly crossfades gain regardless of visual type", () => {
    expect(resolveAudioTransitionGain(LINEAR, 0)).toEqual({ gainA: 1, gainB: 0 });
    expect(resolveAudioTransitionGain(LINEAR, 1)).toEqual({ gainA: 0, gainB: 1 });
    const mid = resolveAudioTransitionGain(LINEAR, 0.5);
    expect(mid.gainA).toBeCloseTo(0.5);
    expect(mid.gainB).toBeCloseTo(0.5);
  });
});

describe("TRANSITION_TYPE_DEFS / defaultDirectionFor", () => {
  it("every type is present with a stable id", () => {
    const ids = TRANSITION_TYPE_DEFS.map((d) => d.id);
    expect(ids).toEqual(["CROSSFADE", "DISSOLVE", "WIPE", "SLIDE", "ZOOM", "FLASH"]);
  });

  it("directional types have a default direction; non-directional types don't", () => {
    expect(defaultDirectionFor("WIPE")).toBe("LEFT");
    expect(defaultDirectionFor("SLIDE")).toBe("LEFT");
    expect(defaultDirectionFor("ZOOM")).toBe("IN");
    expect(defaultDirectionFor("CROSSFADE")).toBeNull();
    expect(defaultDirectionFor("FLASH")).toBeNull();
  });
});

describe("DEFAULT_TRANSITION_EASING", () => {
  it("is EASE_IN_OUT", () => {
    expect(DEFAULT_TRANSITION_EASING).toEqual({ type: "EASE_IN_OUT" });
  });
});
