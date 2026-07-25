import { z } from "zod";
import { generateScript } from "@/lib/generation/llm";
import type { FILM_STYLES } from "@/lib/validations/video";

// AI Film — the "cast breakdown" step. Founder-reported bug, 2026-07-12:
// every character in a film was rendering as the same person/type (an
// elderly vendor, 3 times, for a story about an elderly vendor) because
// each character's variation prompt used the film's whole shared idea
// verbatim — nothing ever assigned distinct roles/ages/genders per slot.
// Mirrors film-storyboard.ts's proven pattern (system prompt -> strict
// JSON -> Zod validation): one LLM call per project, reads the story idea
// and proposes N deliberately DIFFERENT characters that fit it, so slot 0
// might be "the elderly vendor" but slot 1 is "his young teenage
// apprentice" and slot 2 is "a middle-aged female regular customer" —
// never three copies of the same description.

const SYSTEM_PROMPT = `You are a casting director for a short film. You receive the film's idea, its visual style, and how many characters it needs. Propose that many characters who together make sense for the story, and who are DELIBERATELY DIFFERENT FROM EACH OTHER — vary age, gender, and role/relationship-to-the-story wherever the idea allows it. Never propose two characters who would look like the same type of person (e.g. do not make every character an elderly vendor just because the story's protagonist is one) unless the idea explicitly calls for that.

Rules:
1. Every character needs a short "role" label (2-4 words, e.g. "Elderly street vendor", "His teenage apprentice", "Regular customer") and a "description": one concise sentence with concrete visual details a portrait artist could use directly — approximate age, gender, build, and any notable clothing/features — written as a complete natural sentence, not a keyword list.
2. The FIRST character (slotIndex 0) should be the story's protagonist/main character. The rest should be distinct supporting characters who plausibly belong in this story (family, coworkers, customers, friends) — invent a sensible role if the idea doesn't specify one, but keep it grounded in the story's setting.
3. Every description that specifies a person must state they are Indian, matching the story's setting — never leave ethnicity unstated.
4. Output strict JSON only, no markdown fences, no commentary: { "characters": [{ "slotIndex": number, "role": string, "description": string }] }`;

const castCharacterSchema = z.object({
  slotIndex: z.number().int().min(0),
  role: z.string().min(1),
  description: z.string().min(1),
});

// Real LLMs occasionally omit an empty array entirely rather than send `[]`
// — same defensive posture scene-split.ts/film-storyboard.ts already
// establish for this codebase's other structured-LLM-output call sites.
const castBreakdownSchema = z.object({
  characters: z.array(castCharacterSchema).min(1),
});

export type FilmCastBreakdown = z.infer<typeof castBreakdownSchema>;

export class FilmCastBreakdownError extends Error {}

export interface GenerateFilmCastBreakdownInput {
  userId: string;
  videoProjectId: string;
  idea: string;
  style: (typeof FILM_STYLES)[number];
  characterCount: number;
}

export async function generateFilmCastBreakdown(input: GenerateFilmCastBreakdownInput): Promise<FilmCastBreakdown> {
  const prompt =
    `Film idea: ${input.idea}\n` +
    `Style: ${input.style}\n` +
    `Number of characters needed: ${input.characterCount}`;

  const result = await generateScript(
    { prompt, contentLanguage: "EN", systemPrompt: SYSTEM_PROMPT, responseFormat: "json" },
    { userId: input.userId, videoProjectId: input.videoProjectId },
    "film_cast_breakdown"
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    throw new FilmCastBreakdownError("Cast breakdown response was not valid JSON.");
  }

  const validated = castBreakdownSchema.safeParse(parsed);
  if (!validated.success) {
    throw new FilmCastBreakdownError(`Cast breakdown response did not match the expected shape: ${validated.error.message}`);
  }

  // The one thing free-text JSON generation can't be trusted to get right
  // on its own: exactly one entry per requested slot, 0..characterCount-1.
  // A mismatch here (a skipped or duplicated slotIndex) would silently
  // leave some character with no cast description at all downstream —
  // fail loudly instead of guessing which slot a missing entry belonged to.
  const slots = new Set(validated.data.characters.map((c) => c.slotIndex));
  const expected = Array.from({ length: input.characterCount }, (_, i) => i);
  const missing = expected.filter((i) => !slots.has(i));
  if (missing.length > 0) {
    throw new FilmCastBreakdownError(`Cast breakdown is missing character slot(s): ${missing.join(", ")}.`);
  }

  return validated.data;
}
