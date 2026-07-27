import { z } from "zod";
import { generateScript } from "@/lib/generation/llm";
import type { CreativeBrief } from "../brief/types";
import type { Storyboard } from "../storyboard/types";
import type { CTADirection, GlobalDirection, HeroShotDirection, SceneBible, SceneBibleEntry, SuccessDefinition } from "./types";

// Director layer — consumes ONLY the Creative Brief and Storyboard (no
// Prisma, no other input), and never re-decides anything the Storyboard
// already fixed (story, scene order, scene duration, Hero Shot/Logo
// Reveal/CTA placement) — those are fed to the LLM as given, unchangeable
// facts, never asked for again in the response schema.

export class SceneBibleError extends Error {}

const SYSTEM_PROMPT = `You are the Director — the creative brain of a premium commercial production. You are NOT a prompt writer, NOT a rendering model, and NOT the Storyboard. Your responsibility ends the moment you have produced complete, professional production documentation: a Scene Bible detailed enough that a real Creative Director, Director of Photography, Camera Crew, Lighting Crew, Art Director, and Editor could execute the production without ever asking a follow-up question.

You receive two inputs, both already decided and NEVER yours to change:
1. The Creative Brief — ground-truth business/product/brand facts (the WHAT).
2. The Storyboard — the narrative structure already planned: how many scenes, their order, each scene's purpose/story beat/emotional beat/duration/transition, and exactly which scene is the Hero Shot, which scene (if any) is the Logo Reveal, and which scene is the Call To Action (the WHEN).

You own only the HOW. You must NEVER change the story, the scene order, any scene's duration, or which scene is the Hero Shot / Logo Reveal / CTA — treat those as fixed facts handed to you, not decisions to reconsider.

Do NOT write rendering prompts. Do NOT optimize wording for any specific AI video model. Do NOT think about Seedance, Veo, or any other renderer — a separate, later stage handles that translation and you will never see it. Every field you write is professional production documentation, not a prompt.

For EVERY scene in the Storyboard, generate a complete Scene Bible entry: purpose, storyGoal, marketingGoal, viewerEmotion, viewerPsychology, environment, location, weather, timeOfDay, characterBehaviour, expression, wardrobe, props, productBehaviour, camera, lens, cameraHeight, cameraDistance, cameraMovement, composition, framing, foreground, background, lighting, atmosphere, colorPalette, depthOfField, motion, transition, editingRhythm, continuityNotes, negativeInstructions, successCriteria. Every field must be concrete and specific — never generic ("nice lighting" is unacceptable; "warm 3200K tungsten key light with soft negative fill" is the bar). For negativeInstructions: every scene that is NOT the Logo Reveal scene must explicitly exclude any logo or watermark from appearing; the one scene that IS the Logo Reveal scene should not exclude it — that is exactly where it belongs.

Also generate globalDirection — production rules for the entire commercial: marketingGoal and marketingPsychology (the campaign-level marketing objective and the psychological lever behind it — every one of your production decisions above must serve these), brandDna, creativeTheme, visualLanguage, lightingLanguage, cameraLanguage, editingLanguage, colorLanguage, and four rule lists (environmentRules, productRules, characterRules, continuityRules, qualityRules), each a list of concrete, specific rules, never a single vague sentence.

Also generate successDefinition — the whole-campaign success bar, distinct from any single scene's own successCriteria: viewerShouldFeel, viewerShouldRemember, viewerShouldDesire, primarySellingPoint, secondarySellingPoint, brandRecallGoal.

For heroShot (you will be told which scene number is already the Hero Shot — never reconsider this), generate ONLY: purpose, marketingGoal, specialCreativeInstructions, successCriteria. That scene already has its own full Scene Bible entry covering camera/lighting/composition/etc. — do not repeat any of that here; only add what makes this moment THE hero shot.

For cta (you will be told which scene number is already the CTA — never reconsider this), generate ONLY: messageStyle, viewerActionStyle, voiceOverStyle, screenTextStyle — describe HOW the call to action should feel and be delivered. Never write or rephrase its literal wording; the exact words come from the Creative Brief, not from you.

Output strict JSON only, no markdown fences, no commentary: { "globalDirection": {...}, "successDefinition": {...}, "scenes": [{...}], "heroShot": {...}, "logoReveal": {...} | null, "cta": {...} }`;

