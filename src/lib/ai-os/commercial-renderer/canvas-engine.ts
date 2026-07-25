// Phase 9.0 — Canvas Engine.
// Resolves the final pixel canvas size from an aspect ratio string and optional overrides.
// Provides orientation detection and scale factor computation.

import type { CanvasSize } from "./types";

// Standard social/advertising canvas sizes at 96 dpi equivalent
const STANDARD_SIZES: Record<string, CanvasSize> = {
  "9:16":   { width: 1080, height: 1920 },
  "4:5":    { width: 1080, height: 1350 },
  "1:1":    { width: 1080, height: 1080 },
  "16:9":   { width: 1920, height: 1080 },
  "3:4":    { width: 1080, height: 1440 },
  "2:3":    { width: 1080, height: 1620 },
  "1.91:1": { width: 1200, height: 628  },
  "A4":     { width: 2480, height: 3508 },
  "5:4":    { width: 1350, height: 1080 },
  "6:1":    { width: 1920, height: 320  },
};

/** Resolve a CanvasSize from an aspect ratio string.
 *  If width + height are both provided they override the aspect-ratio lookup. */
export function resolveCanvasSize(
  aspectRatio: string,
  width?:      number,
  height?:     number,
): CanvasSize {
  if (width && height && width > 0 && height > 0) return { width, height };
  return STANDARD_SIZES[aspectRatio] ?? { width: 1080, height: 1080 };
}

/** Return the orientation bucket for the canvas. */
export function getCanvasOrientation(
  canvas: CanvasSize,
): "portrait" | "square" | "landscape" {
  const ratio = canvas.width / canvas.height;
  if (ratio < 0.95) return "portrait";
  if (ratio > 1.05) return "landscape";
  return "square";
}

/** Scale factor relative to the 1080px reference width. */
export function getScaleFactor(canvas: CanvasSize): number {
  return canvas.width / 1080;
}
