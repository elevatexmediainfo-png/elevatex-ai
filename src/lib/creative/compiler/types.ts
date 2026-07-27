import type { CreativeBrief } from "../brief/types";
import type { SceneBible } from "../scene-bible/types";

// Creative Compiler layer (2026-07-27, wired to the real Scene Bible
// 2026-07-28) — the only model-specific layer in the architecture (rule 10:
// renderers only render; rule 11: creativity happens entirely upstream).
//
// This file previously hand-declared its own placeholder `DirectorOutput`
// schema since no real Director existed yet. The Director is now built and
// committed (lib/creative/scene-bible/) — this file no longer re-declares
// GlobalDirection/HeroShot/LogoReveal/CallToAction/SuccessDefinition/
// SceneDirection; `compile-creative-plan.ts` imports the real, committed
// types directly from `../scene-bible/types`, so there is exactly one
// canonical definition of the Scene Bible shape in the codebase.
//
// Ownership rule (unchanged): Creative Brief owns WHAT, Storyboard owns
// WHEN, Scene Bible (Director) owns HOW, Compiler owns TRANSLATION. Scene
// placement — which scene is the Hero Shot/Logo Reveal/CTA — belongs
// exclusively to the Storyboard; none of the Scene Bible's types carry a
// scene reference of their own.

export interface CompiledScenePrompt {
  sceneNumber: number;
  renderPrompt: string;
  durationSeconds: number;
}

export interface CompiledCreativePlan {
  videoProjectId: string;
  style: SceneBible["style"];
  brief: CreativeBrief;
  globalDirection: SceneBible["globalDirection"];
  successDefinition: SceneBible["successDefinition"];
  heroShot: SceneBible["heroShot"];
  /** Sourced from the Storyboard — the single owner of scene placement, not from heroShot itself. */
  heroShotSceneNumber: number;
  logoReveal: SceneBible["logoReveal"];
  /** Sourced from the Storyboard; null when the Storyboard planned no logo reveal moment. */
  logoRevealSceneNumber: number | null;
  cta: SceneBible["cta"];
  /** Sourced from the Storyboard. */
  ctaSceneNumber: number;
  scenes: CompiledScenePrompt[];
}
