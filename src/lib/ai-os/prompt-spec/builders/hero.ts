import type { VisualScenePlan } from "../../scene-planner/types";
import type { SceneGraph } from "../../scene-graph/types";
import type { HeroSpecification } from "../types";
import { promoteField, psf, unknownPsf, sceneGraphJoin } from "./shared";

// Builder 2 — Hero Specification
// Promotes hero decisions from VisualScenePlan into the Specification contract.
// Phase 10.6C: heroDetails prefers Scene Graph's POSE/BODY graphs when present —
// "Pose: mid_action. Expression: confident_natural_smile" (2 planning-level
// enums) is replaced wholesale, not appended to, by Scene Graph's physically
// specific pose + head/eye direction + hand-position description, since the
// two describe the exact same thing at different resolutions and showing both
// would duplicate rather than enrich. heroSubject/heroImportance/heroPosition/
// heroScale are untouched — Scene Graph's WHO.primaryHero inherits Hero
// Fusion's output verbatim by design, so there is no new information there.

export function buildHeroSpecification(scene: VisualScenePlan, graph?: SceneGraph): HeroSpecification {
  const heroSubject = promoteField(scene.heroSubject.exactHeroSubject, "scene.heroSubject.exactHeroSubject");

  const heroImportance = (() => {
    const raw = scene.heroSubject.heroImportance.value;
    const map: Record<string, HeroSpecification["heroImportance"]["value"]> = {
      the_entire_message: "absolute_mandatory",
      primary_anchor:     "primary_anchor",
      strong_supporting:  "strong_supporting",
      contextual_element: "strong_supporting",
    };
    const val = map[raw ?? ""] ?? "primary_anchor";
    return psf(val, scene.heroSubject.heroImportance.confidence,
      `[hero importance] mapped from scene plan: "${raw}"`);
  })();

  const heroPosition = promoteField(scene.heroSubject.heroPosition, "scene.heroSubject.heroPosition");

  const heroScale = promoteField(scene.heroSubject.heroScale, "scene.heroSubject.heroScale");

  const heroDetails = (() => {
    if (graph) {
      const graphBits = sceneGraphJoin([
        graph.pose.secondaryAction, graph.body.headDirection, graph.body.eyeDirection, graph.body.handPosition,
      ]);
      if (graphBits.length > 0) {
        return psf(graphBits.join(". "), "high", "Hero details provided by Scene Graph POSE/BODY — not independently regenerated from planning-level pose/expression enums");
      }
    }
    const pose = scene.heroSubject.heroPose.value;
    const expression = scene.heroSubject.heroExpression.value;
    const details = [
      pose !== "unknown" ? `Pose: ${pose.replace(/_/g, " ")}` : null,
      expression !== "unknown" && expression !== "not_applicable_product" ? `Expression: ${expression.replace(/_/g, " ")}` : null,
    ].filter(Boolean).join(". ");
    if (details) return psf(details, "high", `Hero details assembled from pose and expression`);
    if (expression === "not_applicable_product") return psf("Product-only scene — no human expression required", "high", `Non-human hero`);
    return unknownPsf("heroDetails");
  })();

  return { heroSubject, heroImportance, heroPosition, heroScale, heroDetails };
}
