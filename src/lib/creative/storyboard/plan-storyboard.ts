import { z } from "zod";
import { generateScript } from "@/lib/generation/llm";
import type { CreativeBrief } from "../brief/types";
import type { Storyboard, StoryboardScene } from "./types";

// Storyboard layer — consumes ONLY the CreativeBrief (no Prisma, no other
// input), and never re-derives a fact the brief already states (product,
// brand, objective, idea, style, character count) — those are fed to the
// LLM as given context, never asked for again in the response schema.

export class StoryboardError extends Error {}

const SHARED_RULES = `You are a narrative and marketing story architect. You plan ONLY the STRUCTURE of a short video's story — you make NO visual, technical, or cinematic decisions of any kind. You must NEVER mention camera, lens, lighting, composition, framing, color, or any shot-level visual direction — that is a separate stage's job, done later by a different specialist who will read your structure and add cinematography on top of it.

Your job, and only your job:
1. Decide how many scenes the story needs and their order.
2. For each scene, give its narrative purpose (the functional role it plays, e.g. "Hook", "Build desire", "Product reveal", "Call to action"), its story beat (what actually happens/advances in the plot at this point), its emotional beat (the single emotion the viewer should feel here), and its duration in seconds.
3. Describe the transition into the NEXT scene for every scene except the last (the last scene's transitionToNext must be null) — a structural editing decision (e.g. "hard cut", "match cut on the product", "cut on the beat drop"), never a camera movement.
4. Identify which scene is the Hero Shot (the single moment that best sells the product/idea — every video has exactly one).
5. Identify which scene (if any) is the Logo Reveal moment. Most short ads do NOT need a dedicated logo reveal scene — only set one if it genuinely earns its place; otherwise this is null.
6. Identify which scene is the Call To Action — every video must end with a clear CTA, so this is always set, almost always the final scene.
7. Write one short "narrativeArc" sentence summarizing the overall shape of the story from first scene to last.
8. Output strict JSON only, no markdown fences, no commentary: { "narrativeArc": string, "scenes": [{ "sceneNumber": number, "purpose": string, "storyBeat": string, "emotionalBeat": string, "durationSeconds": number, "transitionToNext": string | null }], "heroShotSceneNumber": number, "logoRevealSceneNumber": number | null, "ctaSceneNumber": number }`;

function buildCommercialPrompt(brief: CreativeBrief): string {
  const content = brief.content;
  if (content.style !== "commercial") throw new StoryboardError("Expected commercial content.");

  return [
    SHARED_RULES,
    "",
    "This is a performance-marketing ad. You decide how many scenes it needs and its total duration — nothing about duration has been decided yet, that is entirely your call to make based on what the story actually needs.",
    "",
    `Product/service: ${content.productOrService}`,
    `Key message: ${content.keyMessage}`,
    content.offerDetails ? `Offer details: ${content.offerDetails}` : null,
    content.callToAction ? `Required call to action: ${content.callToAction}` : null,
    content.tone ? `Tone: ${content.tone}` : null,
    brief.brand.businessName ? `Business name: ${brief.brand.businessName}` : null,
    brief.brand.city ? `City: ${brief.brand.city}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildFilmPrompt(brief: CreativeBrief): string {
  const content = brief.content;
  if (content.style !== "film") throw new StoryboardError("Expected film content.");

  return [
    SHARED_RULES,
    "",
    `This is a short AI Film. Its total duration is already fixed at exactly ${content.totalDurationSeconds} seconds — you must NOT change this total; only decide how to divide it across scenes (your scene durations must sum to exactly ${content.totalDurationSeconds}).`,
    "",
    `Idea: ${content.idea}`,
    `Visual style: ${content.filmStyle}`,
    `Number of characters available: ${content.characterCount}`,
    brief.brand.businessName ? `Business name: ${brief.brand.businessName}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const sceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  purpose: z.string().min(1),
  storyBeat: z.string().min(1),
  emotionalBeat: z.string().min(1),
  durationSeconds: z.number().int().positive(),
  transitionToNext: z.string().min(1).nullable().default(null),
});

