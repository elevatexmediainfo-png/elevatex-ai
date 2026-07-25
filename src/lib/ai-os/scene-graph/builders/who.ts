import type { UniversalCampaignBlueprint } from "../../blueprint/types";
import type { VisualScenePlan } from "../../scene-planner/types";
import type { WhoGraph } from "../types";
import { sg } from "../field";
import { pick, axisSeed } from "../seed";
import { safeInheritedText } from "../sanitize";

// Phase 10.6B — WHO graph builder.
// Refines VisualScenePlan.heroSubject/supportingSubjects (already real, campaign-
// specific data) into physically exact subject presence — count, animals,
// vehicles — the dimensions the Phase 10.5C audit found structurally absent.

const GROUP_WORDS = ["family", "team", "guests", "group", "crowd", "colleagues", "students", "staff", "friends"];
const ANIMAL_WORDS = ["dog", "cat", "puppy", "kitten", "horse", "pet", "animal"];
const VEHICLE_WORDS = ["car", "vehicle", "bicycle", "bike", "motorbike", "scooter", "van", "delivery truck"];

function textContainsAny(text: string, words: readonly string[]): string | null {
  const lower = text.toLowerCase();
  // Word-boundary match, not substring — a naive .includes("cat") would false-positive
  // on "location", and .includes("car") on "carefully" or "scenic architecture".
  return words.find((w) => new RegExp(`\\b${w}\\b`).test(lower)) ?? null;
}

export function buildWhoGraph(bp: UniversalCampaignBlueprint, scene: VisualScenePlan, seed: number): WhoGraph {
  const heroText = scene.heroSubject.exactHeroSubject.value !== "unknown" ? scene.heroSubject.exactHeroSubject.value : "";
  const supportingTextRaw = scene.supportingSubjects.supportingSubjects.value !== "unknown" ? scene.supportingSubjects.supportingSubjects.value : "";
  const rawIdea = bp.userIntelligence.rawIdea ?? "";
  const probe = `${heroText} ${supportingTextRaw} ${rawIdea} ${scene.environment.environmentalDetails.value !== "unknown" ? scene.environment.environmentalDetails.value : ""}`;

  // safeInheritedText guards against the observed failure mode where a
  // VisualScenePlan free-text field carries raw commercial-composition/layout
  // copy ("ADVERTISEMENT LAYERS: ... Benefit 1: Quality | Benefit 2: Value")
  // instead of a physical description — that must never reach the graph
  // verbatim, since the graph is meant to own the photograph, not the layout.
  const safeHero = safeInheritedText(scene.heroSubject.exactHeroSubject.value);
  const primaryHero = safeHero
    ? sg(safeHero, scene.heroSubject.exactHeroSubject.confidence,
        "Scene Graph WHO: inherited verbatim from Hero Fusion — the spine is never re-described")
    : sg("a professional in their working environment", "low", "Scene Graph WHO: no usable hero signal upstream — neutral fallback subject");

  const safeSupporting = safeInheritedText(supportingTextRaw);
  const supportingPeople = safeSupporting
    ? sg(safeSupporting, scene.supportingSubjects.supportingSubjects.confidence, "Scene Graph WHO: inherited from Visual Scene Plan supporting-subject planning")
    : sg("not_applicable", "high", "Scene Graph WHO: relationship type indicates no supporting subjects in frame, or the upstream field was not a usable physical description");

  const relationship = scene.supportingSubjects.subjectRelationships.value;
  const subjectCount = (() => {
    if (relationship === "none" || relationship === "environment_only") {
      return sg("one" as const, "high", "Scene Graph WHO: subject relationship is none/environment-only — hero is the sole subject");
    }
    const groupHit = textContainsAny(probe, GROUP_WORDS);
    if (groupHit) {
      const opts = ["small_group", "crowd"] as const;
      return sg(pick(opts, axisSeed(seed, "subjectCount:group")), "medium", `Scene Graph WHO: group keyword "${groupHit}" detected in campaign text`);
    }
    if (relationship === "direct_interaction" || relationship === "product_in_use") {
      return sg("two" as const, "medium", "Scene Graph WHO: direct interaction implies exactly one supporting subject alongside the hero");
    }
    if (relationship === "parallel_presence" || relationship === "contextual_background") {
      const opts = ["two", "three"] as const;
      return sg(pick(opts, axisSeed(seed, "subjectCount:parallel")), "medium", "Scene Graph WHO: parallel/background presence implies a small, unspecified supporting count");
    }
    return sg("one" as const, "low", "Scene Graph WHO: no supporting-subject signal — defaulting to hero-only");
  })();

  const animalHit = textContainsAny(probe, ANIMAL_WORDS);
  const animals = animalHit
    ? sg(`a ${animalHit} present in frame, physically integrated into the scene`, "medium", `Scene Graph WHO: animal keyword "${animalHit}" detected in campaign text`)
    : sg("not_applicable", "high", "Scene Graph WHO: no animal signal in campaign — not applicable to this scene");

  const vehicleHit = textContainsAny(probe, VEHICLE_WORDS);
  const vehicles = vehicleHit
    ? sg(`a ${vehicleHit} visible in the scene`, "medium", `Scene Graph WHO: vehicle keyword "${vehicleHit}" detected in campaign text`)
    : sg("not_applicable", "high", "Scene Graph WHO: no vehicle signal in campaign — not applicable to this scene");

  return { primaryHero, supportingPeople, subjectCount, animals, vehicles };
}
