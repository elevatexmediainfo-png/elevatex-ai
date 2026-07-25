// Phase 9.0 — Safe Zone Engine.
// Converts composition-plan percentage safe zones to absolute pixel values.
// Also computes the available ContentArea for text flow.

import type { CanvasSize, SafeZones, ContentArea } from "./types";
import type { WhitespaceSpec, SafeZoneMap } from "../commercial-composition/types";

/** Convert composition safe-zone percentages to absolute pixel insets.
 *  Each edge is at least the global padding value. */
export function computeSafeZones(
  canvas:      CanvasSize,
  safeZoneMap: SafeZoneMap,
  whitespace:  WhitespaceSpec,
): SafeZones {
  const padH = Math.round(canvas.width  * whitespace.globalPaddingPercent / 100);
  const padV = Math.round(canvas.height * whitespace.globalPaddingPercent / 100);

  return {
    top:    Math.max(padV, Math.round(canvas.height * safeZoneMap.topPercent    / 100)),
    bottom: Math.max(padV, Math.round(canvas.height * safeZoneMap.bottomPercent / 100)),
    left:   Math.max(padH, Math.round(canvas.width  * safeZoneMap.leftPercent   / 100)),
    right:  Math.max(padH, Math.round(canvas.width  * safeZoneMap.rightPercent  / 100)),
  };
}

/** Derive the text-layout content area from canvas and safe zones. */
export function computeContentArea(
  canvas:    CanvasSize,
  safeZones: SafeZones,
): ContentArea {
  const x      = safeZones.left;
  const y      = safeZones.top;
  const right  = canvas.width  - safeZones.right;
  const bottom = canvas.height - safeZones.bottom;
  return {
    x,
    y,
    width:  right  - x,
    height: bottom - y,
    right,
    bottom,
  };
}

/** Global padding in horizontal pixels (used by the orchestrator). */
export function computeGlobalPaddingPx(
  canvas:    CanvasSize,
  whitespace: WhitespaceSpec,
): number {
  return Math.round(canvas.width * whitespace.globalPaddingPercent / 100);
}

/** Section spacing in vertical pixels (between major layout zones). */
export function computeSectionSpacingPx(
  canvas:    CanvasSize,
  whitespace: WhitespaceSpec,
): number {
  return Math.round(canvas.height * whitespace.sectionSpacingPercent / 100);
}

/** Element spacing in vertical pixels (between sibling elements). */
export function computeElementSpacingPx(
  canvas:    CanvasSize,
  whitespace: WhitespaceSpec,
): number {
  return Math.round(canvas.height * whitespace.elementSpacingPercent / 100);
}
