import type { CreativeBrief } from "../brief/types";
import type { Storyboard } from "../storyboard/types";
import type { CTADirection, GlobalDirection, HeroShotDirection, SceneBible, SceneBibleEntry } from "../scene-bible/types";
import type { CompiledCreativePlan, CompiledScenePrompt } from "./types";

// Creative Compiler — the only model-specific layer (rule 10/11: renderers
// only render, creativity happens upstream). Pure, deterministic translation
// from the structured plan into vendor-ready prompt text: no LLM call, no
// rephrasing, no creative interpretation — every scene's fields are already
// authored as natural-language clauses by the Director, this module only
// validates consistency and concatenates them faithfully.
//
// Wired to the real, committed Scene Bible (lib/creative/scene-bible) —
// 2026-07-28. Previously this module took a hand-declared placeholder
// `DirectorOutput`; it now takes the real `SceneBible` type directly.

export class CreativeCompilerError extends Error {}

function joinClauses(values: Array<string | null | undefined>): string {
  return values
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v))
    .map((v) => (/[.!?]$/.test(v) ? v : `${v}.`))
    .join(" ");
}

function composeScenePrompt(params: {
  scene: SceneBibleEntry;
  global: GlobalDirection;
  heroShot: HeroShotDirection | null;
  isLogoRevealScene: boolean;
  logoReveal: SceneBible["logoReveal"];
  cta: CTADirection | null;
  /** The Creative Brief's exact, literal call-to-action wording — Brief ground truth (WHAT), never the Director's to invent (HOW). Only set on the CTA scene. */
  literalCallToAction: string | null;
}): string {
  const { scene, global, heroShot, isLogoRevealScene, logoReveal, cta, literalCallToAction } = params;

  const clauses: Array<string | null | undefined> = [
    scene.purpose,
    scene.storyGoal,
    scene.marketingGoal,
    scene.viewerEmotion,
    scene.viewerPsychology,
    scene.environment,
    scene.location,
    scene.weather,
    scene.timeOfDay,
    scene.characterBehaviour,
    scene.wardrobe,
    scene.expression,
    scene.props,
    scene.foreground,
    scene.background,
    scene.camera,
    scene.lens,
    scene.cameraHeight,
    scene.cameraDistance,
    scene.cameraMovement,
    scene.framing,
    scene.lighting,
    scene.atmosphere,
    scene.composition,
    scene.colorPalette,
    scene.depthOfField,
    scene.motion,
    scene.productBehaviour,
    scene.transition,
    scene.editingRhythm,
    scene.continuityNotes,
    global.visualLanguage,
    ...global.continuityRules,
    ...global.characterRules,
    ...global.productRules,
    ...global.environmentRules,
    ...global.qualityRules,
  ];

  if (heroShot) {
    clauses.push(heroShot.purpose, heroShot.marketingGoal, heroShot.specialCreativeInstructions, heroShot.successCriteria);
  }

  if (isLogoRevealScene && logoReveal) {
    clauses.push(logoReveal.instruction, logoReveal.animationStyle);
  } else {
    // Real logo/watermark hallucination guardrail — every scene that isn't
    // the deliberate reveal must explicitly exclude a logo, matching this
    // codebase's established negative-exclusion-folded-into-prompt-text
    // convention (neither Veo nor Seedance has a real separate
    // negative_prompt field). Kept as an explicit, deterministic guarantee
    // alongside the scene's own negativeInstructions below, rather than
    // relying solely on the Director's free text to remember it every time.
    clauses.push("No logo or watermark should appear in this shot.");
  }

  if (cta) {
    // The literal wording is Creative Brief ground truth (WHAT) — the
    // Director's CTA fields are style/delivery direction only (HOW) and
    // never carry the actual words, so the Compiler folds them in together.
    clauses.push(literalCallToAction, cta.messageStyle, cta.viewerActionStyle, cta.voiceOverStyle, cta.screenTextStyle);
  }

  clauses.push(scene.negativeInstructions, scene.successCriteria);

  return joinClauses(clauses);
}

export interface CompileCreativePlanInput {
  brief: CreativeBrief;
  storyboard: Storyboard;
  sceneBible: SceneBible;
}

