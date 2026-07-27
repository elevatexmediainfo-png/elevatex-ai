import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreativeBrief } from "../brief/types";
import type { Storyboard, StoryboardScene } from "../storyboard/types";
import type { SceneBible, SceneBibleEntry } from "../scene-bible/types";

const getCreativeBriefMock = vi.fn();
vi.mock("../brief/get-creative-brief", () => ({ getCreativeBrief: (...args: unknown[]) => getCreativeBriefMock(...args) }));

const planStoryboardMock = vi.fn();
vi.mock("../storyboard/plan-storyboard", () => ({ planStoryboard: (...args: unknown[]) => planStoryboardMock(...args) }));

const planSceneBibleMock = vi.fn();
vi.mock("../scene-bible/plan-scene-bible", () => ({ planSceneBible: (...args: unknown[]) => planSceneBibleMock(...args) }));

// compileCreativePlan and validateCreativePipeline are NOT mocked — both
// are pure and deterministic, so running them for real gives genuine
// end-to-end confidence the wiring between layers is actually correct.
const { runCreativePipeline } = await import("./run-creative-pipeline");

function makeBrief(): CreativeBrief {
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

describe("runCreativePipeline", () => {
  beforeEach(() => {
    getCreativeBriefMock.mockReset();
    planStoryboardMock.mockReset();
    planSceneBibleMock.mockReset();
  });

  it("executes every layer in order and returns a compiled prompt when validation passes", async () => {
    const brief = makeBrief();
    const storyboard = makeStoryboard();
    const sceneBible = makeSceneBible();
    getCreativeBriefMock.mockResolvedValue(brief);
    planStoryboardMock.mockResolvedValue(storyboard);
    planSceneBibleMock.mockResolvedValue(sceneBible);

    const result = await runCreativePipeline("proj_1");

    expect(getCreativeBriefMock).toHaveBeenCalledWith("proj_1");
    expect(planStoryboardMock).toHaveBeenCalledWith(brief);
    expect(planSceneBibleMock).toHaveBeenCalledWith(brief, storyboard);
    expect(getCreativeBriefMock.mock.invocationCallOrder[0]).toBeLessThan(planStoryboardMock.mock.invocationCallOrder[0]);
    expect(planStoryboardMock.mock.invocationCallOrder[0]).toBeLessThan(planSceneBibleMock.mock.invocationCallOrder[0]);

    expect(result.creativeBrief).toBe(brief);
    expect(result.storyboard).toBe(storyboard);
    expect(result.sceneBible).toBe(sceneBible);
    expect(result.validationResult.valid).toBe(true);
    expect(result.compiledPrompt).not.toBeNull();
    expect(result.compiledPrompt?.scenes).toHaveLength(2);
    expect(result.compiledPrompt?.scenes[1].renderPrompt).toContain("Order now at glowcandles.com");
  });

  it("stops the pipeline (compiledPrompt: null) on a Validator-detected integrity issue the Compiler alone wouldn't necessarily catch", async () => {
    const brief = makeBrief();
    // Duplicate scene numbers: compileCreativePlan's Map-based lookup would
    // silently tolerate this, but the Validator's storyboard integrity check
    // must not.
    const storyboard = makeStoryboard({ scenes: [makeStoryboardScene(1, "cut"), makeStoryboardScene(1, null)] });
    const sceneBible = makeSceneBible();
    getCreativeBriefMock.mockResolvedValue(brief);
    planStoryboardMock.mockResolvedValue(storyboard);
    planSceneBibleMock.mockResolvedValue(sceneBible);

    const result = await runCreativePipeline("proj_1");

    expect(result.validationResult.valid).toBe(false);
    expect(result.compiledPrompt).toBeNull();
    // The rest of the pipeline's outputs are still returned for inspection.
    expect(result.creativeBrief).toBe(brief);
    expect(result.storyboard).toBe(storyboard);
    expect(result.sceneBible).toBe(sceneBible);
  });

  it("stops the pipeline and reports why when compilation itself throws", async () => {
    const brief = makeBrief();
    const storyboard = makeStoryboard({ style: "film" }); // style mismatch -> compileCreativePlan throws
    const sceneBible = makeSceneBible();
    getCreativeBriefMock.mockResolvedValue(brief);
    planStoryboardMock.mockResolvedValue(storyboard);
    planSceneBibleMock.mockResolvedValue(sceneBible);

    const result = await runCreativePipeline("proj_1");

    expect(result.compiledPrompt).toBeNull();
    expect(result.validationResult.valid).toBe(false);
    expect(result.validationResult.issues.some((i) => i.category === "compiler_contract" && i.code === "COMPILE_FAILED")).toBe(true);
  });

  it("propagates a genuine earlier-stage failure instead of swallowing it into a validation result", async () => {
    getCreativeBriefMock.mockRejectedValue(new Error("VideoProject proj_404 not found."));

    await expect(runCreativePipeline("proj_404")).rejects.toThrow("VideoProject proj_404 not found.");
    expect(planStoryboardMock).not.toHaveBeenCalled();
  });
});
