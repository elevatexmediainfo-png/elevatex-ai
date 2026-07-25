// Phase 3.5 — Campaign Blueprint Skeleton.
// These are EMPTY placeholder interfaces. Nothing generates from them yet.
// Their purpose is to establish the future architecture contract so Phase 4+
// can populate them without introducing breaking type changes.
//
// STRICT RULES for this file:
//   ✗ No implementation logic
//   ✗ No LLM calls
//   ✗ No prompt generation
//   ✗ No marketing reasoning
//   ✗ No layout generation
//   ✗ No image/video generation
//   Only type definitions.

/** The marketing strategy layer — campaign objective, funnel stage, target KPIs. */
export interface MarketingPlan {
  /** Future: campaign objective, funnel stage, target audience, KPIs */
  readonly _placeholder: true;
}

/** The copywriting layer — headline, subheadline, CTA, body copy, taglines. */
export interface CopyPlan {
  /** Future: headline, subheadline, CTA button text, body copy, taglines */
  readonly _placeholder: true;
}

/** The typography layer — font pairing, scale, hierarchy, alignment rules. */
export interface TypographyPlan {
  /** Future: headline font, body font, scale, weight, letter-spacing, alignment */
  readonly _placeholder: true;
}

/** The layout layer — grid system, section order, spacing, safe areas. */
export interface LayoutPlan {
  /** Future: layout archetype, grid, section order, visual zones, spacing system */
  readonly _placeholder: true;
}

/** The visual layer — hero subject, composition, lighting, photography direction. */
export interface VisualPlan {
  /** Future: hero subject, composition type, lighting style, scene direction */
  readonly _placeholder: true;
}

/** The brand layer — color palette, brand voice, logo placement, brand rules. */
export interface BrandPlan {
  /** Future: primary/accent colors, brand voice, logo zone, brand consistency rules */
  readonly _placeholder: true;
}

/** The image generation layer — final prompt, provider, quality, dimensions. */
export interface ImagePlan {
  /** Future: generation prompt, provider selection, quality tier, output dimensions */
  readonly _placeholder: true;
}

/** The video generation layer — script, scenes, duration, transitions, audio. */
export interface VideoPlan {
  /** Future: scene list, duration, transitions, voiceover, background music */
  readonly _placeholder: true;
}

/** The editing layer — post-processing, effects, compositing, filters. */
export interface EditingPlan {
  /** Future: post-processing steps, logo compositing, effects, color grading */
  readonly _placeholder: true;
}

/** The export layer — output formats, dimensions, delivery channels. */
export interface ExportPlan {
  /** Future: output format (PNG/JPEG/WebP/MP4), dimensions, delivery channels */
  readonly _placeholder: true;
}

/** The complete campaign blueprint — the full plan produced by the Creative Brain
 *  in Phase 4+. Every sub-plan is optional: a blueprint may be partial
 *  (e.g., image-only campaigns don't need a VideoPlan). */
export interface CampaignBlueprint {
  marketingPlan?: MarketingPlan;
  copyPlan?: CopyPlan;
  typographyPlan?: TypographyPlan;
  layoutPlan?: LayoutPlan;
  visualPlan?: VisualPlan;
  brandPlan?: BrandPlan;
  imagePlan?: ImagePlan;
  videoPlan?: VideoPlan;
  editingPlan?: EditingPlan;
  exportPlan?: ExportPlan;
}
