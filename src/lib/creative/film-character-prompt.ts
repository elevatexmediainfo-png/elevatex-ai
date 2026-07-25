import type { FILM_STYLES } from "@/lib/validations/video";

// AI Film — shared prompt builder for a character's 2 AI-generated
// variation portraits (POST /api/videos/film/[id]/characters/[characterId]/variations).
//
// Founder-reported bug, 2026-07-12, fixed here: this used to build every
// character's prompt from the film's whole shared idea, so all N
// characters rendered as the same person/type. It now leads with the
// character's own distinct cast description (film-cast-breakdown.ts) —
// the film idea is still included, but only as background story context,
// not as the subject description.

const STYLE_VISUAL_HINT: Record<(typeof FILM_STYLES)[number], string> = {
  CINEMATIC: "cinematic film lighting, shallow depth of field",
  DOCUMENTARY: "natural lighting, candid documentary photography",
  ANIMATED: "stylized 3D animated character render",
  COMMERCIAL: "clean bright commercial photography lighting",
  VINTAGE: "vintage film grain, warm retro color grading",
  MINIMALIST: "minimalist studio portrait, soft even lighting",
};

export interface BuildFilmCharacterPromptInput {
  filmIdea: string;
  characterDescription: string;
  style: (typeof FILM_STYLES)[number];
  slotIndex: number;
  variantSeed: "A" | "B";
  /** True when this call also attaches variantSeed A's actual image bytes as ImageGenerateRequest.referenceImage — changes the prompt from "an independent alternate" to an explicit edit-style instruction to keep the same person. */
  hasReferenceImage: boolean;
}

export function buildFilmCharacterPrompt(input: BuildFilmCharacterPromptInput): string {
  const visualHint = STYLE_VISUAL_HINT[input.style];

  if (input.variantSeed === "B" && input.hasReferenceImage) {
    return (
      `The attached image is character ${input.slotIndex + 1} from a short film (${input.characterDescription}). ` +
      `Generate the exact same person shown in that image, in a different pose and a slightly different expression — ` +
      `keep their face, age, build, hair, and outfit identical to the reference image, only the pose/expression changes. ` +
      `Shot in a ${visualHint} style, full face and shoulders clearly visible against a simple, uncluttered background. High quality, sharp focus.`
    );
  }

  // Reached for variant A always, and for variant B only as a fallback when
  // no reference image could be attached (e.g. the active image provider
  // doesn't support one) — see variations/route.ts's isReferenceCapable
  // check. Still worded distinctly so two independent samples aren't
  // steered toward an identical pose even though they won't share an
  // identity without real image conditioning.
  const variantPhrasing =
    input.variantSeed === "A"
      ? "Show them in a natural, relaxed pose."
      : "Show them in a slightly different pose and expression, as an alternate option.";

  return (
    `A front-facing character portrait for a short film. This character: ${input.characterDescription}. ` +
    `Story context (for mood/setting only, not the subject): ${input.filmIdea}. ` +
    `${variantPhrasing} The portrait is shot in a ${visualHint} style, with the character's full face ` +
    `and shoulders clearly visible against a simple, uncluttered background. High quality, sharp focus.`
  );
}

// AI Film — per-scene video generation's prompt composer (2026-07-12).
// Founder decision: the character's PHOTO (passed separately as
// VideoRenderRequest.startImage) is the identity anchor; this only folds
// the character sheet's TEXT in as supplementary detail for the video
// model's prompt — never a substitute for the photo, and never the sole
// consistency mechanism. Returns the scene prompt unchanged when there's
// no sheet to add (a b-roll/no-character scene, or a character whose sheet
// hasn't been generated).
export function appendCharacterSheetContext(scenePrompt: string, characterSheet: unknown): string {
  if (!characterSheet || typeof characterSheet !== "object") return scenePrompt;
  const details = Object.values(characterSheet as Record<string, unknown>)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" ");
  if (!details) return scenePrompt;
  return `${scenePrompt} Character reference details: ${details}`;
}
