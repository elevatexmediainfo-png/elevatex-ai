// Phase 8.9 — Hierarchy Engine.
// Determines visual importance ranking for each text element.
// Headline is always 10. CTA is always 9. Order never inverts.

import type { HierarchyMap } from "./types";
import type { TypographyStyle } from "./types";
import { getImportanceMap } from "./industry-rules";

export interface ElementImportances {
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

export function computeImportances(
  style:       TypographyStyle,
  hasOffer:    boolean,
  hasBadge:    boolean,
): ElementImportances {
  const base = getImportanceMap(style);

  // Enforce hierarchy invariants: headline=10 always, cta≤9 always
  return {
    ...base,
    headline:   10,
    cta:        Math.min(9, base.cta),
    offer:      hasOffer ? base.offer : 0,
    badge:      hasBadge ? base.badge : 0,
  };
}

export function buildHierarchyMap(
  importances: ElementImportances,
  hasOffer:    boolean,
): HierarchyMap {
  return {
    primary:    "headline",
    secondary:  "cta",
    tertiary:   hasOffer ? "offer" : "subheadline",
    quaternary: hasOffer ? "subheadline" : "benefits",
    body:       "socialProof",
    footnote:   importances.disclaimer > 0 ? "disclaimer" : "footer",
  };
}
