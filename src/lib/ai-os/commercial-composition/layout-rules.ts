// Phase 8.7C — Layout safe zones and whitespace rules.
// Pure data — no logic, no generation.

import type { CompositionStrategyId, SafeZoneMap, WhitespaceSpec, Density } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Safe zone map per strategy
// All values are % of the relevant canvas dimension.
// ─────────────────────────────────────────────────────────────────────────────

export const SAFE_ZONES: Record<CompositionStrategyId, SafeZoneMap> = {
  luxury:       { topPercent: 10, bottomPercent: 10, leftPercent: 10, rightPercent: 10, headline: 12, cta: 10, logo: 8,  qr: 6,  footer: 10 },
  minimal:      { topPercent: 8,  bottomPercent: 8,  leftPercent: 8,  rightPercent: 8,  headline: 10, cta: 8,  logo: 6,  qr: 5,  footer: 8  },
  editorial:    { topPercent: 6,  bottomPercent: 6,  leftPercent: 6,  rightPercent: 6,  headline: 8,  cta: 6,  logo: 5,  qr: 5,  footer: 6  },
  product:      { topPercent: 5,  bottomPercent: 5,  leftPercent: 5,  rightPercent: 5,  headline: 8,  cta: 5,  logo: 5,  qr: 5,  footer: 5  },
  healthcare:   { topPercent: 6,  bottomPercent: 8,  leftPercent: 5,  rightPercent: 5,  headline: 8,  cta: 8,  logo: 6,  qr: 5,  footer: 6  },
  real_estate:  { topPercent: 5,  bottomPercent: 6,  leftPercent: 5,  rightPercent: 5,  headline: 6,  cta: 6,  logo: 5,  qr: 5,  footer: 5  },
  restaurant:   { topPercent: 5,  bottomPercent: 6,  leftPercent: 5,  rightPercent: 5,  headline: 6,  cta: 6,  logo: 5,  qr: 5,  footer: 5  },
  fashion:      { topPercent: 5,  bottomPercent: 5,  leftPercent: 5,  rightPercent: 5,  headline: 6,  cta: 5,  logo: 5,  qr: 5,  footer: 5  },
  corporate:    { topPercent: 6,  bottomPercent: 6,  leftPercent: 6,  rightPercent: 6,  headline: 8,  cta: 6,  logo: 6,  qr: 5,  footer: 6  },
  social:       { topPercent: 5,  bottomPercent: 8,  leftPercent: 4,  rightPercent: 4,  headline: 5,  cta: 8,  logo: 4,  qr: 4,  footer: 8  },
  mobile_first: { topPercent: 8,  bottomPercent: 10, leftPercent: 5,  rightPercent: 5,  headline: 8,  cta: 10, logo: 5,  qr: 5,  footer: 10 },
  landscape:    { topPercent: 5,  bottomPercent: 5,  leftPercent: 8,  rightPercent: 8,  headline: 6,  cta: 5,  logo: 6,  qr: 4,  footer: 5  },
  square:       { topPercent: 6,  bottomPercent: 6,  leftPercent: 6,  rightPercent: 6,  headline: 8,  cta: 6,  logo: 5,  qr: 5,  footer: 6  },
  vertical:     { topPercent: 8,  bottomPercent: 10, leftPercent: 5,  rightPercent: 5,  headline: 8,  cta: 10, logo: 5,  qr: 5,  footer: 10 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Whitespace defaults per strategy (crowdingScore is computed at runtime)
// ─────────────────────────────────────────────────────────────────────────────

export type WhitespaceDefaults = Omit<WhitespaceSpec, "crowdingScore">;

export const WHITESPACE_DEFAULTS: Record<CompositionStrategyId, WhitespaceDefaults> = {
  luxury:       { globalPaddingPercent: 8,  sectionSpacingPercent: 4,   elementSpacingPercent: 2,   density: "sparse"   },
  minimal:      { globalPaddingPercent: 6,  sectionSpacingPercent: 3,   elementSpacingPercent: 1.5, density: "sparse"   },
  editorial:    { globalPaddingPercent: 5,  sectionSpacingPercent: 3,   elementSpacingPercent: 1.5, density: "balanced" },
  product:      { globalPaddingPercent: 5,  sectionSpacingPercent: 2.5, elementSpacingPercent: 1.5, density: "balanced" },
  healthcare:   { globalPaddingPercent: 5,  sectionSpacingPercent: 2.5, elementSpacingPercent: 1.5, density: "balanced" },
  real_estate:  { globalPaddingPercent: 4,  sectionSpacingPercent: 2,   elementSpacingPercent: 1,   density: "balanced" },
  restaurant:   { globalPaddingPercent: 4,  sectionSpacingPercent: 2,   elementSpacingPercent: 1,   density: "balanced" },
  fashion:      { globalPaddingPercent: 5,  sectionSpacingPercent: 2.5, elementSpacingPercent: 1.5, density: "balanced" },
  corporate:    { globalPaddingPercent: 5,  sectionSpacingPercent: 2.5, elementSpacingPercent: 1.5, density: "balanced" },
  social:       { globalPaddingPercent: 3,  sectionSpacingPercent: 1.5, elementSpacingPercent: 1,   density: "dense"    },
  mobile_first: { globalPaddingPercent: 4,  sectionSpacingPercent: 2,   elementSpacingPercent: 1,   density: "dense"    },
  landscape:    { globalPaddingPercent: 5,  sectionSpacingPercent: 2.5, elementSpacingPercent: 1.5, density: "balanced" },
  square:       { globalPaddingPercent: 5,  sectionSpacingPercent: 2.5, elementSpacingPercent: 1.5, density: "balanced" },
  vertical:     { globalPaddingPercent: 4,  sectionSpacingPercent: 2,   elementSpacingPercent: 1,   density: "dense"    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Crowding score calculation
// 0 = spacious; 100 = severely overcrowded
// ─────────────────────────────────────────────────────────────────────────────

export function computeCrowdingScore(totalAssets: number, density: Density): number {
  const baseline = 4;
  const extra = Math.max(0, totalAssets - baseline);
  const base = extra * 10;
  const multiplier = density === "sparse" ? 0.6 : density === "dense" ? 1.4 : 1.0;
  return Math.min(100, Math.round(base * multiplier));
}

// ─────────────────────────────────────────────────────────────────────────────
// Composition grade from crowding + conflict count
// ─────────────────────────────────────────────────────────────────────────────

export function computeCompositionGrade(
  crowdingScore: number,
  conflictCount: number,
): "A" | "B" | "C" | "D" {
  if (crowdingScore < 25 && conflictCount === 0) return "A";
  if (crowdingScore < 50 && conflictCount <= 2) return "B";
  if (crowdingScore < 70 && conflictCount <= 4) return "C";
  return "D";
}
