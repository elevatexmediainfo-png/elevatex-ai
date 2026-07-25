import type { VisualScenePlan } from "../../scene-planner/types";
import type { SceneGraph } from "../../scene-graph/types";
import type { CameraSpec } from "../types";
import { promoteField, psf, sceneGraphJoin } from "./shared";

// Builder 5 — Camera Specification
// Promotes camera decisions from VisualScenePlan. cameraHeight/viewingAngle/
// lensIntent/distance/perspectiveIntent stay enum-sourced from VisualScenePlan
// unchanged — Scene Graph's equivalents are the SAME signal, only naturalised
// to prose, and swapping them in would silently change these fields from
// clean enums to human text (Flux/SDXL's tag() helper expects the enum form).
// cameraPosition is free text and gets genuinely NEW information Scene Graph
// adds (occlusion, leading lines, focus plane) — enriched, never regenerated
// independently of what Scene Graph already decided.

export function buildCameraSpec(scene: VisualScenePlan, graph?: SceneGraph): CameraSpec {
  const base = promoteField(scene.camera.cameraPosition, "scene.camera.position");
  const cameraPosition = (() => {
    if (!graph) return base;
    const extras = sceneGraphJoin([graph.camera.occlusion, graph.camera.leadingLines, graph.camera.focusPlane]);
    if (extras.length === 0) return base;
    const combined = base.value !== "unknown" ? `${base.value}. ${extras.join(". ")}` : extras.join(". ");
    return psf(combined, "high", "[scene.camera.position] enriched with Scene Graph camera detail (occlusion, leading lines, focus plane) — not independently regenerated");
  })();

  return {
    cameraPosition,
    cameraHeight:    promoteField(scene.camera.cameraHeight,     "scene.camera.height"),
    viewingAngle:    promoteField(scene.camera.viewingAngle,     "scene.camera.angle"),
    lensIntent:      promoteField(scene.camera.lensIntent,       "scene.camera.lens"),
    distance:        promoteField(scene.camera.distance,         "scene.camera.distance"),
    perspectiveIntent: promoteField(scene.camera.perspective,    "scene.camera.perspective"),
  };
}
