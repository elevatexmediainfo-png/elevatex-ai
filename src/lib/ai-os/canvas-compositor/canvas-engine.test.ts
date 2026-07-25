import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  resolveFontFamily, resolveWeight,
  resolveLetterSpacingPx, applyTextTransform, resolveBulletGlyph,
} from "./font-resolver";
import {
  resolveTextColor, resolveShadowOpacity,
  resolveCTAButtonColor, hexToSvgRgba, lightenHex,
  DEFAULT_CTA_COLOR,
} from "./color-resolver";
import { buildSvgTextLayer } from "./svg-text-layer";
import { composeAdvertisement } from "./canvas-engine";

import type { CommercialRenderPlan, BenefitRegion, CTARegion, TextRegion, SafeZones } from "../commercial-renderer/types";
import type { CommercialCopy, ToneProfile, CopyMetadata } from "../copy-intelligence/types";
import type {
  CommercialTypographyPlan, ElementTypography, BenefitTypography,
  CTATypography, SpacingSystem, HierarchyMap, ResponsiveAdjustments,
  BreakpointAdjustment,
} from "../typography-intelligence/types";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture factories
// ─────────────────────────────────────────────────────────────────────────────

function makeElementTypography(
  overrides: Partial<ElementTypography> = {},
): ElementTypography {
  return {
    importance:    5,
    size:          "lg",
    weight:        "bold",
    alignment:     "center",
    letterSpacing: "normal",
    lineHeight:    "normal",
    spacingAbove:  4,
    spacingBelow:  4,
    contrast:      "high",
    textTransform: "none",
    opacity:       100,
    maxLines:      3,
    ...overrides,
  };
}

function makeBenefitTypography(
  overrides: Partial<BenefitTypography> = {},
): BenefitTypography {
  return {
    ...makeElementTypography({ size: "base", weight: "regular" }),
    columns:       1,
    columnSpacing: 32,
    bulletStyle:   "dot",
    lineSpacing:   8,
    ...overrides,
  };
}

function makeCtaTypography(
  overrides: Partial<CTATypography> = {},
): CTATypography {
  return {
    ...makeElementTypography({ size: "base", weight: "bold", contrast: "ultra_high" }),
    paddingH:     24,
    paddingV:     12,
    borderRadius: 8,
    minWidth:     64,
    ...overrides,
  };
}

function makeSpacingSystem(): SpacingSystem {
  return {
    baseUnit:       4,
    globalPadding:  8,
    sectionSpacing: 16,
    elementSpacing: 4,
    density:        "balanced",
    breathingRoom:  8,
  };
}

function makeBreakpoint(): BreakpointAdjustment {
  return {
    headlineSize:             "xxl",
    subheadlineSize:          "lg",
    ctaSize:                  "base",
    benefitSize:              "base",
    benefitColumns:           1,
    globalPaddingMultiplier:  1,
    sectionSpacingMultiplier: 1,
  };
}

function makeResponsive(): ResponsiveAdjustments {
  const bp = makeBreakpoint();
  return { portrait: bp, square: bp, landscape: bp };
}

function makeHierarchy(): HierarchyMap {
  return {
    primary:    "headline",
    secondary:  "cta",
    tertiary:   "subheadline",
    quaternary: "benefits",
    body:       "socialProof",
    footnote:   "footer",
  };
}

function makeTypography(
  overrides: Partial<CommercialTypographyPlan> = {},
): CommercialTypographyPlan {
  return {
    typographyStyle: "minimal",
    headline:        makeElementTypography({ importance: 10, size: "xxl", weight: "dominant", contrast: "ultra_high" }),
    subheadline:     makeElementTypography({ importance: 7, size: "lg" }),
    benefits:        makeBenefitTypography(),
    cta:             makeCtaTypography(),
    secondaryCta:    null,
    socialProof:     makeElementTypography({ size: "sm", opacity: 85 }),
    offer:           makeElementTypography({ size: "xl", weight: "extrabold" }),
    badge:           null,
    disclaimer:      makeElementTypography({ size: "xs", opacity: 70 }),
    footer:          makeElementTypography({ size: "xs", opacity: 60, textTransform: "uppercase" }),
    responsive:      makeResponsive(),
    spacing:         makeSpacingSystem(),
    hierarchy:       makeHierarchy(),
    ...overrides,
  };
}

