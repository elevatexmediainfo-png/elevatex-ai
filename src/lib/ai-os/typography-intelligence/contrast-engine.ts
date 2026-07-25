// Phase 8.9 — Contrast Engine.
// Maps typography style to contrast rules for each element class.
// Contrast drives legibility decisions in the renderer.

import type { ContrastLevel, TypographyStyle } from "./types";

interface ContrastMap {
  headline:    ContrastLevel;
  subheadline: ContrastLevel;
  cta:         ContrastLevel;
  offer:       ContrastLevel;
  badge:       ContrastLevel;
  benefits:    ContrastLevel;
  socialProof: ContrastLevel;
  footer:      ContrastLevel;
  disclaimer:  ContrastLevel;
}

const STYLE_CONTRAST: Record<TypographyStyle, ContrastMap> = {
  luxury: {
    headline:    "ultra_high",
    subheadline: "high",
    cta:         "high",
    offer:       "medium",
    badge:       "medium",
    benefits:    "medium",
    socialProof: "low",
    footer:      "low",
    disclaimer:  "low",
  },
  editorial: {
    headline:    "ultra_high",
    subheadline: "high",
    cta:         "ultra_high",
    offer:       "high",
    badge:       "high",
    benefits:    "medium",
    socialProof: "medium",
    footer:      "low",
    disclaimer:  "low",
  },
  healthcare: {
    headline:    "high",
    subheadline: "high",
    cta:         "high",
    offer:       "high",
    badge:       "high",
    benefits:    "high",
    socialProof: "medium",
    footer:      "medium",
    disclaimer:  "medium",
  },
  corporate: {
    headline:    "high",
    subheadline: "high",
    cta:         "high",
    offer:       "medium",
    badge:       "medium",
    benefits:    "medium",
    socialProof: "medium",
    footer:      "low",
    disclaimer:  "low",
  },
  restaurant: {
    headline:    "ultra_high",
    subheadline: "high",
    cta:         "ultra_high",
    offer:       "high",
    badge:       "high",
    benefits:    "medium",
    socialProof: "medium",
    footer:      "low",
    disclaimer:  "low",
  },
  real_estate: {
    headline:    "high",
    subheadline: "high",
    cta:         "high",
    offer:       "medium",
    badge:       "medium",
    benefits:    "medium",
    socialProof: "medium",
    footer:      "low",
    disclaimer:  "low",
  },
  fashion: {
    headline:    "ultra_high",
    subheadline: "high",
    cta:         "high",
    offer:       "high",
    badge:       "ultra_high",
    benefits:    "low",
    socialProof: "low",
    footer:      "low",
    disclaimer:  "low",
  },
  product: {
    headline:    "high",
    subheadline: "high",
    cta:         "high",
    offer:       "high",
    badge:       "high",
    benefits:    "medium",
    socialProof: "medium",
    footer:      "low",
    disclaimer:  "low",
  },
  social: {
    headline:    "ultra_high",
    subheadline: "ultra_high",
    cta:         "ultra_high",
    offer:       "ultra_high",
    badge:       "ultra_high",
    benefits:    "high",
    socialProof: "medium",
    footer:      "low",
    disclaimer:  "low",
  },
  minimal: {
    headline:    "high",
    subheadline: "medium",
    cta:         "medium",
    offer:       "medium",
    badge:       "medium",
    benefits:    "low",
    socialProof: "low",
    footer:      "low",
    disclaimer:  "low",
  },
};

export function getContrastForElement(
  style:   TypographyStyle,
  element: keyof ContrastMap,
): ContrastLevel {
  return STYLE_CONTRAST[style][element];
}

export { STYLE_CONTRAST };
export type { ContrastMap };
