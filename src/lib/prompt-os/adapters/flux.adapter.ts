import type { UniversalPrompt } from "../schema";
import {
  describeSubject,
  describeComposition,
  describeCamera,
  describeLighting,
  describeColors,
  describeTypography,
  describeQuality,
  describeObjects,
  toTag,
} from "./generic.adapter";

// Flux/SDXL-family models respond best to a comma-separated tag list, not
// flowing sentences — short descriptive fragments ordered roughly
// subject-first, modifiers-after, the well-established Stable-Diffusion-
// lineage prompting convention. Deliberately not prose, unlike the OpenAI
// adapter's photography-brief style, even from the same input JSON.
// Provider Prompt Optimization: every fragment is passed through toTag()
// so an Expander-enriched full sentence degrades into a clean tag (no
// stray mid-list period) instead of reading as broken prose forced into a
// tag list.
//
// Negative constraints are deliberately NOT folded into this text — Flux's
// real request shape (ImageGenerateRequest.negativePrompt, sent as Replicate's
// `negative_prompt` input) is a dedicated channel for that, unlike OpenAI's
// gpt-image-1 which has no such parameter at all and must have them woven
// into the prompt text itself. See lib/creative/engine.ts for where
// `negative_constraints` gets merged into `negativePrompt`.
export function buildFluxPrompt(prompt: UniversalPrompt): string {
  const tags = [
    ...describeObjects(prompt),
    ...describeSubject(prompt),
    ...describeComposition(prompt),
    ...describeCamera(prompt),
    ...describeLighting(prompt),
    ...describeColors(prompt),
    ...describeTypography(prompt),
    ...describeQuality(prompt),
  ]
    .map(toTag)
    .filter(Boolean);

  return tags.join(", ");
}
