// Phase 8.9 — Industry typography rules and style definitions.
// Each TypographyStyle defines base visual behaviour for its context.

import type {
  TypographyStyle,
  TypographySize,
  TypographyWeight,
  TypographyAlignment,
  LetterSpacingScale,
  LineHeightScale,
  ContrastLevel,
  TextTransform,
  BulletStyle,
  DensityLevel,
} from "./types";
import type { SupportedIndustryId } from "../commercial-assets/types";

// ─────────────────────────────────────────────────────────────────────────────
// Composition strategy → TypographyStyle mapping
// ─────────────────────────────────────────────────────────────────────────────

export const COMPOSITION_TO_TYPOGRAPHY_STYLE: Record<string, TypographyStyle> = {
  luxury:       "luxury",
  minimal:      "minimal",
  editorial:    "editorial",
  product:      "product",
  healthcare:   "healthcare",
  real_estate:  "real_estate",
  restaurant:   "restaurant",
  fashion:      "fashion",
  corporate:    "corporate",
  social:       "social",
  mobile_first: "social",
  landscape:    "product",
  square:       "product",
  vertical:     "social",
};

// ─────────────────────────────────────────────────────────────────────────────
// Industry → default TypographyStyle (when composition not available)
// ─────────────────────────────────────────────────────────────────────────────

export const INDUSTRY_DEFAULT_STYLE: Record<SupportedIndustryId, TypographyStyle> = {
  restaurant:  "restaurant",
  dental:      "healthcare",
  real_estate: "real_estate",
  healthcare:  "healthcare",
  jewelry:     "luxury",
  salon:       "fashion",
  education:   "corporate",
  automotive:  "product",
  finance:     "corporate",
  tech:        "minimal",
  fashion:     "fashion",
  events:      "social",
  general:     "corporate",
};

// ─────────────────────────────────────────────────────────────────────────────
// Style definitions — base typography behaviour per style
// ─────────────────────────────────────────────────────────────────────────────

export interface StyleDefinition {
  headlineWeight:    TypographyWeight;
  headlineSize:      TypographySize;
  headlineAlignment: TypographyAlignment;
  headlineSpacing:   LetterSpacingScale;
  headlineLines:     LineHeightScale;
  headlineMaxLines:  number;
  headlineContrast:  ContrastLevel;
  headlineTransform: TextTransform;
  ctaSize:           TypographySize;
  ctaWeight:         TypographyWeight;
  ctaAlignment:      TypographyAlignment;
  ctaPaddingH:       number;   // spacing units
  ctaPaddingV:       number;
  ctaBorderRadius:   number;
  ctaContrast:       ContrastLevel;
  ctaLetterSpacing:  LetterSpacingScale;
  bodyAlignment:     TypographyAlignment;
  bodySize:          TypographySize;
  benefitBullet:     BulletStyle;
  density:           DensityLevel;
  footerAlignment:   TypographyAlignment;
  globalPadding:     number;  // spacing units
  sectionSpacing:    number;
  elementSpacing:    number;
}

