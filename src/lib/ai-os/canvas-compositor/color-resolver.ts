// Phase 9.3 — Color Resolver.
// Maps ContrastLevel to SVG colors and derives CTA button colors.
// Pure functions — no I/O, deterministic.

import type { ContrastLevel } from "../typography-intelligence/types";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CTA_COLOR     = "#1a56db"; // trust blue
export const DEFAULT_FOOTER_COLOR  = "rgba(200,200,200,0.80)";
export const SCRIM_COLOR           = "rgba(0,0,0,0.45)"; // text legibility scrim

// ─────────────────────────────────────────────────────────────────────────────
// Text fill colors per contrast level
// ─────────────────────────────────────────────────────────────────────────────

const TEXT_FILL: Record<ContrastLevel, string> = {
  ultra_high: "rgba(255,255,255,1.00)",
  high:       "rgba(255,255,255,0.97)",
  medium:     "rgba(220,220,220,0.90)",
  low:        "rgba(180,180,180,0.75)",
};

// ─────────────────────────────────────────────────────────────────────────────
// Drop-shadow opacity per contrast level (0 = no shadow)
// ─────────────────────────────────────────────────────────────────────────────

const SHADOW_OPACITY: Record<ContrastLevel, number> = {
  ultra_high: 0.85,
  high:       0.65,
  medium:     0.40,
  low:        0.00,
};

export function resolveTextColor(contrast: ContrastLevel): string {
  return TEXT_FILL[contrast];
}

export function resolveShadowOpacity(contrast: ContrastLevel): number {
  return SHADOW_OPACITY[contrast];
}

/**
 * Validates and returns a hex color for the CTA button background.
 * Falls back to DEFAULT_CTA_COLOR if brandPrimary is absent or invalid.
 */
export function resolveCTAButtonColor(brandPrimary?: string | null): string {
  if (brandPrimary && /^#[0-9a-fA-F]{3,8}$/.test(brandPrimary.trim())) {
    return brandPrimary.trim();
  }
  return DEFAULT_CTA_COLOR;
}

/**
 * Converts a hex color to an SVG-compatible rgba() string.
 * Supports 3-char and 6-char hex (no alpha from hex).
 */
export function hexToSvgRgba(hex: string, alpha = 1): string {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3
    ? h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
    : h.slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(26,86,219,${alpha})`;
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

/**
 * Returns a lightened version of a color string for secondary CTA or hover accents.
 * Approximation — increases each channel by 30.
 */
export function lightenHex(hex: string): string {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3
    ? h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
    : h.slice(0, 6);
  const r = Math.min(255, parseInt(full.slice(0, 2), 16) + 30);
  const g = Math.min(255, parseInt(full.slice(2, 4), 16) + 30);
  const b = Math.min(255, parseInt(full.slice(4, 6), 16) + 30);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
