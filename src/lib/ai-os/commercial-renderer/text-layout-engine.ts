// Phase 9.0 — Text Layout Engine.
// Converts CommercialTypographyPlan size tokens to absolute pixel bounding boxes.
// All sizes are defined at the 1080px reference width and scaled by `scale`.

import type {
  TextRegion, BenefitRegion, ContentArea, OverflowEvent, RenderElementId,
} from "./types";
import type { CommercialTypographyPlan } from "../typography-intelligence/types";
import type { CommercialCopy } from "../copy-intelligence/types";
import type {
  TypographySize, LineHeightScale,
} from "../typography-intelligence/types";

// ─────────────────────────────────────────────────────────────────────────────
// Reference pixel sizes at 1080px canvas width
// ─────────────────────────────────────────────────────────────────────────────

const BASE_SIZE_PX: Record<TypographySize, number> = {
  xs:      14,
  sm:      17,
  base:    20,
  lg:      26,
  xl:      34,
  xxl:     46,
  display: 62,
};

const LINE_HEIGHT_MULT: Record<LineHeightScale, number> = {
  tight:   1.2,
  snug:    1.35,
  normal:  1.5,
  relaxed: 1.65,
  loose:   1.9,
};

/** Return estimated pixel height of a single rendered line at the given scale. */
export function sizeToPixels(size: TypographySize, scale: number): number {
  return Math.round(BASE_SIZE_PX[size] * scale);
}

/** Estimate the pixel height of a text block given its typography spec. */
export function estimateTextHeight(
  size:       TypographySize,
  lineHeight: LineHeightScale,
  maxLines:   number,
  scale:      number,
): number {
  return Math.round(BASE_SIZE_PX[size] * LINE_HEIGHT_MULT[lineHeight] * maxLines * scale);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-element builders
// ─────────────────────────────────────────────────────────────────────────────

export function buildHeadlineRegion(
  typo:    CommercialTypographyPlan,
  content: ContentArea,
  textX:   number,
  textW:   number,
  startY:  number,
  scale:   number,
): TextRegion {
  const h = typo.headline;
  const height = Math.max(
    14,
    estimateTextHeight(h.size, h.lineHeight, h.maxLines ?? 2, scale),
  );
  return {
    elementId:  "headline",
    x:          textX,
    y:          startY,
    width:      textW,
    height,
    alignment:  h.alignment,
    maxLines:   h.maxLines ?? 2,
    overflow:   false,
    stackOrder: 8,
  };
}

export function buildSubheadlineRegion(
  typo:    CommercialTypographyPlan,
  textX:   number,
  textW:   number,
  startY:  number,
  scale:   number,
): TextRegion {
  const s = typo.subheadline!;
  const height = Math.max(
    12,
    estimateTextHeight(s.size, s.lineHeight, s.maxLines ?? 2, scale),
  );
  return {
    elementId:  "subheadline",
    x:          textX,
    y:          startY,
    width:      textW,
    height,
    alignment:  s.alignment,
    maxLines:   s.maxLines ?? 2,
    overflow:   false,
    stackOrder: 7,
  };
}

export function buildOfferRegion(
  typo:    CommercialTypographyPlan,
  textX:   number,
  textW:   number,
  startY:  number,
  scale:   number,
): TextRegion {
  const o = typo.offer!;
  const height = Math.max(
    20,
    estimateTextHeight(o.size, o.lineHeight, 1, scale),
  );
  return {
    elementId:  "offer",
    x:          textX,
    y:          startY,
    width:      textW,
    height,
    alignment:  o.alignment,
    maxLines:   1,
    overflow:   false,
    stackOrder: 9,
  };
}

export function buildBenefitsRegion(
  typo:              CommercialTypographyPlan,
  copy:              CommercialCopy,
  textX:             number,
  textW:             number,
  startY:            number,
  availableHeight:   number,
  columns:           1 | 2 | 3,
  elementSpacingPx:  number,
  scale:             number,
): BenefitRegion {
  const b     = typo.benefits;
  const count = copy.benefits.length;
  const rowCount = Math.max(1, Math.ceil(count / columns));

  const lineH = estimateTextHeight(b.size, b.lineHeight, 1, scale);
  const rowH  = Math.max(14, lineH * Math.min(b.maxLines ?? 2, 2));
  const columnSpacing = Math.round(b.columnSpacing * scale);
  const colW  = columns > 1
    ? Math.round((textW - columnSpacing * (columns - 1)) / columns)
    : textW;

  const estimatedH = rowCount * rowH + Math.max(0, rowCount - 1) * elementSpacingPx;
  const height = Math.max(rowH, Math.min(estimatedH, availableHeight));
  const overflow = estimatedH > availableHeight;

  return {
    elementId:     "benefits",
    x:             textX,
    y:             startY,
    width:         textW,
    height,
    alignment:     b.alignment,
    maxLines:      b.maxLines ?? 2,
    overflow,
    stackOrder:    5,
    columns,
    rowCount,
    columnWidth:   colW,
    columnSpacing,
  };
}

export function buildSocialProofRegion(
  typo:    CommercialTypographyPlan,
  copy:    CommercialCopy,
  textX:   number,
  textW:   number,
  aboveY:  number,
  gapPx:   number,
  scale:   number,
): TextRegion {
  const sp     = typo.socialProof;
  const count  = copy.socialProof.length;
  const height = Math.max(14, estimateTextHeight(sp.size, sp.lineHeight, count, scale));
  const y      = aboveY - gapPx - height;
  return {
    elementId:  "socialProof",
    x:          textX,
    y:          Math.max(0, y),
    width:      textW,
    height,
    alignment:  sp.alignment,
    maxLines:   count,
    overflow:   false,
    stackOrder: 4,
  };
}

export function buildFooterRegion(
  typo:    CommercialTypographyPlan,
  textX:   number,
  textW:   number,
  bottomY: number, // canvas.height - safeZones.bottom
  scale:   number,
): TextRegion {
  const f      = typo.footer;
  const height = Math.max(14, estimateTextHeight(f.size, f.lineHeight, 1, scale));
  return {
    elementId:  "footer",
    x:          textX,
    y:          bottomY - height,
    width:      textW,
    height,
    alignment:  f.alignment,
    maxLines:   1,
    overflow:   false,
    stackOrder: 1,
  };
}

export function buildDisclaimerRegion(
  typo:           CommercialTypographyPlan,
  textX:          number,
  textW:          number,
  footerY:        number,
  elementSpacing: number,
  scale:          number,
): TextRegion {
  const d      = typo.disclaimer!;
  const height = Math.max(14, estimateTextHeight(d.size, d.lineHeight, 2, scale));
  return {
    elementId:  "disclaimer",
    x:          textX,
    y:          footerY - elementSpacing - height,
    width:      textW,
    height,
    alignment:  d.alignment,
    maxLines:   2,
    overflow:   false,
    stackOrder: 2,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Overflow detection
// ─────────────────────────────────────────────────────────────────────────────

/** Check whether a region's content would overflow the canvas bottom. */
export function checkVerticalOverflow(
  region:    TextRegion | BenefitRegion,
  contentBottom: number,
): OverflowEvent | null {
  const estimatedLines = (region as BenefitRegion).rowCount ?? region.maxLines;
  if (region.y + region.height > contentBottom) {
    return {
      elementId:      region.elementId as RenderElementId,
      estimatedLines,
      maxLines:       region.maxLines,
      clipped:        true,
    };
  }
  return null;
}
