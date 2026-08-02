import { describe, expect, it } from "vitest";
import type { CreativeBrief } from "../brief/types";
import type { Storyboard, StoryboardScene } from "../storyboard/types";
import type { SceneBible, SceneBibleEntry } from "../scene-bible/types";
import {
  validateCreativeBriefCompleteness,
  validateStoryboardIntegrity,
  validateSceneBibleCompleteness,
  validateOwnershipInvariants,
  validateHeroShotIntegrity,
  validateLogoRevealIntegrity,
  validateCtaIntegrity,
  validateRequiredProductionFields,
  validateCompilerContract,
  validateCreativePipeline,
} from "./validate-creative-pipeline";

function makeBrief(overrides: Partial<CreativeBrief> = {}): CreativeBrief {
  return {
    videoProjectId: "proj_1",
    contentLanguage: "EN",
    brand: {
      businessName: "Glow Candles",
      businessVertical: "RETAIL",
      city: "Mumbai",
      primaryColor: null,
      secondaryColor: null,
      fontFamily: null,
      guidelinesText: null,
      contactPhone: null,
      contactWhatsapp: null,
      addressLine: null,
      websiteOrSocial: null,
    },
    content: {
      style: "commercial",
      objective: "PROMOTION",
      productOrService: "Handmade candles",
      keyMessage: "Light up your evenings",
      offerDetails: null,
      callToAction: "Order now at glowcandles.com",
      tone: "FRIENDLY",
    },
    ...overrides,
  };
}

function makeStoryboardScene(sceneNumber: number, transitionToNext: string | null): StoryboardScene {
  return {
    sceneNumber,
    purpose: `purpose${sceneNumber}`,
    storyBeat: `storyBeat${sceneNumber}`,
    emotionalBeat: `emotionalBeat${sceneNumber}`,
    durationSeconds: 8,
    transitionToNext,
  };
}

function makeStoryboard(overrides: Partial<Storyboard> = {}): Storyboard {
  return {
    style: "commercial",
    narrativeArc: "A quiet morning ritual interrupted by delight, closing on a direct offer.",
    totalDurationSeconds: 16,
    scenes: [makeStoryboardScene(1, "Hard cut on the reveal"), makeStoryboardScene(2, null)],
    heroShotSceneNumber: 1,
    logoRevealSceneNumber: null,
    ctaSceneNumber: 2,
    ...overrides,
  };
}

function makeSceneEntry(sceneNumber: number): SceneBibleEntry {
  return {
    sceneNumber,
    purpose: "purpose", storyGoal: "storyGoal", marketingGoal: "marketingGoal", viewerEmotion: "viewerEmotion",
    viewerPsychology: "viewerPsychology", environment: "environment", location: "location", weather: "weather",
    timeOfDay: "timeOfDay", characterBehaviour: "characterBehaviour", expression: "expression", wardrobe: "wardrobe",
    props: "props", productBehaviour: "productBehaviour", camera: "camera", lens: "lens", cameraHeight: "cameraHeight",
    cameraDistance: "cameraDistance", cameraMovement: "cameraMovement", composition: "composition", framing: "framing",
    foreground: "foreground", background: "background", lighting: "lighting", atmosphere: "atmosphere",
    colorPalette: "colorPalette", depthOfField: "depthOfField", motion: "motion", transition: "transition",
    editingRhythm: "editingRhythm", continuityNotes: "continuityNotes", negativeInstructions: "no logo or watermark",
    successCriteria: "successCriteria",
  };
}

