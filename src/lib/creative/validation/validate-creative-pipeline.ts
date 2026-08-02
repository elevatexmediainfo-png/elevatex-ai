import type { CreativeBrief } from "../brief/types";
import type { Storyboard } from "../storyboard/types";
import type { SceneBible } from "../scene-bible/types";
import { compileCreativePlan, CreativeCompilerError } from "../compiler/compile-creative-plan";
import type { ValidationIssue, ValidationResult, ValidationSeverity } from "./types";

// Deterministic validation only — no LLM call anywhere in this file, no
// mutation of its inputs, no attempt to regenerate or repair anything.
// Each function below covers exactly one of the founder's 9 named
// categories and can be run standalone; `validateCreativePipeline`
// aggregates all of them. Some categories legitimately overlap (e.g. a
// Storyboard/Scene Bible logo-reveal disagreement is reported once under
// "ownership" and once under "logo_reveal" — each category is meant to be
// a complete, standalone lens on its own, not a disjoint partition).

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

type Push = (code: string, message: string, path: string, severity?: ValidationSeverity) => void;

function makeIssueCollector(category: ValidationIssue["category"]): { issues: ValidationIssue[]; push: Push } {
  const issues: ValidationIssue[] = [];
  const push: Push = (code, message, path, severity = "error") => {
    issues.push({ category, code, message, path, severity });
  };
  return { issues, push };
}

// ---------------------------------------------------------------------
// 1. Creative Brief completeness
// ---------------------------------------------------------------------
export function validateCreativeBriefCompleteness(brief: CreativeBrief): ValidationIssue[] {
  const { issues, push } = makeIssueCollector("creative_brief");

  if (isBlank(brief.videoProjectId)) push("MISSING_FIELD", "videoProjectId is required.", "brief.videoProjectId");
  if (isBlank(brief.contentLanguage)) push("MISSING_FIELD", "contentLanguage is required.", "brief.contentLanguage");

  if (brief.content.style === "commercial") {
    if (isBlank(brief.content.objective)) push("MISSING_FIELD", "objective is required for a commercial brief.", "brief.content.objective");
    if (isBlank(brief.content.productOrService)) push("MISSING_FIELD", "productOrService is required.", "brief.content.productOrService");
    if (isBlank(brief.content.keyMessage)) push("MISSING_FIELD", "keyMessage is required.", "brief.content.keyMessage");
  } else if (brief.content.style === "film") {
    if (isBlank(brief.content.idea)) push("MISSING_FIELD", "idea is required for a film brief.", "brief.content.idea");
    if (isBlank(brief.content.filmStyle)) push("MISSING_FIELD", "filmStyle is required.", "brief.content.filmStyle");
    if (!(brief.content.totalDurationSeconds > 0)) push("INVALID_VALUE", "totalDurationSeconds must be positive.", "brief.content.totalDurationSeconds");
    if (!(brief.content.characterCount >= 1)) push("INVALID_VALUE", "characterCount must be at least 1.", "brief.content.characterCount");
  }

  return issues;
}

