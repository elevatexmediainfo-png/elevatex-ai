// Phase 8.9 — Typography Intelligence Engine.
// Orchestrates all sub-engines into CommercialTypographyPlan.
// Deterministic — no LLM, no randomness, no font selection, no text generation.

import type { CreativeStrategy }         from "../creative-brain/types";
import type { CommercialCopy }           from "../copy-intelligence/types";
import type { CommercialCompositionPlan } from "../commercial-composition/types";
import type { VisualLayoutPlan }         from "../visual-layout/types";
import type {
  CommercialTypographyPlan,
  ElementTypography,
  BenefitTypography,
  CTATypography,
  TypographyInput,
  TypographyStyle,
  DensityLevel,
} from "./types";
import { COMPOSITION_TO_TYPOGRAPHY_STYLE, INDUSTRY_DEFAULT_STYLE, STYLE_DEFINITIONS } from "./industry-rules";
import { computeImportances, buildHierarchyMap }  from "./hierarchy-engine";
import { computeSpacing, spacingBelow, spacingAbove } from "./spacing-engine";
import { getContrastForElement }                  from "./contrast-engine";
import { getAlignment }                           from "./alignment-engine";
import { buildResponsiveAdjustments } from "./responsive-engine";
import { normalizeIndustryId, strategyToAssetPlannerInput } from "../commercial-assets/adapter";

// ─────────────────────────────────────────────────────────────────────────────
// Resolve TypographyStyle from composition strategy + industry fallback
// ─────────────────────────────────────────────────────────────────────────────

function resolveStyle(input: TypographyInput): TypographyStyle {
  const fromComposition = COMPOSITION_TO_TYPOGRAPHY_STYLE[input.compositionStrategyId];
  if (fromComposition) return fromComposition;
  return INDUSTRY_DEFAULT_STYLE[input.industry] ?? "corporate";
}

// ─────────────────────────────────────────────────────────────────────────────
// Build ElementTypography for a given element
// ─────────────────────────────────────────────────────────────────────────────

type ContrastKey = "headline" | "subheadline" | "cta" | "offer" | "badge" | "benefits" | "socialProof" | "footer" | "disclaimer";
type AlignmentKey = "headline" | "subheadline" | "cta" | "benefits" | "socialProof" | "offer" | "badge" | "footer" | "disclaimer";