function describeStoryboardScene(scene: Storyboard["scenes"][number], storyboard: Storyboard): string {
  const roleTags: string[] = [];
  if (storyboard.heroShotSceneNumber === scene.sceneNumber) roleTags.push("HERO SHOT");
  if (storyboard.logoRevealSceneNumber === scene.sceneNumber) roleTags.push("LOGO REVEAL");
  if (storyboard.ctaSceneNumber === scene.sceneNumber) roleTags.push("CTA");
  const roleSuffix = roleTags.length > 0 ? ` [${roleTags.join(", ")}]` : "";

  return (
    `Scene ${scene.sceneNumber}${roleSuffix} — purpose: ${scene.purpose}; story beat: ${scene.storyBeat}; ` +
    `emotional beat: ${scene.emotionalBeat}; duration: ${scene.durationSeconds}s` +
    (scene.transitionToNext ? `; transition to next: ${scene.transitionToNext}` : "; final scene, no transition after it")
  );
}

function buildPrompt(brief: CreativeBrief, storyboard: Storyboard): string {
  const sceneLines = storyboard.scenes.map((scene) => describeStoryboardScene(scene, storyboard)).join("\n");

  const contentLines =
    brief.content.style === "film"
      ? [`Idea: ${brief.content.idea}`, `Visual style: ${brief.content.filmStyle}`, `Number of characters available: ${brief.content.characterCount}`]
      : [
          `Product/service: ${brief.content.productOrService}`,
          `Key message: ${brief.content.keyMessage}`,
          brief.content.offerDetails ? `Offer details: ${brief.content.offerDetails}` : null,
          brief.content.callToAction ? `Exact call-to-action wording (do not rewrite this — it is ground truth): ${brief.content.callToAction}` : null,
          brief.content.tone ? `Tone: ${brief.content.tone}` : null,
        ].filter(Boolean);

  return [
    `Narrative arc: ${storyboard.narrativeArc}`,
    `Total duration: ${storyboard.totalDurationSeconds} seconds`,
    "",
    "Scenes (fixed — do not reorder, retime, or reassign Hero Shot/Logo Reveal/CTA):",
    sceneLines,
    "",
    ...contentLines,
    brief.brand.businessName ? `Business name: ${brief.brand.businessName}` : null,
    brief.brand.guidelinesText ? `Brand guidelines: ${brief.brand.guidelinesText}` : null,
    storyboard.logoRevealSceneNumber === null
      ? "This commercial has no Logo Reveal scene planned — omit logoReveal entirely or set it to null; do not invent one."
      : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

const sceneEntrySchema = z.object({
  sceneNumber: z.number().int().positive(),
  purpose: z.string().min(1),
  storyGoal: z.string().min(1),
  marketingGoal: z.string().min(1),
  viewerEmotion: z.string().min(1),
  viewerPsychology: z.string().min(1),
  environment: z.string().min(1),
  location: z.string().min(1),
  weather: z.string().min(1),
  timeOfDay: z.string().min(1),
  characterBehaviour: z.string().min(1),
  expression: z.string().min(1),
  wardrobe: z.string().min(1),
  props: z.string().min(1),
  productBehaviour: z.string().min(1),
  camera: z.string().min(1),
  lens: z.string().min(1),
  cameraHeight: z.string().min(1),
  cameraDistance: z.string().min(1),
  cameraMovement: z.string().min(1),
  composition: z.string().min(1),
  framing: z.string().min(1),
  foreground: z.string().min(1),
  background: z.string().min(1),
  lighting: z.string().min(1),
  atmosphere: z.string().min(1),
  colorPalette: z.string().min(1),
  depthOfField: z.string().min(1),
  motion: z.string().min(1),
  transition: z.string().min(1),
  editingRhythm: z.string().min(1),
  continuityNotes: z.string().min(1),
  negativeInstructions: z.string().min(1),
  successCriteria: z.string().min(1),
});

const globalDirectionSchema = z.object({
  marketingGoal: z.string().min(1),
  marketingPsychology: z.string().min(1),
  brandDna: z.string().min(1),
  creativeTheme: z.string().min(1),
  visualLanguage: z.string().min(1),
  lightingLanguage: z.string().min(1),
  cameraLanguage: z.string().min(1),
  editingLanguage: z.string().min(1),
  colorLanguage: z.string().min(1),
  environmentRules: z.array(z.string().min(1)).min(1),
  productRules: z.array(z.string().min(1)).min(1),
  characterRules: z.array(z.string().min(1)).min(1),
  continuityRules: z.array(z.string().min(1)).min(1),
  qualityRules: z.array(z.string().min(1)).min(1),
});

const successDefinitionSchema = z.object({
  viewerShouldFeel: z.string().min(1),
  viewerShouldRemember: z.string().min(1),
  viewerShouldDesire: z.string().min(1),
  primarySellingPoint: z.string().min(1),
  secondarySellingPoint: z.string().min(1),
  brandRecallGoal: z.string().min(1),
});

const heroShotSchema = z.object({
  purpose: z.string().min(1),
  marketingGoal: z.string().min(1),
  specialCreativeInstructions: z.string().min(1),
  successCriteria: z.string().min(1),
});

const logoRevealSchema = z.object({
  instruction: z.string().min(1),
  animationStyle: z.string().min(1),
});

const ctaSchema = z.object({
  messageStyle: z.string().min(1),
  viewerActionStyle: z.string().min(1),
  voiceOverStyle: z.string().min(1),
  screenTextStyle: z.string().min(1),
});

// Real LLMs occasionally omit an empty/null field entirely rather than send
// it explicitly — same defensive posture established elsewhere in this
// codebase's structured-LLM-output call sites.
const sceneBibleResponseSchema = z.object({
  globalDirection: globalDirectionSchema,
  successDefinition: successDefinitionSchema,
  scenes: z.array(sceneEntrySchema).min(1),
  heroShot: heroShotSchema,
  logoReveal: logoRevealSchema.nullable().default(null),
  cta: ctaSchema,
});

export async function planSceneBible(brief: CreativeBrief, storyboard: Storyboard): Promise<SceneBible> {
  if (brief.content.style !== storyboard.style) {
    throw new SceneBibleError(
      `Creative Brief style (${brief.content.style}) and Storyboard style (${storyboard.style}) disagree — the Director never guesses which one is right.`
    );
  }

  const prompt = buildPrompt(brief, storyboard);

  const result = await generateScript(
    { prompt, contentLanguage: "EN", systemPrompt: SYSTEM_PROMPT, responseFormat: "json" },
    { videoProjectId: brief.videoProjectId },
    "scene_bible"
  );

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(result.text);
  } catch {
    throw new SceneBibleError("Scene Bible response was not valid JSON.");
  }

  const validated = sceneBibleResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new SceneBibleError(`Scene Bible response did not match the expected shape: ${validated.error.message}`);
  }

  const entryByNumber = new Map(validated.data.scenes.map((s) => [s.sceneNumber, s]));
  for (const scene of storyboard.scenes) {
    if (!entryByNumber.has(scene.sceneNumber)) {
      throw new SceneBibleError(`Scene ${scene.sceneNumber} has no Scene Bible entry — every storyboard scene must be documented.`);
    }
  }

  // Placement is the Storyboard's exclusive decision. The Director's Logo
  // Reveal enrichment must exist exactly when the Storyboard planned a
  // reveal scene — never invented, never missing.
  const storyboardWantsReveal = storyboard.logoRevealSceneNumber !== null;
  if (storyboardWantsReveal && !validated.data.logoReveal) {
    throw new SceneBibleError(
      `The Storyboard planned a Logo Reveal at scene ${storyboard.logoRevealSceneNumber}, but the Director provided no reveal behaviour for it.`
    );
  }

  const scenes: SceneBibleEntry[] = storyboard.scenes.map((scene) => entryByNumber.get(scene.sceneNumber)!);
  const globalDirection: GlobalDirection = validated.data.globalDirection;
  const successDefinition: SuccessDefinition = validated.data.successDefinition;
  const heroShot: HeroShotDirection = validated.data.heroShot;
  const cta: CTADirection = validated.data.cta;
  // Discarded when the Storyboard planned no reveal — the Director never
  // gets to invent placement the Storyboard didn't ask for, even if it
  // hallucinated reveal content anyway.
  const logoReveal = storyboardWantsReveal ? validated.data.logoReveal : null;

  return {
    style: storyboard.style,
    globalDirection,
    successDefinition,
    scenes,
    heroShot,
    logoReveal,
    cta,
  };
}
