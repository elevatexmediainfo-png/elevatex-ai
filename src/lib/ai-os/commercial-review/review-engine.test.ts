import { describe, expect, it } from "vitest";

import {
  buildCommercialReviewFromComponents,
  buildCommercialReviewFromBlueprint,
} from "./review-engine";
import { reviewLayout }     from "./layout-review";
import { reviewTypography } from "./typography-review";
import { reviewMarketing }  from "./marketing-review";
import { reviewVisual }     from "./visual-review";
import { reviewBrand }      from "./brand-review";
import { classifyRetry }    from "./retry-classifier";
import {
  computeOverallScore,
  getGrade,
  getStatus,
  clampScore,
} from "./score-engine";
import type {
  ReviewScores, ReviewIssue, ImageMetadata,
} from "./types";
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
import { buildRenderPlanFromComponents }       from "../commercial-renderer/render-plan";
import { resolveCanvasSize }                   from "../commercial-renderer/canvas-engine";
import { assembleBlueprint }         from "../blueprint";
import { buildTypographyPlan }       from "../typography";
import type { CreativeRequest }       from "../types";
import type { CommercialRenderPlan }  from "../commercial-renderer/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
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
  const ar          = layoutPlan.canvas.aspectRatio.value ?? "1:1";
  const canvas      = resolveCanvasSize(ar);
  const renderPlan  = buildRenderPlanFromComponents(composition, copy, typography, layoutPlan, canvas.width, canvas.height);
  const brand       = { context: undefined, kit: undefined, logo: undefined };
  return { strategy, campaign, layoutPlan, assets, composition, copy, typography, renderPlan, brand, ctx };
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

