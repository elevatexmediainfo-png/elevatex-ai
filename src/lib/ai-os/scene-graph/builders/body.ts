import type { VisualScenePlan } from "../../scene-planner/types";
import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { BodyGraph, PoseGraph } from "../types";
import { sg } from "../field";
import { axisSeed, pick } from "../seed";
import {
  HEAD_DIRECTION_PHRASE, EYE_DIRECTION_PHRASE, SHOULDER_ANGLE_PHRASE, TORSO_ROTATION_PHRASE,
  FOOT_PLACEMENT_PHRASE, WEIGHT_DISTRIBUTION_PHRASE, CONTACT_VERB_SYNONYMS, HAND_SIDES,
  SPATIAL_TARGETS, CONTACT_OBJECT_FALLBACK, type ContactVerb,
} from "../vocabulary";

// Phase 10.6B — BODY graph builder.
// Head direction, eye direction, hand position are the audit's named gaps.
// Six of the seven axes below are grouped into small "posture families" keyed
// off the POSE graph's chosen primaryPose — enough correlation to stay
// physically coherent (a "kneeling" pose should not pair with "mid-stride"
// feet), while each axis still makes its own independent seeded choice within
// the family's compatible subset, so no two poses in the same family render
// identically. handPosition is composed once here from independent verb/
// object/spatial-target axes and its raw pieces are returned as `HandEvent`
// so object-contact.ts describes the SAME physical event structurally instead
// of independently re-inventing what the hands are doing.

type PoseFamily = "grounded" | "downward_focus" | "in_motion" | "turned_away";

const POSE_TO_FAMILY: Record<string, PoseFamily> = {
  standing: "grounded", holding: "grounded",
  leaning: "downward_focus", kneeling: "downward_focus", looking_down: "downward_focus",
  walking: "in_motion", running: "in_motion", turning: "in_motion", reaching: "in_motion",
  looking_back: "turned_away",
};

type BodyValue<K extends keyof BodyGraph> = Exclude<BodyGraph[K]["value"], "unknown">;

const FAMILY_AXES: Record<PoseFamily, {
  head: readonly BodyValue<"headDirection">[]; eye: readonly BodyValue<"eyeDirection">[];
  shoulder: readonly BodyValue<"shoulderAngle">[]; torso: readonly BodyValue<"torsoRotation">[];
  foot: readonly BodyValue<"footPlacement">[]; weight: readonly BodyValue<"weightDistribution">[];
}> = {
  grounded:        { head: ["toward_camera", "three_quarter_turn"], eye: ["direct_gaze", "toward_middle_distance"], shoulder: ["square_to_camera", "relaxed_asymmetric"], torso: ["facing_forward"], foot: ["even_stance", "weight_forward"], weight: ["even_balanced", "forward_engaged"] },
  downward_focus:  { head: ["down", "toward_object"], eye: ["downcast", "toward_object_in_hand"], shoulder: ["three_quarter_rotation", "relaxed_asymmetric"], torso: ["leaning_forward"], foot: ["weight_forward", "not_visible_in_frame"], weight: ["forward_engaged"] },
  in_motion:       { head: ["toward_object", "three_quarter_turn"], eye: ["toward_object_in_hand", "toward_middle_distance"], shoulder: ["three_quarter_rotation", "profile_turn"], torso: ["twisted_toward_action"], foot: ["mid_stride", "weight_forward"], weight: ["shifted_to_one_side", "forward_engaged"] },
  turned_away:     { head: ["away_from_camera", "three_quarter_turn"], eye: ["toward_companion", "toward_middle_distance"], shoulder: ["profile_turn"], torso: ["twisted_toward_action", "facing_forward"], foot: ["even_stance", "weight_back"], weight: ["shifted_to_one_side", "even_balanced"] },
};

export interface HandEvent {
  verbCategory: ContactVerb;
  primaryVerb: string;
  secondaryVerb: string;
  primaryObject: string;
  secondaryObject: string;
  spatialTarget: string;
}

export interface BodyBuildResult {
  graph: BodyGraph;
  handEvent: HandEvent;
}

const VERB_CATEGORIES = Object.keys(CONTACT_VERB_SYNONYMS) as ContactVerb[];

