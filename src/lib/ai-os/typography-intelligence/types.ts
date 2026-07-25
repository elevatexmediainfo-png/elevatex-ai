// Phase 8.9 — Typography Intelligence Engine types.
// Defines HOW text visually behaves on the canvas.
// Never font families. Never text generation. Only visual behaviour.

import type { SupportedIndustryId, BrandType } from "../commercial-assets/types";

// ─────────────────────────────────────────────────────────────────────────────
// Primitive scales
// ─────────────────────────────────────────────────────────────────────────────

export type TypographySize =
  | "xs"      // 10–11px equiv
  | "sm"      // 12–13px equiv
  | "base"    // 14–16px equiv
  | "lg"      // 18–20px equiv
  | "xl"      // 24–28px equiv
  | "xxl"     // 32–40px equiv
  | "display"; // 48–64px equiv

export type TypographyWeight =
  | "thin"
  | "light"
  | "regular"
  | "medium"
  | "semibold"
  | "bold"
  | "extrabold"
  | "dominant"; // heaviest display weight

export type TypographyAlignment = "left" | "center" | "right" | "justified";
export type LetterSpacingScale  = "tight" | "normal" | "wide" | "loose";
export type LineHeightScale     = "tight" | "snug" | "normal" | "relaxed" | "loose";
export type ContrastLevel       = "ultra_high" | "high" | "medium" | "low";
export type DensityLevel        = "sparse" | "balanced" | "dense";
export type BulletStyle         = "dash" | "dot" | "check" | "none";
export type TextTransform       = "none" | "uppercase" | "capitalize" | "lowercase";

// 10 semantic typography styles (composition strategies normalised to style)
export type TypographyStyle =
  | "luxury"
  | "minimal"
  | "editorial"
  | "product"
  | "healthcare"
  | "real_estate"
  | "restaurant"
  | "fashion"
  | "corporate"
  | "social";

// ─────────────────────────────────────────────────────────────────────────────
// Element-level typography spec
// ─────────────────────────────────────────────────────────────────────────────

export interface ElementTypography {
  importance:    number;              // 1–10 visual hierarchy rank
  size:          TypographySize;
  weight:        TypographyWeight;
  alignment:     TypographyAlignment;
  letterSpacing: LetterSpacingScale;
  lineHeight:    LineHeightScale;
  spacingAbove:  number;             // spacing units (multiples of 4)
  spacingBelow:  number;
  contrast:      ContrastLevel;
  maxLines?:     number;
  textTransform: TextTransform;
  opacity:       number;             // 0–100
}

export interface BenefitTypography extends ElementTypography {
  columns:       1 | 2 | 3;
  columnSpacing: number;             // spacing units between columns
  bulletStyle:   BulletStyle;
  lineSpacing:   number;             // spacing units between bullet rows
}

export interface CTATypography extends ElementTypography {
  paddingH:     number;              // horizontal padding (spacing units)
  paddingV:     number;              // vertical padding (spacing units)
  borderRadius: number;              // border radius units
  letterSpacing: LetterSpacingScale;
  minWidth:     number;              // minimum width (spacing units)
}

// ─────────────────────────────────────────────────────────────────────────────
// Spacing system
// ─────────────────────────────────────────────────────────────────────────────

export interface SpacingSystem {
  baseUnit:       number;  // = 4 always
  globalPadding:  number;  // canvas-level edge padding (spacing units)
  sectionSpacing: number;  // between major sections
  elementSpacing: number;  // between elements within a section
  density:        DensityLevel;
  breathingRoom:  number;  // min clear space around critical elements
}

// ─────────────────────────────────────────────────────────────────────────────
// Responsive adjustments per aspect ratio
// ─────────────────────────────────────────────────────────────────────────────

export interface BreakpointAdjustment {
  headlineSize:              TypographySize;
  subheadlineSize:           TypographySize;
  ctaSize:                   TypographySize;
  benefitSize:               TypographySize;
  benefitColumns:            1 | 2 | 3;
  globalPaddingMultiplier:   number;         // scale applied to SpacingSystem.globalPadding
  sectionSpacingMultiplier:  number;
}

export interface ResponsiveAdjustments {
  portrait:  BreakpointAdjustment; // 9:16, 4:5
  square:    BreakpointAdjustment; // 1:1
  landscape: BreakpointAdjustment; // 16:9, 1.91:1
}

// ─────────────────────────────────────────────────────────────────────────────
// Hierarchy map — renderer reading order
// ─────────────────────────────────────────────────────────────────────────────

export interface HierarchyMap {
  primary:     string; // always "headline"
  secondary:   string; // always "cta"
  tertiary:    string; // "offer" if present, else "subheadline"
  quaternary:  string; // "subheadline" or "benefits"
  body:        string; // "benefits" or "socialProof"
  footnote:    string; // "disclaimer" or "footer"
}

// ─────────────────────────────────────────────────────────────────────────────
// Final output
// ─────────────────────────────────────────────────────────────────────────────

export interface CommercialTypographyPlan {
  typographyStyle:  TypographyStyle;
  headline:         ElementTypography;
  subheadline:      ElementTypography | null;
  benefits:         BenefitTypography;
  cta:              CTATypography;
  secondaryCta:     CTATypography | null;
  socialProof:      ElementTypography;
  offer:            ElementTypography | null;
  badge:            ElementTypography | null;
  disclaimer:       ElementTypography | null;
  footer:           ElementTypography;
  responsive:       ResponsiveAdjustments;
  spacing:          SpacingSystem;
  hierarchy:        HierarchyMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine input
// ─────────────────────────────────────────────────────────────────────────────

export interface TypographyInput {
  industry:             SupportedIndustryId;
  brandType:            BrandType;
  communicationStyle:   string;
  aspectRatio:          string;   // "9:16" | "1:1" | "16:9" | "4:5" | etc.
  orientation:          string;   // "portrait" | "landscape" | "square"
  density:              DensityLevel;
  hasOffer:             boolean;
  hasBadge:             boolean;
  hasDisclaimer:        boolean;
  hasSubheadline:       boolean;
  hasSecondaryCta:      boolean;
  benefitCount:         number;
  compositionStrategyId: string;
}
