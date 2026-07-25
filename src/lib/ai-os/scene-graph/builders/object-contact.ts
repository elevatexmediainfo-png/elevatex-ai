import type { WhoGraph, ObjectContactGraph } from "../types";
import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import { sg } from "../field";
import { axisSeed, pick } from "../seed";
import { CONTACT_OBJECT_FALLBACK, SPATIAL_TARGETS } from "../vocabulary";
import type { HandEvent } from "./body";

// Phase 10.6B — OBJECT CONTACT graph builder.
// Structures the SAME physical hand-event body.ts already composed (never
// re-invents it — "never independently describe the scene again" applies
// between sibling sub-graphs, not only between this module and the Prompt
// Compiler) into the audit's exact nine-term contact vocabulary, plus a
// second, independently composed clause for a supporting subject when WHO
// establishes one is present.

const SUPPORTING_VERBS = [
  "crosses the frame carrying", "stands nearby holding", "leans in offering",
  "reaches toward the counter for", "steps into frame with",
] as const;

export function buildObjectContactGraph(
  who: WhoGraph,
  handEvent: HandEvent,
  seed: number,
  industry: SceneIndustry,
): ObjectContactGraph {
  const primaryContact = sg(
    handEvent.verbCategory,
    "medium",
    "Scene Graph OBJECT CONTACT: same verb category BODY.handPosition composed from — a single hand-event, described structurally here",
  );

  const contactObject = sg(
    handEvent.primaryObject,
    "medium",
    "Scene Graph OBJECT CONTACT: same object BODY.handPosition composed from",
  );

  const contactDescription = sg(
    `left hand ${handEvent.primaryVerb} ${handEvent.primaryObject} ${handEvent.spatialTarget}`,
    "medium",
    "Scene Graph OBJECT CONTACT: the primary-hand clause of the BODY hand-event, isolated for structured consumption",
  );

  const secondaryContact = (() => {
    if (who.subjectCount.value === "one") {
      return sg("not_applicable", "high", "Scene Graph OBJECT CONTACT: subject count is one — no supporting subject to compose a second contact clause for");
    }
    const verb = pick(SUPPORTING_VERBS, axisSeed(seed, "objectContact:supportingVerb"));
    const pool = CONTACT_OBJECT_FALLBACK[industry].filter((o) => o !== handEvent.primaryObject && o !== handEvent.secondaryObject);
    const obj = pick(pool.length > 0 ? pool : CONTACT_OBJECT_FALLBACK[industry], axisSeed(seed, "objectContact:supportingObject"));
    const spatial = pick(SPATIAL_TARGETS, axisSeed(seed, "objectContact:supportingSpatial"));
    return sg(
      `a supporting figure ${verb} ${obj} ${spatial}`,
      "medium",
      "Scene Graph OBJECT CONTACT: independent contact clause composed for the supporting subject WHO established",
    );
  })();

  return { primaryContact, contactObject, contactDescription, secondaryContact };
}