// ---------------------------------------------------------------------
// 2. Storyboard integrity
// ---------------------------------------------------------------------
export function validateStoryboardIntegrity(storyboard: Storyboard): ValidationIssue[] {
  const { issues, push } = makeIssueCollector("storyboard");

  if (isBlank(storyboard.narrativeArc)) push("MISSING_FIELD", "narrativeArc is required.", "storyboard.narrativeArc");
  if (!(storyboard.totalDurationSeconds > 0)) push("INVALID_VALUE", "totalDurationSeconds must be positive.", "storyboard.totalDurationSeconds");

  if (storyboard.scenes.length === 0) {
    push("EMPTY_SCENE_LIST", "A storyboard must have at least one scene.", "storyboard.scenes");
    return issues;
  }

  const seenNumbers = new Set<number>();
  let durationSum = 0;

  storyboard.scenes.forEach((scene, index) => {
    const path = `storyboard.scenes[${index}]`;
    if (seenNumbers.has(scene.sceneNumber)) {
      push("DUPLICATE_SCENE_NUMBER", `Scene number ${scene.sceneNumber} appears more than once.`, path);
    }
    seenNumbers.add(scene.sceneNumber);

    if (isBlank(scene.purpose)) push("MISSING_FIELD", "purpose is required.", `${path}.purpose`);
    if (isBlank(scene.storyBeat)) push("MISSING_FIELD", "storyBeat is required.", `${path}.storyBeat`);
    if (isBlank(scene.emotionalBeat)) push("MISSING_FIELD", "emotionalBeat is required.", `${path}.emotionalBeat`);
    if (!(scene.durationSeconds > 0)) push("INVALID_VALUE", "durationSeconds must be positive.", `${path}.durationSeconds`);
    durationSum += scene.durationSeconds;

    const isLast = index === storyboard.scenes.length - 1;
    if (isLast && scene.transitionToNext !== null) {
      push("UNEXPECTED_TRANSITION", "The final scene should not have a transitionToNext.", `${path}.transitionToNext`, "warning");
    }
    if (!isLast && scene.transitionToNext === null) {
      push("MISSING_TRANSITION", "Every non-final scene should have a transitionToNext.", `${path}.transitionToNext`, "warning");
    }
  });

  if (durationSum !== storyboard.totalDurationSeconds) {
    push(
      "DURATION_MISMATCH",
      `Scene durations sum to ${durationSum}s but totalDurationSeconds is ${storyboard.totalDurationSeconds}s.`,
      "storyboard.scenes"
    );
  }

  if (!seenNumbers.has(storyboard.heroShotSceneNumber)) {
    push("SCENE_NOT_FOUND", `heroShotSceneNumber ${storyboard.heroShotSceneNumber} does not match any scene.`, "storyboard.heroShotSceneNumber");
  }
  if (storyboard.logoRevealSceneNumber !== null && !seenNumbers.has(storyboard.logoRevealSceneNumber)) {
    push(
      "SCENE_NOT_FOUND",
      `logoRevealSceneNumber ${storyboard.logoRevealSceneNumber} does not match any scene.`,
      "storyboard.logoRevealSceneNumber"
    );
  }
  if (!seenNumbers.has(storyboard.ctaSceneNumber)) {
    push("SCENE_NOT_FOUND", `ctaSceneNumber ${storyboard.ctaSceneNumber} does not match any scene.`, "storyboard.ctaSceneNumber");
  }

  return issues;
}

// ---------------------------------------------------------------------
// 3. Scene Bible completeness (structural: one entry per storyboard scene)
// ---------------------------------------------------------------------
export function validateSceneBibleCompleteness(storyboard: Storyboard, sceneBible: SceneBible): ValidationIssue[] {
  const { issues, push } = makeIssueCollector("scene_bible");

  const storyboardNumbers = new Set(storyboard.scenes.map((s) => s.sceneNumber));
  const sceneBibleNumbers = new Set<number>();

  sceneBible.scenes.forEach((entry, index) => {
    const path = `sceneBible.scenes[${index}]`;
    if (sceneBibleNumbers.has(entry.sceneNumber)) {
      push("DUPLICATE_SCENE_NUMBER", `Scene Bible has more than one entry for scene ${entry.sceneNumber}.`, path);
    }
    sceneBibleNumbers.add(entry.sceneNumber);
    if (!storyboardNumbers.has(entry.sceneNumber)) {
      push("ORPHAN_ENTRY", `Scene Bible entry references scene ${entry.sceneNumber}, which doesn't exist in the storyboard.`, path);
    }
  });

  for (const sceneNumber of storyboardNumbers) {
    if (!sceneBibleNumbers.has(sceneNumber)) {
      push("MISSING_ENTRY", `Storyboard scene ${sceneNumber} has no Scene Bible entry.`, "sceneBible.scenes");
    }
  }

  return issues;
}

// ---------------------------------------------------------------------
// 4. Ownership invariants (Brief=WHAT, Storyboard=WHEN, Scene Bible=HOW)
// ---------------------------------------------------------------------
export function validateOwnershipInvariants(brief: CreativeBrief, storyboard: Storyboard, sceneBible: SceneBible): ValidationIssue[] {
  const { issues, push } = makeIssueCollector("ownership");

  if (brief.content.style !== storyboard.style || storyboard.style !== sceneBible.style) {
    push(
      "STYLE_MISMATCH",
      `Style disagreement across layers: brief=${brief.content.style}, storyboard=${storyboard.style}, sceneBible=${sceneBible.style}.`,
      "style"
    );
  }

  const storyboardWantsReveal = storyboard.logoRevealSceneNumber !== null;
  const sceneBibleHasReveal = sceneBible.logoReveal !== null;
  if (storyboardWantsReveal !== sceneBibleHasReveal) {
    push(
      "LOGO_REVEAL_DISAGREEMENT",
      `Storyboard/Scene Bible disagree on whether a logo reveal happens (storyboard.logoRevealSceneNumber=${storyboard.logoRevealSceneNumber}, sceneBible.logoReveal=${sceneBibleHasReveal ? "present" : "null"}).`,
      "logoReveal"
    );
  }

  // Defensive: HeroShotDirection/LogoRevealDirection/CTADirection carry no
  // scene reference of their own by type — Storyboard is the sole owner of
  // placement. Guards against untrusted/deserialized data (e.g. a stored
  // JSON blob) smuggling one back in.
  const placementCarriers: Array<[string, unknown]> = [
    ["heroShot", sceneBible.heroShot],
    ["cta", sceneBible.cta],
    ["logoReveal", sceneBible.logoReveal],
  ];
  for (const [label, obj] of placementCarriers) {
    if (obj && typeof obj === "object" && "sceneNumber" in obj) {
      push("PLACEMENT_LEAK", `sceneBible.${label} carries its own sceneNumber — placement must be owned exclusively by the Storyboard.`, `sceneBible.${label}`);
    }
  }

  return issues;
}

