import type { VisualScenePlan } from "../../scene-planner/types";
import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { WhereGraph } from "../types";
import type { KnowledgeSignal } from "../knowledge-bridge";
import { sg } from "../field";
import { axisSeed, pickBiased } from "../seed";
import { safeInheritedText } from "../sanitize";
import { ARCHITECTURE_NOUNS, ROOM_NOUNS, FURNITURE_NOUNS, STREET_NOUNS, LANDSCAPE_NOUNS } from "../vocabulary";

// Phase 10.6B — WHERE graph builder.
// Architecture and furniture are the audit's named gaps — VisualScenePlan's
// EnvironmentPlanning has an environmentType enum and free-text background
// story, but no physically enumerable structural elements a camera would
// actually record. Depth-plane fields (background/foreground/midground) are
// refined from the existing plan rather than re-derived. Selection is biased
// toward the knowledge bridge's tags (e.g. a scene-type tagged "wine-cellar"
// nudges architecture toward "a wine wall") but always falls back to the
// seeded vocabulary pick, so the field is never empty.

const OUTDOOR_TYPES = new Set(["outdoor_natural", "architectural_exterior"]);

type PlanField = { value: string; confidence: "high" | "medium" | "low" | "unknown"; reasoning: string };

export function buildWhereGraph(
  scene: VisualScenePlan,
  seed: number,
  industry: SceneIndustry,
  knowledge: KnowledgeSignal,
): WhereGraph {
  const envType = scene.environment.environmentType.value;
  const isOutdoor = envType !== "unknown" && OUTDOOR_TYPES.has(envType);
  const tags = knowledge.tags;

  const archOptions = ARCHITECTURE_NOUNS[industry];
  const architecture = sg(
    pickBiased(archOptions, axisSeed(seed, "where:architecture"), tags),
    "medium",
    `Scene Graph WHERE: architectural element selected from the ${industry} vocabulary bank, biased by knowledge-bank tags where they matched`,
  );

  const room = isOutdoor
    ? sg("not_applicable", "high", "Scene Graph WHERE: environment type is exterior — no interior room applies")
    : sg(pickBiased(ROOM_NOUNS[industry], axisSeed(seed, "where:room"), tags), "medium", `Scene Graph WHERE: interior room selected from the ${industry} vocabulary bank`);

  const street = isOutdoor && (industry === "real-estate" || industry === "retail" || industry === "generic")
    ? sg(pickBiased(STREET_NOUNS, axisSeed(seed, "where:street"), tags), "medium", "Scene Graph WHERE: exterior urban context selected — industry and environment type both signal a street-adjacent setting")
    : sg("not_applicable", "high", "Scene Graph WHERE: scene is not set in an exterior urban context");

  const landscape = isOutdoor && street.value === "not_applicable"
    ? sg(pickBiased(LANDSCAPE_NOUNS, axisSeed(seed, "where:landscape"), tags), "medium", "Scene Graph WHERE: exterior natural context selected from environment type")
    : sg("not_applicable", "high", "Scene Graph WHERE: scene is not set in open/natural landscape");

  const furniture = sg(
    pickBiased(FURNITURE_NOUNS[industry], axisSeed(seed, "where:furniture"), tags),
    "medium",
    `Scene Graph WHERE: load-bearing furniture piece selected from the ${industry} vocabulary bank`,
  );

  const environment = scene.environment.environmentType.value !== "unknown"
    ? sg(scene.environment.environmentType.value.replace(/_/g, " "), scene.environment.environmentType.confidence, "Scene Graph WHERE: naturalised from Visual Scene Plan environment type")
    : sg("a professional commercial setting", "low", "Scene Graph WHERE: no environment type upstream — neutral fallback");

  const refine = (field: PlanField, label: string, axisName: string, fallbackPool: readonly string[]) => {
    const safe = safeInheritedText(field.value);
    return safe
      ? sg(safe, field.confidence, `Scene Graph WHERE ${label}: inherited from Visual Scene Plan environment planning`)
      : sg(pickBiased(fallbackPool, axisSeed(seed, axisName), tags), "low", `Scene Graph WHERE ${label}: no usable upstream signal — vocabulary fallback`);
  };

  const background = refine(scene.environment.background, "background", "where:background", archOptions);
  const foreground = refine(scene.environment.foreground, "foreground", "where:foreground", FURNITURE_NOUNS[industry]);
  const midground = refine(scene.environment.midground, "midground", "where:midground", ROOM_NOUNS[industry]);

  return { architecture, room, street, landscape, furniture, environment, background, foreground, midground };
}
