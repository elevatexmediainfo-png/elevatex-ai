import type { VisualScenePlan } from "../../scene-planner/types";
import type { PoseGraph } from "../types";
import { sg } from "../field";
import { axisSeed, pick } from "../seed";

// Phase 10.6B — POSE graph builder.
// VisualScenePlan.heroSubject.heroPose is an 8-value planning-level enum
// (seated_engaged, mid_action, ...). PoseGraph.primaryPose uses the audit's
// exact ten physical-pose vocabulary. Each planning-level pose maps to the
// subset of physical poses actually compatible with it — the mapping keeps
// the two layers coherent without collapsing them into one, and a seeded pick
// within the compatible subset is what keeps two campaigns sharing a heroPose
// from always rendering the identical physical pose.

type PrimaryPose = PoseGraph["primaryPose"]["value"];

const POSE_COMPATIBILITY: Record<string, readonly Exclude<PrimaryPose, "unknown">[]> = {
  seated_engaged:       ["leaning", "looking_down", "holding", "reaching"],
  standing_confident:   ["standing", "looking_back", "turning", "holding"],
  mid_action:           ["walking", "reaching", "turning", "holding"],
  at_rest:              ["standing", "leaning", "looking_down"],
  dynamic_movement:     ["walking", "running", "turning", "reaching"],
  static_product:       ["standing", "holding"],
  transformation_split: ["standing", "turning", "looking_back"],
  overhead_product:     ["holding", "reaching"],
  unknown:              ["standing", "walking", "leaning", "kneeling", "looking_back", "looking_down", "turning", "reaching", "holding", "running"],
};

// Reference-image-dominant campaigns must not assert a pose that could visibly
// contradict an uploaded photo's actual, unseen pose — restricted to the
// subset least likely to conflict with an arbitrary portrait or product shot.
const REFERENCE_SAFE_POSES: readonly Exclude<PrimaryPose, "unknown">[] = ["standing", "leaning", "holding", "looking_down"];

const SECONDARY_ACTION_PHRASE: Record<Exclude<PrimaryPose, "unknown">, readonly string[]> = {
  standing:     ["standing with settled, confident weight", "standing at ease, fully present in the space"],
  walking:      ["mid-stride through the space", "caught in the middle of a walking motion"],
  running:      ["caught mid-run, motion still resolving", "in full stride, momentum visible"],
  leaning:      ["leaning forward over the work surface", "leaning in toward the point of focus"],
  kneeling:     ["kneeling to align with the lower detail", "kneeling, bringing the eyeline down to the work"],
  looking_back: ["glancing back over one shoulder", "turning back mid-motion to look behind"],
  looking_down: ["gaze dropped to the task at hand", "looking down at what the hands are doing"],
  turning:      ["caught mid-turn toward the action", "rotating through the frame toward the subject"],
  reaching:     ["reaching toward the object just ahead", "arm extended mid-reach"],
  holding:      ["holding steady, weight settled", "holding the position with quiet control"],
};

export function buildPoseGraph(scene: VisualScenePlan, seed: number, referenceImageDominant: boolean): PoseGraph {
  const heroPoseKey = scene.heroSubject.heroPose.value;
  const compatible = POSE_COMPATIBILITY[heroPoseKey] ?? POSE_COMPATIBILITY.unknown!;
  const pool = referenceImageDominant ? compatible.filter((p) => REFERENCE_SAFE_POSES.includes(p)) : compatible;
  const finalPool = pool.length > 0 ? pool : compatible;

  const chosen = pick(finalPool, axisSeed(seed, "pose:primary"));

  const primaryPose = sg(
    chosen,
    referenceImageDominant ? "medium" : (scene.heroSubject.heroPose.confidence === "unknown" ? "low" : "medium"),
    referenceImageDominant
      ? `Scene Graph POSE: reference image fixes the true pose — "${chosen}" is a conservative physical-vocabulary label compatible with an unseen photo, not an invented pose`
      : `Scene Graph POSE: selected from the physical poses compatible with Visual Scene Plan heroPose "${heroPoseKey}"`,
  );

  const secondaryAction = sg(
    pick(SECONDARY_ACTION_PHRASE[chosen], axisSeed(seed, "pose:secondary")),
    "medium",
    `Scene Graph POSE: secondary action clause composed to match the chosen primary pose "${chosen}"`,
  );

  return { primaryPose, secondaryAction };
}
