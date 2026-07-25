import type { VisualScenePlan } from "../../scene-planner/types";
import type { CameraGraph } from "../types";
import type { KnowledgeSignal } from "../knowledge-bridge";
import { sg } from "../field";
import { axisSeed, pickBiased } from "../seed";
import { LEADING_LINE_SOURCES, OCCLUSION_PHRASES } from "../vocabulary";

// Phase 10.6B — CAMERA graph builder.
// VisualScenePlan already carries real, campaign-specific camera and
// composition signals (height, distance, viewing angle, lens intent, depth,
// negative space) — those are refined/naturalised here, not re-derived.
// Occlusion (the audit's #8 named gap), focus plane, leading lines, and
// foreground framing are new.

function naturalise(value: string): string {
  return value.replace(/_/g, " ");
}

export function buildCameraGraph(
  scene: VisualScenePlan,
  seed: number,
  knowledge: KnowledgeSignal,
  hasHandContact: boolean,
): CameraGraph {
  const cam = scene.camera;
  const comp = scene.composition;

  const height = cam.cameraHeight.value !== "unknown"
    ? sg(naturalise(cam.cameraHeight.value), cam.cameraHeight.confidence, "Scene Graph CAMERA: naturalised from Visual Scene Plan camera height")
    : sg("eye level", "low", "Scene Graph CAMERA: no camera height upstream — eye-level fallback");

  const distance = cam.distance.value !== "unknown"
    ? sg(naturalise(cam.distance.value), cam.distance.confidence, "Scene Graph CAMERA: naturalised from Visual Scene Plan distance")
    : sg("medium shot", "low", "Scene Graph CAMERA: no distance upstream — medium-shot fallback");

  const perspective = cam.viewingAngle.value !== "unknown"
    ? sg(naturalise(cam.viewingAngle.value), cam.viewingAngle.confidence, "Scene Graph CAMERA: naturalised from Visual Scene Plan viewing angle")
    : (cam.perspective.value !== "unknown"
        ? sg(cam.perspective.value, cam.perspective.confidence, "Scene Graph CAMERA: inherited from Visual Scene Plan perspective")
        : sg("straight on, direct", "low", "Scene Graph CAMERA: no viewing angle or perspective upstream — direct fallback"));

  const lens = cam.lensIntent.value !== "unknown"
    ? sg(naturalise(cam.lensIntent.value), cam.lensIntent.confidence, "Scene Graph CAMERA: naturalised from Visual Scene Plan lens intent")
    : sg("standard, authentic", "low", "Scene Graph CAMERA: no lens intent upstream — standard fallback");

  const focusPlane = (() => {
    if (hasHandContact) return sg("hands_and_object" as const, "medium", "Scene Graph CAMERA: object-contact graph has an active hand/object clause — focus follows the hands");
    if (scene.heroSubject.heroScale.value === "full_frame_dominant" || scene.heroSubject.heroScale.value === "two_thirds_dominant") {
      return sg("hero_face" as const, "medium", "Scene Graph CAMERA: hero dominates frame scale — focus follows the face");
    }
    const opts = ["foreground_object", "full_depth", "shallow_isolation_on_detail"] as const;
    return sg(pickBiased(opts, axisSeed(seed, "camera:focusPlane"), knowledge.tags), "low", "Scene Graph CAMERA: no strong hero/contact signal — vocabulary fallback");
  })();

  const depth = comp.depth.value !== "unknown"
    ? sg(naturalise(comp.depth.value), comp.depth.confidence, "Scene Graph CAMERA: naturalised from Visual Scene Plan composition depth")
    : sg("three layer natural", "low", "Scene Graph CAMERA: no depth signal upstream — three-layer fallback");

  const leadingLines = sg(
    pickBiased(LEADING_LINE_SOURCES, axisSeed(seed, "camera:leadingLines"), knowledge.tags),
    "medium",
    "Scene Graph CAMERA: leading-line source selected from vocabulary bank, biased by knowledge-bank tags where they matched",
  );

  const occlusion = sg(
    pickBiased(OCCLUSION_PHRASES, axisSeed(seed, "camera:occlusion"), knowledge.tags),
    "medium",
    "Scene Graph CAMERA: occlusion state selected from vocabulary bank — the audit's named gap, now always populated",
  );

  const foregroundFraming = (() => {
    if (comp.negativeSpace.value === "generous_editorial_space" || comp.negativeSpace.value === "extreme_luxury_space") {
      return sg("clean_no_framing" as const, "medium", "Scene Graph CAMERA: generous negative space upstream implies an unframed foreground");
    }
    const opts = ["soft_blurred_object_frame", "architectural_frame", "human_shoulder_frame"] as const;
    return sg(pickBiased(opts, axisSeed(seed, "camera:foregroundFraming"), knowledge.tags), "low", "Scene Graph CAMERA: no strong negative-space signal — vocabulary fallback");
  })();

  const negativeSpace = comp.negativeSpace.value !== "unknown"
    ? sg(naturalise(comp.negativeSpace.value), comp.negativeSpace.confidence, "Scene Graph CAMERA: naturalised from Visual Scene Plan negative space")
    : sg("balanced breathing room", "low", "Scene Graph CAMERA: no negative-space signal upstream — balanced fallback");

  return { height, distance, perspective, lens, focusPlane, depth, leadingLines, occlusion, foregroundFraming, negativeSpace };
}