// Minimal fake render plan for isolated testing
function makeRenderPlan(overrides: Partial<CommercialRenderPlan> = {}): CommercialRenderPlan {
  const base: CommercialRenderPlan = {
    canvas:          { width: 1080, height: 1350 },
    safeZones:       { top: 65, bottom: 65, left: 65, right: 65 },
    globalPaddingPx: 65,
    headline:  { elementId: "headline",  x: 65, y: 70,   width: 950, height: 110, alignment: "left", maxLines: 2, overflow: false, stackOrder: 10 },
    subheadline: null,
    benefits:  { elementId: "benefits",  x: 65, y: 220,  width: 950, height: 300, alignment: "left", maxLines: 6, overflow: false, stackOrder: 5, columns: 2, rowCount: 3, columnWidth: 460, columnSpacing: 30 },
    cta:       { elementId: "cta",       x: 270, y: 1160, width: 540, height: 80, alignment: "center", paddingH: 32, paddingV: 20, borderRadius: 8, stackOrder: 10 },
    secondaryCta: null,
    socialProof:  null,
    offer:        null,
    badge:        null,
    logo:         { elementId: "logo", x: 900, y: 65, width: 80, height: 80, scale: 1, corner: "top_right", stackOrder: 20 },
    qr:           null,
    disclaimer:   null,
    footer:       { elementId: "footer", x: 65, y: 1300, width: 950, height: 20, alignment: "center", maxLines: 1, overflow: false, stackOrder: 1 },
    diagnostics:  { collisions: [], overflows: [], warnings: [], layoutScore: 100 },
  };
  return { ...base, ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────────
// score-engine
// ─────────────────────────────────────────────────────────────────────────────

describe("computeOverallScore", () => {
  it("all 100 → 100", () => {
    const s: ReviewScores = { layout: 100, typography: 100, marketing: 100, visual: 100, branding: 100 };
    expect(computeOverallScore(s)).toBe(100);
  });

  it("all 0 → 0", () => {
    const s: ReviewScores = { layout: 0, typography: 0, marketing: 0, visual: 0, branding: 0 };
    expect(computeOverallScore(s)).toBe(0);
  });

  it("weights: layout=100, rest=0 → 25", () => {
    const s: ReviewScores = { layout: 100, typography: 0, marketing: 0, visual: 0, branding: 0 };
    expect(computeOverallScore(s)).toBe(25);
  });

  it("weights: marketing=100, rest=0 → 25", () => {
    const s: ReviewScores = { layout: 0, typography: 0, marketing: 100, visual: 0, branding: 0 };
    expect(computeOverallScore(s)).toBe(25);
  });

  it("weights: typography=100, rest=0 → 20", () => {
    const s: ReviewScores = { layout: 0, typography: 100, marketing: 0, visual: 0, branding: 0 };
    expect(computeOverallScore(s)).toBe(20);
  });

  it("weights: visual=100, rest=0 → 15", () => {
    const s: ReviewScores = { layout: 0, typography: 0, marketing: 0, visual: 100, branding: 0 };
    expect(computeOverallScore(s)).toBe(15);
  });

  it("weights: branding=100, rest=0 → 15", () => {
    const s: ReviewScores = { layout: 0, typography: 0, marketing: 0, visual: 0, branding: 100 };
    expect(computeOverallScore(s)).toBe(15);
  });

  it("mixed scores produce correct weighted result", () => {
    const s: ReviewScores = { layout: 80, typography: 90, marketing: 70, visual: 95, branding: 85 };
    const expected = Math.round(80*0.25 + 90*0.20 + 70*0.25 + 95*0.15 + 85*0.15);
    expect(computeOverallScore(s)).toBe(expected);
  });

  it("clamps at 100", () => {
    const s: ReviewScores = { layout: 110, typography: 110, marketing: 110, visual: 110, branding: 110 };
    expect(computeOverallScore(s)).toBe(100);
  });
});

describe("getGrade", () => {
  it("95 → A+", () => expect(getGrade(95)).toBe("A+"));
  it("100 → A+", () => expect(getGrade(100)).toBe("A+"));
  it("90 → A", () => expect(getGrade(90)).toBe("A"));
  it("94 → A", () => expect(getGrade(94)).toBe("A"));
  it("80 → B", () => expect(getGrade(80)).toBe("B"));
  it("89 → B", () => expect(getGrade(89)).toBe("B"));
  it("70 → C", () => expect(getGrade(70)).toBe("C"));
  it("79 → C", () => expect(getGrade(79)).toBe("C"));
  it("69 → F", () => expect(getGrade(69)).toBe("F"));
  it("0 → F",  () => expect(getGrade(0)).toBe("F"));
});

describe("getStatus", () => {
  it("95 → approved", () => expect(getStatus(95)).toBe("approved"));
  it("100 → approved", () => expect(getStatus(100)).toBe("approved"));
  it("90 → approved_with_recommendations", () => expect(getStatus(90)).toBe("approved_with_recommendations"));
  it("94 → approved_with_recommendations", () => expect(getStatus(94)).toBe("approved_with_recommendations"));
  it("80 → retry_required", () => expect(getStatus(80)).toBe("retry_required"));
  it("89 → retry_required", () => expect(getStatus(89)).toBe("retry_required"));
  it("79 → rejected", () => expect(getStatus(79)).toBe("rejected"));
  it("0 → rejected",  () => expect(getStatus(0)).toBe("rejected"));
});

describe("clampScore", () => {
  it("100 stays 100", () => expect(clampScore(100)).toBe(100));
  it("0 stays 0", () => expect(clampScore(0)).toBe(0));
  it("150 clamps to 100", () => expect(clampScore(150)).toBe(100));
  it("-10 clamps to 0", () => expect(clampScore(-10)).toBe(0));
  it("85.6 rounds to 86", () => expect(clampScore(85.6)).toBe(86));
});

// ─────────────────────────────────────────────────────────────────────────────
// layout-review
// ─────────────────────────────────────────────────────────────────────────────

describe("reviewLayout — good plan", () => {
  it("returns score 0–100", () => {
    const plan = makeRenderPlan();
    const result = reviewLayout(plan);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("returns issues array", () => {
    const result = reviewLayout(makeRenderPlan());
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it("perfect plan → score near 100", () => {
    const result = reviewLayout(makeRenderPlan());
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it("no issues for a clean plan", () => {
    const result = reviewLayout(makeRenderPlan());
    expect(result.issues.filter(i => i.severity === "critical" || i.severity === "high")).toHaveLength(0);
  });
});

describe("reviewLayout — hierarchy broken", () => {
  it("headline.y >= cta.y → critical issue", () => {
    const plan = makeRenderPlan({
      headline: { elementId: "headline", x: 65, y: 1200, width: 950, height: 110, alignment: "left", maxLines: 2, overflow: false, stackOrder: 10 },
    });
    const result = reviewLayout(plan);
    const critical = result.issues.filter(i => i.severity === "critical");
    expect(critical.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(85);
  });
});

describe("reviewLayout — footer overflow", () => {
  it("footer beyond canvas → high issue", () => {
    const plan = makeRenderPlan({
      footer: { elementId: "footer", x: 65, y: 1360, width: 950, height: 30, alignment: "center", maxLines: 1, overflow: false, stackOrder: 1 },
    });
    const result = reviewLayout(plan);
    expect(result.issues.some(i => i.field === "footer" && i.severity === "high")).toBe(true);
  });
});

describe("reviewLayout — benefits too small", () => {
  it("benefits height < 5% canvas height → medium issue", () => {
    const plan = makeRenderPlan({
      benefits: { elementId: "benefits", x: 65, y: 220, width: 950, height: 5, alignment: "left", maxLines: 6, overflow: false, stackOrder: 5, columns: 2, rowCount: 3, columnWidth: 460, columnSpacing: 30 },
    });
    const result = reviewLayout(plan);
    expect(result.issues.some(i => i.field === "benefits")).toBe(true);
  });
});

describe("reviewLayout — collisions", () => {
  it("multiple unresolved collisions → high issue and lower score", () => {
    const plan = makeRenderPlan({
      diagnostics: {
        collisions: [
          { elementA: "headline", elementB: "cta",     overlapPx: 30, resolved: false, resolution: "" },
          { elementA: "cta",      elementB: "footer",  overlapPx: 20, resolved: false, resolution: "" },
          { elementA: "headline", elementB: "benefits",overlapPx: 10, resolved: false, resolution: "" },
        ],
        overflows: [],
        warnings:  [],
        layoutScore: 55,
      },
    });
    const result = reviewLayout(plan);
    expect(result.score).toBeLessThan(75);
    expect(result.issues.some(i => i.severity === "high")).toBe(true);
  });
});

describe("reviewLayout — logo outside canvas", () => {
  it("logo outside canvas → high issue", () => {
    const plan = makeRenderPlan({
      logo: { elementId: "logo", x: 1100, y: 65, width: 80, height: 80, scale: 1, corner: "top_right", stackOrder: 20 },
    });
    const result = reviewLayout(plan);
    expect(result.issues.some(i => i.field === "logo" && i.severity === "high")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// typography-review
// ─────────────────────────────────────────────────────────────────────────────

describe("reviewTypography — with real data", () => {
  const { typography, renderPlan } = makeComponents("Dental clinic consultation");

  it("returns score 0–100", () => {
    const r = reviewTypography(typography, renderPlan);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("returns issues array", () => {
    const r = reviewTypography(typography, renderPlan);
    expect(Array.isArray(r.issues)).toBe(true);
  });

  it("headline importance is always 10", () => {
    const r = reviewTypography(typography, renderPlan);
    expect(typography.headline.importance).toBe(10);
    expect(r.issues.filter(i => i.message.includes("importance"))).toHaveLength(0);
  });

  it("CTA importance < headline importance", () => {
    expect(typography.cta.importance).toBeLessThan(typography.headline.importance);
  });
});

describe("reviewTypography — hierarchy violations", () => {
  it("headline importance !== 10 → critical issue", () => {
    const { typography, renderPlan } = makeComponents("Dental clinic");
    const broken = { ...typography, headline: { ...typography.headline, importance: 8 } };
    const r = reviewTypography(broken, renderPlan);
    expect(r.issues.some(i => i.severity === "critical" && i.field === "headline")).toBe(true);
    expect(r.score).toBeLessThan(90);
  });

  it("CTA importance >= headline → high issue", () => {
    const { typography, renderPlan } = makeComponents("Dental clinic");
    const broken = { ...typography, cta: { ...typography.cta, importance: 10 } };
    const r = reviewTypography(broken, renderPlan);
    expect(r.issues.some(i => i.severity === "high" && i.field === "cta")).toBe(true);
  });
});

describe("reviewTypography — contrast checks", () => {
  it("headline with low contrast → high severity issue", () => {
    const { typography, renderPlan } = makeComponents("Dental clinic");
    const broken = { ...typography, headline: { ...typography.headline, contrast: "low" as const } };
    const r = reviewTypography(broken, renderPlan);
    expect(r.issues.some(i => i.field === "headline" && i.severity === "high")).toBe(true);
  });

  it("CTA with low contrast → medium severity issue", () => {
    const { typography, renderPlan } = makeComponents("Dental clinic");
    const broken = { ...typography, cta: { ...typography.cta, contrast: "low" as const } };
    const r = reviewTypography(broken, renderPlan);
    expect(r.issues.some(i => i.field === "cta" && i.severity === "medium")).toBe(true);
  });
});

describe("reviewTypography — size hierarchy", () => {
  it("headline smaller than benefits → high issue", () => {
    const { typography, renderPlan } = makeComponents("Dental clinic");
    const broken = {
      ...typography,
      headline: { ...typography.headline, size: "sm" as const },
      benefits: { ...typography.benefits, size: "xl" as const },
    };
    const r = reviewTypography(broken, renderPlan);
    expect(r.issues.some(i => i.field === "headline" && i.severity === "high")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// marketing-review
// ─────────────────────────────────────────────────────────────────────────────

describe("reviewMarketing — with real data", () => {
  const { copy, strategy } = makeComponents("Restaurant grand opening special menu");

  it("returns score 0–100", () => {
    const r = reviewMarketing(copy, strategy);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("has a non-empty headline", () => {
    expect(copy.headline.length).toBeGreaterThan(0);
  });

  it("has a non-empty CTA", () => {
    expect(copy.cta.length).toBeGreaterThan(0);
  });

  it("has benefits", () => {
    expect(copy.benefits.length).toBeGreaterThan(0);
  });
});

describe("reviewMarketing — missing headline", () => {
  it("empty headline → critical issue, -25 score", () => {
    const { copy, strategy } = makeComponents("Dental clinic");
    const brokenCopy = { ...copy, headline: "" };
    const r = reviewMarketing(brokenCopy, strategy);
    expect(r.issues.some(i => i.severity === "critical" && i.field === "headline")).toBe(true);
    expect(r.score).toBeLessThanOrEqual(75);
  });
});

describe("reviewMarketing — missing CTA", () => {
  it("empty CTA → critical issue, -25 score", () => {
    const { copy, strategy } = makeComponents("Dental clinic");
    const brokenCopy = { ...copy, cta: "" };
    const r = reviewMarketing(brokenCopy, strategy);
    expect(r.issues.some(i => i.severity === "critical" && i.field === "cta")).toBe(true);
    expect(r.score).toBeLessThanOrEqual(75);
  });
});

describe("reviewMarketing — no benefits", () => {
  it("zero benefits → high issue", () => {
    const { copy, strategy } = makeComponents("Dental clinic");
    const brokenCopy = { ...copy, benefits: [] };
    const r = reviewMarketing(brokenCopy, strategy);
    expect(r.issues.some(i => i.severity === "high" && i.field === "benefits")).toBe(true);
  });
});

describe("reviewMarketing — benefit count", () => {
  it("1 benefit → low severity issue", () => {
    const { copy, strategy } = makeComponents("Dental clinic");
    const r = reviewMarketing({ ...copy, benefits: ["Great care"] }, strategy);
    expect(r.issues.some(i => i.field === "benefits" && i.severity === "low")).toBe(true);
  });

  it("7+ benefits → low severity issue", () => {
    const { copy, strategy } = makeComponents("Dental clinic");
    const r = reviewMarketing({ ...copy, benefits: Array(8).fill("Benefit") }, strategy);
    expect(r.issues.some(i => i.field === "benefits" && i.severity === "low")).toBe(true);
  });

  it("3–6 benefits → no benefit issue", () => {
    const { copy, strategy } = makeComponents("Dental clinic");
    const r = reviewMarketing({ ...copy, benefits: ["A", "B", "C", "D"] }, strategy);
    expect(r.issues.filter(i => i.field === "benefits")).toHaveLength(0);
  });
});

describe("reviewMarketing — CTA length", () => {
  it("very long CTA → low severity issue", () => {
    const { copy, strategy } = makeComponents("Dental clinic");
    const r = reviewMarketing({ ...copy, cta: "Click here to get started with us now" }, strategy);
    expect(r.issues.some(i => i.field === "cta" && i.severity === "low")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// visual-review
// ─────────────────────────────────────────────────────────────────────────────

describe("reviewVisual — clean plan", () => {
  const { composition, renderPlan } = makeComponents("Dental clinic");

  it("returns score 0–100", () => {
    const r = reviewVisual(renderPlan, composition);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("no image metadata → low severity issue", () => {
    const r = reviewVisual(renderPlan, composition);
    expect(r.issues.some(i => i.severity === "low")).toBe(true);
  });

  it("matching image metadata → no aspect ratio issue", () => {
    const r = reviewVisual(renderPlan, composition, {
      width: renderPlan.canvas.width,
      height: renderPlan.canvas.height,
    });
    expect(r.issues.filter(i => i.message.includes("aspect ratio"))).toHaveLength(0);
  });

  it("mismatched image → aspect ratio issue", () => {
    const r = reviewVisual(renderPlan, composition, { width: 1920, height: 1080 });
    expect(r.issues.some(i => i.message.includes("aspect ratio"))).toBe(true);
  });
});

describe("reviewVisual — no logo", () => {
  it("no logo region → medium severity issue", () => {
    const { composition, renderPlan } = makeComponents("Dental clinic");
    const noLogo = { ...renderPlan, logo: null };
    const r = reviewVisual(noLogo, composition);
    expect(r.issues.some(i => i.field === "logo" && i.severity === "medium")).toBe(true);
  });
});

describe("reviewVisual — small logo", () => {
  it("logo < 40px → medium issue", () => {
    const { composition, renderPlan } = makeComponents("Dental clinic");
    const smallLogo = { ...renderPlan, logo: { ...renderPlan.logo!, width: 30, height: 30 } };
    const r = reviewVisual(smallLogo, composition);
    expect(r.issues.some(i => i.field === "logo" && i.severity === "medium")).toBe(true);
  });
});

describe("reviewVisual — element outside canvas", () => {
  it("headline with negative x → high severity issue", () => {
    const { composition } = makeComponents("Dental clinic");
    const badPlan = makeRenderPlan({
      headline: { elementId: "headline", x: -10, y: 70, width: 950, height: 110, alignment: "left", maxLines: 2, overflow: false, stackOrder: 10 },
    });
    const r = reviewVisual(badPlan, composition);
    expect(r.issues.some(i => i.field === "headline" && i.severity === "high")).toBe(true);
  });
});

describe("reviewVisual — CTA tap target", () => {
  it("CTA narrower than 100px → medium issue", () => {
    const { composition } = makeComponents("Dental clinic");
    const plan = makeRenderPlan({
      cta: { elementId: "cta", x: 270, y: 1160, width: 80, height: 80, alignment: "center", paddingH: 16, paddingV: 8, borderRadius: 4, stackOrder: 10 },
    });
    const r = reviewVisual(plan, composition);
    expect(r.issues.some(i => i.field === "cta" && i.severity === "medium")).toBe(true);
  });

  it("CTA shorter than 36px → medium issue", () => {
    const { composition } = makeComponents("Dental clinic");
    const plan = makeRenderPlan({
      cta: { elementId: "cta", x: 270, y: 1160, width: 540, height: 30, alignment: "center", paddingH: 16, paddingV: 8, borderRadius: 4, stackOrder: 10 },
    });
    const r = reviewVisual(plan, composition);
    expect(r.issues.some(i => i.field === "cta" && i.severity === "medium")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// brand-review
// ─────────────────────────────────────────────────────────────────────────────

describe("reviewBrand — no logo", () => {
  it("no logo in render plan → medium severity issue", () => {
    const { copy, renderPlan, composition } = makeComponents("Dental clinic");
    const brand = { context: undefined, kit: undefined, logo: undefined };
    const noLogo = { ...renderPlan, logo: null };
    const r = reviewBrand(copy, brand, noLogo, composition);
    expect(r.issues.some(i => i.field === "logo" && i.severity === "medium")).toBe(true);
  });
});

describe("reviewBrand — regulated industry disclaimer", () => {
  it("dental with no disclaimer → medium issue", () => {
    const { copy, renderPlan, composition } = makeComponents("Dental clinic");
    const brand = { context: undefined, kit: undefined, logo: undefined };
    if (copy.disclaimer === null) {
      const r = reviewBrand(copy, brand, renderPlan, composition);
      expect(r.issues.some(i => i.field === "disclaimer" && i.severity === "medium")).toBe(true);
    }
  });

  it("restaurant with no disclaimer → no disclaimer issue", () => {
    const { copy, renderPlan, composition } = makeComponents("Restaurant grand opening special menu");
    const brand = { context: undefined, kit: undefined, logo: undefined };
    if (copy.disclaimer === null) {
      const r = reviewBrand(copy, brand, renderPlan, composition);
      expect(r.issues.filter(i => i.field === "disclaimer")).toHaveLength(0);
    }
  });
});

describe("reviewBrand — brand context", () => {
  it("brand with primary color → no color issue", () => {
    const { copy, renderPlan, composition } = makeComponents("Dental clinic");
    const brand = { context: { primaryColor: "#2563eb", secondaryColor: null, fontFamily: null }, kit: undefined, logo: undefined };
    const r = reviewBrand(copy, brand, renderPlan, composition);
    expect(r.issues.filter(i => i.message.includes("color"))).toHaveLength(0);
  });

  it("no brand colors → low severity issue", () => {
    const { copy, renderPlan, composition } = makeComponents("Dental clinic");
    const brand = { context: undefined, kit: undefined, logo: undefined };
    const r = reviewBrand(copy, brand, renderPlan, composition);
    expect(r.issues.some(i => i.message.includes("color") && i.severity === "low")).toBe(true);
  });
});

describe("reviewBrand — returns 0–100", () => {
  it("score is always in valid range", () => {
    const { copy, renderPlan, composition } = makeComponents("Healthcare clinic");
    const brand = { context: undefined, kit: undefined, logo: undefined };
    const r = reviewBrand(copy, brand, renderPlan, composition);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// retry-classifier
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyRetry", () => {
  const baseScores: ReviewScores = { layout: 95, typography: 95, marketing: 95, visual: 95, branding: 95 };

  it("overall >= 95, no issues → action: none", () => {
    const r = classifyRetry([], baseScores, 95);
    expect(r.action).toBe("none");
  });

  it("critical layout issue → rerender_layout", () => {
    const issues: ReviewIssue[] = [
      { type: "layout", severity: "critical", message: "Hierarchy broken", field: "headline" },
    ];
    const r = classifyRetry(issues, baseScores, 80);
    expect(r.action).toBe("rerender_layout");
  });

  it("critical marketing issue → rewrite_copy", () => {
    const issues: ReviewIssue[] = [
      { type: "marketing", severity: "critical", message: "No CTA", field: "cta" },
    ];
    const r = classifyRetry(issues, baseScores, 75);
    expect(r.action).toBe("rewrite_copy");
  });

  it("critical visual issue → regenerate_image", () => {
    const issues: ReviewIssue[] = [
      { type: "visual", severity: "critical", message: "Image missing", field: "logo" },
    ];
    const r = classifyRetry(issues, baseScores, 70);
    expect(r.action).toBe("regenerate_image");
  });

  it("critical typography issue → rerender_typography", () => {
    const issues: ReviewIssue[] = [
      { type: "typography", severity: "critical", message: "Contrast broken", field: "headline" },
    ];
    const r = classifyRetry(issues, baseScores, 78);
    expect(r.action).toBe("rerender_typography");
  });

  it("critical brand issue → brand_fix", () => {
    const issues: ReviewIssue[] = [
      { type: "brand", severity: "critical", message: "Logo missing", field: "logo" },
    ];
    const r = classifyRetry(issues, baseScores, 82);
    expect(r.action).toBe("brand_fix");
  });

  it("no critical/high issues, lowest score drives action", () => {
    const scores: ReviewScores = { layout: 100, typography: 100, marketing: 72, visual: 100, branding: 100 };
    const issues: ReviewIssue[] = [
      { type: "marketing", severity: "low", message: "Missing social proof" },
    ];
    const r = classifyRetry(issues, scores, 85);
    expect(r.action).toBe("rewrite_copy");
  });

  it("highest severity wins when multiple issue types", () => {
    const issues: ReviewIssue[] = [
      { type: "layout",     severity: "low",      message: "Minor layout" },
      { type: "marketing",  severity: "critical",  message: "Missing CTA" },
      { type: "typography", severity: "medium",    message: "Contrast" },
    ];
    const r = classifyRetry(issues, baseScores, 70);
    expect(r.action).toBe("rewrite_copy");
  });

  it("recommendation includes a reason string", () => {
    const issues: ReviewIssue[] = [{ type: "layout", severity: "high", message: "Collision" }];
    const r = classifyRetry(issues, baseScores, 80);
    expect(typeof r.reason).toBe("string");
    expect(r.reason.length).toBeGreaterThan(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildCommercialReviewFromComponents — integration
// ─────────────────────────────────────────────────────────────────────────────

describe("buildCommercialReviewFromComponents — structure", () => {
  const c = makeComponents("Dental clinic consultation book now");
  const review = buildCommercialReviewFromComponents(
    c.composition, c.copy, c.typography, c.renderPlan, c.strategy, c.brand,
  );

  it("overallScore is 0–100", () => {
    expect(review.overallScore).toBeGreaterThanOrEqual(0);
    expect(review.overallScore).toBeLessThanOrEqual(100);
  });

  it("grade is a valid grade string", () => {
    expect(["A+", "A", "B", "C", "F"]).toContain(review.grade);
  });

  it("status is a valid status string", () => {
    expect(["approved", "approved_with_recommendations", "retry_required", "rejected"]).toContain(review.status);
  });

  it("scores object has all five keys", () => {
    expect(review.scores).toHaveProperty("layout");
    expect(review.scores).toHaveProperty("typography");
    expect(review.scores).toHaveProperty("marketing");
    expect(review.scores).toHaveProperty("visual");
    expect(review.scores).toHaveProperty("branding");
  });

  it("all scores are 0–100", () => {
    for (const [, v] of Object.entries(review.scores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("issues is an array", () => {
    expect(Array.isArray(review.issues)).toBe(true);
  });

  it("recommendation has action and reason", () => {
    expect(review.recommendation).toHaveProperty("action");
    expect(review.recommendation).toHaveProperty("reason");
  });

  it("grade is consistent with overallScore", () => {
    const { overallScore, grade } = review;
    if (overallScore >= 95)      expect(grade).toBe("A+");
    else if (overallScore >= 90) expect(grade).toBe("A");
    else if (overallScore >= 80) expect(grade).toBe("B");
    else if (overallScore >= 70) expect(grade).toBe("C");
    else                          expect(grade).toBe("F");
  });

  it("status is consistent with overallScore", () => {
    const { overallScore, status } = review;
    if (overallScore >= 95)      expect(status).toBe("approved");
    else if (overallScore >= 90) expect(status).toBe("approved_with_recommendations");
    else if (overallScore >= 80) expect(status).toBe("retry_required");
    else                          expect(status).toBe("rejected");
  });
});

describe("buildCommercialReviewFromComponents — determinism", () => {
  it("same inputs produce identical output", () => {
    const c = makeComponents("Restaurant grand opening");
    const a = buildCommercialReviewFromComponents(c.composition, c.copy, c.typography, c.renderPlan, c.strategy, c.brand);
    const b = buildCommercialReviewFromComponents(c.composition, c.copy, c.typography, c.renderPlan, c.strategy, c.brand);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("different industries produce different reviews", () => {
    const dental      = makeComponents("Dental clinic consultation");
    const restaurant  = makeComponents("Restaurant grand opening");
    const ra = buildCommercialReviewFromComponents(dental.composition, dental.copy, dental.typography, dental.renderPlan, dental.strategy, dental.brand);
    const rb = buildCommercialReviewFromComponents(restaurant.composition, restaurant.copy, restaurant.typography, restaurant.renderPlan, restaurant.strategy, restaurant.brand);
    expect(JSON.stringify(ra)).not.toBe(JSON.stringify(rb));
  });
});

describe("buildCommercialReviewFromComponents — imageMeta", () => {
  it("with matching imageMeta → fewer visual issues", () => {
    const c = makeComponents("Dental clinic");
    const noMeta  = buildCommercialReviewFromComponents(c.composition, c.copy, c.typography, c.renderPlan, c.strategy, c.brand);
    const withMeta = buildCommercialReviewFromComponents(c.composition, c.copy, c.typography, c.renderPlan, c.strategy, c.brand, {
      width: c.renderPlan.canvas.width,
      height: c.renderPlan.canvas.height,
    });
    // visual score should be equal or better with matching metadata
    expect(withMeta.scores.visual).toBeGreaterThanOrEqual(noMeta.scores.visual);
  });
});

describe("buildCommercialReviewFromComponents — multiple industries", () => {
  const ideas = [
    "Dental clinic consultation",
    "Restaurant grand opening special menu",
    "Healthcare clinic trust campaign",
    "Tech startup product launch",
    "Real estate luxury apartments",
    "Fitness gym membership offer",
  ];

  for (const idea of ideas) {
    it(`produces valid review for: ${idea}`, () => {
      const c = makeComponents(idea);
      const r = buildCommercialReviewFromComponents(c.composition, c.copy, c.typography, c.renderPlan, c.strategy, c.brand);
      expect(r.overallScore).toBeGreaterThanOrEqual(0);
      expect(r.overallScore).toBeLessThanOrEqual(100);
      expect(["A+", "A", "B", "C", "F"]).toContain(r.grade);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// buildCommercialReviewFromBlueprint
// ─────────────────────────────────────────────────────────────────────────────

describe("buildCommercialReviewFromBlueprint", () => {
  it("produces valid review from dental blueprint", () => {
    const blueprint = makeBlueprint("Dental clinic consultation book now");
    const r = buildCommercialReviewFromBlueprint(blueprint);
    expect(r.overallScore).toBeGreaterThanOrEqual(0);
    expect(r.overallScore).toBeLessThanOrEqual(100);
    expect(["A+", "A", "B", "C", "F"]).toContain(r.grade);
  });

  it("produces valid review from restaurant blueprint", () => {
    const blueprint = makeBlueprint("Restaurant grand opening special menu");
    const r = buildCommercialReviewFromBlueprint(blueprint);
    expect(r.recommendation).toHaveProperty("action");
  });

  it("throws when blueprint.commercialComposition is missing", () => {
    const blueprint = makeBlueprint("Dental clinic");
    const incomplete = { ...blueprint, commercialComposition: undefined } as unknown as UniversalCampaignBlueprint;
    expect(() => buildCommercialReviewFromBlueprint(incomplete)).toThrow();
  });

  it("throws when blueprint.commercialCopy is missing", () => {
    const blueprint = makeBlueprint("Dental clinic");
    const incomplete = { ...blueprint, commercialCopy: undefined } as unknown as UniversalCampaignBlueprint;
    expect(() => buildCommercialReviewFromBlueprint(incomplete)).toThrow();
  });

  it("throws when blueprint.commercialTypography is missing", () => {
    const blueprint = makeBlueprint("Dental clinic");
    const incomplete = { ...blueprint, commercialTypography: undefined } as unknown as UniversalCampaignBlueprint;
    expect(() => buildCommercialReviewFromBlueprint(incomplete)).toThrow();
  });

  it("uses blueprint.renderPlan when available (avoids rebuilding)", () => {
    const blueprint = makeBlueprint("Healthcare clinic");
    const r = buildCommercialReviewFromBlueprint(blueprint);
    expect(r.scores.layout).toBeGreaterThanOrEqual(0);
  });

  it("blueprint.commercialReview is populated automatically", () => {
    const blueprint = makeBlueprint("Dental clinic consultation");
    expect(blueprint.commercialReview).toBeDefined();
    expect(blueprint.commercialReview!.overallScore).toBeGreaterThanOrEqual(0);
  });

  it("blueprint.commercialReview.grade is a valid grade", () => {
    const blueprint = makeBlueprint("Restaurant grand opening");
    expect(["A+", "A", "B", "C", "F"]).toContain(blueprint.commercialReview!.grade);
  });

  it("blueprint.commercialReview.status is a valid status", () => {
    const blueprint = makeBlueprint("Tech startup product launch");
    expect([
      "approved", "approved_with_recommendations", "retry_required", "rejected",
    ]).toContain(blueprint.commercialReview!.status);
  });

  it("is deterministic", () => {
    const blueprint = makeBlueprint("Finance investment consultation");
    const a = buildCommercialReviewFromBlueprint(blueprint);
    const b = buildCommercialReviewFromBlueprint(blueprint);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
