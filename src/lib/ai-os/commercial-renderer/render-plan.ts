// Phase 9.0 — Render Plan Orchestrator.
// Assembles CommercialRenderPlan from blueprint components and canvas dimensions.
// Pure function — deterministic, no I/O, no side-effects.

import type { CommercialCompositionPlan } from "../commercial-composition/types";
import type { CommercialCopy }             from "../copy-intelligence/types";
import type { CommercialTypographyPlan }   from "../typography-intelligence/types";
import type { VisualLayoutPlan }           from "../visual-layout/types";
import type { UniversalCampaignBlueprint } from "../blueprint/types";
import type {
  CommercialRenderPlan, RendererInput, NamedBox,
  TextRegion, BenefitRegion, OverflowEvent,
} from "./types";

import { resolveCanvasSize, getCanvasOrientation, getScaleFactor } from "./canvas-engine";
import {
  computeSafeZones, computeContentArea,
  computeGlobalPaddingPx, computeSectionSpacingPx, computeElementSpacingPx,
} from "./safe-zone-engine";
import { computeResponsiveProfile } from "./responsive-engine";
import {
  buildHeadlineRegion, buildSubheadlineRegion, buildOfferRegion,
  buildBenefitsRegion, buildSocialProofRegion, buildFooterRegion,
  buildDisclaimerRegion, checkVerticalOverflow,
} from "./text-layout-engine";
import {
  buildCTARegion, buildSecondaryCTARegion,
  buildLogoRegion, buildQRRegion, buildBadgeRegion,
  detectCollisions, computeLayoutScore,
} from "./asset-layout-engine";

// ─────────────────────────────────────────────────────────────────────────────
// Main orchestrator — works from individual components (no full blueprint needed)
// ─────────────────────────────────────────────────────────────────────────────