function makeSceneBible(overrides: Partial<SceneBible> = {}): SceneBible {
  return {
    style: "commercial",
    globalDirection: {
      marketingGoal: "marketingGoal", marketingPsychology: "marketingPsychology", brandDna: "brandDna",
      creativeTheme: "creativeTheme", visualLanguage: "visualLanguage", lightingLanguage: "lightingLanguage",
      cameraLanguage: "cameraLanguage", editingLanguage: "editingLanguage", colorLanguage: "colorLanguage",
      environmentRules: ["rule"], productRules: ["rule"], characterRules: ["rule"], continuityRules: ["rule"], qualityRules: ["rule"],
    },
    successDefinition: {
      viewerShouldFeel: "feel", viewerShouldRemember: "remember", viewerShouldDesire: "desire",
      primarySellingPoint: "primary", secondarySellingPoint: "secondary", brandRecallGoal: "recall",
    },
    scenes: [makeSceneEntry(1), makeSceneEntry(2)],
    heroShot: { purpose: "purpose", marketingGoal: "marketingGoal", specialCreativeInstructions: "special", successCriteria: "success" },
    logoReveal: null,
    cta: { messageStyle: "messageStyle", viewerActionStyle: "viewerActionStyle", voiceOverStyle: "voiceOverStyle", screenTextStyle: "screenTextStyle" },
    ...overrides,
  };
}

describe("validateCreativeBriefCompleteness", () => {
  it("passes for a complete commercial brief", () => {
    expect(validateCreativeBriefCompleteness(makeBrief())).toEqual([]);
  });

  it("flags a missing productOrService", () => {
    const brief = makeBrief({ content: { ...makeBrief().content, productOrService: "  " } as never });
    const issues = validateCreativeBriefCompleteness(brief);
    expect(issues.some((i) => i.code === "MISSING_FIELD" && i.path === "brief.content.productOrService")).toBe(true);
  });

  it("flags an invalid film duration", () => {
    const brief = makeBrief({
      content: { style: "film", idea: "idea", filmStyle: "CINEMATIC", totalDurationSeconds: 0, characterCount: 1 },
    });
    const issues = validateCreativeBriefCompleteness(brief);
    expect(issues.some((i) => i.code === "INVALID_VALUE" && i.path === "brief.content.totalDurationSeconds")).toBe(true);
  });
});

describe("validateStoryboardIntegrity", () => {
  it("passes for a well-formed storyboard", () => {
    expect(validateStoryboardIntegrity(makeStoryboard())).toEqual([]);
  });

  it("flags an empty scene list", () => {
    const issues = validateStoryboardIntegrity(makeStoryboard({ scenes: [] }));
    expect(issues.some((i) => i.code === "EMPTY_SCENE_LIST")).toBe(true);
  });

  it("flags duplicate scene numbers", () => {
    const storyboard = makeStoryboard({ scenes: [makeStoryboardScene(1, "cut"), makeStoryboardScene(1, null)] });
    const issues = validateStoryboardIntegrity(storyboard);
    expect(issues.some((i) => i.code === "DUPLICATE_SCENE_NUMBER")).toBe(true);
  });

  it("flags a duration mismatch against totalDurationSeconds", () => {
    const issues = validateStoryboardIntegrity(makeStoryboard({ totalDurationSeconds: 99 }));
    expect(issues.some((i) => i.code === "DURATION_MISMATCH")).toBe(true);
  });

  it("warns when the final scene has a transitionToNext", () => {
    const storyboard = makeStoryboard({ scenes: [makeStoryboardScene(1, "cut"), makeStoryboardScene(2, "cut")] });
    const issues = validateStoryboardIntegrity(storyboard);
    const issue = issues.find((i) => i.code === "UNEXPECTED_TRANSITION");
    expect(issue?.severity).toBe("warning");
  });

  it("flags a hero shot scene reference that doesn't exist", () => {
    const issues = validateStoryboardIntegrity(makeStoryboard({ heroShotSceneNumber: 99 }));
    expect(issues.some((i) => i.code === "SCENE_NOT_FOUND" && i.path === "storyboard.heroShotSceneNumber")).toBe(true);
  });
});

