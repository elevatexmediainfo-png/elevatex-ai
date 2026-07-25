// Phase 9.3 — Canvas Compositor types.
// Defines the input and output contract for the final image composition step.
// This is the ONLY module in the AI OS that produces actual pixel data.

import type { CommercialRenderPlan } from "../commercial-renderer/types";
import type { CommercialCopy }        from "../copy-intelligence/types";
import type { CommercialTypographyPlan } from "../typography-intelligence/types";

// ─────────────────────────────────────────────────────────────────────────────
// Output format
// ─────────────────────────────────────────────────────────────────────────────

export type OutputFormat = "png" | "jpeg" | "webp";

export type LayerName =
  | "background"   // the AI-generated image
  | "text_overlay" // all text elements (single SVG pass)
  | "logo"         // uploaded brand logo
  | "badge"        // accent badge / ribbon
  | "qr";          // QR code

// ─────────────────────────────────────────────────────────────────────────────
// Asset buffers (pre-fetched by caller before compositing)
// ─────────────────────────────────────────────────────────────────────────────

export interface AssetBuffers {
  logo?:  Buffer;
  badge?: Buffer;
  qr?:    Buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand context (drives CTA button color, text scrim color)
// ─────────────────────────────────────────────────────────────────────────────

export interface BrandCompositorContext {
  primaryColor?:   string | null; // hex, e.g. "#2563eb"
  secondaryColor?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────────────────────────

export interface CanvasCompositorInput {
  /** The AI-generated background image (PNG/JPEG buffer). */
  backgroundImageBuffer: Buffer;
  /** Absolute pixel layout from the commercial renderer. */
  renderPlan:            CommercialRenderPlan;
  /** The marketing copy to render. */
  copy:                  CommercialCopy;
  /** Visual typography behaviour (size, weight, contrast, etc.). */
  typography:            CommercialTypographyPlan;
  /** Optional brand colors for CTA button and accents. */
  brandContext?:         BrandCompositorContext;
  /** Optional pre-fetched overlay assets. Skipped gracefully if absent. */
  assetBuffers?:         AssetBuffers;
  /** Output image format. Default: "png". */
  outputFormat?:         OutputFormat;
  /** JPEG/WebP quality 1–100. Default: 90. */
  quality?:              number;
  /**
   * Opt-in — reserves a footer band for text instead of stretching the
   * background photo across the full canvas. When true, the photo is
   * cropped to a shorter box anchored at the top (so a subject's head
   * framing is never touched, only excess below it), and the remaining
   * canvas rows are filled with a color sampled from the photo itself. The
   * matte height is derived from renderPlan's own bottom-anchored elements
   * (cta/footer/etc.), not a fixed fraction, so it tracks actual copy
   * length. Default false — other renderPlan layouts (e.g. a left-third
   * hero) should keep the original full-canvas cover behavior; only the
   * top-photo/bottom-text poster convention (composeFromBlueprint) opts in.
   */
  reserveBottomBand?:    boolean;
  /**
   * Pre-formatted, ready-to-render contact line (e.g. "Ph: ... • Add: ...
   * • Web: ..."), sourced from BrandKit/Profile by the caller — this
   * module stays ignorant of those business models, same as it already is
   * for copy/typography. Replaces the footer region's generic tagline
   * when present; falls back to the existing tagline when null/undefined.
   */
  contactBarText?:       string | null;
  /**
   * Phase 2a split layout — opt-in. When present, overrides matteTop's
   * usual renderPlan-derived computation (canvas-engine.ts's
   * computeMatteTop) with a fixed fraction of canvas height instead, and
   * switches the matte's color treatment from Phase 1's subtle band tint
   * to a mostly-solid brand-color zone with a short seam blend. Also
   * switches the SVG text layer's benefits rendering to the single-row
   * icon-chip strip (useBenefitChips) instead of the plain-text grid — the
   * two always go together for this layout, so one option bundles both
   * rather than requiring three separate flags to be set in sync.
   * The caller (compose-marketing-poster.ts) is responsible for also
   * repositioning renderPlan.headline/subheadline/benefits.y into the new,
   * shorter photo zone before calling composeFromBlueprint — this module
   * only prepares the background and switches the chip renderer; it does
   * not move text on its own.
   */
  splitLayout?: {
    /** Fraction (0-1) of canvas height the photo zone occupies from the top. */
    photoZoneFraction: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────

export interface FinalAdvertisement {
  /** The composited advertisement image as a raw buffer. */
  imageBuffer:      Buffer;
  mimeType:         "image/png" | "image/jpeg" | "image/webp";
  width:            number;
  height:           number;
  /** Ordered list of layers that were applied. */
  layersApplied:    LayerName[];
  /** Wall-clock time from input receipt to output buffer ready. */
  processingTimeMs: number;
  /** The render plan that drove the layout — preserved for audit. */
  renderPlanUsed:   CommercialRenderPlan;
}

// ─────────────────────────────────────────────────────────────────────────────
// Blueprint-based convenience input
// ─────────────────────────────────────────────────────────────────────────────

export interface BlueprintCompositorOptions {
  backgroundImageBuffer: Buffer;
  assetBuffers?:         AssetBuffers;
  outputFormat?:         OutputFormat;
  quality?:              number;
}
