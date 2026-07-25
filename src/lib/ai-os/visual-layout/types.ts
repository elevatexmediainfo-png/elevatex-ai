import type { StrategyField } from "../types";

// Phase 6 — Visual Layout Intelligence Engine types.
// VisualLayoutPlan is the output of the Visual Layout Engine: every decision
// about HOW the campaign should be spatially arranged before any prompt,
// image, or layout file is generated.
//
// Every field: value | "unknown", confidence, reasoning.
// NO generation of prompts, colors, fonts, images, or videos.
// Only spatial and compositional intelligence.

// ─────────────────────────────────────────────────────────────────────────────
// Domain 1 — Canvas Planning
// ─────────────────────────────────────────────────────────────────────────────

export interface CanvasPlanning {
  /** The type of creative canvas this layout targets. */
  canvasType: StrategyField<"social_post" | "print_poster" | "outdoor_billboard" | "story_vertical" | "web_banner" | "carousel_slide" | "email_header" | "display_ad">;
  /** Portrait, landscape, or square. */
  canvasOrientation: StrategyField<"portrait" | "landscape" | "square">;
  /** The aspect ratio as a described ratio (not pixels). */
  aspectRatio: StrategyField<"1:1" | "4:5" | "9:16" | "16:9" | "1.91:1" | "A4" | "6:1" | "custom">;
  /** Where safe zones begin and end (described as percentages from edges). */
  safeZones: StrategyField;
  /** Internal margin description for the format. */
  margins: StrategyField;
  /** Print bleed area specification (or "digital — no bleed required"). */
  bleedArea: StrategyField;
  /** Where content can be safely placed given platform cropping behaviour. */
  responsiveZones: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 2 — Visual Hierarchy
// ─────────────────────────────────────────────────────────────────────────────

export interface VisualHierarchy {
  /** The most dominant visual element — what the eye hits first. */
  primaryFocus: StrategyField;
  /** The second eye stop — reinforces or contextualises the primary. */
  secondaryFocus: StrategyField;
  /** The third visual element the eye reaches after the secondary. */
  tertiaryFocus: StrategyField;
  /** The pattern in which the eye travels through the creative. */
  eyeFlow: StrategyField<"z_pattern" | "f_pattern" | "center_out" | "top_to_bottom" | "circular" | "diagonal">;
  /** The primary reading direction for text-bearing elements. */
  readingDirection: StrategyField<"left_to_right_top_bottom" | "center_out" | "top_dominant" | "single_focus">;
  /** The ordered sequence in which elements should demand attention. */
  attentionOrder: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 3 — Layout Blocks
// Each block describes its spatial position and weight in the layout.
// Values describe positioning in layout terms, NOT pixel coordinates.
// ─────────────────────────────────────────────────────────────────────────────

export interface LayoutBlocks {
  /** The dominant visual area — its placement on the canvas. */
  heroBlock: StrategyField<"top_third_full_width" | "upper_half_full_bleed" | "left_half_split" | "right_half_split" | "center_dominant" | "full_canvas_immersive" | "bottom_half">;
  /** Headline placement relative to the hero. */
  headlineBlock: StrategyField<"above_hero" | "overlaid_hero_bottom" | "below_hero" | "beside_hero_left" | "beside_hero_right" | "centered_standalone">;
  /** Subheadline position — absent if not needed. */
  subheadlineBlock: StrategyField<"below_headline" | "above_cta" | "absent">;
  /** Body copy zone — absent for minimal/outdoor formats. */
  bodyBlock: StrategyField<"below_subheadline" | "right_column" | "left_column" | "footer_zone" | "absent">;
  /** Feature icons or list — absent for simple campaigns. */
  featureBlock: StrategyField<"three_columns_below_hero" | "horizontal_strip" | "left_sidebar" | "absent">;
  /** Benefits zone placement. */
  benefitsBlock: StrategyField<"below_hero_strip" | "three_icon_row" | "left_column_list" | "absent">;
  /** Statistics / data callouts. */
  statisticsBlock: StrategyField<"integrated_with_benefits" | "standalone_section" | "overlay_hero" | "absent">;
  /** Trust badges, certifications. */
  trustBlock: StrategyField<"top_corner_badge" | "below_headline" | "alongside_cta" | "footer_row" | "absent">;
  /** CTA button / action zone. */
  ctaBlock: StrategyField<"bottom_center_prominent" | "bottom_right_accent" | "lower_third_centered" | "inline_with_offer" | "floating_bottom">;
  /** Logo placement. */
  logoBlock: StrategyField<"top_left" | "top_right" | "top_center" | "bottom_left" | "bottom_right" | "bottom_center">;
  /** Footer bar — contact, address, legal. */
  footerBlock: StrategyField<"bottom_strip" | "integrated_cta_footer" | "absent">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 4 — Grid Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface GridIntelligence {
  /** The named grid system for this layout. */
  gridSystem: StrategyField<"12_column_editorial" | "6_column_modular" | "3_column_relaxed" | "4_column_social" | "freeform_compositional" | "single_column_stack">;
  /** How many content columns the grid uses. */
  columns: StrategyField<"1" | "2" | "3" | "4" | "6" | "12">;
  /** Number of content rows (horizontal bands). */
  rows: StrategyField<"2" | "3" | "4" | "5" | "variable">;
  /** The spatial rhythm between elements (described in relative terms). */
  spacing: StrategyField<"tight_8px_base" | "comfortable_16px_base" | "generous_24px_base" | "ultra_generous_32px_plus">;
  /** Primary alignment axis. */
  alignment: StrategyField<"left_aligned" | "centered" | "right_aligned" | "justified">;
  /** Visual weight distribution across the layout. */
  balance: StrategyField<"symmetrical" | "asymmetric_left_heavy" | "asymmetric_right_heavy" | "radial" | "dynamic_tension">;
  /** Symmetry type that governs the overall design. */
  symmetry: StrategyField<"bilateral" | "translational" | "rotational" | "asymmetric_intentional" | "none">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 5 — White Space Intelligence
// ─────────────────────────────────────────────────────────────────────────────

export interface WhiteSpaceIntelligence {
  /** Approximate percentage of the canvas that should remain empty. */
  negativeSpaceRatio: StrategyField<"10_to_20_percent" | "20_to_35_percent" | "35_to_50_percent" | "50_to_65_percent" | "65_plus_percent">;
  /** How much clear space should surround key elements. */
  breathingRoom: StrategyField<"tight_proximity" | "comfortable_padding" | "generous_isolation" | "extreme_isolation">;
  /** Overall information density of the layout. */
  contentDensity: StrategyField<"single_focus" | "two_elements" | "structured_multi" | "rich_information" | "complex_infographic">;
  /** How visual mass is distributed across the canvas. */
  visualWeight: StrategyField<"top_heavy" | "bottom_anchored" | "center_weighted" | "left_weighted" | "right_weighted" | "evenly_distributed">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 6 — Composition Planning
// ─────────────────────────────────────────────────────────────────────────────

export interface CompositionPlanning {
  /** Whether the rule of thirds governs the primary element placement. */
  ruleOfThirds: StrategyField<"primary_application" | "partial_application" | "intentionally_broken" | "not_applicable">;
  /** Whether the golden ratio influences proportions. */
  goldenRatioPreference: StrategyField<"preferred_for_hero" | "optional_accent" | "not_applied">;
  /** Whether leading lines direct the eye toward the focal point. */
  leadingLines: StrategyField<"strong_leading_lines" | "subtle_directional_flow" | "none">;
  /** How many depth layers the composition uses. */
  depthLayers: StrategyField<"two_layer_flat" | "three_layer_standard" | "four_plus_layer_cinematic">;
  /** What occupies the visual foreground. */
  foreground: StrategyField;
  /** What occupies the visual midground. */
  midground: StrategyField;
  /** What occupies the visual background. */
  background: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 7 — Safe Area Planning
// Platform-specific safe zones described as percentages from each edge.
// ─────────────────────────────────────────────────────────────────────────────

export interface SafeAreaPlanning {
  /** Safe zone for Instagram (UI chrome, comments overlay). */
  instagramSafeArea: StrategyField;
  /** Safe zone for Facebook (reactions, caption area). */
  facebookSafeArea: StrategyField;
  /** Safe zone for YouTube (player controls, annotations). */
  youtubeSafeArea: StrategyField;
  /** Safe zone for print (trim, bleed, binding margins). */
  printSafeArea: StrategyField;
  /** The active platform's specific cropping safety instruction. */
  platformCropSafety: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 8 — Visual Priority Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface VisualPriorityEngine {
  /** The element that must dominate visually — rendered first / given maximum weight. */
  priority1: StrategyField;
  /** Second most important visual element. */
  priority2: StrategyField;
  /** Third. */
  priority3: StrategyField;
  /** Fourth — supporting information. */
  priority4: StrategyField;
  /** Fifth — trust or proof layer. */
  priority5: StrategyField;
  /** Sixth — brand identity layer. */
  priority6: StrategyField;
  /** Seventh — decorative or ambient elements. */
  priority7: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// VisualLayoutPlan — the complete output of the Visual Layout Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface VisualLayoutPlan {
  canvas:          CanvasPlanning;
  hierarchy:       VisualHierarchy;
  blocks:          LayoutBlocks;
  grid:            GridIntelligence;
  whiteSpace:      WhiteSpaceIntelligence;
  composition:     CompositionPlanning;
  safeAreas:       SafeAreaPlanning;
  visualPriority:  VisualPriorityEngine;

  /** 0–100 overall confidence across all 8 domains. */
  confidenceScore: number;
  /** Fields where value is "unknown". */
  unknownFields: string[];
}
