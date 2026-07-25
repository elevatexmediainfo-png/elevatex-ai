import type { StrategyField } from "../types";
import type { HeroKnowledgeGraphMeta } from "../creative-brain/types";

// Phase 10 — Visual Scene Planning Engine types.
// VisualScenePlan describes exactly WHAT exists inside the frame before any
// prompt is written. Think Senior Art Director planning a premium photoshoot.
//
// STRICT RULES:
//   ✗ No prompts, no provider instructions, no AI-specific language
//   ✗ No layouts, no typography, no copy
//   ✓ Only scene description — what a photographer would execute

// ─────────────────────────────────────────────────────────────────────────────
// Domain 1 — Scene Objective
// ─────────────────────────────────────────────────────────────────────────────

export interface SceneObjective {
  /** Why does this scene exist — what commercial purpose does it serve? */
  scenePurpose: StrategyField;
  /** The emotion this scene must create in the viewer — the feeling goal. */
  emotionalGoal: StrategyField<"trust_and_reassurance" | "aspiration_and_desire" | "excitement_and_urgency" | "transformation_and_hope" | "authority_and_expertise" | "joy_and_delight" | "curiosity_and_intrigue">;
  /** The specific marketing objective this scene converts toward. */
  marketingGoal: StrategyField;
  /** The first action the viewer should feel compelled to take after seeing this image. */
  primaryUserAction: StrategyField;
  /** Experience Engine: exact emotion the viewer must feel — first-class directive, preserve verbatim. */
  experienceEmotionalCore?: StrategyField;
  /** Experience Engine: what the visual must evoke — first-class directive, preserve verbatim. */
  experienceVisualImplication?: StrategyField;
  /** Experience Engine: primary experience type this creative must deliver. */
  experienceType?: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 2 — Hero Subject Planning
// ─────────────────────────────────────────────────────────────────────────────

export interface HeroSubjectPlanning {
  /** The exact, specific description of the hero — what a photographer would brief. */
  exactHeroSubject: StrategyField;
  /** How the hero subject is physically positioned or oriented. */
  heroPose: StrategyField<"seated_engaged" | "standing_confident" | "mid_action" | "at_rest" | "dynamic_movement" | "static_product" | "transformation_split" | "overhead_product">;
  /** The expression or visual character the hero projects (N/A for product-only). */
  heroExpression: StrategyField<"confident_natural_smile" | "focused_expertise" | "warm_genuine_care" | "aspirational_gaze" | "transformation_joy" | "not_applicable_product">;
  /** How much of the frame the hero dominates. */
  heroScale: StrategyField<"full_frame_dominant" | "two_thirds_dominant" | "half_frame" | "one_third_frame" | "small_contextual">;
  /** Where in the compositional grid the hero sits. */
  heroPosition: StrategyField<"center_frame" | "left_third" | "right_third" | "upper_third" | "lower_third" | "full_bleed" | "diagonal_split">;
  /** How critical the hero is to the message — does the entire campaign live or die on this element? */
  heroImportance: StrategyField<"the_entire_message" | "primary_anchor" | "strong_supporting" | "contextual_element">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 3 — Supporting Subject Planning
// ─────────────────────────────────────────────────────────────────────────────

export interface SupportingSubjectPlanning {
  /** What additional subjects appear alongside the hero. */
  supportingSubjects: StrategyField;
  /** How supporting subjects relate to the hero — spatial and narrative. */
  subjectRelationships: StrategyField<"direct_interaction" | "parallel_presence" | "contextual_background" | "product_in_use" | "environment_only" | "none">;
  /** The logic of how subjects interact — what story their relationship tells. */
  interactionLogic: StrategyField;
  /** How large supporting subjects are relative to the hero. */
  relativeScale: StrategyField<"same_scale" | "hero_twice_as_large" | "hero_dominant_others_small" | "product_hero_human_secondary" | "environment_subject_only">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 4 — Environment Planning
// ─────────────────────────────────────────────────────────────────────────────

export interface EnvironmentPlanning {
  /** The category of environment the scene takes place in. */
  environmentType: StrategyField<"professional_studio" | "lifestyle_real_world" | "premium_interior" | "outdoor_natural" | "abstract_gradient" | "architectural_exterior" | "controlled_product_table">;
  /** What the background communicates about the brand before anyone reads a word. */
  backgroundStory: StrategyField;
  /** What occupies the nearest depth plane — often props or environmental accents. */
  foreground: StrategyField;
  /** What occupies the middle depth plane — typically the hero subject zone. */
  midground: StrategyField;
  /** What occupies the furthest depth plane — typically blurred environmental context. */
  background: StrategyField;
  /** Specific environmental details that reinforce brand quality and message credibility. */
  environmentalDetails: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 5 — Object Planning
// ─────────────────────────────────────────────────────────────────────────────

export interface ObjectPlanning {
  /** Objects that MUST appear — their absence would break the message. */
  requiredObjects: StrategyField;
  /** Objects that would strengthen the message if present but aren't mandatory. */
  optionalObjects: StrategyField;
  /** Objects that add visual richness without informational role. */
  decorativeObjects: StrategyField;
  /** Objects that establish credibility: badges, certifications, equipment. */
  trustObjects: StrategyField;
  /** Objects that explain or educate: models, diagrams, process elements. */
  educationalObjects: StrategyField;
  /** Brand identity objects: logo placement, branded packaging, brand colours. */
  brandObjects: StrategyField;
  /** Objects that must NEVER appear — they would undermine the message or brand. */
  objectsToExclude: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 6 — Composition Planning
// ─────────────────────────────────────────────────────────────────────────────

export interface CompositionPlanning {
  /** The dominant compositional principle governing this scene. */
  primaryComposition: StrategyField<"rule_of_thirds" | "centered_symmetry" | "golden_ratio" | "leading_diagonal" | "frame_within_frame" | "negative_space_dominant" | "edge_tension_asymmetric">;
  /** A secondary compositional device that adds depth or dynamism. */
  secondaryComposition: StrategyField;
  /** How visual mass is distributed left-to-right and top-to-bottom. */
  visualBalance: StrategyField<"top_heavy_hero" | "bottom_anchored" | "left_weighted" | "right_weighted" | "center_weighted" | "evenly_distributed">;
  /** The type of symmetry (or deliberate asymmetry) in the scene. */
  symmetry: StrategyField<"bilateral_symmetry" | "deliberate_asymmetry" | "radial_from_center" | "translational_rhythm">;
  /** The role and volume of empty space in the composition. */
  negativeSpace: StrategyField<"minimal_tight_content" | "balanced_breathing_room" | "generous_editorial_space" | "extreme_luxury_space">;
  /** The depth layers present and their relationship to each other. */
  depth: StrategyField<"flat_two_dimensional" | "shallow_foreground_blur" | "three_layer_natural" | "four_layer_cinematic" | "extreme_depth_environmental">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 7 — Camera Planning
// ─────────────────────────────────────────────────────────────────────────────

export interface CameraPlanning {
  /** Where the camera is positioned in the physical space relative to the subject. */
  cameraPosition: StrategyField;
  /** The vertical height of the camera relative to the subject. */
  cameraHeight: StrategyField<"eye_level" | "slightly_elevated" | "high_angle" | "low_angle_heroic" | "overhead_flat_lay" | "ground_level">;
  /** The angle and direction from which the subject is viewed. */
  viewingAngle: StrategyField<"straight_on_direct" | "three_quarter_view" | "side_profile" | "overhead_top_down" | "worm_eye_upward" | "dutch_tilt_dynamic">;
  /** The intended character and quality the lens treatment should create. */
  lensIntent: StrategyField<"macro_intimate_detail" | "portrait_natural_compression" | "standard_authentic" | "wide_environmental_scale" | "telephoto_compressed_elegance">;
  /** The conceptual distance between camera and subject. */
  distance: StrategyField<"extreme_close_up" | "close_up" | "medium_shot" | "medium_wide" | "wide_establishing">;
  /** What the perspective communicates about the subject's scale and importance. */
  perspective: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 8 — Lighting Planning
// ─────────────────────────────────────────────────────────────────────────────

export interface LightingPlanning {
  /** The key light — direction, quality, and what it communicates. */
  primaryLight: StrategyField;
  /** The fill or accent light — how it modifies the key light's effect. */
  secondaryLight: StrategyField;
  /** The overall mood the lighting creates in the scene. */
  moodLighting: StrategyField<"warm_intimate_golden" | "cool_clinical_precise" | "soft_diffused_approachable" | "dramatic_contrasty_luxury" | "bright_even_commercial" | "natural_authentic_ambient">;
  /** The character of shadows in the scene. */
  shadowStyle: StrategyField<"hard_dramatic_shadows" | "soft_diffused_shadows" | "minimal_shadowless" | "directional_subtle" | "no_shadow_product">;
  /** Surface reflections — in eyes, on products, in environments. */
  reflectionStyle: StrategyField<"specular_product_highlight" | "catchlight_eyes" | "surface_material_reflection" | "environmental_reflection" | "minimal_matte_finish">;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 9 — Storytelling Planning
// ─────────────────────────────────────────────────────────────────────────────

export interface StorytellingPlanning {
  /** The visual hook — what the eye notices first and the initial tension it creates. */
  beginning: StrategyField;
  /** The narrative development — what story the full scene tells. */
  middle: StrategyField;
  /** The visual resolution — the feeling the viewer is left with after reading the scene. */
  end: StrategyField;
  /** The complete story in a single decisive moment — what makes this one image unforgettable. */
  singleFrameNarrative: StrategyField;
  /** The emotional arc the viewer travels from first glance to final impression. */
  emotionalArc: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain 10 — Rendering Intent
// ─────────────────────────────────────────────────────────────────────────────

export interface RenderingIntent {
  /** How realistic the final image should be on a spectrum from stylised to hyperreal. */
  photorealismLevel: StrategyField<"hyperrealistic" | "photorealistic" | "photo_quality" | "stylized_realism" | "editorial_realism">;
  /** The luxury positioning of the image — how premium and refined it must feel. */
  luxuryLevel: StrategyField<"utility_functional" | "professional_quality" | "premium_polished" | "luxury_refined" | "ultra_prestige_perfect">;
  /** The advertising/commercial production standard this image must meet. */
  commercialQuality: StrategyField<"regional_commercial" | "national_commercial" | "global_campaign" | "award_winning_creative">;
  /** The editorial photographic quality standard this image must meet. */
  editorialQuality: StrategyField<"trade_editorial" | "consumer_magazine" | "luxury_editorial" | "art_direction">;
  /** What category of real-world media this image should be mistakeable for. */
  realismTarget: StrategyField<"premium_stock_photo" | "commercial_campaign_shoot" | "editorial_magazine_shoot" | "product_studio_shoot" | "architectural_photography">;
  /** Specific AI generation artifacts that must be actively prevented. */
  aiArtifactPreventionStrategy: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// VisualScenePlan — complete output of the Visual Scene Planning Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface VisualScenePlan {
  sceneObjective:     SceneObjective;
  heroSubject:        HeroSubjectPlanning;
  supportingSubjects: SupportingSubjectPlanning;
  environment:        EnvironmentPlanning;
  objects:            ObjectPlanning;
  composition:        CompositionPlanning;
  camera:             CameraPlanning;
  lighting:           LightingPlanning;
  storytelling:       StorytellingPlanning;
  renderingIntent:    RenderingIntent;

  /** Phase 10.4I — Hero Knowledge Graph metadata threaded from the blueprint.
   *  Carries heroMomentId, sceneTypeId, and all related IDs for memory and similarity. */
  heroGraph?: HeroKnowledgeGraphMeta;

  /** 0–100 overall confidence across all 10 domains. */
  confidenceScore: number;
  /** Fields where value is "unknown". */
  unknownFields: string[];
}