function makeTextRegion(
  id: CommercialRenderPlan["headline"]["elementId"],
  y: number,
  overrides: Partial<TextRegion> = {},
): TextRegion {
  return {
    elementId:  id,
    x:          48,
    y,
    width:      984,
    height:     80,
    alignment:  "center",
    maxLines:   3,
    overflow:   false,
    stackOrder: 1,
    ...overrides,
  };
}

function makeBenefitRegion(): BenefitRegion {
  return {
    elementId:     "benefits",
    x:             48,
    y:             900,
    width:         984,
    height:        200,
    alignment:     "left",
    maxLines:      6,
    overflow:      false,
    stackOrder:    4,
    columns:       1,
    rowCount:      4,
    columnWidth:   984,
    columnSpacing: 0,
  };
}

function makeCTARegion(): CTARegion {
  return {
    elementId:    "cta",
    x:            340,
    y:            1180,
    width:        400,
    height:       56,
    alignment:    "center",
    paddingH:     24,
    paddingV:     12,
    borderRadius: 8,
    stackOrder:   5,
  };
}

function makeRenderPlan(
  overrides: Partial<CommercialRenderPlan> = {},
): CommercialRenderPlan {
  const safeZones: SafeZones = { top: 48, bottom: 80, left: 48, right: 48 };
  return {
    canvas:          { width: 1080, height: 1920 },
    safeZones,
    globalPaddingPx: 48,
    headline:        makeTextRegion("headline",    200),
    subheadline:     makeTextRegion("subheadline", 320, { height: 48 }),
    benefits:        makeBenefitRegion(),
    cta:             makeCTARegion(),
    secondaryCta:    null,
    socialProof:     makeTextRegion("socialProof", 1100, { height: 40 }),
    offer:           makeTextRegion("offer",       420, { height: 60 }),
    badge:           null,
    logo:            null,
    qr:              null,
    disclaimer:      makeTextRegion("disclaimer",  1820, { height: 24 }),
    footer:          makeTextRegion("footer",      1860, { height: 24 }),
    diagnostics: {
      collisions:  [],
      overflows:   [],
      warnings:    [],
      layoutScore: 95,
    },
    ...overrides,
  };
}

function makeTone(): ToneProfile {
  return { primary: "professional", secondary: null, formality: "semi_formal", energyLevel: "medium" };
}

function makeCopyMetadata(): CopyMetadata {
  return {
    industry:         "healthcare",
    objective:        "brand_awareness",
    brandType:        "premium",
    headlineWordCount: 4,
    benefitCount:      3,
    hasOffer:          true,
    hasDisclaimer:     true,
  };
}