export function buildRenderPlanFromComponents(
  composition:  CommercialCompositionPlan,
  copy:         CommercialCopy,
  typography:   CommercialTypographyPlan,
  layoutPlan:   VisualLayoutPlan,
  canvasWidth:  number,
  canvasHeight: number,
  imageUrl?:    string,
): CommercialRenderPlan {
  // ── Canvas ─────────────────────────────────────────────────────────────────
  const canvas      = { width: canvasWidth, height: canvasHeight };
  const orientation = getCanvasOrientation(canvas);
  const scale       = getScaleFactor(canvas);

  // ── Spacing + safe zones ───────────────────────────────────────────────────
  const globalPaddingPx   = computeGlobalPaddingPx(canvas, composition.whitespace);
  const sectionSpacingPx  = computeSectionSpacingPx(canvas, composition.whitespace);
  const elementSpacingPx  = computeElementSpacingPx(canvas, composition.whitespace);
  const safeZones         = computeSafeZones(canvas, composition.safeZoneMap, composition.whitespace);
  const content           = computeContentArea(canvas, safeZones);

  // ── Responsive profile ─────────────────────────────────────────────────────
  const responsive = computeResponsiveProfile(canvas, content, composition.heroZone, orientation);
  const textX = responsive.textColumnX;
  const textW = responsive.textColumnWidth;

  // ── Corner / anchor elements ────────────────────────────────────────────────
  const logo  = buildLogoRegion(composition.placements, canvas, safeZones, scale);
  const qr    = buildQRRegion(composition.placements, canvas, safeZones, scale);
  const badge = buildBadgeRegion(composition.placements, copy, canvas, safeZones, scale);

  // ── Bottom-anchored elements (work upward from safeBottom) ─────────────────
  const footer = buildFooterRegion(typography, textX, textW, content.bottom, scale);

  const disclaimer = copy.disclaimer !== null
    ? buildDisclaimerRegion(typography, textX, textW, footer.y, elementSpacingPx, scale)
    : null;

  const anchorBaseY = disclaimer ? disclaimer.y : footer.y;
  const cta = buildCTARegion(typography, content, textX, textW, anchorBaseY, sectionSpacingPx, scale);

  const secondaryCta = copy.secondaryCta !== null && typography.secondaryCta !== null
    ? buildSecondaryCTARegion(typography, textX, textW, cta, elementSpacingPx, scale)
    : null;

  // ── Top-down flow elements ─────────────────────────────────────────────────
  let flowY = content.y;

  // Bump start below logo if logo is in the top area
  if (logo && (logo.corner === "top_left" || logo.corner === "top_right")) {
    flowY = Math.max(flowY, logo.y + logo.height + elementSpacingPx);
  }

  const headline = buildHeadlineRegion(typography, content, textX, textW, flowY, scale);
  flowY = headline.y + headline.height + elementSpacingPx;

  const subheadline = copy.subheadline !== null && typography.subheadline !== null
    ? buildSubheadlineRegion(typography, textX, textW, flowY, scale)
    : null;
  if (subheadline) flowY = subheadline.y + subheadline.height + elementSpacingPx;

  const offer = copy.offer !== null && typography.offer !== null
    ? buildOfferRegion(typography, textX, textW, flowY, scale)
    : null;
  if (offer) flowY = offer.y + offer.height + sectionSpacingPx;

  // Social proof anchored above CTA
  const hasSocialProof = copy.socialProof.length > 0;
  const socialProof = hasSocialProof
    ? buildSocialProofRegion(
        typography, copy, textX, textW,
        cta.y, sectionSpacingPx, scale,
      )
    : null;

  // Benefits fills the space between the top-flow and the social proof / CTA
  const benefitsBottomBound = socialProof
    ? socialProof.y - elementSpacingPx
    : cta.y - sectionSpacingPx;

  const effectiveColumns: 1 | 2 | 3 =
    responsive.benefitColumnOverride ?? typography.benefits.columns;

  const benefits = buildBenefitsRegion(
    typography, copy, textX, textW,
    flowY,
    Math.max(0, benefitsBottomBound - flowY),
    effectiveColumns,
    elementSpacingPx,
    scale,
  );

  // ── Collect all named boxes for collision detection ─────────────────────────
  const namedBoxes: NamedBox[] = [
    toNamedBox(headline),
    ...(subheadline  ? [toNamedBox(subheadline)]  : []),
    toNamedBox(benefits),
    ...(socialProof  ? [toNamedBox(socialProof)]  : []),
    ...(offer        ? [toNamedBox(offer)]        : []),
    toNamedBox(cta),
    ...(secondaryCta ? [toNamedBox(secondaryCta)] : []),
    ...(logo         ? [toNamedBox(logo)]         : []),
    ...(qr           ? [toNamedBox(qr)]           : []),
    ...(badge        ? [toNamedBox(badge)]        : []),
    ...(disclaimer   ? [toNamedBox(disclaimer)]   : []),
    toNamedBox(footer),
  ];

  const collisions = detectCollisions(namedBoxes);

  // ── Overflow detection ─────────────────────────────────────────────────────
  const overflows: OverflowEvent[] = [];
  for (const reg of [headline, subheadline, benefits, socialProof, offer, disclaimer, footer]) {
    if (reg === null) continue;
    const ev = checkVerticalOverflow(reg as TextRegion | BenefitRegion, content.bottom);
    if (ev) overflows.push(ev);
  }

  // ── Warnings ───────────────────────────────────────────────────────────────
  const warnings: string[] = [];
  if (collisions.length > 0) {
    warnings.push(`${collisions.length} element collision(s) detected`);
  }
  if (overflows.some(o => o.clipped)) {
    warnings.push(`Text overflow detected on: ${overflows.filter(o => o.clipped).map(o => o.elementId).join(", ")}`);
  }
  if (benefits.height < elementSpacingPx) {
    warnings.push("Benefits region is extremely small — increase canvas height or reduce element count");
  }
  if (composition.compositionGrade === "D") {
    warnings.push("Composition grade D — canvas may be too crowded for this asset plan");
  }

  const layoutScore = computeLayoutScore(collisions, overflows);

  return {
    canvas,
    safeZones,
    globalPaddingPx,
    ...(imageUrl ? { imageUrl } : {}),
    headline,
    subheadline,
    benefits,
    cta,
    secondaryCta,
    socialProof,
    offer,
    badge,
    logo,
    qr,
    disclaimer,
    footer,
    diagnostics: {
      collisions,
      overflows,
      warnings,
      layoutScore,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Blueprint convenience wrapper (reads aspect ratio from layout plan)
// ─────────────────────────────────────────────────────────────────────────────

export function buildRenderPlanFromBlueprint(
  blueprint:    UniversalCampaignBlueprint,
  canvasWidth?: number,
  canvasHeight?: number,
  imageUrl?:    string,
): CommercialRenderPlan {
  const composition = blueprint.commercialComposition;
  const copy        = blueprint.commercialCopy;
  const typography  = blueprint.commercialTypography;
  const layoutPlan  = blueprint.layout;

  if (!composition) throw new Error("buildRenderPlanFromBlueprint: blueprint.commercialComposition is missing");
  if (!copy)        throw new Error("buildRenderPlanFromBlueprint: blueprint.commercialCopy is missing");
  if (!typography)  throw new Error("buildRenderPlanFromBlueprint: blueprint.commercialTypography is missing");

  const aspectRatio = layoutPlan.canvas.aspectRatio.value ?? "1:1";
  const canvas = resolveCanvasSize(aspectRatio, canvasWidth, canvasHeight);

  return buildRenderPlanFromComponents(
    composition, copy, typography, layoutPlan,
    canvas.width, canvas.height, imageUrl,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function toNamedBox(region: { elementId: string; x: number; y: number; width: number; height: number }): NamedBox {
  return {
    elementId: region.elementId as NamedBox["elementId"],
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
  };
}
