import type { UniversalPrompt } from "../schema";
import {
  describeSubject,
  describeComposition,
  describeCamera,
  describeLighting,
  describeColors,
  describeMarketing,
  describeQuality,
  describeObjects,
  composeFluently,
} from "./generic.adapter";

// Ideogram's distinguishing strength is literal in-image text rendering, so
// unlike the OpenAI/Flux adapters (which fold typography into a generic
// "style" descriptor), this adapter calls out exact on-image text content
// and its placement as a first-class, explicit instruction — the phrasing
// Ideogram's prompt parser is tuned to follow for headline/CTA accuracy.
// Provider Prompt Optimization: composeFluently() replaces naive comma
// joining so Expander-enriched full sentences read as fluent prose instead
// of broken short-tag grammar.
export function buildIdeogramPrompt(prompt: UniversalPrompt): string {
  const sentences: string[] = [];

  const objects = describeObjects(prompt);
  if (objects.length) sentences.push(`The scene features ${objects.join(", ")}.`);

  const subject = describeSubject(prompt);
  if (subject.length) sentences.push(composeFluently(subject, "A"));

  const composition = describeComposition(prompt);
  if (composition.length) sentences.push(composeFluently(composition, "Layout:"));

  const camera = describeCamera(prompt);
  if (camera.length) sentences.push(composeFluently(camera, "Shot with"));

  const lighting = describeLighting(prompt);
  if (lighting.length) sentences.push(composeFluently(lighting, "Lighting:"));

  const colors = describeColors(prompt);
  if (colors.length) sentences.push(composeFluently(colors));

  const textParts: string[] = [];
  if (prompt.typography.treatment) textParts.push(prompt.typography.treatment);
  if (prompt.typography.fontStyle) textParts.push(`rendered in a ${prompt.typography.fontStyle} typeface`);
  if (prompt.layout.headlinePosition) textParts.push(`headline text placed ${prompt.layout.headlinePosition}`);
  if (prompt.layout.ctaPosition) textParts.push(`call-to-action text placed ${prompt.layout.ctaPosition}`);
  if (prompt.layout.logoPosition) textParts.push(`logo placed ${prompt.layout.logoPosition}`);
  if (textParts.length) {
    sentences.push(composeFluently(textParts, "Render legible, accurately spelled on-image text:"));
  }

  const marketing = describeMarketing(prompt);
  if (marketing.length) sentences.push(composeFluently(marketing, "Marketing intent:"));

  const quality = describeQuality(prompt);
  if (quality.length) sentences.push(`${quality.join(", ")}.`);

  if (prompt.negative_constraints.length) {
    sentences.push(`Avoid: ${prompt.negative_constraints.join(", ")}, misspelled text, garbled text.`);
  }

  return sentences.filter(Boolean).join(" ");
}
