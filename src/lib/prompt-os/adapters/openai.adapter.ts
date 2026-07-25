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

// gpt-image-1.5 weights earlier prompt content more heavily. The most
// important content — the complete visual story from Creative Director 2.0's
// visualStory field (which lives in composition.framing after Expander
// enrichment) — now opens the prompt rather than appearing 3rd behind generic
// style tags. Section labels use professional creative-brief language rather
// than mechanical machine-tag prefixes. composeFluently() mechanics unchanged.
export function buildOpenAIPrompt(prompt: UniversalPrompt): string {
  const sentences: string[] = [];

  // 1. SCENE — visual story first: composition.framing carries the full
  // Creative Director narrative ("An experienced implant specialist explaining
  // a dental model to a reassured patient..."), the layout composition plan,
  // and the visual hierarchy. Highest-weight content goes first.
  const composition = describeComposition(prompt);
  if (composition.length) sentences.push(composeFluently(composition, "Scene:"));

  // [Indian-default / realism fix] Immediately after the Scene block — this
  // legacy adapter (used by the AI_IMAGE pipeline, distinct from
  // clean-background-prompt.ts's MARKETING_CREATIVE-only fix) had no
  // ethnicity instruction anywhere, confirmed by reading the file before
  // this change. Same wording and adjacency lesson applied to
  // gemini.adapter.ts in the same pass — kept consistent across both
  // providers in this pipeline rather than fixing only one.
  sentences.push(
    "Everyone shown in this scene is Indian — the main subject and any secondary, background, or incidental people — with authentic Indian faces, Indian skin tones, and natural features and styling appropriate to the setting."
  );

  // 2. FEATURING — scene elements (objects)
  const objects = describeObjects(prompt);
  if (objects.length) sentences.push(`Featuring: ${objects.join(", ")}.`);

  // 3. STYLE — aesthetic, mood, luxury/modern/minimalism levels
  const subject = describeSubject(prompt);
  if (subject.length) sentences.push(composeFluently(subject, "Style:"));

  // 4. SHOT — camera angle, lens, depth of field, perspective
  const camera = describeCamera(prompt);
  if (camera.length) sentences.push(composeFluently(camera, "Shot:"));

  // 5. LIGHTING — type, direction, quality
  const lighting = describeLighting(prompt);
  if (lighting.length) sentences.push(composeFluently(lighting, "Lighting:"));

  // 6. COLOR — palette, harmony
  const colors = describeColors(prompt);
  if (colors.length) sentences.push(composeFluently(colors, "Color:"));

  // 7. TYPOGRAPHY — treatment, font style, headline/CTA/logo positions
  // (layout.headlinePosition now carries actual headline copy when the
  // Creative Director generated copywriting.headline — see composition.ts)
  const typography = describeTypography(prompt);
  if (typography.length) sentences.push(composeFluently(typography, "Typography:"));

  // 8. CAMPAIGN — marketing goal, audience, psychology hooks
  const marketing = describeMarketing(prompt);
  if (marketing.length) sentences.push(composeFluently(marketing, "Campaign:"));

  // 9. QUALITY — rendered as prose sentences, not a comma-tagged keyword list
  const quality = describeQuality(prompt);
  if (quality.length) sentences.push(composeFluently(quality));

  // 10. NEGATIVE CONSTRAINTS — always last
  if (prompt.negative_constraints.length) {
    sentences.push(`Avoid: ${prompt.negative_constraints.join(", ")}.`);
  }

  return sentences.filter(Boolean).join(" ");
}
