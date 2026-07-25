// Phase 9.0 — Commercial Canvas Renderer types.
// Defines the CommercialRenderPlan: absolute pixel coordinates for every
// overlay element that should be composited onto the generated image.
//
// STRICT RULES:
//   ✗ Never contains actual image pixel data
//   ✗ Never generates prompts, copy, or typography decisions
//   ✓ Only coordinate math — inputs are Blueprint sections + canvas dimensions

import type { UniversalCampaignBlueprint } from "../blueprint/types";

// ─────────────────────────────────────────────────────────────────────────────
// Canvas + bounding primitives
// ─────────────────────────────────────────────────────────────────────────────

export interface CanvasSize {
  width:  number;
  height: number;
}

export interface BoundingBox {
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

/** Available region within the safe-zone margins. */
export interface ContentArea {
  x:      number;
  y:      number;
  width:  number;
  height: number;
  right:  number;
  bottom: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Element region types
// ─────────────────────────────────────────────────────────────────────────────

export type RenderElementId =
  | "headline" | "subheadline" | "benefits" | "cta" | "secondaryCta"
  | "socialProof" | "offer" | "badge" | "logo" | "qr"
  | "disclaimer" | "footer";

export type RenderAlignment = "left" | "center" | "right" | "justified";

/** Bounding box for a text element. alignment is a text-layout hint; the
 *  actual renderer must honour it within the box. */
export interface TextRegion extends BoundingBox {
  elementId:  RenderElementId;
  alignment:  RenderAlignment;
  maxLines:   number;
  overflow:   boolean;
  stackOrder: number;
}

/** Extends TextRegion with multi-column grid specification. */
export interface BenefitRegion extends BoundingBox {
  elementId:     "benefits";
  alignment:     RenderAlignment;
  maxLines:      number;
  overflow:      boolean;
  stackOrder:    number;
  columns:       1 | 2 | 3;
  rowCount:      number;
  columnWidth:   number;
  columnSpacing: number;
}

/** CTA button region — includes padding and border-radius for actual button rendering. */
export interface CTARegion extends BoundingBox {
  elementId:    "cta" | "secondaryCta";
  alignment:    "left" | "center" | "right";
  paddingH:     number;
  paddingV:     number;
  borderRadius: number;
  stackOrder:   number;
}

/** Logo/wordmark region — rendered at the specified corner. */
export interface LogoRegion extends BoundingBox {
  elementId:  "logo";
  scale:      number;
  corner:     "top_left" | "top_right" | "bottom_left" | "bottom_right";
  stackOrder: number;
}

/** QR code region — always square. */
export interface QRRegion extends BoundingBox {
  elementId:  "qr";
  corner:     "top_left" | "top_right" | "bottom_left" | "bottom_right";
  stackOrder: number;
}

/** Accent badge — award, ribbon, festival sticker, etc. */
export interface BadgeRegion extends BoundingBox {
  elementId:  "badge";
  position:   "top_left" | "top_right" | "mid_right" | "mid_left" | "overlay";
  stackOrder: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Safe zones
// ─────────────────────────────────────────────────────────────────────────────

/** Absolute pixel distances from each canvas edge within which no text may start. */
export interface SafeZones {
  top:    number;
  bottom: number;
  left:   number;
  right:  number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostics
// ─────────────────────────────────────────────────────────────────────────────

export interface CollisionEvent {
  elementA:   RenderElementId;
  elementB:   RenderElementId;
  /** Vertical overlap in pixels. */
  overlapPx:  number;
  resolved:   boolean;
  resolution: string;
}

export interface OverflowEvent {
  elementId:      RenderElementId;
  estimatedLines: number;
  maxLines:       number;
  clipped:        boolean;
}

export interface RenderDiagnostics {
  collisions:  CollisionEvent[];
  overflows:   OverflowEvent[];
  warnings:    string[];
  /** 0–100: 100 = perfect layout, 0 = severe problems. */
  layoutScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CommercialRenderPlan — the complete output
// ─────────────────────────────────────────────────────────────────────────────

export interface CommercialRenderPlan {
  canvas:          CanvasSize;
  safeZones:       SafeZones;
  globalPaddingPx: number;
  imageUrl?:       string;
  headline:        TextRegion;
  subheadline:     TextRegion | null;
  benefits:        BenefitRegion;
  cta:             CTARegion;
  secondaryCta:    CTARegion | null;
  socialProof:     TextRegion | null;
  offer:           TextRegion | null;
  badge:           BadgeRegion | null;
  logo:            LogoRegion | null;
  qr:              QRRegion | null;
  disclaimer:      TextRegion | null;
  footer:          TextRegion;
  diagnostics:     RenderDiagnostics;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input to the renderer
// ─────────────────────────────────────────────────────────────────────────────

export interface RendererInput {
  blueprint:    UniversalCampaignBlueprint;
  canvasWidth:  number;
  canvasHeight: number;
  imageUrl?:    string;
}

/** Simplified inner region record used during collision detection. */
export interface NamedBox extends BoundingBox {
  elementId: RenderElementId;
}
