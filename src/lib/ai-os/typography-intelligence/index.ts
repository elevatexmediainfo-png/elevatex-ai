// Phase 8.9 — Typography Intelligence Engine public API.
// Re-exports all public types and functions.

export type {
  TypographySize,
  TypographyWeight,
  TypographyAlignment,
  LetterSpacingScale,
  LineHeightScale,
  ContrastLevel,
  DensityLevel,
  BulletStyle,
  TextTransform,
  TypographyStyle,
  ElementTypography,
  BenefitTypography,
  CTATypography,
  SpacingSystem,
  BreakpointAdjustment,
  ResponsiveAdjustments,
  HierarchyMap,
  CommercialTypographyPlan,
  TypographyInput,
} from "./types";

export {
  buildTypographyPlanFromInput,
  strategyToTypographyInput,
  buildTypographyFromBlueprintInputs,
} from "./typography-engine";

export { computeImportances, buildHierarchyMap }  from "./hierarchy-engine";
export { computeSpacing, spacingBelow, spacingAbove } from "./spacing-engine";
export { getContrastForElement, STYLE_CONTRAST }   from "./contrast-engine";
export { getAlignment, STYLE_ALIGNMENT }            from "./alignment-engine";
export {
  buildResponsiveAdjustments,
  normaliseOrientation,
  escalateSize,
  deescalateSize,
  DEFAULT_BREAKPOINTS,
} from "./responsive-engine";
export {
  COMPOSITION_TO_TYPOGRAPHY_STYLE,
  INDUSTRY_DEFAULT_STYLE,
  STYLE_DEFINITIONS,
  getImportanceMap,
} from "./industry-rules";
