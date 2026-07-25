// Phase 9.3 — Asset Compositor.
// Resizes and positions logo / badge / QR buffers as sharp OverlayOptions.
// Returns an ordered list ready for sharp().composite().

import sharp from "sharp";
import type { OverlayOptions } from "sharp";
import type { CommercialRenderPlan } from "../commercial-renderer/types";
import type { AssetBuffers, LayerName } from "./types";

export interface AssetOverlayResult {
  overlays: OverlayOptions[];
  applied:  LayerName[];
}

/**
 * Resizes each present asset buffer to fit its render-plan region and returns
 * sharp OverlayOptions at the correct canvas coordinates.
 * Assets absent from assetBuffers are silently skipped.
 */
export async function buildAssetOverlays(
  renderPlan:   CommercialRenderPlan,
  assetBuffers: AssetBuffers = {},
): Promise<AssetOverlayResult> {
  const overlays: OverlayOptions[] = [];
  const applied:  LayerName[]      = [];

  // ── Logo ────────────────────────────────────────────────────────────────────
  if (renderPlan.logo && assetBuffers.logo) {
    const r = renderPlan.logo;
    const resized = await sharp(assetBuffers.logo)
      .resize(r.width, r.height, { fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
    overlays.push({ input: resized, top: Math.round(r.y), left: Math.round(r.x) });
    applied.push("logo");
  }

  // ── Badge ───────────────────────────────────────────────────────────────────
  if (renderPlan.badge && assetBuffers.badge) {
    const r = renderPlan.badge;
    const resized = await sharp(assetBuffers.badge)
      .resize(r.width, r.height, { fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
    overlays.push({ input: resized, top: Math.round(r.y), left: Math.round(r.x) });
    applied.push("badge");
  }

  // ── QR code ─────────────────────────────────────────────────────────────────
  if (renderPlan.qr && assetBuffers.qr) {
    const r = renderPlan.qr;
    const resized = await sharp(assetBuffers.qr)
      .resize(r.width, r.height, { fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
    overlays.push({ input: resized, top: Math.round(r.y), left: Math.round(r.x) });
    applied.push("qr");
  }

  return { overlays, applied };
}