describe("validateSceneBibleCompleteness", () => {
  it("passes when every storyboard scene has exactly one Scene Bible entry", () => {
    expect(validateSceneBibleCompleteness(makeStoryboard(), makeSceneBible())).toEqual([]);
  });

  it("flags a missing entry", () => {
    const sceneBible = makeSceneBible({ scenes: [makeSceneEntry(1)] });
    const issues = validateSceneBibleCompleteness(makeStoryboard(), sceneBible);
    expect(issues.some((i) => i.code === "MISSING_ENTRY")).toBe(true);
  });

  it("flags an orphan entry with no matching storyboard scene", () => {
    const sceneBible = makeSceneBible({ scenes: [makeSceneEntry(1), makeSceneEntry(2), makeSceneEntry(3)] });
    const issues = validateSceneBibleCompleteness(makeStoryboard(), sceneBible);
    expect(issues.some((i) => i.code === "ORPHAN_ENTRY")).toBe(true);
  });

  it("flags a duplicate Scene Bible entry", () => {
    const sceneBible = makeSceneBible({ scenes: [makeSceneEntry(1), makeSceneEntry(1), makeSceneEntry(2)] });
    const issues = validateSceneBibleCompleteness(makeStoryboard(), sceneBible);
    expect(issues.some((i) => i.code === "DUPLICATE_SCENE_NUMBER")).toBe(true);
  });
});

describe("validateOwnershipInvariants", () => {
  it("passes when all three layers agree", () => {
    expect(validateOwnershipInvariants(makeBrief(), makeStoryboard(), makeSceneBible())).toEqual([]);
  });

  it("flags a style mismatch", () => {
    const issues = validateOwnershipInvariants(makeBrief(), makeStoryboard({ style: "film" }), makeSceneBible());
    expect(issues.some((i) => i.code === "STYLE_MISMATCH")).toBe(true);
  });

  it("flags a logo reveal disagreement", () => {
    const issues = validateOwnershipInvariants(makeBrief(), makeStoryboard({ logoRevealSceneNumber: 2 }), makeSceneBible());
    expect(issues.some((i) => i.code === "LOGO_REVEAL_DISAGREEMENT")).toBe(true);
  });

  it("flags a placement leak on heroShot", () => {
    const sceneBible = makeSceneBible();
    (sceneBible.heroShot as unknown as { sceneNumber: number }).sceneNumber = 1;
    const issues = validateOwnershipInvariants(makeBrief(), makeStoryboard(), sceneBible);
    expect(issues.some((i) => i.code === "PLACEMENT_LEAK" && i.path === "sceneBible.heroShot")).toBe(true);
  });
});

describe("validateHeroShotIntegrity", () => {
  it("passes for a complete hero shot", () => {
    expect(validateHeroShotIntegrity(makeSceneBible())).toEqual([]);
  });

  it("flags a blank specialCreativeInstructions", () => {
    const sceneBible = makeSceneBible({ heroShot: { ...makeSceneBible().heroShot, specialCreativeInstructions: "" } });
    const issues = validateHeroShotIntegrity(sceneBible);
    expect(issues.some((i) => i.path === "sceneBible.heroShot.specialCreativeInstructions")).toBe(true);
  });
});

describe("validateLogoRevealIntegrity", () => {
  it("passes when no reveal is planned and none is enriched", () => {
    expect(validateLogoRevealIntegrity(makeStoryboard(), makeSceneBible())).toEqual([]);
  });

  it("flags an unexpected reveal enrichment when the storyboard planned none", () => {
    const sceneBible = makeSceneBible({ logoReveal: { instruction: "fade", animationStyle: "fade" } });
    const issues = validateLogoRevealIntegrity(makeStoryboard(), sceneBible);
    expect(issues.some((i) => i.code === "UNEXPECTED_REVEAL")).toBe(true);
  });

  it("flags a missing reveal enrichment when the storyboard planned one", () => {
    const issues = validateLogoRevealIntegrity(makeStoryboard({ logoRevealSceneNumber: 2 }), makeSceneBible());
    expect(issues.some((i) => i.code === "MISSING_REVEAL")).toBe(true);
  });

  it("flags a blank field on a present reveal", () => {
    const sceneBible = makeSceneBible({ logoReveal: { instruction: "", animationStyle: "fade" } });
    const issues = validateLogoRevealIntegrity(makeStoryboard({ logoRevealSceneNumber: 2 }), sceneBible);
    expect(issues.some((i) => i.path === "sceneBible.logoReveal.instruction")).toBe(true);
  });
});