function buildElement(
  style:       TypographyStyle,
  density:     DensityLevel,
  importance:  number,
  opts: {
    contrastKey:  ContrastKey;
    alignKey:     AlignmentKey;
    size:         ElementTypography["size"];
    weight:       ElementTypography["weight"];
    letterSpacing: ElementTypography["letterSpacing"];
    lineHeight:   ElementTypography["lineHeight"];
    textTransform: ElementTypography["textTransform"];
    maxLines?:    number;
    baseAbove:    number;
    baseBelow:    number;
    opacity?:     number;
  },
): ElementTypography {
  return {
    importance,
    size:          opts.size,
    weight:        opts.weight,
    alignment:     getAlignment(style, opts.alignKey),
    letterSpacing: opts.letterSpacing,
    lineHeight:    opts.lineHeight,
    maxLines:      opts.maxLines,
    textTransform: opts.textTransform,
    spacingAbove:  spacingAbove(opts.baseAbove, density),
    spacingBelow:  spacingBelow(opts.baseBelow, density),
    contrast:      getContrastForElement(style, opts.contrastKey),
    opacity:       opts.opacity ?? 100,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main engine function
// ─────────────────────────────────────────────────────────────────────────────

export function buildTypographyPlanFromInput(input: TypographyInput): CommercialTypographyPlan {
  const style    = resolveStyle(input);
  const def      = STYLE_DEFINITIONS[style];
  const density  = input.density;
  const imp      = computeImportances(style, input.hasOffer, input.hasBadge);
  const spacing  = computeSpacing(style, density);
  const hierarchy = buildHierarchyMap(imp, input.hasOffer);
  const responsive = buildResponsiveAdjustments(style, input.aspectRatio, input.orientation);

  // ── Headline ──────────────────────────────────────────────────────────────
  const headline = buildElement(style, density, imp.headline, {
    contrastKey:   "headline",
    alignKey:      "headline",
    size:          def.headlineSize,
    weight:        def.headlineWeight,
    letterSpacing: def.headlineSpacing,
    lineHeight:    def.headlineLines,
    textTransform: def.headlineTransform,
    maxLines:      def.headlineMaxLines,
    baseAbove:     2,
    baseBelow:     4,
  });

  // ── Subheadline ──────────────────────────────────────────────────────────
  const subheadline: ElementTypography | null = input.hasSubheadline
    ? buildElement(style, density, imp.subheadline, {
        contrastKey:   "subheadline",
        alignKey:      "subheadline",
        size:          "lg",
        weight:        "semibold",
        letterSpacing: "normal",
        lineHeight:    "snug",
        textTransform: "none",
        maxLines:      2,
        baseAbove:     1,
        baseBelow:     3,
      })
    : null;

  // ── Benefits ─────────────────────────────────────────────────────────────
  const benefitColumns: 1 | 2 | 3 =
    input.benefitCount <= 2 ? 1 :
    input.benefitCount <= 4 ? 2 :
    3;

  const benefits: BenefitTypography = {
    ...buildElement(style, density, imp.benefits, {
      contrastKey:   "benefits",
      alignKey:      "benefits",
      size:          def.bodySize,
      weight:        "medium",
      letterSpacing: "normal",
      lineHeight:    "relaxed",
      textTransform: "none",
      baseAbove:     2,
      baseBelow:     3,
    }),
    columns:       benefitColumns,
    columnSpacing: spacing.elementSpacing * 2,
    bulletStyle:   def.benefitBullet,
    lineSpacing:   spacing.elementSpacing,
  };

  // ── CTA ──────────────────────────────────────────────────────────────────
  const cta: CTATypography = {
    ...buildElement(style, density, imp.cta, {
      contrastKey:   "cta",
      alignKey:      "cta",
      size:          def.ctaSize,
      weight:        def.ctaWeight,
      letterSpacing: def.ctaLetterSpacing,
      lineHeight:    "normal",
      textTransform: "uppercase",
      baseAbove:     3,
      baseBelow:     2,
    }),
    paddingH:     def.ctaPaddingH,
    paddingV:     def.ctaPaddingV,
    borderRadius: def.ctaBorderRadius,
    minWidth:     spacing.elementSpacing * 10,
  };

  // ── Secondary CTA ────────────────────────────────────────────────────────
  const secondaryCta: CTATypography | null = input.hasSecondaryCta
    ? {
        ...buildElement(style, density, imp.cta - 2, {
          contrastKey:   "cta",
          alignKey:      "cta",
          size:          "sm",
          weight:        "medium",
          letterSpacing: "normal",
          lineHeight:    "normal",
          textTransform: "none",
          baseAbove:     1,
          baseBelow:     2,
        }),
        paddingH:     def.ctaPaddingH - 2,
        paddingV:     def.ctaPaddingV - 1,
        borderRadius: def.ctaBorderRadius,
        minWidth:     spacing.elementSpacing * 8,
      }
    : null;

  // ── Social Proof ─────────────────────────────────────────────────────────
  const socialProof = buildElement(style, density, imp.socialProof, {
    contrastKey:   "socialProof",
    alignKey:      "socialProof",
    size:          "xs",
    weight:        "medium",
    letterSpacing: "normal",
    lineHeight:    "normal",
    textTransform: "none",
    baseAbove:     2,
    baseBelow:     2,
  });

  // ── Offer ────────────────────────────────────────────────────────────────
  const offer: ElementTypography | null = input.hasOffer
    ? buildElement(style, density, imp.offer, {
        contrastKey:   "offer",
        alignKey:      "offer",
        size:          "xl",
        weight:        "extrabold",
        letterSpacing: "tight",
        lineHeight:    "tight",
        textTransform: "uppercase",
        maxLines:      1,
        baseAbove:     2,
        baseBelow:     2,
      })
    : null;

  // ── Badge ────────────────────────────────────────────────────────────────
  const badge: ElementTypography | null = input.hasBadge
    ? buildElement(style, density, imp.badge, {
        contrastKey:   "badge",
        alignKey:      "badge",
        size:          "xs",
        weight:        "bold",
        letterSpacing: "wide",
        lineHeight:    "tight",
        textTransform: "uppercase",
        maxLines:      1,
        baseAbove:     1,
        baseBelow:     1,
      })
    : null;

  // ── Disclaimer ───────────────────────────────────────────────────────────
  const disclaimer: ElementTypography | null = input.hasDisclaimer
    ? buildElement(style, density, imp.disclaimer, {
        contrastKey:   "disclaimer",
        alignKey:      "disclaimer",
        size:          "xs",
        weight:        "light",
        letterSpacing: "normal",
        lineHeight:    "relaxed",
        textTransform: "none",
        baseAbove:     2,
        baseBelow:     1,
        opacity:       70,
      })
    : null;

  // ── Footer ───────────────────────────────────────────────────────────────
  const footer = buildElement(style, density, imp.footer, {
    contrastKey:   "footer",
    alignKey:      "footer",
    size:          "xs",
    weight:        "light",
    letterSpacing: "normal",
    lineHeight:    "relaxed",
    textTransform: "none",
    baseAbove:     2,
    baseBelow:     1,
    opacity:       60,
  });

  return {
    typographyStyle: style,
    headline,
    subheadline,
    benefits,
    cta,
    secondaryCta,
    socialProof,
    offer,
    badge,
    disclaimer,
    footer,
    responsive,
    spacing,
    hierarchy,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter: blueprint inputs → TypographyInput
// ─────────────────────────────────────────────────────────────────────────────

export function strategyToTypographyInput(
  strategy:            CreativeStrategy,
  commercialCopy:      CommercialCopy,
  commercialComposition: CommercialCompositionPlan,
  layoutPlan:          VisualLayoutPlan,
): TypographyInput {
  const assetInput = strategyToAssetPlannerInput(strategy);
  const industry   = normalizeIndustryId(
    strategy.business.industry.value,
    strategy.business.subIndustry.value,
  );

  const density = commercialComposition.whitespace.density as DensityLevel;

  return {
    industry,
    brandType:            assetInput.brandType,
    communicationStyle:   strategy.communication.communicationStyle.value ?? "professional",
    aspectRatio:          layoutPlan.canvas.aspectRatio.value ?? "1:1",
    orientation:          layoutPlan.canvas.canvasOrientation.value ?? "square",
    density,
    hasOffer:             commercialCopy.metadata.hasOffer,
    hasBadge:             commercialCopy.badge !== null,
    hasDisclaimer:        commercialCopy.metadata.hasDisclaimer,
    hasSubheadline:       commercialCopy.subheadline !== null,
    hasSecondaryCta:      commercialCopy.secondaryCta !== null,
    benefitCount:         commercialCopy.metadata.benefitCount,
    compositionStrategyId: commercialComposition.strategyId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: build from blueprint inputs (used by blueprint builder)
// ─────────────────────────────────────────────────────────────────────────────

export function buildTypographyFromBlueprintInputs(
  strategy:              CreativeStrategy,
  commercialCopy:        CommercialCopy,
  commercialComposition: CommercialCompositionPlan,
  layoutPlan:            VisualLayoutPlan,
): CommercialTypographyPlan {
  const input = strategyToTypographyInput(strategy, commercialCopy, commercialComposition, layoutPlan);
  return buildTypographyPlanFromInput(input);
}