// requiredObjects is often a full instruction clause ("Signature dish, premium
// tableware, ambient restaurant lighting — the food must look genuine and
// appetising"), not a short noun phrase — using it whole as a hand-contact
// object produces incoherent prose. Extracting the text before the first
// comma/semicolon/dash keeps the real, campaign-specific noun ("Signature
// dish") when there is one short enough to read as an object, and falls back
// to the vocabulary bank otherwise.
function shortObjectPhrase(value: string): string | undefined {
  if (value === "unknown") return undefined;
  const head = value.split(/[,;—–]/)[0]!.trim();
  return head.length > 0 && head.length <= 40 ? head : undefined;
}

function objectFor(scene: VisualScenePlan, industry: SceneIndustry, seed: number): { primary: string; secondary: string } {
  const real = shortObjectPhrase(scene.objects.requiredObjects.value);
  const fallbackPool = CONTACT_OBJECT_FALLBACK[industry];
  const secondary = pick(fallbackPool, axisSeed(seed, "body:secondaryObject"));
  const primary = real ?? pick(fallbackPool, axisSeed(seed, "body:primaryObject"));
  return { primary, secondary: secondary === primary ? pick(fallbackPool, axisSeed(seed, "body:secondaryObject2")) : secondary };
}

export function buildBodyGraph(scene: VisualScenePlan, seed: number, industry: SceneIndustry, pose: PoseGraph): BodyBuildResult {
  const family = POSE_TO_FAMILY[pose.primaryPose.value] ?? "grounded";
  const axes = FAMILY_AXES[family];

  const headDirection = sg(pick(axes.head, axisSeed(seed, "body:head")), "medium", `Scene Graph BODY: head direction chosen within the "${family}" posture family implied by pose "${pose.primaryPose.value}"`);
  const eyeDirection = sg(pick(axes.eye, axisSeed(seed, "body:eye")), "medium", `Scene Graph BODY: eye direction chosen independently of head direction — same posture family, different axis`);
  const shoulderAngle = sg(pick(axes.shoulder, axisSeed(seed, "body:shoulder")), "medium", `Scene Graph BODY: shoulder angle chosen within the "${family}" posture family`);
  const torsoRotation = sg(pick(axes.torso, axisSeed(seed, "body:torso")), "medium", `Scene Graph BODY: torso rotation chosen within the "${family}" posture family`);
  const footPlacement = sg(pick(axes.foot, axisSeed(seed, "body:foot")), "medium", `Scene Graph BODY: foot placement chosen within the "${family}" posture family`);
  const weightDistribution = sg(pick(axes.weight, axisSeed(seed, "body:weight")), "medium", `Scene Graph BODY: weight distribution chosen within the "${family}" posture family`);

  const verbCategory = pick(VERB_CATEGORIES, axisSeed(seed, "body:verbCategory"));
  const synonyms = CONTACT_VERB_SYNONYMS[verbCategory];
  const primaryVerb = pick(synonyms, axisSeed(seed, "body:primaryVerb"));
  const secondaryPool = synonyms.filter((v) => v !== primaryVerb);
  const secondaryVerb = secondaryPool.length > 0 ? pick(secondaryPool, axisSeed(seed, "body:secondaryVerb")) : primaryVerb;
  const { primary: primaryObject, secondary: secondaryObject } = objectFor(scene, industry, seed);
  const spatialTarget = pick(SPATIAL_TARGETS, axisSeed(seed, "body:spatialTarget"));
  const [sideA, sideB] = HAND_SIDES;

  const handPosition = sg(
    `${sideA} ${primaryVerb} ${primaryObject} while ${sideB} ${secondaryVerb} ${secondaryObject} ${spatialTarget}`,
    "medium",
    "Scene Graph BODY: hand position composed from independent verb, object, and spatial-target axes — the audit's named gap",
  );

  return {
    graph: { headDirection, eyeDirection, shoulderAngle, torsoRotation, handPosition, footPlacement, weightDistribution },
    handEvent: { verbCategory, primaryVerb, secondaryVerb, primaryObject, secondaryObject, spatialTarget },
  };
}

// Re-exported so narrative.ts and other consumers can render enum values to
// prose without duplicating the phrase tables.
export {
  HEAD_DIRECTION_PHRASE, EYE_DIRECTION_PHRASE, SHOULDER_ANGLE_PHRASE,
  TORSO_ROTATION_PHRASE, FOOT_PLACEMENT_PHRASE, WEIGHT_DISTRIBUTION_PHRASE,
};
