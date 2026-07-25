import type { SceneGraph } from "../scene-graph/types";
import type { PromptSpecification } from "../prompt-spec/types";

// Phase 10.6D — Scene Graph <-> Prompt Specification provenance.
//
// Phase 10.6C wired exactly 5 of PromptSpecification's 12 builders to prefer
// Scene Graph content over independent re-derivation (hero, supporting,
// composition, camera, environment — see PROJECT_STATUS.md's Phase 10.6C
// entry). This map documents that exact wiring so the trace can verify it
// against REAL field values, not merely trust the reasoning-string marker
// Phase 10.6C's builders already write ("Scene Graph WHO:", "provided by
// Scene Graph WHERE", ...). If a builder's source mapping ever changes, this
// map must change with it — it is metadata ABOUT the integration, not a
// second copy of the integration's logic.

interface ProvenanceRule {
  specPath: string;
  sceneGraphPaths: string[];
  getSceneGraphValues(graph: SceneGraph): Array<{ path: string; value: string }>;
}

const PROVENANCE_RULES: ProvenanceRule[] = [
  {
    specPath: "hero.heroDetails",
    sceneGraphPaths: ["pose.secondaryAction", "body.headDirection", "body.eyeDirection", "body.handPosition"],
    getSceneGraphValues: (g) => [
      { path: "pose.secondaryAction", value: g.pose.secondaryAction.value },
      { path: "body.headDirection", value: g.body.headDirection.value },
      { path: "body.eyeDirection", value: g.body.eyeDirection.value },
      { path: "body.handPosition", value: g.body.handPosition.value },
    ],
  },
  {
    specPath: "supporting.relationships",
    sceneGraphPaths: ["objectContact.contactDescription", "objectContact.secondaryContact"],
    getSceneGraphValues: (g) => [
      { path: "objectContact.contactDescription", value: g.objectContact.contactDescription.value },
      { path: "objectContact.secondaryContact", value: g.objectContact.secondaryContact.value },
    ],
  },
  {
    specPath: "environment.premiumDetails",
    sceneGraphPaths: ["materials.architectureMaterial", "materials.surfaceMaterial", "materials.reflection"],
    getSceneGraphValues: (g) => [
      { path: "materials.architectureMaterial", value: g.materials.architectureMaterial.value },
      { path: "materials.surfaceMaterial", value: g.materials.surfaceMaterial.value },
      { path: "materials.reflection", value: g.materials.reflection.value },
    ],
  },
  {
    specPath: "composition.background",
    sceneGraphPaths: ["where.background"],
    getSceneGraphValues: (g) => [{ path: "where.background", value: g.where.background.value }],
  },
  {
    specPath: "composition.foreground",
    sceneGraphPaths: ["where.foreground"],
    getSceneGraphValues: (g) => [{ path: "where.foreground", value: g.where.foreground.value }],
  },
  {
    specPath: "composition.midground",
    sceneGraphPaths: ["where.midground"],
    getSceneGraphValues: (g) => [{ path: "where.midground", value: g.where.midground.value }],
  },
  {
    specPath: "camera.cameraPosition",
    sceneGraphPaths: ["camera.occlusion", "camera.leadingLines", "camera.focusPlane"],
    getSceneGraphValues: (g) => [
      { path: "camera.occlusion", value: g.camera.occlusion.value },
      { path: "camera.leadingLines", value: g.camera.leadingLines.value },
      { path: "camera.focusPlane", value: g.camera.focusPlane.value },
    ],
  },
];

const NON_VALUE = new Set(["unknown", "not_applicable"]);

function getByPath(spec: PromptSpecification, path: string): string | undefined {
  const [section, field] = path.split(".");
  const sectionObj = (spec as unknown as Record<string, unknown>)[section!];
  if (!sectionObj || typeof sectionObj !== "object") return undefined;
  const fieldObj = (sectionObj as Record<string, unknown>)[field!];
  if (!fieldObj || typeof fieldObj !== "object" || !("value" in fieldObj)) return undefined;
  return (fieldObj as { value: string }).value;
}

export interface SceneGraphConsumption {
  /** PromptSpecification field paths whose current value actually contains
   *  Scene-Graph-sourced content (verified by substring, not assumed). */
  specFieldsConsumed: string[];
  /** SceneGraph field paths confirmed to have contributed. */
  sceneGraphFieldsConsumed: string[];
}

/**
 * Cross-checks each Phase 10.6C wiring rule against a REAL spec + Scene Graph
 * pair: a rule only counts as "consumed" when the Scene Graph source field
 * has a usable value AND that exact value is present as a substring of the
 * PromptSpecification field it is supposed to feed. This is a verification,
 * not a trust of the reasoning-string marker alone.
 */
export function detectSceneGraphConsumption(spec: PromptSpecification, graph: SceneGraph): SceneGraphConsumption {
  const specFieldsConsumed = new Set<string>();
  const sceneGraphFieldsConsumed = new Set<string>();

  for (const rule of PROVENANCE_RULES) {
    const specValue = getByPath(spec, rule.specPath);
    if (!specValue || specValue === "unknown") continue;
    for (const { path, value } of rule.getSceneGraphValues(graph)) {
      if (NON_VALUE.has(value)) continue;
      if (specValue.includes(value)) {
        specFieldsConsumed.add(rule.specPath);
        sceneGraphFieldsConsumed.add(path);
      }
    }
  }

  return {
    specFieldsConsumed: [...specFieldsConsumed].sort(),
    sceneGraphFieldsConsumed: [...sceneGraphFieldsConsumed].sort(),
  };
}

/** For influence-graph attribution: given a spec field path, return the
 *  Scene Graph source paths that rule maps to (regardless of whether they
 *  were confirmed present in this specific run) — used only after a spec
 *  field has already been matched to a sentence by text overlap. */
export function sceneGraphSourcesFor(specPath: string): string[] {
  return PROVENANCE_RULES.find((r) => r.specPath === specPath)?.sceneGraphPaths ?? [];
}

export const SCENE_GRAPH_WIRED_SPEC_FIELDS: readonly string[] = PROVENANCE_RULES.map((r) => r.specPath);
