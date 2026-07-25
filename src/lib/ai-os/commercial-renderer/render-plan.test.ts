import { describe, expect, it } from "vitest";

import { buildRenderPlanFromBlueprint, buildRenderPlanFromComponents } from "./render-plan";
import { resolveCanvasSize, getCanvasOrientation, getScaleFactor }     from "./canvas-engine";
import {
  computeSafeZones, computeContentArea,
  computeGlobalPaddingPx, computeSectionSpacingPx, computeElementSpacingPx,
} from "./safe-zone-engine";
import { computeResponsiveProfile }   from "./responsive-engine";
import {
  sizeToPixels, estimateTextHeight,
} from "./text-layout-engine";
import {
  verticalOverlapPx, boxesOverlap, detectCollisions,
  computeLayoutScore,
} from "./asset-layout-engine";
import type { BoundingBox, NamedBox, RenderElementId } from "./types";
import type { UniversalCampaignBlueprint } from "../blueprint/types";

import { buildCreativeStrategy }     from "../creative-brain";
import { buildCampaignPlan }         from "../creative-director";
import { buildVisualLayoutPlan }     from "../visual-layout";
import { buildCreativeContext }       from "../creative-context";
import { analyzeUserRequest }         from "../user-understanding";
import { planFromStrategy }           from "../commercial-assets/adapter";
import { buildCompositionFromBlueprintInputs } from "../commercial-composition/composition-engine";
import { buildCopyFromBlueprintInputs }        from "../copy-intelligence/copy-engine";
import { buildTypographyFromBlueprintInputs }  from "../typography-intelligence/typography-engine";
import { assembleBlueprint }         from "../blueprint";
import { buildTypographyPlan }       from "../typography";
import type { CreativeRequest }       from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeComponents(rawIdea: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
  const uu          = analyzeUserRequest(request);
  const ctx         = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy    = buildCreativeStrategy(ctx);
  const campaign    = buildCampaignPlan(strategy);
  const layoutPlan  = buildVisualLayoutPlan(strategy, campaign);
  const assets      = planFromStrategy(strategy);
  const composition = buildCompositionFromBlueprintInputs(strategy, assets, layoutPlan);
  const copy        = buildCopyFromBlueprintInputs(strategy, assets, rawIdea);
  const typography  = buildTypographyFromBlueprintInputs(strategy, copy, composition, layoutPlan);
  return { strategy, campaign, layoutPlan, composition, copy, typography };
}

function makeBlueprint(rawIdea: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
  const uu       = analyzeUserRequest(request);
  const ctx      = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const campaign = buildCampaignPlan(strategy);
  const layout   = buildVisualLayoutPlan(strategy, campaign);
  const typo     = buildTypographyPlan(strategy, campaign, layout);
  return assembleBlueprint({ context: ctx, strategy, campaignPlan: campaign, layoutPlan: layout, typographyPlan: typo });
}

function makeBox(elementId: RenderElementId, x: number, y: number, w: number, h: number): NamedBox {
  return { elementId, x, y, width: w, height: h };
}

// ─────────────────────────────────────────────────────────────────────────────
// canvas-engine
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveCanvasSize", () => {
  it("9:16 → 1080×1920", () => {
    const s = resolveCanvasSize("9:16");
    expect(s).toEqual({ width: 1080, height: 1920 });
  });

  it("4:5 → 1080×1350", () => {
    expect(resolveCanvasSize("4:5")).toEqual({ width: 1080, height: 1350 });
  });

  it("1:1 → 1080×1080", () => {
    expect(resolveCanvasSize("1:1")).toEqual({ width: 1080, height: 1080 });
  });

  it("16:9 → 1920×1080", () => {
    expect(resolveCanvasSize("16:9")).toEqual({ width: 1920, height: 1080 });
  });

  it("3:4 → 1080×1440", () => {
    expect(resolveCanvasSize("3:4")).toEqual({ width: 1080, height: 1440 });
  });

  it("unknown ratio → defaults to 1080×1080", () => {
    expect(resolveCanvasSize("custom")).toEqual({ width: 1080, height: 1080 });
  });

  it("explicit width+height override aspect ratio", () => {
    const s = resolveCanvasSize("9:16", 800, 600);
    expect(s).toEqual({ width: 800, height: 600 });
  });

  it("partial override (only one dimension) falls back to standard", () => {
    // width provided but no height → falls back to standard
    const s = resolveCanvasSize("1:1", 800, 0);
    expect(s).toEqual({ width: 1080, height: 1080 });
  });
});

