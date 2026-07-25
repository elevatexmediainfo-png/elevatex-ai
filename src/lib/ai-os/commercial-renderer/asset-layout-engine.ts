// Phase 9.0 — Asset Layout Engine.
// Positions non-text overlay elements: logo, QR code, badge, CTA button.
// Also runs bounding-box collision detection and auto-resolution.

import type {
  CTARegion, LogoRegion, QRRegion, BadgeRegion,
  ContentArea, CanvasSize, SafeZones, NamedBox, CollisionEvent, OverflowEvent, BoundingBox,
} from "./types";
import type { AssetPlacement } from "../commercial-composition/types";
import type { CommercialAssetId } from "../commercial-assets/types";
import type { CommercialTypographyPlan, TypographyAlignment } from "../typography-intelligence/types";
import type { CommercialCopy } from "../copy-intelligence/types";
import { estimateTextHeight } from "./text-layout-engine";

/** Map TypographyAlignment to the three-way CTA alignment (justified → center). */
function ctaAlign(a: TypographyAlignment): "left" | "center" | "right" {
  return a === "justified" ? "center" : a;
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset ID groups
// ─────────────────────────────────────────────────────────────────────────────

const LOGO_ASSET_IDS: CommercialAssetId[] = [
  "logo", "clinic_logo", "builder_logo",
];
const QR_ASSET_IDS: CommercialAssetId[] = ["qr_code"];
const BADGE_ASSET_IDS: CommercialAssetId[] = [
  "award_badge", "offer_ribbon", "limited_time_badge",
  "trust_badge", "opening_badge", "discount_badge", "festival_sticker",
];

// Pixel sizes at 1080px reference width
const LOGO_SIZE_PX  = { small: 60, medium: 90, large: 120, auto: 80 };
const QR_SIZE_PX    = { small: 80, medium: 100, large: 120, auto: 90 };
const BADGE_SIZE_PX = { small: 56, medium: 72, large: 96, auto: 64 };

// ─────────────────────────────────────────────────────────────────────────────
// Placement lookup
// ─────────────────────────────────────────────────────────────────────────────

function findPlacement(
  placements: AssetPlacement[],
  ids:        CommercialAssetId[],
): AssetPlacement | null {
  for (const id of ids) {
    const found = placements.find(p => p.assetId === id);
    if (found) return found;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA button
// ─────────────────────────────────────────────────────────────────────────────

export function buildCTARegion(
  typo:           CommercialTypographyPlan,
  content:        ContentArea,
  textX:          number,
  textW:          number,
  anchorBottomY:  number, // top-y of the first bottom-anchored element (footer or disclaimer)
  sectionSpacing: number,
  scale:          number,
): CTARegion {
  const c       = typo.cta;
  const paddingH = Math.round(c.paddingH * 4 * scale);
  const paddingV = Math.round(c.paddingV * 4 * scale);
  const borderRadius = Math.round(c.borderRadius * 4 * scale);
  const minWidth = Math.round(c.minWidth * scale);

  const textH  = Math.max(14, estimateTextHeight(c.size, c.lineHeight, 1, scale));
  const height = textH + paddingV * 2;
  const width  = Math.max(minWidth, Math.round(textW * 0.5));

  const y = anchorBottomY - sectionSpacing - height;

  let x: number;
  if (c.alignment === "left") {
    x = textX;
  } else if (c.alignment === "right") {
    x = textX + textW - width;
  } else {
    x = textX + Math.round((textW - width) / 2);
  }

  return {
    elementId:    "cta",
    x:            Math.max(textX, x),
    y:            Math.max(content.y, y),
    width,
    height,
    alignment:    ctaAlign(c.alignment),
    paddingH,
    paddingV,
    borderRadius,
    stackOrder:   10,
  };
}

export function buildSecondaryCTARegion(
  typo:           CommercialTypographyPlan,
  textX:          number,
  textW:          number,
  cta:            CTARegion,
  elementSpacing: number,
  scale:          number,
): CTARegion {
  const c = typo.secondaryCta!;
  const paddingH = Math.round(c.paddingH * 4 * scale);
  const paddingV = Math.round(c.paddingV * 4 * scale);
  const borderRadius = Math.round(c.borderRadius * 4 * scale);
  const minWidth = Math.round(c.minWidth * scale);

  const textH  = Math.max(12, estimateTextHeight(c.size, c.lineHeight, 1, scale));
  const height = textH + paddingV * 2;
  const width  = Math.max(minWidth, Math.round(textW * 0.4));
  const y      = cta.y - elementSpacing - height;

  let x: number;
  if (c.alignment === "left") {
    x = textX;
  } else if (c.alignment === "right") {
    x = textX + textW - width;
  } else {
    x = textX + Math.round((textW - width) / 2);
  }

  return {
    elementId:    "secondaryCta",
    x:            Math.max(textX, x),
    y:            Math.max(0, y),
    width,
    height,
    alignment:    ctaAlign(c.alignment),
    paddingH,
    paddingV,
    borderRadius,
    stackOrder:   9,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Logo
// ─────────────────────────────────────────────────────────────────────────────

export function buildLogoRegion(
  placements: AssetPlacement[],
  canvas:     CanvasSize,
  safeZones:  SafeZones,
  scale:      number,
): LogoRegion | null {
  const p = findPlacement(placements, LOGO_ASSET_IDS);
  if (!p) return null;

  const sizePx = Math.round(scale * LOGO_SIZE_PX[p.size]);
  const region = p.region;

  let x: number;
  let y: number;
  let corner: LogoRegion["corner"] = "top_right";

  if (region.startsWith("top_right") || region === "top_right") {
    x = canvas.width - safeZones.right - sizePx;
    y = safeZones.top;
    corner = "top_right";
  } else if (region.startsWith("top_left") || region === "top_left") {
    x = safeZones.left;
    y = safeZones.top;
    corner = "top_left";
  } else if (region.startsWith("bottom_right") || region === "bottom_right") {
    x = canvas.width - safeZones.right - sizePx;
    y = canvas.height - safeZones.bottom - sizePx;
    corner = "bottom_right";
  } else if (region.startsWith("bottom_left") || region === "bottom_left") {
    x = safeZones.left;
    y = canvas.height - safeZones.bottom - sizePx;
    corner = "bottom_left";
  } else {
    // top_center or overlay: center-top
    x = Math.round((canvas.width - sizePx) / 2);
    y = safeZones.top;
    corner = "top_right";
  }

  return {
    elementId:  "logo",
    x,
    y,
    width:      sizePx,
    height:     sizePx,
    scale:      1.0,
    corner,
    stackOrder: p.stackOrder,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QR code
// ─────────────────────────────────────────────────────────────────────────────

export function buildQRRegion(
  placements: AssetPlacement[],
  canvas:     CanvasSize,
  safeZones:  SafeZones,
  scale:      number,
): QRRegion | null {
  const p = findPlacement(placements, QR_ASSET_IDS);
  if (!p) return null;

  const sizePx = Math.round(scale * QR_SIZE_PX[p.size]);
  const region = p.region;

  let x: number;
  let y: number;
  let corner: QRRegion["corner"] = "bottom_right";

  if (region === "bottom_left" || region === "footer_left") {
    x = safeZones.left;
    y = canvas.height - safeZones.bottom - sizePx;
    corner = "bottom_left";
  } else if (region === "bottom_right" || region === "footer_right" || region === "footer_center") {
    x = canvas.width - safeZones.right - sizePx;
    y = canvas.height - safeZones.bottom - sizePx;
    corner = "bottom_right";
  } else if (region === "top_left") {
    x = safeZones.left;
    y = safeZones.top;
    corner = "top_left";
  } else if (region === "top_right") {
    x = canvas.width - safeZones.right - sizePx;
    y = safeZones.top;
    corner = "top_right";
  } else {
    // default: bottom-right
    x = canvas.width - safeZones.right - sizePx;
    y = canvas.height - safeZones.bottom - sizePx;
    corner = "bottom_right";
  }

  return {
    elementId:  "qr",
    x,
    y,
    width:      sizePx,
    height:     sizePx,
    corner,
    stackOrder: p.stackOrder,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────────────────────────────────────

export function buildBadgeRegion(
  placements: AssetPlacement[],
  copy:       CommercialCopy,
  canvas:     CanvasSize,
  safeZones:  SafeZones,
  scale:      number,
): BadgeRegion | null {
  if (copy.badge === null) return null;
  const p = findPlacement(placements, BADGE_ASSET_IDS);
  if (!p) return null;

  const sizePx = Math.round(scale * BADGE_SIZE_PX[p.size]);
  const region = p.region;

  let x: number;
  let y: number;
  let position: BadgeRegion["position"] = "top_right";

  if (region === "top_left") {
    x = safeZones.left;
    y = safeZones.top;
    position = "top_left";
  } else if (region === "top_right") {
    x = canvas.width - safeZones.right - sizePx;
    y = safeZones.top;
    position = "top_right";
  } else if (region === "mid_right") {
    x = canvas.width - safeZones.right - sizePx;
    y = Math.round((canvas.height - sizePx) / 2);
    position = "mid_right";
  } else if (region === "mid_left") {
    x = safeZones.left;
    y = Math.round((canvas.height - sizePx) / 2);
    position = "mid_left";
  } else {
    // overlay_hero or any other: center
    x = Math.round((canvas.width - sizePx) / 2);
    y = Math.round((canvas.height - sizePx) / 2);
    position = "overlay";
  }

  return {
    elementId:  "badge",
    x,
    y,
    width:      sizePx,
    height:     sizePx,
    position,
    stackOrder: p.stackOrder,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Collision detection + resolution
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the vertical overlap in pixels between two boxes, or 0 if they don't overlap. */
export function verticalOverlapPx(a: BoundingBox, b: BoundingBox): number {
  const xOverlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  if (xOverlap <= 0) return 0;
  return Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}

/** True if two bounding boxes share any area. */
export function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.x < b.x + b.width  &&
    b.x < a.x + a.width  &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

/** Detect all pairwise collisions in the list of named boxes. */
export function detectCollisions(regions: NamedBox[]): CollisionEvent[] {
  const events: CollisionEvent[] = [];
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      const a = regions[i]!;
      const b = regions[j]!;
      const overlap = verticalOverlapPx(a, b);
      if (overlap > 0) {
        events.push({
          elementA:   a.elementId,
          elementB:   b.elementId,
          overlapPx:  overlap,
          resolved:   false,
          resolution: "",
        });
      }
    }
  }
  return events;
}

/** Resolve logo/badge vs text-flow collisions by pushing the text element down. */
export function resolveCollisions(
  moverRegions: Array<{ elementId: string; y: number; height: number }>,
  collisions:   CollisionEvent[],
): CollisionEvent[] {
  return collisions.map(ev => {
    const ANCHORS = ["logo", "qr", "badge"] as const;
    const anchorSet = new Set<string>(ANCHORS);

    const aIsAnchor = anchorSet.has(ev.elementA);
    const bIsAnchor = anchorSet.has(ev.elementB);

    if (!aIsAnchor && !bIsAnchor) {
      // Both are flow elements — push B down
      const mover = moverRegions.find(r => r.elementId === ev.elementB);
      if (mover) {
        mover.y += ev.overlapPx;
        return { ...ev, resolved: true, resolution: `Shifted ${ev.elementB} down by ${ev.overlapPx}px` };
      }
    }

    if (aIsAnchor && !bIsAnchor) {
      const mover = moverRegions.find(r => r.elementId === ev.elementB);
      if (mover) {
        mover.y += ev.overlapPx;
        return { ...ev, resolved: true, resolution: `Shifted ${ev.elementB} down by ${ev.overlapPx}px (anchor conflict)` };
      }
    }

    if (!aIsAnchor && bIsAnchor) {
      const mover = moverRegions.find(r => r.elementId === ev.elementA);
      if (mover) {
        mover.y += ev.overlapPx;
        return { ...ev, resolved: true, resolution: `Shifted ${ev.elementA} down by ${ev.overlapPx}px (anchor conflict)` };
      }
    }

    return { ...ev, resolved: false, resolution: "Unresolvable anchor-to-anchor collision" };
  });
}

/** Compute layout score (0–100). */
export function computeLayoutScore(
  collisions: CollisionEvent[],
  overflows:  OverflowEvent[],
): number {
  const deduction = collisions.length * 15 + overflows.filter(o => o.clipped).length * 10;
  return Math.max(0, 100 - deduction);
}