// Real LLMs occasionally omit an empty/null field entirely rather than send
// it explicitly — same defensive posture established elsewhere in this
// codebase's structured-LLM-output call sites (scene-split.ts, film-director.ts).
const storyboardResponseSchema = z.object({
  narrativeArc: z.string().min(1),
  scenes: z.array(sceneSchema).min(1),
  heroShotSceneNumber: z.number().int().positive(),
  logoRevealSceneNumber: z.number().int().positive().nullable().default(null),
  ctaSceneNumber: z.number().int().positive(),
});

// Real, deterministic enforcement (not just a prompt instruction) that a
// FILM storyboard's scene durations sum to exactly the brief's already-fixed
// total — an LLM occasionally ignores numeric instructions. Proportionally
// rescales, then folds any rounding remainder into the final scene, mirroring
// this codebase's established trimScenesToTotalDuration() reasoning without
// reusing its vendor-pacing-specific (2-3s window) implementation, which
// doesn't apply here — this layer has no vendor-floor concept at all.
function normalizeToExactTotal(scenes: StoryboardScene[], totalDurationSeconds: number): StoryboardScene[] {
  const currentTotal = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  if (currentTotal === totalDurationSeconds) return scenes;

  const scaled = scenes.map((s) => ({
    ...s,
    durationSeconds: Math.max(1, Math.round((s.durationSeconds / currentTotal) * totalDurationSeconds)),
  }));

  const scaledTotal = scaled.reduce((sum, s) => sum + s.durationSeconds, 0);
  const remainder = totalDurationSeconds - scaledTotal;
  const lastIndex = scaled.length - 1;
  scaled[lastIndex] = { ...scaled[lastIndex], durationSeconds: Math.max(1, scaled[lastIndex].durationSeconds + remainder) };
  return scaled;
}

function validateSceneReferences(parsed: {
  scenes: StoryboardScene[];
  heroShotSceneNumber: number;
  logoRevealSceneNumber: number | null;
  ctaSceneNumber: number;
}): void {
  const validNumbers = new Set(parsed.scenes.map((s) => s.sceneNumber));
  if (!validNumbers.has(parsed.heroShotSceneNumber)) {
    throw new StoryboardError(`heroShotSceneNumber ${parsed.heroShotSceneNumber} does not match any planned scene.`);
  }
  if (parsed.logoRevealSceneNumber !== null && !validNumbers.has(parsed.logoRevealSceneNumber)) {
    throw new StoryboardError(`logoRevealSceneNumber ${parsed.logoRevealSceneNumber} does not match any planned scene.`);
  }
  if (!validNumbers.has(parsed.ctaSceneNumber)) {
    throw new StoryboardError(`ctaSceneNumber ${parsed.ctaSceneNumber} does not match any planned scene.`);
  }
}

export async function planStoryboard(brief: CreativeBrief): Promise<Storyboard> {
  const prompt = brief.content.style === "film" ? buildFilmPrompt(brief) : buildCommercialPrompt(brief);

  const result = await generateScript(
    { prompt, contentLanguage: "EN", systemPrompt: SHARED_RULES, responseFormat: "json" },
    { videoProjectId: brief.videoProjectId },
    "storyboard"
  );

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(result.text);
  } catch {
    throw new StoryboardError("Storyboard response was not valid JSON.");
  }

  const validated = storyboardResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new StoryboardError(`Storyboard response did not match the expected shape: ${validated.error.message}`);
  }

  validateSceneReferences(validated.data);

  let scenes = validated.data.scenes;
  let totalDurationSeconds: number;

  if (brief.content.style === "film") {
    totalDurationSeconds = brief.content.totalDurationSeconds;
    scenes = normalizeToExactTotal(scenes, totalDurationSeconds);
  } else {
    totalDurationSeconds = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  }

  return {
    style: brief.content.style,
    narrativeArc: validated.data.narrativeArc,
    totalDurationSeconds,
    scenes,
    heroShotSceneNumber: validated.data.heroShotSceneNumber,
    logoRevealSceneNumber: validated.data.logoRevealSceneNumber,
    ctaSceneNumber: validated.data.ctaSceneNumber,
  };
}