// ---------------------------------------------------------------------
// 5. Hero Shot integrity
// ---------------------------------------------------------------------
export function validateHeroShotIntegrity(sceneBible: SceneBible): ValidationIssue[] {
  const { issues, push } = makeIssueCollector("hero_shot");
  const h = sceneBible.heroShot;

  if (isBlank(h.purpose)) push("MISSING_FIELD", "heroShot.purpose is required.", "sceneBible.heroShot.purpose");
  if (isBlank(h.marketingGoal)) push("MISSING_FIELD", "heroShot.marketingGoal is required.", "sceneBible.heroShot.marketingGoal");
  if (isBlank(h.specialCreativeInstructions)) {
    push("MISSING_FIELD", "heroShot.specialCreativeInstructions is required.", "sceneBible.heroShot.specialCreativeInstructions");
  }
  if (isBlank(h.successCriteria)) push("MISSING_FIELD", "heroShot.successCriteria is required.", "sceneBible.heroShot.successCriteria");

  return issues;
}

// ---------------------------------------------------------------------
// 6. Logo Reveal integrity
// ---------------------------------------------------------------------
export function validateLogoRevealIntegrity(storyboard: Storyboard, sceneBible: SceneBible): ValidationIssue[] {
  const { issues, push } = makeIssueCollector("logo_reveal");

  if (storyboard.logoRevealSceneNumber === null) {
    if (sceneBible.logoReveal !== null) {
      push("UNEXPECTED_REVEAL", "Scene Bible defines logo reveal behaviour, but the Storyboard planned no reveal scene.", "sceneBible.logoReveal");
    }
    return issues;
  }

  if (!sceneBible.logoReveal) {
    push("MISSING_REVEAL", "Storyboard planned a logo reveal scene, but the Scene Bible defines no reveal behaviour.", "sceneBible.logoReveal");
    return issues;
  }

  if (isBlank(sceneBible.logoReveal.instruction)) push("MISSING_FIELD", "logoReveal.instruction is required.", "sceneBible.logoReveal.instruction");
  if (isBlank(sceneBible.logoReveal.animationStyle)) {
    push("MISSING_FIELD", "logoReveal.animationStyle is required.", "sceneBible.logoReveal.animationStyle");
  }

  return issues;
}

// ---------------------------------------------------------------------
// 7. CTA integrity
// ---------------------------------------------------------------------
export function validateCtaIntegrity(sceneBible: SceneBible): ValidationIssue[] {
  const { issues, push } = makeIssueCollector("cta");
  const c = sceneBible.cta;

  if (isBlank(c.messageStyle)) push("MISSING_FIELD", "cta.messageStyle is required.", "sceneBible.cta.messageStyle");
  if (isBlank(c.viewerActionStyle)) push("MISSING_FIELD", "cta.viewerActionStyle is required.", "sceneBible.cta.viewerActionStyle");
  if (isBlank(c.voiceOverStyle)) push("MISSING_FIELD", "cta.voiceOverStyle is required.", "sceneBible.cta.voiceOverStyle");
  if (isBlank(c.screenTextStyle)) push("MISSING_FIELD", "cta.screenTextStyle is required.", "sceneBible.cta.screenTextStyle");

  return issues;
}

// ---------------------------------------------------------------------
// 8. Required production fields (deep non-emptiness sweep)
// ---------------------------------------------------------------------
const GLOBAL_STRING_FIELDS = [
  "marketingGoal",
  "marketingPsychology",
  "brandDna",
  "creativeTheme",
  "visualLanguage",
  "lightingLanguage",
  "cameraLanguage",
  "editingLanguage",
  "colorLanguage",
] as const;

