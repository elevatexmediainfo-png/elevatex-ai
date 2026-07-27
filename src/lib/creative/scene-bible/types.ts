// Director layer (2026-07-27) — "the creative brain of the production."
// Owns only HOW (rule: renderers only render, creativity happens upstream;
// Director owns HOW, Storyboard owns WHEN, Creative Brief owns WHAT). Its
// output is the "Scene Bible": complete production documentation, detailed
// enough for a real Creative Director/DP/Camera Crew/Lighting Crew/Art
// Director/Editor to execute without asking a follow-up question. It is NOT
// a prompt writer and NEVER produces rendering-ready text or thinks about
// any specific vendor — that translation is a separate, later stage
// (lib/creative/compiler) this layer never sees.
//
// Placement (WHEN) is the Storyboard's exclusive decision — which scene is
// the Hero Shot / Logo Reveal / CTA. The Director receives that decision as
// a given fact and only enriches whichever scene the Storyboard already
// chose; none of the types below carry a scene reference of their own.
//
// Naming note: this lives in `lib/creative/scene-bible/`, not
// `lib/creative/director/`, because that directory already holds the
// pre-existing Phase-1 `DirectorPlan`/`planFilm`/`planCommercialFromScript`
// system, still wired into real live routes and explicitly off-limits to
// modification. This is a separate, new module producing a different,
// richer shape — not an edit to that legacy system.

export type SceneBibleStyle = "commercial" | "film";

export interface GlobalDirection {
  marketingGoal: string;
  marketingPsychology: string;
  brandDna: string;
  creativeTheme: string;
  visualLanguage: string;
  lightingLanguage: string;
  cameraLanguage: string;
  editingLanguage: string;
  colorLanguage: string;
  environmentRules: string[];
  productRules: string[];
  characterRules: string[];
  continuityRules: string[];
  qualityRules: string[];
}

export interface SceneBibleEntry {
  sceneNumber: number;
  purpose: string;
  storyGoal: string;
  marketingGoal: string;
  viewerEmotion: string;
  viewerPsychology: string;
  environment: string;
  location: string;
  weather: string;
  timeOfDay: string;
  characterBehaviour: string;
  expression: string;
  wardrobe: string;
  props: string;
  productBehaviour: string;
  camera: string;
  lens: string;
  cameraHeight: string;
  cameraDistance: string;
  cameraMovement: string;
  composition: string;
  framing: string;
  foreground: string;
  background: string;
  lighting: string;
  atmosphere: string;
  colorPalette: string;
  depthOfField: string;
  motion: string;
  transition: string;
  editingRhythm: string;
  continuityNotes: string;
  negativeInstructions: string;
  successCriteria: string;
}

// Deliberately narrow — the Hero Shot scene already has its own full
// SceneBibleEntry (camera/lighting/composition/etc.). This only adds what
// makes that scene THE hero moment; it must never restate what the scene's
// own entry already covers.
export interface HeroShotDirection {
  purpose: string;
  marketingGoal: string;
  specialCreativeInstructions: string;
  successCriteria: string;
}

export interface LogoRevealDirection {
  instruction: string;
  animationStyle: string;
}

// Style/delivery direction only — never the literal CTA wording, which is
// Creative Brief ground truth (WHAT), not the Director's to invent (HOW).
export interface CTADirection {
  messageStyle: string;
  viewerActionStyle: string;
  voiceOverStyle: string;
  screenTextStyle: string;
}

// Whole-campaign success bar — distinct in scope from any single scene's or
// the Hero Shot's own successCriteria (both narrower, per-shot bars); none
// of the three are deduplicated, each is scoped to its own level.
export interface SuccessDefinition {
  viewerShouldFeel: string;
  viewerShouldRemember: string;
  viewerShouldDesire: string;
  primarySellingPoint: string;
  secondarySellingPoint: string;
  brandRecallGoal: string;
}

export interface SceneBible {
  style: SceneBibleStyle;
  globalDirection: GlobalDirection;
  successDefinition: SuccessDefinition;
  scenes: SceneBibleEntry[];
  heroShot: HeroShotDirection;
  /** Null exactly when the Storyboard planned no Logo Reveal scene — nothing for the Director to enrich. */
  logoReveal: LogoRevealDirection | null;
  cta: CTADirection;
}