export const STYLE_DEFINITIONS: Record<TypographyStyle, StyleDefinition> = {
  luxury: {
    headlineWeight:    "dominant",
    headlineSize:      "xxl",
    headlineAlignment: "left",
    headlineSpacing:   "tight",
    headlineLines:     "tight",
    headlineMaxLines:  1,
    headlineContrast:  "ultra_high",
    headlineTransform: "none",
    ctaSize:           "lg",
    ctaWeight:         "semibold",
    ctaAlignment:      "left",
    ctaPaddingH:       8,   // × 4px = 32px
    ctaPaddingV:       4,   // × 4px = 16px
    ctaBorderRadius:   0,   // sharp edge for luxury
    ctaContrast:       "high",
    ctaLetterSpacing:  "wide",
    bodyAlignment:     "left",
    bodySize:          "sm",
    benefitBullet:     "dash",
    density:           "sparse",
    footerAlignment:   "left",
    globalPadding:     10,
    sectionSpacing:    8,
    elementSpacing:    4,
  },
  editorial: {
    headlineWeight:    "dominant",
    headlineSize:      "display",
    headlineAlignment: "left",
    headlineSpacing:   "normal",
    headlineLines:     "tight",
    headlineMaxLines:  2,
    headlineContrast:  "ultra_high",
    headlineTransform: "none",
    ctaSize:           "base",
    ctaWeight:         "bold",
    ctaAlignment:      "left",
    ctaPaddingH:       6,
    ctaPaddingV:       3,
    ctaBorderRadius:   0,
    ctaContrast:       "ultra_high",
    ctaLetterSpacing:  "wide",
    bodyAlignment:     "left",
    bodySize:          "sm",
    benefitBullet:     "dash",
    density:           "balanced",
    footerAlignment:   "left",
    globalPadding:     8,
    sectionSpacing:    6,
    elementSpacing:    3,
  },
  healthcare: {
    headlineWeight:    "bold",
    headlineSize:      "xl",
    headlineAlignment: "center",
    headlineSpacing:   "normal",
    headlineLines:     "snug",
    headlineMaxLines:  2,
    headlineContrast:  "high",
    headlineTransform: "none",
    ctaSize:           "lg",
    ctaWeight:         "bold",
    ctaAlignment:      "center",
    ctaPaddingH:       8,
    ctaPaddingV:       4,
    ctaBorderRadius:   2,   // × 4px = 8px
    ctaContrast:       "high",
    ctaLetterSpacing:  "normal",
    bodyAlignment:     "center",
    bodySize:          "sm",
    benefitBullet:     "check",
    density:           "balanced",
    footerAlignment:   "center",
    globalPadding:     7,
    sectionSpacing:    6,
    elementSpacing:    3,
  },
  corporate: {
    headlineWeight:    "bold",
    headlineSize:      "xl",
    headlineAlignment: "left",
    headlineSpacing:   "normal",
    headlineLines:     "snug",
    headlineMaxLines:  2,
    headlineContrast:  "high",
    headlineTransform: "none",
    ctaSize:           "base",
    ctaWeight:         "semibold",
    ctaAlignment:      "center",
    ctaPaddingH:       6,
    ctaPaddingV:       3,
    ctaBorderRadius:   1,
    ctaContrast:       "high",
    ctaLetterSpacing:  "normal",
    bodyAlignment:     "left",
    bodySize:          "sm",
    benefitBullet:     "dot",
    density:           "balanced",
    footerAlignment:   "left",
    globalPadding:     6,
    sectionSpacing:    5,
    elementSpacing:    3,
  },
  restaurant: {
    headlineWeight:    "extrabold",
    headlineSize:      "xxl",
    headlineAlignment: "center",
    headlineSpacing:   "tight",
    headlineLines:     "tight",
    headlineMaxLines:  2,
    headlineContrast:  "ultra_high",
    headlineTransform: "none",
    ctaSize:           "lg",
    ctaWeight:         "bold",
    ctaAlignment:      "center",
    ctaPaddingH:       8,
    ctaPaddingV:       4,
    ctaBorderRadius:   2,
    ctaContrast:       "ultra_high",
    ctaLetterSpacing:  "normal",
    bodyAlignment:     "center",
    bodySize:          "sm",
    benefitBullet:     "dot",
    density:           "balanced",
    footerAlignment:   "center",
    globalPadding:     6,
    sectionSpacing:    5,
    elementSpacing:    3,
  },
  real_estate: {
    headlineWeight:    "bold",
    headlineSize:      "xl",
    headlineAlignment: "center",
    headlineSpacing:   "normal",
    headlineLines:     "snug",
    headlineMaxLines:  2,
    headlineContrast:  "high",
    headlineTransform: "none",
    ctaSize:           "lg",
    ctaWeight:         "bold",
    ctaAlignment:      "center",
    ctaPaddingH:       8,
    ctaPaddingV:       4,
    ctaBorderRadius:   1,
    ctaContrast:       "high",
    ctaLetterSpacing:  "normal",
    bodyAlignment:     "left",
    bodySize:          "sm",
    benefitBullet:     "check",
    density:           "balanced",
    footerAlignment:   "center",
    globalPadding:     7,
    sectionSpacing:    6,
    elementSpacing:    3,
  },
  fashion: {
    headlineWeight:    "dominant",
    headlineSize:      "display",
    headlineAlignment: "left",
    headlineSpacing:   "loose",
    headlineLines:     "tight",
    headlineMaxLines:  1,
    headlineContrast:  "ultra_high",
    headlineTransform: "uppercase",
    ctaSize:           "sm",
    ctaWeight:         "semibold",
    ctaAlignment:      "right",
    ctaPaddingH:       6,
    ctaPaddingV:       3,
    ctaBorderRadius:   0,
    ctaContrast:       "high",
    ctaLetterSpacing:  "loose",
    bodyAlignment:     "left",
    bodySize:          "xs",
    benefitBullet:     "none",
    density:           "sparse",
    footerAlignment:   "left",
    globalPadding:     8,
    sectionSpacing:    6,
    elementSpacing:    4,
  },
  product: {
    headlineWeight:    "bold",
    headlineSize:      "xl",
    headlineAlignment: "center",
    headlineSpacing:   "normal",
    headlineLines:     "snug",
    headlineMaxLines:  2,
    headlineContrast:  "high",
    headlineTransform: "none",
    ctaSize:           "lg",
    ctaWeight:         "bold",
    ctaAlignment:      "center",
    ctaPaddingH:       8,
    ctaPaddingV:       4,
    ctaBorderRadius:   2,
    ctaContrast:       "high",
    ctaLetterSpacing:  "normal",
    bodyAlignment:     "center",
    bodySize:          "sm",
    benefitBullet:     "check",
    density:           "balanced",
    footerAlignment:   "center",
    globalPadding:     6,
    sectionSpacing:    5,
    elementSpacing:    3,
  },
  social: {
    headlineWeight:    "extrabold",
    headlineSize:      "xxl",
    headlineAlignment: "center",
    headlineSpacing:   "tight",
    headlineLines:     "tight",
    headlineMaxLines:  2,
    headlineContrast:  "ultra_high",
    headlineTransform: "none",
    ctaSize:           "xl",
    ctaWeight:         "extrabold",
    ctaAlignment:      "center",
    ctaPaddingH:       8,
    ctaPaddingV:       5,
    ctaBorderRadius:   3,
    ctaContrast:       "ultra_high",
    ctaLetterSpacing:  "normal",
    bodyAlignment:     "center",
    bodySize:          "sm",
    benefitBullet:     "dot",
    density:           "dense",
    footerAlignment:   "center",
    globalPadding:     5,
    sectionSpacing:    4,
    elementSpacing:    2,
  },
  minimal: {
    headlineWeight:    "semibold",
    headlineSize:      "xl",
    headlineAlignment: "center",
    headlineSpacing:   "wide",
    headlineLines:     "normal",
    headlineMaxLines:  2,
    headlineContrast:  "high",
    headlineTransform: "none",
    ctaSize:           "base",
    ctaWeight:         "medium",
    ctaAlignment:      "center",
    ctaPaddingH:       6,
    ctaPaddingV:       3,
    ctaBorderRadius:   1,
    ctaContrast:       "medium",
    ctaLetterSpacing:  "wide",
    bodyAlignment:     "center",
    bodySize:          "sm",
    benefitBullet:     "none",
    density:           "sparse",
    footerAlignment:   "center",
    globalPadding:     10,
    sectionSpacing:    8,
    elementSpacing:    4,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-style importance scores for each element
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportanceMap {
  headline:    number;
  subheadline: number;
  cta:         number;
  offer:       number;
  badge:       number;
  benefits:    number;
  socialProof: number;
  footer:      number;
  disclaimer:  number;
}

// Headline is ALWAYS 10. CTA is ALWAYS 9.
const BASE_IMPORTANCE: ImportanceMap = {
  headline:    10,
  subheadline: 7,
  cta:         9,
  offer:       8,
  badge:       7,
  benefits:    6,
  socialProof: 5,
  footer:      2,
  disclaimer:  1,
};

// Style overrides for elements that differ
const STYLE_IMPORTANCE_OVERRIDES: Partial<Record<TypographyStyle, Partial<ImportanceMap>>> = {
  luxury:      { offer: 6, badge: 5, socialProof: 4 },           // luxury downplays deal urgency
  editorial:   { subheadline: 8, benefits: 5 },                  // subheadline more prominent
  fashion:     { badge: 8, benefits: 4, socialProof: 3 },        // fashion foregrounds badge
  social:      { cta: 10, offer: 9, subheadline: 8 },            // social maximises CTA
  minimal:     { subheadline: 5, socialProof: 3, badge: 4 },     // minimal strips clutter
  healthcare:  { subheadline: 8, socialProof: 6 },               // healthcare foregrounds trust
  corporate:   { socialProof: 6, benefits: 7 },                  // corporate values evidence
};

export function getImportanceMap(style: TypographyStyle): ImportanceMap {
  const overrides = STYLE_IMPORTANCE_OVERRIDES[style] ?? {};
  return { ...BASE_IMPORTANCE, ...overrides };
}