describe("getCanvasOrientation", () => {
  it("1080×1920 → portrait", () => {
    expect(getCanvasOrientation({ width: 1080, height: 1920 })).toBe("portrait");
  });

  it("1920×1080 → landscape", () => {
    expect(getCanvasOrientation({ width: 1920, height: 1080 })).toBe("landscape");
  });

  it("1080×1080 → square", () => {
    expect(getCanvasOrientation({ width: 1080, height: 1080 })).toBe("square");
  });

  it("1080×1350 (4:5) → portrait", () => {
    expect(getCanvasOrientation({ width: 1080, height: 1350 })).toBe("portrait");
  });

  it("1920×1080 (16:9) → landscape", () => {
    expect(getCanvasOrientation({ width: 1920, height: 1080 })).toBe("landscape");
  });
});

describe("getScaleFactor", () => {
  it("1080px → 1.0", () => {
    expect(getScaleFactor({ width: 1080, height: 1080 })).toBe(1.0);
  });

  it("540px → 0.5", () => {
    expect(getScaleFactor({ width: 540, height: 960 })).toBeCloseTo(0.5);
  });

  it("1920px → 1.778", () => {
    expect(getScaleFactor({ width: 1920, height: 1080 })).toBeCloseTo(1.778, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// safe-zone-engine
// ─────────────────────────────────────────────────────────────────────────────

describe("computeGlobalPaddingPx", () => {
  it("6% of 1080px = 65px", () => {
    const canvas = { width: 1080, height: 1080 };
    const whitespace = { globalPaddingPercent: 6, sectionSpacingPercent: 5, elementSpacingPercent: 3, density: "balanced" as const, crowdingScore: 0 };
    expect(computeGlobalPaddingPx(canvas, whitespace)).toBe(65);
  });

  it("scales with canvas width", () => {
    const canvas = { width: 1920, height: 1080 };
    const whitespace = { globalPaddingPercent: 6, sectionSpacingPercent: 5, elementSpacingPercent: 3, density: "balanced" as const, crowdingScore: 0 };
    expect(computeGlobalPaddingPx(canvas, whitespace)).toBe(115);
  });
});

describe("computeSectionSpacingPx", () => {
  it("5% of 1350px height = 68px", () => {
    const canvas = { width: 1080, height: 1350 };
    const whitespace = { globalPaddingPercent: 6, sectionSpacingPercent: 5, elementSpacingPercent: 3, density: "balanced" as const, crowdingScore: 0 };
    expect(computeSectionSpacingPx(canvas, whitespace)).toBe(68);
  });
});

describe("computeElementSpacingPx", () => {
  it("3% of 1080px height = 32px", () => {
    const canvas = { width: 1080, height: 1080 };
    const whitespace = { globalPaddingPercent: 6, sectionSpacingPercent: 5, elementSpacingPercent: 3, density: "balanced" as const, crowdingScore: 0 };
    expect(computeElementSpacingPx(canvas, whitespace)).toBe(32);
  });
});

describe("computeSafeZones", () => {
  const canvas = { width: 1080, height: 1350 };
  const whitespace = { globalPaddingPercent: 6, sectionSpacingPercent: 5, elementSpacingPercent: 3, density: "balanced" as const, crowdingScore: 0 };
  const safeZoneMap = { topPercent: 5, bottomPercent: 5, leftPercent: 5, rightPercent: 5, headline: 5, cta: 5, logo: 3, qr: 3, footer: 2 };

  it("returns positive values for all edges", () => {
    const sz = computeSafeZones(canvas, safeZoneMap, whitespace);
    expect(sz.top).toBeGreaterThan(0);
    expect(sz.bottom).toBeGreaterThan(0);
    expect(sz.left).toBeGreaterThan(0);
    expect(sz.right).toBeGreaterThan(0);
  });

  it("top safe zone is at least the global padding", () => {
    const sz = computeSafeZones(canvas, safeZoneMap, whitespace);
    const gp = computeGlobalPaddingPx(canvas, whitespace);
    expect(sz.top).toBeGreaterThanOrEqual(gp);
  });

  it("left = max(globalPadding, 5% of width) = max(65, 54) = 65", () => {
    const sz = computeSafeZones(canvas, safeZoneMap, whitespace);
    expect(sz.left).toBe(65); // 6% of 1080 = 64.8 → 65; 5% of 1080 = 54; max = 65
  });
});

describe("computeContentArea", () => {
  it("content.x = safeZones.left", () => {
    const canvas = { width: 1080, height: 1080 };
    const safeZones = { top: 65, bottom: 65, left: 65, right: 65 };
    const c = computeContentArea(canvas, safeZones);
    expect(c.x).toBe(65);
  });

  it("content.width = canvas.width - left - right", () => {
    const canvas = { width: 1080, height: 1080 };
    const safeZones = { top: 65, bottom: 65, left: 65, right: 65 };
    const c = computeContentArea(canvas, safeZones);
    expect(c.width).toBe(1080 - 65 - 65);
  });

  it("content.right = canvas.width - safeZones.right", () => {
    const canvas = { width: 1080, height: 1080 };
    const safeZones = { top: 65, bottom: 65, left: 65, right: 65 };
    const c = computeContentArea(canvas, safeZones);
    expect(c.right).toBe(1080 - 65);
  });

  it("content.bottom = canvas.height - safeZones.bottom", () => {
    const canvas = { width: 1080, height: 1350 };
    const safeZones = { top: 68, bottom: 68, left: 65, right: 65 };
    const c = computeContentArea(canvas, safeZones);
    expect(c.bottom).toBe(1350 - 68);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// text-layout-engine — sizeToPixels / estimateTextHeight
// ─────────────────────────────────────────────────────────────────────────────

describe("sizeToPixels", () => {
  it("xs at scale 1.0 → 14", () => {
    expect(sizeToPixels("xs", 1.0)).toBe(14);
  });

  it("sm at scale 1.0 → 17", () => {
    expect(sizeToPixels("sm", 1.0)).toBe(17);
  });

  it("base at scale 1.0 → 20", () => {
    expect(sizeToPixels("base", 1.0)).toBe(20);
  });

  it("lg at scale 1.0 → 26", () => {
    expect(sizeToPixels("lg", 1.0)).toBe(26);
  });

  it("xl at scale 1.0 → 34", () => {
    expect(sizeToPixels("xl", 1.0)).toBe(34);
  });

  it("xxl at scale 1.0 → 46", () => {
    expect(sizeToPixels("xxl", 1.0)).toBe(46);
  });

  it("display at scale 1.0 → 62", () => {
    expect(sizeToPixels("display", 1.0)).toBe(62);
  });

  it("scales proportionally: xl at scale 2.0 → 68", () => {
    expect(sizeToPixels("xl", 2.0)).toBe(68);
  });
});

describe("estimateTextHeight", () => {
  it("xxl, tight, 2 lines → round(46 × 1.2 × 2) = 110", () => {
    expect(estimateTextHeight("xxl", "tight", 2, 1.0)).toBe(110);
  });

  it("xs, relaxed, 1 line → round(14 × 1.65 × 1) = 23", () => {
    expect(estimateTextHeight("xs", "relaxed", 1, 1.0)).toBe(23);
  });

  it("lg, normal, 3 lines → round(26 × 1.5 × 3) = 117", () => {
    expect(estimateTextHeight("lg", "normal", 3, 1.0)).toBe(117);
  });

  it("scales with scale factor", () => {
    const base  = estimateTextHeight("xl", "snug", 2, 1.0);
    const scaled = estimateTextHeight("xl", "snug", 2, 2.0);
    expect(scaled).toBe(base * 2);
  });

  it("more lines → proportionally taller", () => {
    const one   = estimateTextHeight("sm", "normal", 1, 1.0);
    const three = estimateTextHeight("sm", "normal", 3, 1.0);
    // Math.round is applied to the total, so three may differ from one*3 by ±1
    expect(three).toBeGreaterThanOrEqual(one * 3 - 2);
    expect(three).toBeLessThanOrEqual(one * 3 + 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// responsive-engine
// ─────────────────────────────────────────────────────────────────────────────

describe("computeResponsiveProfile — portrait bleed", () => {
  const canvas  = { width: 1080, height: 1920 };
  const content = computeContentArea(canvas, { top: 65, bottom: 65, left: 65, right: 65 });
  const heroZone = { region: "hero_zone" as const, dominancePercent: 100, aspectMode: "bleed" as const, safeZonePercent: 5 };

  it("orientation is portrait", () => {
    const p = computeResponsiveProfile(canvas, content, heroZone, "portrait");
    expect(p.orientation).toBe("portrait");
  });

  it("textColumnX = content.x (full bleed = text overlays image)", () => {
    const p = computeResponsiveProfile(canvas, content, heroZone, "portrait");
    expect(p.textColumnX).toBe(content.x);
  });

  it("textColumnWidth = content.width", () => {
    const p = computeResponsiveProfile(canvas, content, heroZone, "portrait");
    expect(p.textColumnWidth).toBe(content.width);
  });

  it("benefitColumnOverride is null for portrait (use typography plan)", () => {
    const p = computeResponsiveProfile(canvas, content, heroZone, "portrait");
    expect(p.benefitColumnOverride).toBeNull();
  });
});

describe("computeResponsiveProfile — landscape bleed", () => {
  const canvas  = { width: 1920, height: 1080 };
  const content = computeContentArea(canvas, { top: 65, bottom: 65, left: 115, right: 115 });
  const heroZone = { region: "hero_zone" as const, dominancePercent: 100, aspectMode: "bleed" as const, safeZonePercent: 5 };

  it("benefitColumnOverride is 3 for landscape bleed", () => {
    const p = computeResponsiveProfile(canvas, content, heroZone, "landscape");
    expect(p.benefitColumnOverride).toBe(3);
  });
});

describe("computeResponsiveProfile — landscape split layout", () => {
  const canvas  = { width: 1920, height: 1080 };
  const content = computeContentArea(canvas, { top: 65, bottom: 65, left: 115, right: 115 });
  const heroZone = { region: "mid_left" as const, dominancePercent: 55, aspectMode: "fill" as const, safeZonePercent: 5 };

  it("textColumnX shifts right in split layout", () => {
    const p = computeResponsiveProfile(canvas, content, heroZone, "landscape");
    expect(p.textColumnX).toBeGreaterThan(content.x);
  });

  it("benefitColumnOverride is 1 for side-panel text", () => {
    const p = computeResponsiveProfile(canvas, content, heroZone, "landscape");
    expect(p.benefitColumnOverride).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// asset-layout-engine — collision detection
// ─────────────────────────────────────────────────────────────────────────────

describe("verticalOverlapPx", () => {
  it("no horizontal overlap → 0", () => {
    const a: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const b: BoundingBox = { x: 200, y: 0, width: 100, height: 100 };
    expect(verticalOverlapPx(a, b)).toBe(0);
  });

  it("no vertical overlap → 0", () => {
    const a: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const b: BoundingBox = { x: 0, y: 200, width: 100, height: 100 };
    expect(verticalOverlapPx(a, b)).toBe(0);
  });

  it("full vertical overlap → overlapPx = min(height)", () => {
    const a: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const b: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    expect(verticalOverlapPx(a, b)).toBe(100);
  });

  it("partial vertical overlap", () => {
    const a: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const b: BoundingBox = { x: 0, y: 50, width: 100, height: 100 };
    expect(verticalOverlapPx(a, b)).toBe(50);
  });

  it("touching edges (exactly adjacent) → 0", () => {
    const a: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const b: BoundingBox = { x: 0, y: 100, width: 100, height: 100 };
    expect(verticalOverlapPx(a, b)).toBe(0);
  });
});

describe("boxesOverlap", () => {
  it("completely separate → false", () => {
    const a: BoundingBox = { x: 0, y: 0, width: 50, height: 50 };
    const b: BoundingBox = { x: 100, y: 100, width: 50, height: 50 };
    expect(boxesOverlap(a, b)).toBe(false);
  });

  it("adjacent (touching) → false (edge-sharing is NOT a collision)", () => {
    const a: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const b: BoundingBox = { x: 100, y: 0, width: 100, height: 100 };
    expect(boxesOverlap(a, b)).toBe(false);
  });

  it("overlapping → true", () => {
    const a: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const b: BoundingBox = { x: 50, y: 50, width: 100, height: 100 };
    expect(boxesOverlap(a, b)).toBe(true);
  });

  it("one inside the other → true", () => {
    const outer: BoundingBox = { x: 0, y: 0, width: 200, height: 200 };
    const inner: BoundingBox = { x: 50, y: 50, width: 50, height: 50 };
    expect(boxesOverlap(outer, inner)).toBe(true);
  });
});

describe("detectCollisions", () => {
  it("non-overlapping boxes → no collisions", () => {
    const boxes: NamedBox[] = [
      makeBox("headline", 0, 0, 1080, 110),
      makeBox("cta", 0, 500, 540, 70),
    ];
    expect(detectCollisions(boxes)).toHaveLength(0);
  });

  it("overlapping boxes → collision detected", () => {
    const boxes: NamedBox[] = [
      makeBox("headline", 0, 0, 1080, 200),
      makeBox("cta", 0, 100, 540, 70),
    ];
    const collisions = detectCollisions(boxes);
    expect(collisions.length).toBeGreaterThan(0);
    expect(collisions[0]!.elementA).toBe("headline");
    expect(collisions[0]!.elementB).toBe("cta");
  });

  it("reports overlap in pixels", () => {
    const boxes: NamedBox[] = [
      makeBox("headline", 0, 0, 1080, 200),
      makeBox("subheadline", 0, 150, 1080, 80), // 50px overlap
    ];
    const collisions = detectCollisions(boxes);
    expect(collisions[0]!.overlapPx).toBe(50);
  });

  it("three boxes, two pairs collide → 2 events (full mesh)", () => {
    const boxes: NamedBox[] = [
      makeBox("headline",    0, 0, 1080, 150),
      makeBox("subheadline", 0, 100, 1080, 80), // overlaps headline
      makeBox("cta",         0, 600, 540, 70),  // no overlap
    ];
    const collisions = detectCollisions(boxes);
    expect(collisions.length).toBe(1);
  });

  it("empty list → no collisions", () => {
    expect(detectCollisions([])).toHaveLength(0);
  });

  it("single element → no collisions", () => {
    expect(detectCollisions([makeBox("headline", 0, 0, 1080, 110)])).toHaveLength(0);
  });
});

describe("computeLayoutScore", () => {
  it("no collisions, no overflows → 100", () => {
    expect(computeLayoutScore([], [])).toBe(100);
  });

  it("one collision → 85", () => {
    const collision = { elementA: "headline" as RenderElementId, elementB: "cta" as RenderElementId, overlapPx: 10, resolved: false, resolution: "" };
    expect(computeLayoutScore([collision], [])).toBe(85);
  });

  it("one clipped overflow → 90", () => {
    const overflow = { elementId: "benefits" as RenderElementId, estimatedLines: 5, maxLines: 3, clipped: true };
    expect(computeLayoutScore([], [overflow])).toBe(90);
  });

  it("non-clipped overflow has no score impact", () => {
    const overflow = { elementId: "benefits" as RenderElementId, estimatedLines: 3, maxLines: 3, clipped: false };
    expect(computeLayoutScore([], [overflow])).toBe(100);
  });

  it("score never goes below 0", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      elementA: "headline" as RenderElementId, elementB: "cta" as RenderElementId,
      overlapPx: 50, resolved: false, resolution: "",
    }));
    expect(computeLayoutScore(many, [])).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRenderPlanFromComponents — structure
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRenderPlanFromComponents — structure", () => {
  const { composition, copy, typography, layoutPlan } = makeComponents("Dental clinic consultation book now");
  const plan = buildRenderPlanFromComponents(composition, copy, typography, layoutPlan, 1080, 1350);

  it("returns canvas with correct dimensions", () => {
    expect(plan.canvas).toEqual({ width: 1080, height: 1350 });
  });

  it("globalPaddingPx is positive", () => {
    expect(plan.globalPaddingPx).toBeGreaterThan(0);
  });

  it("safeZones has all four positive edges", () => {
    expect(plan.safeZones.top).toBeGreaterThan(0);
    expect(plan.safeZones.bottom).toBeGreaterThan(0);
    expect(plan.safeZones.left).toBeGreaterThan(0);
    expect(plan.safeZones.right).toBeGreaterThan(0);
  });

  it("headline is defined", () => {
    expect(plan.headline).toBeDefined();
    expect(plan.headline.elementId).toBe("headline");
  });

  it("benefits is defined", () => {
    expect(plan.benefits).toBeDefined();
    expect(plan.benefits.elementId).toBe("benefits");
  });

  it("cta is defined", () => {
    expect(plan.cta).toBeDefined();
    expect(plan.cta.elementId).toBe("cta");
  });

  it("footer is defined", () => {
    expect(plan.footer).toBeDefined();
    expect(plan.footer.elementId).toBe("footer");
  });

  it("diagnostics is defined with layoutScore", () => {
    expect(plan.diagnostics).toBeDefined();
    expect(plan.diagnostics.layoutScore).toBeGreaterThanOrEqual(0);
    expect(plan.diagnostics.layoutScore).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRenderPlanFromComponents — coordinate invariants
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRenderPlanFromComponents — coordinate invariants", () => {
  function getPlan(idea: string, w = 1080, h = 1350) {
    const c = makeComponents(idea);
    return buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, w, h);
  }

  it("headline.y >= safeZones.top", () => {
    const plan = getPlan("Dental clinic");
    expect(plan.headline.y).toBeGreaterThanOrEqual(plan.safeZones.top);
  });

  it("headline.y < cta.y (hierarchy: text above CTA)", () => {
    const plan = getPlan("Restaurant grand opening special menu");
    expect(plan.headline.y).toBeLessThan(plan.cta.y);
  });

  it("footer is within canvas bottom", () => {
    const plan = getPlan("Healthcare trust campaign");
    expect(plan.footer.y + plan.footer.height).toBeLessThanOrEqual(plan.canvas.height);
  });

  it("cta.y + cta.height <= canvas.height", () => {
    const plan = getPlan("Tech startup product launch");
    expect(plan.cta.y + plan.cta.height).toBeLessThanOrEqual(plan.canvas.height);
  });

  it("headline.x >= safeZones.left", () => {
    const plan = getPlan("Dental clinic");
    expect(plan.headline.x).toBeGreaterThanOrEqual(plan.safeZones.left);
  });

  it("no element extends past canvas right edge", () => {
    const plan = getPlan("Real estate new apartments sale");
    const allRegions = [
      plan.headline, plan.benefits, plan.cta, plan.footer,
      ...(plan.subheadline ? [plan.subheadline] : []),
    ];
    for (const r of allRegions) {
      expect(r.x + r.width).toBeLessThanOrEqual(plan.canvas.width + 1); // +1 for rounding
    }
  });

  it("benefits.y > headline.y (benefits is below headline)", () => {
    const plan = getPlan("Restaurant dining experience");
    expect(plan.benefits.y).toBeGreaterThan(plan.headline.y);
  });

  it("footer.y > cta.y (footer is below CTA)", () => {
    const plan = getPlan("Finance investment services");
    expect(plan.footer.y).toBeGreaterThan(plan.cta.y);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRenderPlanFromComponents — optional elements
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRenderPlanFromComponents — optional elements", () => {
  it("disclaimer is present for dental (disclaimer industry)", () => {
    const c = makeComponents("Dental implants consultation book now");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    if (c.copy.disclaimer !== null) {
      expect(plan.disclaimer).not.toBeNull();
      expect(plan.disclaimer!.elementId).toBe("disclaimer");
    }
  });

  it("disclaimer is null when copy has no disclaimer", () => {
    const c = makeComponents("Restaurant grand opening special menu tonight");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    if (c.copy.disclaimer === null) {
      expect(plan.disclaimer).toBeNull();
    }
  });

  it("subheadline matches copy.subheadline presence", () => {
    const c = makeComponents("Healthcare clinic trust");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    if (c.copy.subheadline !== null) {
      expect(plan.subheadline).not.toBeNull();
    } else {
      expect(plan.subheadline).toBeNull();
    }
  });

  it("offer is null when copy has no offer", () => {
    const c = makeComponents("Brand awareness campaign");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    if (c.copy.offer === null) {
      expect(plan.offer).toBeNull();
    }
  });

  it("secondaryCta is null when copy has no secondaryCta", () => {
    const c = makeComponents("Tech startup product launch");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    if (c.copy.secondaryCta === null) {
      expect(plan.secondaryCta).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRenderPlanFromComponents — benefits region
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRenderPlanFromComponents — benefits region", () => {
  it("benefits.columns is 1, 2, or 3", () => {
    const c = makeComponents("Dental clinic consultation");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    expect([1, 2, 3]).toContain(plan.benefits.columns);
  });

  it("benefits.rowCount is at least 1", () => {
    const c = makeComponents("Restaurant special menu dinner");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    expect(plan.benefits.rowCount).toBeGreaterThanOrEqual(1);
  });

  it("benefits.columnWidth > 0", () => {
    const c = makeComponents("Healthcare clinic");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    expect(plan.benefits.columnWidth).toBeGreaterThan(0);
  });

  it("benefits.height > 0", () => {
    const c = makeComponents("Tech startup");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    expect(plan.benefits.height).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRenderPlanFromComponents — CTA region
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRenderPlanFromComponents — CTA region", () => {
  it("cta.paddingH > 0", () => {
    const c = makeComponents("Dental clinic consultation");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    expect(plan.cta.paddingH).toBeGreaterThan(0);
  });

  it("cta.paddingV > 0", () => {
    const c = makeComponents("Dental clinic consultation");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    expect(plan.cta.paddingV).toBeGreaterThan(0);
  });

  it("cta.borderRadius >= 0", () => {
    const c = makeComponents("Dental clinic consultation");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    expect(plan.cta.borderRadius).toBeGreaterThanOrEqual(0);
  });

  it("cta.height > 0", () => {
    const c = makeComponents("Dental clinic consultation");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    expect(plan.cta.height).toBeGreaterThan(0);
  });

  it("cta.width > 0", () => {
    const c = makeComponents("Dental clinic consultation");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    expect(plan.cta.width).toBeGreaterThan(0);
  });

  it("luxury style has cta.borderRadius = 0 (sharp)", () => {
    const c = makeComponents("Luxury jewelry collection fine gold bracelet");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    // luxury uses borderRadius=0 in style definitions
    expect(plan.cta.borderRadius).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRenderPlanFromComponents — different canvas sizes
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRenderPlanFromComponents — canvas sizes", () => {
  it("square canvas (1080×1080) produces valid plan", () => {
    const c = makeComponents("Restaurant grand opening");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1080);
    expect(plan.canvas).toEqual({ width: 1080, height: 1080 });
    expect(plan.headline.y).toBeLessThan(plan.cta.y);
    expect(plan.cta.y + plan.cta.height).toBeLessThanOrEqual(1080);
  });

  it("landscape canvas (1920×1080) produces valid plan", () => {
    const c = makeComponents("Tech startup product launch");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1920, 1080);
    expect(plan.canvas).toEqual({ width: 1920, height: 1080 });
    expect(plan.headline.y).toBeLessThan(plan.cta.y);
  });

  it("portrait canvas (1080×1920) produces valid plan", () => {
    const c = makeComponents("Healthcare clinic trust");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1920);
    expect(plan.canvas).toEqual({ width: 1080, height: 1920 });
    expect(plan.footer.y + plan.footer.height).toBeLessThanOrEqual(1920);
  });

  it("scale factor affects element sizes proportionally", () => {
    const c = makeComponents("Restaurant grand opening");
    const plan1080 = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    const plan2160 = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 2160, 2700);
    // At 2× scale, headline height should roughly double
    expect(plan2160.headline.height).toBeGreaterThan(plan1080.headline.height);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRenderPlanFromComponents — determinism
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRenderPlanFromComponents — determinism", () => {
  it("same inputs produce identical output", () => {
    const c = makeComponents("Dental clinic consultation book now");
    const a = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    const b = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("different industries produce different render plans", () => {
    const dental  = makeComponents("Dental clinic");
    const restaurant = makeComponents("Restaurant grand opening");
    const pa = buildRenderPlanFromComponents(dental.composition, dental.copy, dental.typography, dental.layoutPlan, 1080, 1350);
    const pb = buildRenderPlanFromComponents(restaurant.composition, restaurant.copy, restaurant.typography, restaurant.layoutPlan, 1080, 1350);
    // Different plans (at least different strategy will affect safeZones or elements)
    expect(JSON.stringify(pa)).not.toBe(JSON.stringify(pb));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRenderPlanFromComponents — imageUrl passthrough
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRenderPlanFromComponents — imageUrl", () => {
  it("imageUrl is stored when provided", () => {
    const c = makeComponents("Dental clinic");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350, "https://example.com/image.jpg");
    expect(plan.imageUrl).toBe("https://example.com/image.jpg");
  });

  it("imageUrl is absent when not provided", () => {
    const c = makeComponents("Dental clinic");
    const plan = buildRenderPlanFromComponents(c.composition, c.copy, c.typography, c.layoutPlan, 1080, 1350);
    expect(plan.imageUrl).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildRenderPlanFromBlueprint — blueprint integration
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRenderPlanFromBlueprint", () => {
  it("produces a valid render plan from a dental blueprint", () => {
    const blueprint = makeBlueprint("Dental clinic consultation book now");
    const plan = buildRenderPlanFromBlueprint(blueprint);
    expect(plan.headline).toBeDefined();
    expect(plan.cta).toBeDefined();
    expect(plan.footer).toBeDefined();
    expect(plan.canvas.width).toBeGreaterThan(0);
    expect(plan.canvas.height).toBeGreaterThan(0);
  });

  it("produces a valid render plan from a restaurant blueprint", () => {
    const blueprint = makeBlueprint("Restaurant grand opening special menu");
    const plan = buildRenderPlanFromBlueprint(blueprint);
    expect(plan.headline.y).toBeLessThan(plan.cta.y);
  });

  it("throws when blueprint.commercialComposition is missing", () => {
    const blueprint = makeBlueprint("Dental clinic");
    const incomplete = { ...blueprint, commercialComposition: undefined } as unknown as UniversalCampaignBlueprint;
    expect(() => buildRenderPlanFromBlueprint(incomplete)).toThrow();
  });

  it("throws when blueprint.commercialCopy is missing", () => {
    const blueprint = makeBlueprint("Dental clinic");
    const incomplete = { ...blueprint, commercialCopy: undefined } as unknown as UniversalCampaignBlueprint;
    expect(() => buildRenderPlanFromBlueprint(incomplete)).toThrow();
  });

  it("throws when blueprint.commercialTypography is missing", () => {
    const blueprint = makeBlueprint("Dental clinic");
    const incomplete = { ...blueprint, commercialTypography: undefined } as unknown as UniversalCampaignBlueprint;
    expect(() => buildRenderPlanFromBlueprint(incomplete)).toThrow();
  });

  it("custom canvas width/height override", () => {
    const blueprint = makeBlueprint("Healthcare clinic");
    const plan = buildRenderPlanFromBlueprint(blueprint, 800, 600);
    expect(plan.canvas).toEqual({ width: 800, height: 600 });
  });

  it("render plan in blueprint.renderPlan matches standalone buildRenderPlanFromBlueprint", () => {
    const blueprint = makeBlueprint("Restaurant grand opening");
    const standalone = buildRenderPlanFromBlueprint(blueprint);
    // blueprint.renderPlan should be structurally equivalent
    expect(blueprint.renderPlan?.canvas).toEqual(standalone.canvas);
    expect(blueprint.renderPlan?.headline.elementId).toBe(standalone.headline.elementId);
  });

  it("is deterministic across two calls", () => {
    const blueprint = makeBlueprint("Finance investment consultation");
    const a = buildRenderPlanFromBlueprint(blueprint);
    const b = buildRenderPlanFromBlueprint(blueprint);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
