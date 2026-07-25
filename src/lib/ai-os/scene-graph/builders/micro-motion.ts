import type { SceneIndustry } from "../../prompt-spec/scene-builder";
import type { MicroMotionGraph } from "../types";
import type { KnowledgeSignal } from "../knowledge-bridge";
import type { HandEvent } from "./body";
import { sg } from "../field";
import { axisSeed, pick, pickN } from "../seed";
import { MICRO_MOTION_CONTEXT, MICRO_MOTION_PHRASE, type MicroMotionElement } from "../vocabulary";

// Phase 10.6B — MICRO MOTION graph builder.
// Both fields are the audit's named gaps. Elements are filtered to those
// physically plausible for the industry + knowledge-bank tags before a
// deterministic pick — never "steam" in a jewellery boutique, never "leaves"
// indoors — then composed into a short joined clause. Temporal instant is
// biased toward instants that make sense for the active contact verb (a
// "pouring" action reads naturally as "just before contact"; "holding" reads
// as "suspended") without collapsing to one fixed instant per verb.

const ALL_ELEMENTS = Object.keys(MICRO_MOTION_CONTEXT) as MicroMotionElement[];

const VERB_TEMPORAL_BIAS: Record<string, readonly MicroMotionGraph["temporalInstant"]["value"][]> = {
  holding:   ["suspended_mid_motion", "peak_action"],
  touching:  ["mid_gesture", "just_before_contact"],
  picking:   ["just_before_contact", "mid_gesture"],
  pouring:   ["mid_gesture", "just_before_contact"],
  writing:   ["mid_gesture", "peak_action"],
  opening:   ["mid_gesture", "just_after_release"],
  closing:   ["just_after_release", "mid_gesture"],
  serving:   ["just_before_contact", "peak_action"],
  operating: ["peak_action", "mid_gesture"],
};

function plausibleFor(industry: SceneIndustry, envWords: string[]): MicroMotionElement[] {
  const probe = new Set([industry, ...envWords].map((w) => w.toLowerCase()));
  const matches = ALL_ELEMENTS.filter((el) => MICRO_MOTION_CONTEXT[el].some((ctx) => probe.has(ctx)));
  // "glass_reflection" and "fabric_folds" are broadly plausible almost anywhere a
  // person and a surface coexist — kept as a universal fallback pair so the
  // element pool is never empty for an industry with no direct context match.
  return matches.length > 0 ? matches : ["glass_reflection", "fabric_folds"];
}

export function buildMicroMotionGraph(
  seed: number,
  industry: SceneIndustry,
  knowledge: KnowledgeSignal,
  handEvent: HandEvent,
): MicroMotionGraph {
  const pool = plausibleFor(industry, knowledge.tags);
  const chosen = pickN(pool, axisSeed(seed, "microMotion:elements"), pool.length >= 2 ? 2 : 1);

  const phrases = chosen.map((el, i) => pick(MICRO_MOTION_PHRASE[el], axisSeed(seed, `microMotion:phrase:${i}`)));
  const elements = sg(
    phrases.join(", "),
    "medium",
    `Scene Graph MICRO MOTION: ${chosen.length} element(s) selected from the physically-plausible pool for "${industry}" (${chosen.join(", ")})`,
  );

  const biasPool = VERB_TEMPORAL_BIAS[handEvent.verbCategory] ?? ["mid_gesture", "peak_action"];
  const temporalInstant = sg(
    pick(biasPool, axisSeed(seed, "microMotion:temporal")),
    "medium",
    `Scene Graph MICRO MOTION: temporal instant biased toward what reads naturally for the "${handEvent.verbCategory}" contact verb — the audit's named gap`,
  );

  return { elements, temporalInstant };
}
