import type { UniversalPrompt } from "../schema";
import {
  describeSubject,
  describeComposition,
  describeCamera,
  describeLighting,
  describeColors,
  describeTypography,
  describeMarketing,
  describeQuality,
  describeObjects,
  composeFluently,
} from "./generic.adapter";

// Gemini/Imagen-family models, like gpt-image-1, respond best to flowing
// natural-language description rather than a comma-separated tag list — but
// Gemini's prompt guidance favors leading with the scene/object list before
// stylistic modifiers, so this orders objects-and-subject first, distinct
// phrasing from the OpenAI adapter's "shot with / captured with" brief
// structure even from the exact same Universal JSON Prompt input. Provider
// Prompt Optimization: switched to the shared describeObjects()/
// composeFluently() helpers for consistency with every other adapter.
export function buildGeminiPrompt(prompt: UniversalPrompt): string {
  const sentences: string[] = [];

  const objects = describeObjects(prompt);
  if (objects.length) sentences.push(`Scene contains: ${objects.join(", ")}.`);

  // [Indian-default / realism fix] Placed immediately after the scene/object
  // line — adjacent to where the model decides who populates the scene, not
  // buried after style/camera/lighting. This adapter previously had no
  // ethnicity instruction anywhere (confirmed by reading the file before
  // this change), unlike the MARKETING_CREATIVE pipeline
  // (clean-background-prompt.ts's own "[Ethnicity placement fix]"), which
  // already establishes this exact placement lesson: an instruction only
  // reliably steers the model when it sits right next to what it governs.
  // Covers secondary/background people explicitly, not just the main
  // subject — the same "every human subject" ambiguity that previously let
  // Western background people slip through on the OpenAI poster path.
  sentences.push(
    "Everyone shown in this scene is Indian — the main subject and any secondary, background, or incidental people — with authentic Indian faces, Indian skin tones, and natural features and styling appropriate to the setting."
  );

  const subject = describeSubject(prompt);
  if (subject.length) sentences.push(composeFluently(subject, "Visual style:"));

  const composition = describeComposition(prompt);
  if (composition.length) sentences.push(composeFluently(composition, "Composition:"));

  const camera = describeCamera(prompt);
  if (camera.length) sentences.push(composeFluently(camera, "Camera:"));

  const lighting = describeLighting(prompt);
  if (lighting.length) sentences.push(composeFluently(lighting, "Lighting:"));

  const colors = describeColors(prompt);
  if (colors.length) sentences.push(composeFluently(colors));

  const typography = describeTypography(prompt);
  if (typography.length) sentences.push(composeFluently(typography, "Typography:"));

  const marketing = describeMarketing(prompt);
  if (marketing.length) sentences.push(composeFluently(marketing, "Marketing intent:"));

  const quality = describeQuality(prompt);
  if (quality.length) sentences.push(`${quality.join(", ")}.`);

  if (prompt.negative_constraints.length) {
    sentences.push(`Avoid: ${prompt.negative_constraints.join(", ")}.`);
  }

  return sentences.filter(Boolean).join(" ");
}
