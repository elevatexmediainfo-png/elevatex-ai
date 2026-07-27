// Storyboard layer (2026-07-27) — narrative structure only. Deliberately
// narrower than the pre-existing lib/creative/director/* modules (which
// still bake camera/lighting/visualPrompt directly into their scenes) —
// this layer owns exactly the responsibilities the founder assigned: scene
// sequence, story progression, emotional progression, scene purpose,
// duration, transitions, and where the Hero Shot / Logo Reveal / CTA land.
// It never produces camera, lighting, lens, composition, prompt text, or
// director notes — that is a future, separate cinematic-direction stage's
// job, consuming this Storyboard alongside the Creative Brief.

export type StoryboardStyle = "commercial" | "film";

export interface StoryboardScene {
  sceneNumber: number;
  purpose: string;
  storyBeat: string;
  emotionalBeat: string;
  durationSeconds: number;
  /** Null only for the final scene — there is no "next" to transition into. */
  transitionToNext: string | null;
}

export interface Storyboard {
  style: StoryboardStyle;
  narrativeArc: string;
  totalDurationSeconds: number;
  scenes: StoryboardScene[];
  heroShotSceneNumber: number;
  /** Null when this video has no intentional logo reveal moment. */
  logoRevealSceneNumber: number | null;
  ctaSceneNumber: number;
}
