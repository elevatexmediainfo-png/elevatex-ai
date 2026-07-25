// Phase 9.3 — Font Resolver.
// Maps TypographyStyle and weight tokens to SVG-compatible values.
// Pure functions — no I/O, deterministic.

import type {
  TypographyStyle,
  TypographyWeight,
  LetterSpacingScale,
  TextTransform,
} from "../typography-intelligence/types";

// ─────────────────────────────────────────────────────────────────────────────
// Font family stacks (system fonts — no external download required)
// ─────────────────────────────────────────────────────────────────────────────

const FONT_FAMILIES: Record<TypographyStyle, string> = {
  luxury:      "Georgia, 'Times New Roman', Times, serif",
  minimal:     "'Helvetica Neue', Helvetica, Arial, sans-serif",
  editorial:   "Georgia, 'Palatino Linotype', Palatino, serif",
  product:     "Arial, 'Helvetica Neue', Helvetica, sans-serif",
  healthcare:  "Arial, Helvetica, 'Liberation Sans', sans-serif",
  real_estate: "Georgia, 'Times New Roman', Times, serif",
  restaurant:  "Georgia, 'Palatino Linotype', Palatino, serif",
  fashion:     "'Helvetica Neue', Helvetica, Arial, sans-serif",
  corporate:   "Arial, 'Helvetica Neue', 'Liberation Sans', sans-serif",
  social:      "Arial, Helvetica, sans-serif",
};

// ─────────────────────────────────────────────────────────────────────────────
// Weight map
// ─────────────────────────────────────────────────────────────────────────────

const FONT_WEIGHTS: Record<TypographyWeight, number> = {
  thin:      100,
  light:     300,
  regular:   400,
  medium:    500,
  semibold:  600,
  bold:      700,
  extrabold: 800,
  dominant:  900,
};

// ─────────────────────────────────────────────────────────────────────────────
// Letter spacing (in em — multiplied by font-size in px to get pixel value)
// ─────────────────────────────────────────────────────────────────────────────

const LETTER_SPACING_EM: Record<LetterSpacingScale, number> = {
  tight:  -0.02,
  normal:  0.00,
  wide:    0.05,
  loose:   0.10,
};

// ─────────────────────────────────────────────────────────────────────────────
// Bullet style glyphs
// ─────────────────────────────────────────────────────────────────────────────

const BULLET_GLYPHS: Record<string, string> = {
  dash:  "– ", // en-dash
  dot:   "• ", // bullet
  check: "✓ ", // check mark
  none:  "",
};

export function resolveFontFamily(style: TypographyStyle): string {
  return FONT_FAMILIES[style];
}

export function resolveWeight(weight: TypographyWeight): number {
  return FONT_WEIGHTS[weight];
}

/** Returns the letter-spacing in pixels for a given em scale and font size. */
export function resolveLetterSpacingPx(
  scale:    LetterSpacingScale,
  fontSizePx: number,
): number {
  return Math.round(LETTER_SPACING_EM[scale] * fontSizePx * 100) / 100;
}

/** Applies text-transform to a string (avoids CSS text-transform, which is
 *  unreliable in librsvg). */
export function applyTextTransform(text: string, transform: TextTransform): string {
  switch (transform) {
    case "uppercase":  return text.toUpperCase();
    case "lowercase":  return text.toLowerCase();
    case "capitalize": return text.replace(/\b\w/g, c => c.toUpperCase());
    case "none":       return text;
  }
}

export function resolveBulletGlyph(style: string): string {
  return BULLET_GLYPHS[style] ?? "• ";
}