const GLOBAL_LIST_FIELDS = ["environmentRules", "productRules", "characterRules", "continuityRules", "qualityRules"] as const;

const SUCCESS_DEFINITION_FIELDS = [
  "viewerShouldFeel",
  "viewerShouldRemember",
  "viewerShouldDesire",
  "primarySellingPoint",
  "secondarySellingPoint",
  "brandRecallGoal",
] as const;

const SCENE_ENTRY_STRING_FIELDS = [
  "purpose",
  "storyGoal",
  "marketingGoal",
  "viewerEmotion",
  "viewerPsychology",
  "environment",
  "location",
  "weather",
  "timeOfDay",
  "characterBehaviour",
  "expression",
  "wardrobe",
  "props",
  "productBehaviour",
  "camera",
  "lens",
  "cameraHeight",
  "cameraDistance",
  "cameraMovement",
  "composition",
  "framing",
  "foreground",
  "background",
  "lighting",
  "atmosphere",
  "colorPalette",
  "depthOfField",
  "motion",
  "transition",
  "editingRhythm",
  "continuityNotes",
  "negativeInstructions",
  "successCriteria",
] as const;

export function validateRequiredProductionFields(sceneBible: SceneBible): ValidationIssue[] {
  const { issues, push } = makeIssueCollector("production_fields");

  for (const field of GLOBAL_STRING_FIELDS) {
    if (isBlank(sceneBible.globalDirection[field])) {
      push("MISSING_FIELD", `globalDirection.${field} is required.`, `sceneBible.globalDirection.${field}`);
    }
  }

  for (const field of GLOBAL_LIST_FIELDS) {
    const list = sceneBible.globalDirection[field];
    if (!list || list.length === 0) {
      push("EMPTY_LIST", `globalDirection.${field} must have at least one rule.`, `sceneBible.globalDirection.${field}`);
    } else {
      list.forEach((rule, i) => {
        if (isBlank(rule)) push("MISSING_FIELD", `globalDirection.${field}[${i}] must not be blank.`, `sceneBible.globalDirection.${field}[${i}]`);
      });
    }
  }

  for (const field of SUCCESS_DEFINITION_FIELDS) {
    if (isBlank(sceneBible.successDefinition[field])) {
      push("MISSING_FIELD", `successDefinition.${field} is required.`, `sceneBible.successDefinition.${field}`);
    }
  }

  sceneBible.scenes.forEach((entry, index) => {
    const path = `sceneBible.scenes[${index}]`;
    for (const field of SCENE_ENTRY_STRING_FIELDS) {
      if (isBlank(entry[field])) push("MISSING_FIELD", `${field} is required.`, `${path}.${field}`);
    }
  });

  return issues;
}

// ---------------------------------------------------------------------
// 9. Compiler contract — reuses the real, canonical compileCreativePlan()
// as a dry run instead of reimplementing its preconditions a second time
// (rule 9: one canonical source per concern). The Compiler itself is
// already fully deterministic (no LLM call), so invoking it here doesn't
// compromise this layer's own "no AI" requirement.
// ---------------------------------------------------------------------
export function validateCompilerContract(brief: CreativeBrief, storyboard: Storyboard, sceneBible: SceneBible): ValidationIssue[] {
  try {
    compileCreativePlan({ brief, storyboard, sceneBible });
    return [];
  } catch (err) {
    const message =
      err instanceof CreativeCompilerError || err instanceof Error ? err.message : "The Compiler failed for an unknown reason.";
    return [{ category: "compiler_contract", code: "COMPILE_FAILED", message, path: "compiler", severity: "error" }];
  }
}

// ---------------------------------------------------------------------
// Aggregate entry point
// ---------------------------------------------------------------------
export function validateCreativePipeline(brief: CreativeBrief, storyboard: Storyboard, sceneBible: SceneBible): ValidationResult {
  const issues: ValidationIssue[] = [
    ...validateCreativeBriefCompleteness(brief),
    ...validateStoryboardIntegrity(storyboard),
    ...validateSceneBibleCompleteness(storyboard, sceneBible),
    ...validateOwnershipInvariants(brief, storyboard, sceneBible),
    ...validateHeroShotIntegrity(sceneBible),
    ...validateLogoRevealIntegrity(storyboard, sceneBible),
    ...validateCtaIntegrity(sceneBible),
    ...validateRequiredProductionFields(sceneBible),
    ...validateCompilerContract(brief, storyboard, sceneBible),
  ];

  return { valid: issues.every((issue) => issue.severity !== "error"), issues };
}
