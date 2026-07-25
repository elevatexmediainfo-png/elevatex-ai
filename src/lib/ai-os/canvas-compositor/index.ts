// Phase 9.3 — Canvas Compositor public API.

// Types
export type {
  OutputFormat,
  LayerName,
  AssetBuffers,
  BrandCompositorContext,
  CanvasCompositorInput,
  FinalAdvertisement,
  BlueprintCompositorOptions,
} from "./types";

// Main compositor functions
export { composeAdvertisement, composeFromBlueprint } from "./canvas-engine";

// Pure utility exports (useful for testing and preview rendering)
export { buildSvgTextLayer }     from "./svg-text-layer";
export type { SvgLayerOptions }  from "./svg-text-layer";
export { buildAssetOverlays }    from "./asset-compositor";
export type { AssetOverlayResult } from "./asset-compositor";

// Color and font resolution (exposed for custom renderers)
export {
  resolveTextColor,
  resolveShadowOpacity,
  resolveCTAButtonColor,
  hexToSvgRgba,
  lightenHex,
  DEFAULT_CTA_COLOR,
} from "./color-resolver";

export {
  resolveFontFamily,
  resolveWeight,
  resolveLetterSpacingPx,
  applyTextTransform,
  resolveBulletGlyph,
} from "./font-resolver";