export function compileCreativePlan(input: CompileCreativePlanInput): CompiledCreativePlan {
  const { brief, storyboard, sceneBible } = input;

  if (brief.content.style !== storyboard.style || storyboard.style !== sceneBible.style) {
    throw new CreativeCompilerError(
      `Style mismatch across layers: brief=${brief.content.style}, storyboard=${storyboard.style}, sceneBible=${sceneBible.style}. These must all agree — the Compiler never guesses which one is right.`
    );
  }

  const validSceneNumbers = new Set(storyboard.scenes.map((s) => s.sceneNumber));
  const sceneBibleEntryByNumber = new Map(sceneBible.scenes.map((s) => [s.sceneNumber, s]));

  for (const scene of storyboard.scenes) {
    if (!sceneBibleEntryByNumber.has(scene.sceneNumber)) {
      throw new CreativeCompilerError(
        `Scene ${scene.sceneNumber} has no matching Scene Bible entry — every storyboard scene must have cinematic direction, none may be silently dropped.`
      );
    }
  }

  // Placement (WHEN) is owned exclusively by the Storyboard.
  if (!validSceneNumbers.has(storyboard.heroShotSceneNumber)) {
    throw new CreativeCompilerError(
      `Storyboard's Hero Shot references scene ${storyboard.heroShotSceneNumber}, which doesn't exist in its own scene list.`
    );
  }
  if (storyboard.logoRevealSceneNumber !== null && !validSceneNumbers.has(storyboard.logoRevealSceneNumber)) {
    throw new CreativeCompilerError(
      `Storyboard's Logo Reveal references scene ${storyboard.logoRevealSceneNumber}, which doesn't exist in its own scene list.`
    );
  }
  if (!validSceneNumbers.has(storyboard.ctaSceneNumber)) {
    throw new CreativeCompilerError(
      `Storyboard's CTA references scene ${storyboard.ctaSceneNumber}, which doesn't exist in its own scene list.`
    );
  }

  // The Director must agree with the Storyboard on WHETHER a logo reveal
  // happens at all (placement is the Storyboard's call; the Director only
  // decides HOW to render whatever the Storyboard already decided).
  const storyboardWantsReveal = storyboard.logoRevealSceneNumber !== null;
  if (storyboardWantsReveal !== (sceneBible.logoReveal !== null)) {
    throw new CreativeCompilerError(
      `Storyboard/Scene Bible disagree on whether a Logo Reveal happens: storyboard.logoRevealSceneNumber=${storyboard.logoRevealSceneNumber}, sceneBible.logoReveal=${sceneBible.logoReveal === null ? "null" : "present"}.`
    );
  }

  const literalCallToAction =
    brief.content.style === "commercial" && brief.content.callToAction ? brief.content.callToAction.trim() || null : null;

  const scenes: CompiledScenePrompt[] = storyboard.scenes.map((scene) => {
    const sceneBibleEntry = sceneBibleEntryByNumber.get(scene.sceneNumber)!;
    const isHeroShot = storyboard.heroShotSceneNumber === scene.sceneNumber;
    const isLogoRevealScene = storyboard.logoRevealSceneNumber === scene.sceneNumber;
    const isCtaScene = storyboard.ctaSceneNumber === scene.sceneNumber;

    const renderPrompt = composeScenePrompt({
      scene: sceneBibleEntry,
      global: sceneBible.globalDirection,
      heroShot: isHeroShot ? sceneBible.heroShot : null,
      isLogoRevealScene,
      logoReveal: sceneBible.logoReveal,
      cta: isCtaScene ? sceneBible.cta : null,
      literalCallToAction: isCtaScene ? literalCallToAction : null,
    });

    return {
      sceneNumber: scene.sceneNumber,
      renderPrompt,
      durationSeconds: scene.durationSeconds,
    };
  });

  // Ground-truth fact preservation (rule 14) — the exact CTA wording the
  // user actually typed must survive into the compiled CTA scene's render
  // prompt verbatim; never silently reworded or dropped. The Director's own
  // CTA fields are style-only (no literal wording), so the Compiler itself
  // folds this in directly above — this check is a deterministic regression
  // guard on that folding, not a check on the Director's output.
  if (literalCallToAction) {
    const ctaScene = scenes.find((s) => s.sceneNumber === storyboard.ctaSceneNumber);
    if (!ctaScene || !ctaScene.renderPrompt.includes(literalCallToAction)) {
      throw new CreativeCompilerError(
        `The Creative Brief's exact call-to-action ("${literalCallToAction}") is missing from the compiled CTA scene's render prompt.`
      );
    }
  }

  return {
    videoProjectId: brief.videoProjectId,
    style: storyboard.style,
    brief,
    globalDirection: sceneBible.globalDirection,
    successDefinition: sceneBible.successDefinition,
    heroShot: sceneBible.heroShot,
    heroShotSceneNumber: storyboard.heroShotSceneNumber,
    logoReveal: sceneBible.logoReveal,
    logoRevealSceneNumber: storyboard.logoRevealSceneNumber,
    cta: sceneBible.cta,
    ctaSceneNumber: storyboard.ctaSceneNumber,
    scenes,
  };
}
