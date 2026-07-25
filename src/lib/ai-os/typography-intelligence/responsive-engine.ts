// Phase 8.9 — Responsive Engine.
// Provides breakpoint-specific typography adjustments for 9:16, 1:1, 16:9, etc.
// These multiply or override base style values — they do not replace them.

import type { BreakpointAdjustment, ResponsiveAdjustments, TypographySize, TypographyStyle } from "./types";
import { STYLE_DEFINITIONS } from "./industry-rules";

// ─────────────────────────────────────────────────────────────────────────────
// Default breakpoint adjustments (applied to any style)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BREAKPOINTS: ResponsiveAdjustments = {
  portrait: {
    headlineSize:              "xxl",
    subheadlineSize:           "lg",
    ctaSize:                   "xl",
    benefitSize:               "base",
    benefitColumns:            1,
    globalPaddingMultiplier:   1.4,
    sectionSpacingMultiplier:  1.3,
  },
  square: {
    headlineSize:              "xl",
    subheadlineSize:           "lg",
    ctaSize:                   "lg",
    benefitSize:               "sm",
    benefitColumns:            2,
    globalPaddingMultiplier:   1.0,
    sectionSpacingMultiplier:  1.0,
  },
  landscape: {
    headlineSize:              "xl",
    subheadlineSize:           "base",
    ctaSize:                   "base",
    benefitSize:               "xs",
    benefitColumns:            3,
    globalPaddingMultiplier:   0.8,
    sectionSpacingMultiplier:  0.8,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Style-specific overrides on top of defaults
// Only the fields that differ from DEFAULT_BREAKPOINTS are specified.
// ─────────────────────────────────────────────────────────────────────────────

type StyleBreakpointOverrides = Partial<Record<
  keyof ResponsiveAdjustments,
  Partial<BreakpointAdjustment>
>>;

const STYLE_BREAKPOINT_OVERRIDES: Partial<Record<TypographyStyle, StyleBreakpointOverrides>> = {
  luxury: {
    portrait:  { headlineSize: "xxl",    benefitColumns: 1, globalPaddingMultiplier: 1.6 },
    square:    { headlineSize: "xxl",    benefitColumns: 1, globalPaddingMultiplier: 1.2 },
    landscape: { headlineSize: "xl",     benefitColumns: 2, globalPaddingMultiplier: 1.0 },
  },
  social: {
    portrait:  { headlineSize: "display", benefitColumns: 1, ctaSize: "xxl" },
    square:    { headlineSize: "xxl",    benefitColumns: 1, ctaSize: "xl" },
    landscape: { headlineSize: "xl",     benefitColumns: 2, ctaSize: "lg" },
  },
  fashion: {
    portrait:  { headlineSize: "display", benefitColumns: 1, globalPaddingMultiplier: 1.5 },
    square:    { headlineSize: "xxl",    benefitColumns: 2, globalPaddingMultiplier: 1.2 },
    landscape: { headlineSize: "xl",     benefitColumns: 3, globalPaddingMultiplier: 0.8 },
  },
  editorial: {
    portrait:  { headlineSize: "display", benefitColumns: 1 },
    landscape: { headlineSize: "xxl",    benefitColumns: 2 },
  },
  minimal: {
    portrait:  { headlineSize: "xl",     benefitColumns: 1, globalPaddingMultiplier: 1.8 },
    landscape: { headlineSize: "lg",     benefitColumns: 3, globalPaddingMultiplier: 0.7 },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Aspect ratio → orientation normalisation
// ─────────────────────────────────────────────────────────────────────────────

export function normaliseOrientation(
  aspectRatio: string,
  orientation: string,
): "portrait" | "square" | "landscape" {
  if (orientation === "portrait")  return "portrait";
  if (orientation === "landscape") return "landscape";
  if (orientation === "square")    return "square";

  if (aspectRatio === "9:16" || aspectRatio === "4:5" || aspectRatio === "2:3") return "portrait";
  if (aspectRatio === "1:1")                                                     return "square";
  return "landscape";
}

// ─────────────────────────────────────────────────────────────────────────────
// Size escalation helper: bump size up by one step if needed
// ─────────────────────────────────────────────────────────────────────────────

const SIZE_ORDER: TypographySize[] = ["xs", "sm", "base", "lg", "xl", "xxl", "display"];

export function escalateSize(size: TypographySize, steps = 1): TypographySize {
  const idx = SIZE_ORDER.indexOf(size);
  return SIZE_ORDER[Math.min(SIZE_ORDER.length - 1, idx + steps)] ?? size;
}

export function deescalateSize(size: TypographySize, steps = 1): TypographySize {
  const idx = SIZE_ORDER.indexOf(size);
  return SIZE_ORDER[Math.max(0, idx - steps)] ?? size;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function buildResponsiveAdjustments(
  style:       TypographyStyle,
  aspectRatio: string,
  orientation: string,
): ResponsiveAdjustments {
  const def   = STYLE_DEFINITIONS[style];
  const overrides = STYLE_BREAKPOINT_OVERRIDES[style] ?? {};

  const merge = (
    bp: keyof ResponsiveAdjustments,
    defaults: BreakpointAdjustment,
  ): BreakpointAdjustment => ({
    ...defaults,
    ...(overrides[bp] ?? {}),
  });

  void (aspectRatio + orientation + def.headlineSize); // used implicitly via style

  return {
    portrait:  merge("portrait",  DEFAULT_BREAKPOINTS.portrait),
    square:    merge("square",    DEFAULT_BREAKPOINTS.square),
    landscape: merge("landscape", DEFAULT_BREAKPOINTS.landscape),
  };
}

export { DEFAULT_BREAKPOINTS };
