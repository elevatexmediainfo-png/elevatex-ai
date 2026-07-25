// Phase 10.4J — Advertisement Intelligence Translator: Main Engine.
//
// resolveAdvertisementNarrative() is the single entry point.
// Pure function — no I/O, no LLM calls, no side effects.
//
// Input:  CreativeStrategy + VisualScenePlan (both already computed)
// Output: AdvertisementNarrative — specific, actionable visual storytelling directives
//
// The output converts marketing intelligence into visual storytelling:
//   trust + authority + critical requirement → expert_in_action with proof element
//   romance + milestone + celebration        → intimate_occasion with specific moment
//   transformation + fear resolved           → transformation_proof with exact emotional beat
//   luxury + exclusivity + aspiration        → exclusive_access with identity signal

import type { CreativeStrategy } from "../creative-brain/types";
import type { VisualScenePlan }  from "../scene-planner/types";
import type { AdvertisementNarrative } from "./types";
import {
  resolveStoryArchetype,
  resolveStoryScenario,
  resolveEmotionalMoment,
  resolveProofElement,
  resolveObjectionCounter,
  resolveIdentitySignal,
  resolveUrgencyVisual,
  resolveConversionMoment,
  resolveEnrichmentTags,
} from "./rules";

/**
 * Convert the campaign's marketing intelligence into specific visual storytelling directives.
 *
 * This layer answers: "What specific thing should be HAPPENING in this image
 * that makes the marketing intent visible without any copy?"
 *
 * Example outputs:
 *   Dental + authority + critical trust:
 *     storyScenario: "Specialist showing patient their scan — the moment doubt becomes plan"
 *     enrichmentTags: ["expert_demonstrating", "evidence_based", "chairside_consultation", "trust_reveal"]
 *
 *   Restaurant + romance + celebration:
 *     storyScenario: "A proposal dinner: champagne arriving as the moment is about to happen"
 *     enrichmentTags: ["romantic_occasion", "proposal_moment", "intimate_occasion", "milestone_achievement"]
 *
 *   Jewellery + legacy + luxury:
 *     storyScenario: "The moment of gifting — the piece passed from maker's hands to recipient's"
 *     enrichmentTags: ["luxury_gifting", "inheritance_moment", "craftsmanship", "ultra_premium"]
 */
export function resolveAdvertisementNarrative(
  strategy: CreativeStrategy,
  scene:    VisualScenePlan,
): AdvertisementNarrative {
  const storyArchetype  = resolveStoryArchetype(strategy);
  const storyScenario   = resolveStoryScenario(storyArchetype, strategy, scene);
  const emotionalMoment = resolveEmotionalMoment(storyArchetype, strategy, scene);
  const proofElement    = resolveProofElement(strategy);
  const objectionCounter = resolveObjectionCounter(strategy);
  const identitySignal  = resolveIdentitySignal(strategy);
  const urgencyVisual   = resolveUrgencyVisual(strategy);
  const conversionMoment = resolveConversionMoment(storyArchetype, strategy);
  const enrichmentTags  = resolveEnrichmentTags(storyArchetype, strategy, scene);

  return {
    storyScenario,
    emotionalMoment,
    ...(proofElement     ? { proofElement }     : {}),
    ...(objectionCounter ? { objectionCounter } : {}),
    identitySignal,
    ...(urgencyVisual    ? { urgencyVisual }    : {}),
    conversionMoment,
    storyArchetype,
    enrichmentTags,
  };
}
