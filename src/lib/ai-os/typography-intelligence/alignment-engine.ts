// Phase 8.9 — Alignment Engine.
// Determines text alignment per element and typography style.
// No font selection. No text generation.

import type { TypographyAlignment, TypographyStyle } from "./types";

interface AlignmentMap {
  headline:    TypographyAlignment;
  subheadline: TypographyAlignment;
  cta:         TypographyAlignment;
  benefits:    TypographyAlignment;
  socialProof: TypographyAlignment;
  offer:       TypographyAlignment;
  badge:       TypographyAlignment;
  footer:      TypographyAlignment;
  disclaimer:  TypographyAlignment;
}

const STYLE_ALIGNMENT: Record<TypographyStyle, AlignmentMap> = {
  luxury: {
    headline:    "left",
    subheadline: "left",
    cta:         "left",
    benefits:    "left",
    socialProof: "left",
    offer:       "left",
    badge:       "center",
    footer:      "left",
    disclaimer:  "left",
  },
  editorial: {
    headline:    "left",
    subheadline: "left",
    cta:         "left",
    benefits:    "left",
    socialProof: "left",
    offer:       "left",
    badge:       "center",
    footer:      "left",
    disclaimer:  "left",
  },
  healthcare: {
    headline:    "center",
    subheadline: "center",
    cta:         "center",
    benefits:    "left",
    socialProof: "center",
    offer:       "center",
    badge:       "center",
    footer:      "center",
    disclaimer:  "center",
  },
  corporate: {
    headline:    "left",
    subheadline: "left",
    cta:         "center",
    benefits:    "left",
    socialProof: "left",
    offer:       "left",
    badge:       "center",
    footer:      "left",
    disclaimer:  "left",
  },
  restaurant: {
    headline:    "center",
    subheadline: "center",
    cta:         "center",
    benefits:    "center",
    socialProof: "center",
    offer:       "center",
    badge:       "center",
    footer:      "center",
    disclaimer:  "center",
  },
  real_estate: {
    headline:    "center",
    subheadline: "center",
    cta:         "center",
    benefits:    "left",
    socialProof: "left",
    offer:       "right",
    badge:       "center",
    footer:      "center",
    disclaimer:  "center",
  },
  fashion: {
    headline:    "left",
    subheadline: "left",
    cta:         "right",
    benefits:    "left",
    socialProof: "left",
    offer:       "left",
    badge:       "center",
    footer:      "left",
    disclaimer:  "left",
  },
  product: {
    headline:    "center",
    subheadline: "center",
    cta:         "center",
    benefits:    "center",
    socialProof: "center",
    offer:       "center",
    badge:       "center",
    footer:      "center",
    disclaimer:  "center",
  },
  social: {
    headline:    "center",
    subheadline: "center",
    cta:         "center",
    benefits:    "center",
    socialProof: "center",
    offer:       "center",
    badge:       "center",
    footer:      "center",
    disclaimer:  "center",
  },
  minimal: {
    headline:    "center",
    subheadline: "center",
    cta:         "center",
    benefits:    "left",
    socialProof: "center",
    offer:       "center",
    badge:       "center",
    footer:      "center",
    disclaimer:  "center",
  },
};

export function getAlignment(
  style:   TypographyStyle,
  element: keyof AlignmentMap,
): TypographyAlignment {
  return STYLE_ALIGNMENT[style][element];
}

export { STYLE_ALIGNMENT };
export type { AlignmentMap };
