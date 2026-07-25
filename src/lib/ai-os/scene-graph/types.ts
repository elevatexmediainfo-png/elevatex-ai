import type { StrategyField } from "../types";

// Phase 10.6B — Dynamic Scene Graph Compiler types.
//
// The Phase 10.5C Scene Graph audit measured the live pipeline's output at
// 64.5/100 photographic completeness and named ten structurally absent
// dimensions: body orientation, head direction, eye direction, hand position,
// object contact, subject count, architecture, occlusion, micro motion, and
// temporal instant. VisualScenePlan (scene-planner/types.ts) describes a
// campaign — objective, hero role, composition philosophy. SceneGraph
// describes a photograph — exactly what a camera would record at one instant.
//
// Every leaf below is a StrategyField so the type discipline matches every
// other domain object in the pipeline (VisualScenePlan, PromptSpecification):
// {value, confidence, reasoning} — never a bare string.

// ─────────────────────────────────────────────────────────────────────────────
// WHO — subjects physically present in the frame
// ─────────────────────────────────────────────────────────────────────────────

export interface WhoGraph {
  /** The primary hero, refined from VisualScenePlan.heroSubject into a physically exact description. */
  primaryHero: StrategyField;
  /** Supporting people physically present — role and count, not just "present/absent". */
  supportingPeople: StrategyField;
  /** How many distinct people occupy the frame. */
  subjectCount: StrategyField<"one" | "two" | "three" | "small_group" | "crowd">;
  /** An animal physically present, when the campaign signals make one plausible. */
  animals: StrategyField;
  /** A vehicle physically present, when the campaign signals make one plausible. */
  vehicles: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// WHERE — the physical space
// ─────────────────────────────────────────────────────────────────────────────

export interface WhereGraph {
  /** Structural architecture visible in the frame — the audit's #1 named gap. */
  architecture: StrategyField;
  /** The room or interior category, when the scene is indoors. */
  room: StrategyField;
  /** The street or exterior urban context, when the scene is outdoors. */
  street: StrategyField;
  /** The landscape context, when the scene is set in open/natural space. */
  landscape: StrategyField;
  /** Furniture physically present and load-bearing to the composition. */
  furniture: StrategyField;
  /** The overall environment category (refined from VisualScenePlan.environment.environmentType). */
  environment: StrategyField;
  /** What occupies the background depth plane. */
  background: StrategyField;
  /** What occupies the foreground depth plane. */
  foreground: StrategyField;
  /** What occupies the midground depth plane. */
  midground: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// POSE — whole-body physical action
// ─────────────────────────────────────────────────────────────────────────────

export interface PoseGraph {
  /** The hero's primary physical pose, drawn from the audit's exact ten-term vocabulary. */
  primaryPose: StrategyField<"standing" | "walking" | "running" | "leaning" | "kneeling" | "looking_back" | "looking_down" | "turning" | "reaching" | "holding">;
  /** A concrete secondary action clause composed alongside the primary pose. */
  secondaryAction: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// BODY — body-part-level orientation
// ─────────────────────────────────────────────────────────────────────────────

export interface BodyGraph {
  /** Where the head is turned. */
  headDirection: StrategyField<"toward_camera" | "toward_companion" | "toward_object" | "down" | "away_from_camera" | "three_quarter_turn">;
  /** Where the eyes are directed — independent axis from head direction (a turned head does not fix gaze). */
  eyeDirection: StrategyField<"direct_gaze" | "toward_companion" | "toward_object_in_hand" | "downcast" | "toward_middle_distance">;
  /** The shoulder line's rotation relative to the camera. */
  shoulderAngle: StrategyField<"square_to_camera" | "three_quarter_rotation" | "profile_turn" | "relaxed_asymmetric">;
  /** The torso's rotation and lean. */
  torsoRotation: StrategyField<"facing_forward" | "twisted_toward_action" | "leaning_forward" | "leaning_back">;
  /** The composed, physically exact description of what each hand is doing — the audit's #4 named gap. */
  handPosition: StrategyField;
  /** Where weight lands through the feet. */
  footPlacement: StrategyField<"weight_forward" | "weight_back" | "even_stance" | "mid_stride" | "not_visible_in_frame">;
  /** How body weight is distributed. */
  weightDistribution: StrategyField<"forward_engaged" | "back_relaxed" | "even_balanced" | "shifted_to_one_side">;
}

// ─────────────────────────────────────────────────────────────────────────────
// OBJECT CONTACT — the physical verb connecting a hand to an object
// ─────────────────────────────────────────────────────────────────────────────

export interface ObjectContactGraph {
  /** The primary contact verb — the audit's exact nine-term vocabulary. */
  primaryContact: StrategyField<"holding" | "touching" | "picking" | "pouring" | "writing" | "opening" | "closing" | "serving" | "operating">;
  /** The object being contacted. */
  contactObject: StrategyField;
  /** The fully composed physical clause: hand + verb + object + spatial target. */
  contactDescription: StrategyField;
  /** A second, independently composed contact clause for a supporting subject, when one is present. */
  secondaryContact: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// MICRO MOTION — small, time-bound physical phenomena
// ─────────────────────────────────────────────────────────────────────────────

export interface MicroMotionGraph {
  /** The composed clause describing 1-2 selected micro-motion elements, environment-coherent. */
  elements: StrategyField;
  /** The exact instant within the physical action this frame freezes — the audit's #10 named gap. */
  temporalInstant: StrategyField<"mid_gesture" | "peak_action" | "just_before_contact" | "just_after_release" | "suspended_mid_motion">;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA — mostly refined from VisualScenePlan.camera/composition, plus new fields
// ─────────────────────────────────────────────────────────────────────────────

export interface CameraGraph {
  /** Camera height, refined from VisualScenePlan.camera.cameraHeight. */
  height: StrategyField;
  /** Camera-to-subject distance, refined from VisualScenePlan.camera.distance. */
  distance: StrategyField;
  /** Viewing perspective, refined from VisualScenePlan.camera.viewingAngle/perspective. */
  perspective: StrategyField;
  /** Lens character, refined from VisualScenePlan.camera.lensIntent. */
  lens: StrategyField;
  /** What plane of the scene is in critical focus. */
  focusPlane: StrategyField<"hero_face" | "hands_and_object" | "foreground_object" | "full_depth" | "shallow_isolation_on_detail">;
  /** Depth layering, refined from VisualScenePlan.composition.depth. */
  depth: StrategyField;
  /** What draws the eye through the frame toward the subject. */
  leadingLines: StrategyField;
  /** What sits between the camera and the subject, and what it obscures — the audit's #8 named gap. */
  occlusion: StrategyField;
  /** What occupies and frames the extreme foreground. */
  foregroundFraming: StrategyField<"clean_no_framing" | "soft_blurred_object_frame" | "architectural_frame" | "human_shoulder_frame">;
  /** The role of empty space, refined from VisualScenePlan.composition.negativeSpace. */
  negativeSpace: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// MATERIALS — physical surfaces, replacing static per-industry lookup text
// with independently-chosen material/finish/light-interaction fragments
// ─────────────────────────────────────────────────────────────────────────────

export interface MaterialsGraph {
  /** The dominant architectural material (walls, floor, structure). */
  architectureMaterial: StrategyField;
  /** The material of the primary work surface (counter, table, desk). */
  surfaceMaterial: StrategyField;
  /** The material of the object under contact. */
  objectMaterial: StrategyField;
  /** The fabric visible on clothing or upholstery. */
  fabricMaterial: StrategyField;
  /** Food or skin surface texture, when physically relevant to the scene. */
  textureDetail: StrategyField;
  /** Where and how light reflects off a material surface. */
  reflection: StrategyField;
}

// ─────────────────────────────────────────────────────────────────────────────
// SceneGraph — complete output of the Scene Graph Compiler
// ─────────────────────────────────────────────────────────────────────────────

export interface SceneGraphMeta {
  /** Deterministic base seed derived from the blueprint — same input always reproduces the same graph. */
  seed: number;
  /** The SceneIndustry this graph was generated for. */
  industry: string;
  /** True when a reference image fixes the hero's pose — pose/body axes are then described as inherited, not invented. */
  referenceImageDominant: boolean;
  /** 0-100 photographic completeness score, computed against the same checklist the Phase 10.5C audit used. */
  completenessScore: number;
  /** Fields where value is "unknown". */
  unknownFields: string[];
}

export interface SceneGraph {
  who: WhoGraph;
  where: WhereGraph;
  pose: PoseGraph;
  body: BodyGraph;
  objectContact: ObjectContactGraph;
  microMotion: MicroMotionGraph;
  camera: CameraGraph;
  materials: MaterialsGraph;

  /** The single cohesive paragraph rendered FROM the graph above — "Scene Graph owns the photograph." */
  narrative: string;

  meta: SceneGraphMeta;
}
