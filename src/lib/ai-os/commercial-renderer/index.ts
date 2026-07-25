// Phase 9.0 — Commercial Canvas Renderer public API.

export type {
  CanvasSize,
  BoundingBox,
  ContentArea,
  RenderElementId,
  TextRegion,
  BenefitRegion,
  CTARegion,
  LogoRegion,
  QRRegion,
  BadgeRegion,
  SafeZones,
  CollisionEvent,
  OverflowEvent,
  RenderDiagnostics,
  CommercialRenderPlan,
  RendererInput,
  NamedBox,
} from "./types";

export { buildRenderPlanFromComponents, buildRenderPlanFromBlueprint } from "./render-plan";

export { resolveCanvasSize, getCanvasOrientation, getScaleFactor }    from "./canvas-engine";
export {
  computeSafeZones, computeContentArea,
  computeGlobalPaddingPx, computeSectionSpacingPx, computeElementSpacingPx,
} from "./safe-zone-engine";
export { computeResponsiveProfile }                                    from "./responsive-engine";
export {
  sizeToPixels, estimateTextHeight,
  buildHeadlineRegion, buildSubheadlineRegion, buildOfferRegion,
  buildBenefitsRegion, buildSocialProofRegion, buildFooterRegion,
  buildDisclaimerRegion, checkVerticalOverflow,
} from "./text-layout-engine";
export {
  buildCTARegion, buildSecondaryCTARegion,
  buildLogoRegion, buildQRRegion, buildBadgeRegion,
  detectCollisions, resolveCollisions,
  verticalOverlapPx, boxesOverlap, computeLayoutScore,
} from "./asset-layout-engine";