function makeCopy(overrides: Partial<CommercialCopy> = {}): CommercialCopy {
  return {
    headline:           "Transform Your Health Today",
    subheadline:        "Expert care you can trust",
    benefits:           ["Advanced diagnostics", "Same-day appointments", "Trusted specialists"],
    cta:                "Book Now",
    secondaryCta:       null,
    socialProof:        ["★★★★★ Rating"],
    offer:              "50% Off First Visit",
    badge:              null,
    disclaimer:         "Terms and conditions apply.",
    alternateHeadlines: [],
    tone:               makeTone(),
    metadata:           makeCopyMetadata(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// font-resolver
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveFontFamily", () => {
  it("luxury → serif Georgia stack", () => {
    expect(resolveFontFamily("luxury")).toContain("Georgia");
  });
  it("minimal → sans-serif Helvetica stack", () => {
    expect(resolveFontFamily("minimal")).toContain("Helvetica");
  });
  it("editorial → serif stack", () => {
    expect(resolveFontFamily("editorial")).toContain("Georgia");
  });
  it("product → Arial stack", () => {
    expect(resolveFontFamily("product")).toContain("Arial");
  });
  it("healthcare → Arial stack", () => {
    expect(resolveFontFamily("healthcare")).toContain("Arial");
  });
  it("real_estate → serif Georgia stack", () => {
    expect(resolveFontFamily("real_estate")).toContain("Georgia");
  });
  it("restaurant → serif stack", () => {
    expect(resolveFontFamily("restaurant")).toContain("Georgia");
  });
  it("fashion → Helvetica stack", () => {
    expect(resolveFontFamily("fashion")).toContain("Helvetica");
  });
  it("corporate → Arial stack", () => {
    expect(resolveFontFamily("corporate")).toContain("Arial");
  });
  it("social → Arial stack", () => {
    expect(resolveFontFamily("social")).toContain("Arial");
  });
  it("every style returns a non-empty string", () => {
    const styles = ["luxury","minimal","editorial","product","healthcare","real_estate","restaurant","fashion","corporate","social"] as const;
    for (const s of styles) {
      expect(resolveFontFamily(s).length).toBeGreaterThan(0);
    }
  });
});

describe("resolveWeight", () => {
  it("thin → 100",      () => expect(resolveWeight("thin")).toBe(100));
  it("light → 300",     () => expect(resolveWeight("light")).toBe(300));
  it("regular → 400",   () => expect(resolveWeight("regular")).toBe(400));
  it("medium → 500",    () => expect(resolveWeight("medium")).toBe(500));
  it("semibold → 600",  () => expect(resolveWeight("semibold")).toBe(600));
  it("bold → 700",      () => expect(resolveWeight("bold")).toBe(700));
  it("extrabold → 800", () => expect(resolveWeight("extrabold")).toBe(800));
  it("dominant → 900",  () => expect(resolveWeight("dominant")).toBe(900));
});

describe("resolveLetterSpacingPx", () => {
  it("normal scale → 0 px offset", () => {
    expect(resolveLetterSpacingPx("normal", 40)).toBe(0);
  });
  it("tight scale returns negative value", () => {
    expect(resolveLetterSpacingPx("tight", 40)).toBeLessThan(0);
  });
  it("wide scale returns positive value", () => {
    expect(resolveLetterSpacingPx("wide", 40)).toBeGreaterThan(0);
  });
  it("loose scale > wide scale for same font size", () => {
    expect(resolveLetterSpacingPx("loose", 40)).toBeGreaterThan(resolveLetterSpacingPx("wide", 40));
  });
  it("tight 40px → ~-0.8px", () => {
    expect(Math.round(resolveLetterSpacingPx("tight", 40) * 10) / 10).toBe(-0.8);
  });
  it("wide 20px → 1px", () => {
    expect(resolveLetterSpacingPx("wide", 20)).toBe(1);
  });
});

describe("applyTextTransform", () => {
  it("uppercase capitalizes all letters", () => {
    expect(applyTextTransform("hello world", "uppercase")).toBe("HELLO WORLD");
  });
  it("lowercase lowercases all letters", () => {
    expect(applyTextTransform("HELLO WORLD", "lowercase")).toBe("hello world");
  });
  it("capitalize title-cases each word", () => {
    expect(applyTextTransform("hello world", "capitalize")).toBe("Hello World");
  });
  it("none returns the original string", () => {
    expect(applyTextTransform("Hello World", "none")).toBe("Hello World");
  });
  it("capitalize handles mixed case words", () => {
    expect(applyTextTransform("the quick BROWN fox", "capitalize")).toBe("The Quick BROWN Fox");
  });
});

describe("resolveBulletGlyph", () => {
  it("dot → bullet char", () => expect(resolveBulletGlyph("dot")).toBe("• "));
  it("dash → en-dash",    () => expect(resolveBulletGlyph("dash")).toBe("– "));
  it("check → checkmark", () => expect(resolveBulletGlyph("check")).toBe("✓ "));
  it("none → empty string", () => expect(resolveBulletGlyph("none")).toBe(""));
  it("unknown style falls back to bullet", () => {
    expect(resolveBulletGlyph("star")).toBe("• ");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// color-resolver
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveTextColor", () => {
  it("ultra_high → full white opacity 1.0", () => {
    expect(resolveTextColor("ultra_high")).toBe("rgba(255,255,255,1.00)");
  });
  it("high → near-full white opacity", () => {
    expect(resolveTextColor("high")).toContain("0.97");
  });
  it("medium → reduced opacity light grey", () => {
    expect(resolveTextColor("medium")).toContain("220");
  });
  it("low → further-reduced opacity grey", () => {
    expect(resolveTextColor("low")).toContain("180");
  });
  it("each level returns an rgba string", () => {
    const levels = ["ultra_high", "high", "medium", "low"] as const;
    for (const l of levels) {
      expect(resolveTextColor(l)).toMatch(/^rgba\(/);
    }
  });
});

describe("resolveShadowOpacity", () => {
  it("ultra_high → highest shadow opacity", () => {
    expect(resolveShadowOpacity("ultra_high")).toBe(0.85);
  });
  it("high → 0.65", () => {
    expect(resolveShadowOpacity("high")).toBe(0.65);
  });
  it("medium → 0.40", () => {
    expect(resolveShadowOpacity("medium")).toBe(0.40);
  });
  it("low → 0 (no shadow)", () => {
    expect(resolveShadowOpacity("low")).toBe(0);
  });
  it("shadow opacity decreases with contrast level", () => {
    expect(resolveShadowOpacity("ultra_high")).toBeGreaterThan(resolveShadowOpacity("high"));
    expect(resolveShadowOpacity("high")).toBeGreaterThan(resolveShadowOpacity("medium"));
    expect(resolveShadowOpacity("medium")).toBeGreaterThan(resolveShadowOpacity("low"));
  });
});

describe("resolveCTAButtonColor", () => {
  it("returns the default trust-blue when no color provided", () => {
    expect(resolveCTAButtonColor()).toBe(DEFAULT_CTA_COLOR);
  });
  it("returns the default when null is passed", () => {
    expect(resolveCTAButtonColor(null)).toBe(DEFAULT_CTA_COLOR);
  });
  it("returns the default when undefined is passed", () => {
    expect(resolveCTAButtonColor(undefined)).toBe(DEFAULT_CTA_COLOR);
  });
  it("returns a valid 6-digit hex as-is", () => {
    expect(resolveCTAButtonColor("#2563eb")).toBe("#2563eb");
  });
  it("accepts a 3-digit hex", () => {
    expect(resolveCTAButtonColor("#f00")).toBe("#f00");
  });
  it("returns default for non-hex string", () => {
    expect(resolveCTAButtonColor("blue")).toBe(DEFAULT_CTA_COLOR);
  });
  it("returns default for hex without #", () => {
    expect(resolveCTAButtonColor("2563eb")).toBe(DEFAULT_CTA_COLOR);
  });
  it("strips whitespace from hex input", () => {
    expect(resolveCTAButtonColor("  #2563eb  ")).toBe("#2563eb");
  });
});

describe("hexToSvgRgba", () => {
  it("converts 6-digit hex to rgba string", () => {
    expect(hexToSvgRgba("#ff0000")).toBe("rgba(255,0,0,1.00)");
  });
  it("converts 3-digit hex correctly", () => {
    expect(hexToSvgRgba("#f00")).toBe("rgba(255,0,0,1.00)");
  });
  it("respects alpha parameter", () => {
    expect(hexToSvgRgba("#ffffff", 0.5)).toContain("0.50");
  });
  it("trust blue converts correctly", () => {
    const result = hexToSvgRgba("#1a56db");
    expect(result).toContain("26");   // 0x1a = 26
    expect(result).toContain("86");   // 0x56 = 86
    expect(result).toContain("219");  // 0xdb = 219
  });
  it("falls back gracefully on invalid hex", () => {
    // Should not throw
    expect(() => hexToSvgRgba("invalid")).not.toThrow();
  });
});

describe("lightenHex", () => {
  it("lightens a dark color by ~30 per channel", () => {
    const result = lightenHex("#000000");
    expect(result).toBe("#1e1e1e"); // 30 = 0x1e
  });
  it("does not exceed 255 per channel", () => {
    const result = lightenHex("#ffffff");
    expect(result).toBe("#ffffff");
  });
  it("returns a valid hex string starting with #", () => {
    expect(lightenHex("#1a56db")).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("result is lighter than input", () => {
    const r = parseInt(lightenHex("#100000").slice(1, 3), 16);
    expect(r).toBeGreaterThan(0x10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSvgTextLayer — pure SVG generation
// ─────────────────────────────────────────────────────────────────────────────

describe("buildSvgTextLayer", () => {
  const plan  = makeRenderPlan();
  const copy  = makeCopy();
  const typo  = makeTypography();
  const svg   = buildSvgTextLayer(plan, copy, typo);

  it("returns a string", () => {
    expect(typeof svg).toBe("string");
  });

  it("has correct svg root element with canvas dimensions", () => {
    expect(svg).toContain('width="1080"');
    expect(svg).toContain('height="1920"');
  });

  it("contains the headline text", () => {
    expect(svg).toContain("Transform Your Health Today");
  });

  it("contains the CTA text", () => {
    expect(svg).toContain("Book Now");
  });

  it("contains a CTA rect element", () => {
    expect(svg).toContain("<rect");
  });

  it("contains benefit items", () => {
    expect(svg).toContain("Advanced diagnostics");
    expect(svg).toContain("Same-day appointments");
    expect(svg).toContain("Trusted specialists");
  });

  it("contains the offer text", () => {
    expect(svg).toContain("50% Off First Visit");
  });

  it("contains the disclaimer", () => {
    expect(svg).toContain("Terms and conditions apply.");
  });

  it("contains the subheadline", () => {
    expect(svg).toContain("Expert care you can trust");
  });

  it("contains the social proof text", () => {
    expect(svg).toContain("Rating");
  });

  it("contains a defs block for filters", () => {
    expect(svg).toContain("<defs>");
  });

  it("contains feDropShadow for high-contrast elements", () => {
    expect(svg).toContain("feDropShadow");
  });

  it("contains font-family attribute", () => {
    expect(svg).toContain("font-family=");
  });

  it("contains font-weight attribute", () => {
    expect(svg).toContain("font-weight=");
  });

  it("contains fill attribute on text elements", () => {
    expect(svg).toContain("fill=");
  });

  it("SVG opens and closes properly", () => {
    expect(svg.trim()).toMatch(/^<svg /);
    expect(svg.trim()).toMatch(/<\/svg>$/);
  });

  it("escapes ampersands in copy text", () => {
    const ampCopy = makeCopy({ headline: "Health & Wellness" });
    const ampSvg  = buildSvgTextLayer(plan, ampCopy, typo);
    expect(ampSvg).toContain("Health &amp; Wellness");
    expect(ampSvg).not.toContain("Health & Wellness");
  });

  it("escapes angle brackets in copy text", () => {
    const ltCopy = makeCopy({ headline: "Less <than> expected" });
    const ltSvg  = buildSvgTextLayer(plan, ltCopy, typo);
    expect(ltSvg).toContain("&lt;than&gt;");
  });

  it("uses brand primary color for CTA button when provided", () => {
    const svgBrand = buildSvgTextLayer(plan, copy, typo, { brandPrimaryColor: "#e63946" });
    expect(svgBrand).toContain("#e63946");
  });

  it("falls back to DEFAULT_CTA_COLOR when no brand color given", () => {
    expect(svg).toContain(DEFAULT_CTA_COLOR);
  });

  it("applies uppercase text transform to headline when configured", () => {
    const upperTypo = makeTypography({
      headline: makeElementTypography({ importance: 10, size: "xxl", weight: "dominant", contrast: "ultra_high", textTransform: "uppercase" }),
    });
    const upperSvg = buildSvgTextLayer(plan, copy, upperTypo);
    expect(upperSvg).toContain("TRANSFORM YOUR HEALTH TODAY");
  });

  it("renders bullet prefix on benefit items when bulletStyle is dot", () => {
    const dotSvg = buildSvgTextLayer(plan, copy, typo);
    expect(dotSvg).toContain("• Advanced diagnostics");
  });

  it("renders dash prefix when bulletStyle is dash", () => {
    const dashTypo = makeTypography({
      benefits: makeBenefitTypography({ bulletStyle: "dash" }),
    });
    const dashSvg = buildSvgTextLayer(plan, copy, dashTypo);
    expect(dashSvg).toContain("– Advanced diagnostics");
  });

  it("omits subheadline block when renderPlan.subheadline is null", () => {
    const noSubPlan = makeRenderPlan({ subheadline: null });
    const noSubSvg  = buildSvgTextLayer(noSubPlan, copy, typo);
    expect(noSubSvg).not.toContain("Expert care you can trust");
  });

  it("omits offer block when renderPlan.offer is null", () => {
    const noOfferPlan = makeRenderPlan({ offer: null });
    const noOfferSvg  = buildSvgTextLayer(noOfferPlan, copy, typo);
    expect(noOfferSvg).not.toContain("50% Off First Visit");
  });

  it("omits social proof when copy.socialProof is empty", () => {
    const emptySocialCopy = makeCopy({ socialProof: [] });
    const svgNoSocial     = buildSvgTextLayer(plan, emptySocialCopy, typo);
    expect(svgNoSocial).not.toContain("Rating");
  });

  it("omits disclaimer block when renderPlan.disclaimer is null", () => {
    const noDisclaimPlan = makeRenderPlan({ disclaimer: null });
    const svgNoDisclaim  = buildSvgTextLayer(noDisclaimPlan, copy, typo);
    expect(svgNoDisclaim).not.toContain("Terms and conditions apply.");
  });

  it("does not throw when benefits array is empty", () => {
    const noBenCopy = makeCopy({ benefits: [] });
    expect(() => buildSvgTextLayer(plan, noBenCopy, typo)).not.toThrow();
  });

  it("multi-column benefits use x-offsets per column", () => {
    const twoColPlan = makeRenderPlan({
      benefits: { ...makeBenefitRegion(), columns: 2, columnWidth: 480, columnSpacing: 24 },
    });
    const twoColTypo = makeTypography({
      benefits: makeBenefitTypography({ columns: 2 }),
    });
    const svgTwoCol = buildSvgTextLayer(twoColPlan, copy, twoColTypo);
    // Second benefit should be in second column — x offset = 48 + (480+24)*1 = 552
    expect(svgTwoCol).toContain('x="552"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// composeAdvertisement — integration (requires sharp)
// ─────────────────────────────────────────────────────────────────────────────

async function makeBackgroundBuffer(
  width  = 1080,
  height = 1920,
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 50, g: 80, b: 120 } },
  }).png().toBuffer();
}

describe("composeAdvertisement", () => {
  it("returns a FinalAdvertisement with a non-empty imageBuffer", async () => {
    const bg     = await makeBackgroundBuffer();
    const result = await composeAdvertisement({
      backgroundImageBuffer: bg,
      renderPlan:  makeRenderPlan(),
      copy:        makeCopy(),
      typography:  makeTypography(),
    });
    expect(result.imageBuffer).toBeInstanceOf(Buffer);
    expect(result.imageBuffer.length).toBeGreaterThan(0);
  }, 15000);

  it("output has correct width and height", async () => {
    const bg     = await makeBackgroundBuffer();
    const result = await composeAdvertisement({
      backgroundImageBuffer: bg,
      renderPlan:  makeRenderPlan(),
      copy:        makeCopy(),
      typography:  makeTypography(),
    });
    expect(result.width).toBe(1080);
    expect(result.height).toBe(1920);
  }, 15000);

  it("default output format is PNG with correct mimeType", async () => {
    const bg     = await makeBackgroundBuffer();
    const result = await composeAdvertisement({
      backgroundImageBuffer: bg,
      renderPlan: makeRenderPlan(),
      copy:       makeCopy(),
      typography: makeTypography(),
    });
    expect(result.mimeType).toBe("image/png");
  }, 15000);

  it("jpeg format returns correct mimeType", async () => {
    const bg     = await makeBackgroundBuffer();
    const result = await composeAdvertisement({
      backgroundImageBuffer: bg,
      renderPlan:   makeRenderPlan(),
      copy:         makeCopy(),
      typography:   makeTypography(),
      outputFormat: "jpeg",
    });
    expect(result.mimeType).toBe("image/jpeg");
  }, 15000);

  it("webp format returns correct mimeType", async () => {
    const bg     = await makeBackgroundBuffer();
    const result = await composeAdvertisement({
      backgroundImageBuffer: bg,
      renderPlan:   makeRenderPlan(),
      copy:         makeCopy(),
      typography:   makeTypography(),
      outputFormat: "webp",
    });
    expect(result.mimeType).toBe("image/webp");
  }, 15000);

  it("always includes background and text_overlay in layersApplied", async () => {
    const bg     = await makeBackgroundBuffer();
    const result = await composeAdvertisement({
      backgroundImageBuffer: bg,
      renderPlan: makeRenderPlan(),
      copy:       makeCopy(),
      typography: makeTypography(),
    });
    expect(result.layersApplied).toContain("background");
    expect(result.layersApplied).toContain("text_overlay");
  }, 15000);

  it("does not include logo/badge/qr when asset buffers are absent", async () => {
    const bg     = await makeBackgroundBuffer();
    const result = await composeAdvertisement({
      backgroundImageBuffer: bg,
      renderPlan: makeRenderPlan(),
      copy:       makeCopy(),
      typography: makeTypography(),
    });
    expect(result.layersApplied).not.toContain("logo");
    expect(result.layersApplied).not.toContain("badge");
    expect(result.layersApplied).not.toContain("qr");
  }, 15000);

  it("includes logo layer when logo buffer and region are present", async () => {
    const bg   = await makeBackgroundBuffer();
    const logo = await sharp({
      create: { width: 100, height: 40, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    }).png().toBuffer();

    const planWithLogo = makeRenderPlan({
      logo: {
        elementId:  "logo",
        x:          40,
        y:          40,
        width:      160,
        height:     64,
        scale:      1,
        corner:     "top_left",
        stackOrder: 10,
      },
    });

    const result = await composeAdvertisement({
      backgroundImageBuffer: bg,
      renderPlan:   planWithLogo,
      copy:         makeCopy(),
      typography:   makeTypography(),
      assetBuffers: { logo },
    });
    expect(result.layersApplied).toContain("logo");
  }, 15000);

  it("records processingTimeMs as a non-negative number", async () => {
    const bg     = await makeBackgroundBuffer();
    const result = await composeAdvertisement({
      backgroundImageBuffer: bg,
      renderPlan: makeRenderPlan(),
      copy:       makeCopy(),
      typography: makeTypography(),
    });
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  }, 15000);

  it("renderPlanUsed is the same plan passed in", async () => {
    const bg   = await makeBackgroundBuffer();
    const plan = makeRenderPlan();
    const result = await composeAdvertisement({
      backgroundImageBuffer: bg,
      renderPlan: plan,
      copy:       makeCopy(),
      typography: makeTypography(),
    });
    expect(result.renderPlanUsed).toBe(plan);
  }, 15000);

  it("sharp can decode the output PNG buffer", async () => {
    const bg     = await makeBackgroundBuffer();
    const result = await composeAdvertisement({
      backgroundImageBuffer: bg,
      renderPlan: makeRenderPlan(),
      copy:       makeCopy(),
      typography: makeTypography(),
    });
    const meta = await sharp(result.imageBuffer).metadata();
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1920);
  }, 15000);

  it("uses brand primary color in output (does not throw)", async () => {
    const bg = await makeBackgroundBuffer();
    await expect(composeAdvertisement({
      backgroundImageBuffer: bg,
      renderPlan:   makeRenderPlan(),
      copy:         makeCopy(),
      typography:   makeTypography(),
      brandContext: { primaryColor: "#e63946" },
    })).resolves.toBeDefined();
  }, 15000);
});
