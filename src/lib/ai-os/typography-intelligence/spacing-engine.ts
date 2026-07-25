// Phase 8.9 — Spacing Engine.
// Computes the SpacingSystem from density and style definition.
// All values are multiples of the 4-unit base grid.

import type { SpacingSystem, DensityLevel } from "./types";
import type { TypographyStyle } from "./types";
import { STYLE_DEFINITIONS } from "./industry-rules";

const DENSITY_MULTIPLIER: Record<DensityLevel, number> = {
  sparse:   1.4,
  balanced: 1.0,
  dense:    0.7,
};

export function computeSpacing(
  style:   TypographyStyle,
  density: DensityLevel,
): SpacingSystem {
  const def = STYLE_DEFINITIONS[style];
  const mul = DENSITY_MULTIPLIER[density];

  const globalPadding  = Math.round(def.globalPadding  * mul);
  const sectionSpacing = Math.round(def.sectionSpacing * mul);
  const elementSpacing = Math.round(def.elementSpacing * mul);

  // breathing room = at least 2 element-spacing units around critical elements
  const breathingRoom = Math.max(elementSpacing * 2, 4);

  return {
    baseUnit:       4,
    globalPadding,
    sectionSpacing,
    elementSpacing,
    density,
    breathingRoom,
  };
}

/** Space below an element in spacing units, adjusted for density. */
export function spacingBelow(
  baseUnits: number,
  density:   DensityLevel,
): number {
  return Math.max(1, Math.round(baseUnits * DENSITY_MULTIPLIER[density]));
}

/** Space above an element in spacing units, adjusted for density. */
export function spacingAbove(
  baseUnits: number,
  density:   DensityLevel,
): number {
  return Math.max(1, Math.round(baseUnits * DENSITY_MULTIPLIER[density]));
}
