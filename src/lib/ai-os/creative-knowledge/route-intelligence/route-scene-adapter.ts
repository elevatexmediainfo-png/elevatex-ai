// Phase 10.4C — Route Scene Adapter.
//
// Bridges the Route Intelligence output (ScoredRouteCandidate.route) into the
// Visual Scene Plan produced by Phase 10 (buildVisualScenePlan), so that
// Phase 11's prompt specification — and ultimately Phase 13's provider prompt —
// reflect the creative philosophy of the selected route.
//
// WHY here, not inside Phase 11:
//   buildPromptSpecification() is stable, correct, and thoroughly tested.
//   Rather than adding an optional parameter (which would propagate a type
//   change through every one of its 12 builders), this adapter enriches the
//   VisualScenePlan BEFORE Phase 11 receives it. Phase 11 is unchanged.
//
// WHAT it does:
//   For each of the route's 7 plain-text directives (hero, composition,
//   photography, layout, marketing, emotion, productionNote), it locates the
//   most semantically-aligned free-text StrategyField in the scene plan and
//   APPENDS the route directive to the existing value.
//
//   "Append" not "replace" — the scene plan's field already carries Phase 10
//   intelligence derived from the full Blueprint. The route directive adds
//   specificity without discarding what the earlier phases contributed.
//
// WHAT it does NOT do:
//   ✗  Never overwrites enum-constrained StrategyField values (primaryComposition,
//      cameraHeight, moodLighting, etc.) — those can only hold specific string
//      literals and route data is freeform.
//   ✗  Never mutates the original scene plan — returns a shallow-cloned copy
//      with only the target fields replaced.
//   ✗  Never throws — if the route directive is empty or "unknown", the field
//      is returned unchanged.
//
// Usage:
//   const enrichedScene = applyRouteToScene(visualScenePlan, selected.route);
//   const spec = buildPromptSpecification(blueprint, enrichedScene, gptDirection);

import type { VisualScenePlan } from "../../scene-planner/types";
import type { CreativeRoute } from "../../creative-route-engine/types";

// ── Private helpers ─────────────────────────────────────────────────────────────

/**
 * A structurally-typed StrategyField limited to plain-string values.
 * Only passed to free-text fields (not enum-constrained ones).
 * Preserving the wider field type via generics keeps the return assignable
 * back to the original field position in VisualScenePlan.
 */
type TextField<C extends string = string> = {
  value:      string;
  confidence: C;
  reasoning:  string;
};

/**
 * Append a route directive to an existing StrategyField value.
 * Skips augmentation when the directive is absent, empty, or "unknown".
 * Returns the SAME object reference when no change is needed (cheap path).
 */
function augment<F extends TextField>(
  field:     F,
  directive: string | undefined,
): F {
  if (!directive || directive === "unknown" || directive.trim() === "") return field;
  const existing = field.value !== "unknown" ? field.value.trim() : "";
  const merged   = existing ? `${existing}. ${directive}` : directive;
  return { ...field, value: merged };
}

// ── Public API ──────────────────────────────────────────────────────────────────

/**
 * Return a new VisualScenePlan enriched with the selected route's visual
 * directives. The original scene plan is not mutated.
 *
 * Each route property is appended to the most semantically-relevant free-text
 * StrategyField in the scene plan:
 *
 *   route.hero           → heroSubject.exactHeroSubject
 *                          (what/who occupies the primary visual zone)
 *   route.marketing      → sceneObjective.scenePurpose
 *                          (commercial strategy behind this execution)
 *   route.composition    → composition.secondaryComposition
 *                          (compositional philosophy as secondary device)
 *   route.photography    → camera.cameraPosition
 *                          (lens + light + angle approach)
 *   route.layout         → camera.perspective
 *                          (zone distribution shapes framing intent)
 *   route.productionNote → environment.environmentalDetails
 *                          (key direction that unlocks this route)
 *   route.emotion        → storytelling.singleFrameNarrative
 *                          (primary psychological trigger)
 *   route.emotion        → storytelling.emotionalArc
 *                          (carried through beginning → end)
 *   route.layout         → storytelling.middle
 *                          (reading flow = story development direction)
 */
export function applyRouteToScene(
  scene: VisualScenePlan,
  route: CreativeRoute,
): VisualScenePlan {
  return {
    ...scene,

    sceneObjective: {
      ...scene.sceneObjective,
      scenePurpose: augment(scene.sceneObjective.scenePurpose, route.marketing),
    },

    heroSubject: {
      ...scene.heroSubject,
      exactHeroSubject: augment(scene.heroSubject.exactHeroSubject, route.hero),
    },

    composition: {
      ...scene.composition,
      secondaryComposition: augment(scene.composition.secondaryComposition, route.composition),
    },

    camera: {
      ...scene.camera,
      cameraPosition: augment(scene.camera.cameraPosition, route.photography),
      perspective:    augment(scene.camera.perspective,    route.layout),
    },

    environment: {
      ...scene.environment,
      environmentalDetails: augment(scene.environment.environmentalDetails, route.productionNote),
    },

    storytelling: {
      ...scene.storytelling,
      middle:               augment(scene.storytelling.middle,              route.layout),
      singleFrameNarrative: augment(scene.storytelling.singleFrameNarrative, route.emotion),
      emotionalArc:         augment(scene.storytelling.emotionalArc,        route.emotion),
    },
  };
}
