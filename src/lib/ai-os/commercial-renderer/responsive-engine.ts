// Phase 9.0 — Responsive Engine.
// Provides orientation-specific column and text-column overrides.
// Does NOT reproduce the typography-intelligence responsive engine —
// here the concern is pixel geometry, not font sizing.

import type { CanvasSize, ContentArea } from "./types";
import type { HeroZone } from "../commercial-composition/types";

export type CanvasOrientation = "portrait" | "square" | "landscape";

export interface ResponsiveProfile {
  orientation:           CanvasOrientation;
  /** Content column x start (px). Shifts right in split-layout landscape. */
  textColumnX:           number;
  /** Content column width (px). Shrinks in split-layout landscape. */
  textColumnWidth:       number;
  /** Override for benefits columns. null = use typography plan value. */
  benefitColumnOverride: 1 | 2 | 3 | null;
  /** Minimum height for any rendered element (prevents zero-height divs). */
  minElementHeightPx:    number;
}

/** Compute the layout profile for the canvas + hero zone combination. */
export function computeResponsiveProfile(
  canvas:   CanvasSize,
  content:  ContentArea,
  heroZone: HeroZone,
  orientation: CanvasOrientation,
): ResponsiveProfile {
  // Landscape + non-bleed hero: image occupies left portion of canvas,
  // text flows in the right column.
  if (orientation === "landscape" && heroZone.aspectMode !== "bleed") {
    const splitX = Math.round(canvas.width * (heroZone.dominancePercent / 100));
    const textX  = splitX + Math.round(canvas.width * 0.03); // 3% gap after image
    const textW  = canvas.width - content.x - (canvas.width - content.right) - (textX - content.x);
    return {
      orientation,
      textColumnX:           Math.max(content.x, textX),
      textColumnWidth:       Math.max(200, textW),
      benefitColumnOverride: 1, // single column in side panel
      minElementHeightPx:    14,
    };
  }

  // Portrait or bleed-hero landscape: text overlays full canvas width
  return {
    orientation,
    textColumnX:           content.x,
    textColumnWidth:       content.width,
    benefitColumnOverride: orientation === "landscape" ? 3 : null,
    minElementHeightPx:    14,
  };
}