describe("validateCtaIntegrity", () => {
  it("passes for a complete CTA", () => {
    expect(validateCtaIntegrity(makeSceneBible())).toEqual([]);
  });

  it("flags a blank voiceOverStyle", () => {
    const sceneBible = makeSceneBible({ cta: { ...makeSceneBible().cta, voiceOverStyle: "   " } });
    const issues = validateCtaIntegrity(sceneBible);
    expect(issues.some((i) => i.path === "sceneBible.cta.voiceOverStyle")).toBe(true);
  });
});

describe("validateRequiredProductionFields", () => {
  it("passes for a fully populated Scene Bible", () => {
    expect(validateRequiredProductionFields(makeSceneBible())).toEqual([]);
  });

  it("flags a blank global field", () => {
    const sceneBible = makeSceneBible();
    sceneBible.globalDirection.brandDna = "";
    const issues = validateRequiredProductionFields(sceneBible);
    expect(issues.some((i) => i.path === "sceneBible.globalDirection.brandDna")).toBe(true);
  });

  it("flags an empty global rule list", () => {
    const sceneBible = makeSceneBible();
    sceneBible.globalDirection.continuityRules = [];
    const issues = validateRequiredProductionFields(sceneBible);
    expect(issues.some((i) => i.code === "EMPTY_LIST" && i.path === "sceneBible.globalDirection.continuityRules")).toBe(true);
  });

  it("flags a blank per-scene field", () => {
    const sceneBible = makeSceneBible();
    sceneBible.scenes[0].camera = "";
    const issues = validateRequiredProductionFields(sceneBible);
    expect(issues.some((i) => i.path === "sceneBible.scenes[0].camera")).toBe(true);
  });
});

describe("validateCompilerContract", () => {
  it("passes when the plan would compile successfully", () => {
    expect(validateCompilerContract(makeBrief(), makeStoryboard(), makeSceneBible())).toEqual([]);
  });

  it("reports a single COMPILE_FAILED issue when compilation would throw", () => {
    const issues = validateCompilerContract(makeBrief(), makeStoryboard({ heroShotSceneNumber: 99 }), makeSceneBible());
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("COMPILE_FAILED");
    expect(issues[0].category).toBe("compiler_contract");
  });
});

describe("validateCreativePipeline", () => {
  it("returns valid: true with no issues for a fully correct pipeline", () => {
    const result = validateCreativePipeline(makeBrief(), makeStoryboard(), makeSceneBible());
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it("returns valid: false when any error-severity issue exists", () => {
    const result = validateCreativePipeline(makeBrief(), makeStoryboard({ heroShotSceneNumber: 99 }), makeSceneBible());
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("stays valid: true when only warning-severity issues exist", () => {
    const storyboard = makeStoryboard({ scenes: [makeStoryboardScene(1, "cut"), makeStoryboardScene(2, "cut")] });
    const result = validateCreativePipeline(makeBrief(), storyboard, makeSceneBible());
    expect(result.issues.every((i) => i.severity === "warning")).toBe(true);
    expect(result.valid).toBe(true);
  });

  it("never mutates its inputs", () => {
    const brief = makeBrief();
    const storyboard = makeStoryboard();
    const sceneBible = makeSceneBible();
    const briefCopy = JSON.parse(JSON.stringify(brief));
    const storyboardCopy = JSON.parse(JSON.stringify(storyboard));
    const sceneBibleCopy = JSON.parse(JSON.stringify(sceneBible));

    validateCreativePipeline(brief, storyboard, sceneBible);

    expect(brief).toEqual(briefCopy);
    expect(storyboard).toEqual(storyboardCopy);
    expect(sceneBible).toEqual(sceneBibleCopy);
  });
});
