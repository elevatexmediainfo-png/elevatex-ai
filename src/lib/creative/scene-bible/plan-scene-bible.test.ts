import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreativeBrief } from "../brief/types";
import type { Storyboard } from "../storyboard/types";

const generateScriptMock = vi.fn();
vi.mock("@/lib/generation/llm", () => ({
  generateScript: (...args: unknown[]) => generateScriptMock(...args),
}));

const { planSceneBible, SceneBibleError } = await import("./plan-scene-bible");

const commercialBrief: CreativeBrief = {
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

const storyboardNoReveal: Storyboard = {
  style: "commercial",
  narrativeArc: "A quiet morning ritual interrupted by delight, closing on a direct offer.",
  totalDurationSeconds: 16,
  scenes: [
    { sceneNumber: 1, purpose: "Hook", storyBeat: "An unexpected morning moment.", emotionalBeat: "Curiosity", durationSeconds: 8, transitionToNext: "Hard cut on the reveal" },
    { sceneNumber: 2, purpose: "Call to action", storyBeat: "The offer is made directly.", emotionalBeat: "Urgency", durationSeconds: 8, transitionToNext: null },
  ],
  heroShotSceneNumber: 1,
  logoRevealSceneNumber: null,
  ctaSceneNumber: 2,
};

function fullSceneEntry(sceneNumber: number) {
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

function fullGlobalDirection() {
  return {
    marketingGoal: "marketingGoal", marketingPsychology: "marketingPsychology",
    brandDna: "brandDna", creativeTheme: "creativeTheme", visualLanguage: "visualLanguage",
    lightingLanguage: "lightingLanguage", cameraLanguage: "cameraLanguage", editingLanguage: "editingLanguage",
    colorLanguage: "colorLanguage", environmentRules: ["rule"], productRules: ["rule"], characterRules: ["rule"],
    continuityRules: ["rule"], qualityRules: ["rule"],
  };
}

function fullSuccessDefinition() {
  return {
    viewerShouldFeel: "feel", viewerShouldRemember: "remember", viewerShouldDesire: "desire",
    primarySellingPoint: "primary", secondarySellingPoint: "secondary", brandRecallGoal: "recall",
  };
}

function fullHeroShot() {
  return { purpose: "purpose", marketingGoal: "marketingGoal", specialCreativeInstructions: "special", successCriteria: "success" };
}

function fullCta() {
  return { messageStyle: "messageStyle", viewerActionStyle: "viewerActionStyle", voiceOverStyle: "voiceOverStyle", screenTextStyle: "screenTextStyle" };
}

function mockLLMResponse(json: unknown) {
  generateScriptMock.mockResolvedValue({ text: JSON.stringify(json) });
}

describe("planSceneBible", () => {
  beforeEach(() => {
    generateScriptMock.mockReset();
  });

  it("builds a full Scene Bible with no logo reveal when the storyboard planned none", async () => {
    mockLLMResponse({
      globalDirection: fullGlobalDirection(),
      successDefinition: fullSuccessDefinition(),
      scenes: [fullSceneEntry(1), fullSceneEntry(2)],
      heroShot: fullHeroShot(),
      logoReveal: null,
      cta: fullCta(),
    });

    const bible = await planSceneBible(commercialBrief, storyboardNoReveal);

    expect(bible.style).toBe("commercial");
    expect(bible.scenes).toHaveLength(2);
    expect(bible.scenes.map((s) => s.sceneNumber)).toEqual([1, 2]);
    expect(bible.logoReveal).toBeNull();
    expect(bible.heroShot.specialCreativeInstructions).toBe("special");
    expect(bible.cta.messageStyle).toBe("messageStyle");
    expect(bible.globalDirection.marketingGoal).toBe("marketingGoal");
    expect(bible.globalDirection.marketingPsychology).toBe("marketingPsychology");
    expect(bible.successDefinition.brandRecallGoal).toBe("recall");
  });

  it("discards a hallucinated logo reveal when the storyboard planned none", async () => {
    mockLLMResponse({
      globalDirection: fullGlobalDirection(),
      successDefinition: fullSuccessDefinition(),
      scenes: [fullSceneEntry(1), fullSceneEntry(2)],
      heroShot: fullHeroShot(),
      logoReveal: { instruction: "fade in", animationStyle: "fade" },
      cta: fullCta(),
    });

    const bible = await planSceneBible(commercialBrief, storyboardNoReveal);

    expect(bible.logoReveal).toBeNull();
  });

  it("builds a logo reveal when the storyboard planned one", async () => {
    const revealStoryboard: Storyboard = { ...storyboardNoReveal, logoRevealSceneNumber: 2 };
    mockLLMResponse({
      globalDirection: fullGlobalDirection(),
      successDefinition: fullSuccessDefinition(),
      scenes: [fullSceneEntry(1), fullSceneEntry(2)],
      heroShot: fullHeroShot(),
      logoReveal: { instruction: "The logo fades in on the final frame", animationStyle: "Soft fade-in" },
      cta: fullCta(),
    });

    const bible = await planSceneBible(commercialBrief, revealStoryboard);

    expect(bible.logoReveal).toEqual({ instruction: "The logo fades in on the final frame", animationStyle: "Soft fade-in" });
  });

  it("throws when the storyboard plans a logo reveal but the Director provides none", async () => {
    const revealStoryboard: Storyboard = { ...storyboardNoReveal, logoRevealSceneNumber: 2 };
    mockLLMResponse({
      globalDirection: fullGlobalDirection(),
      successDefinition: fullSuccessDefinition(),
      scenes: [fullSceneEntry(1), fullSceneEntry(2)],
      heroShot: fullHeroShot(),
      logoReveal: null,
      cta: fullCta(),
    });

    await expect(planSceneBible(commercialBrief, revealStoryboard)).rejects.toThrow(SceneBibleError);
  });

  it("throws when brief and storyboard styles disagree", async () => {
    const filmStoryboard: Storyboard = { ...storyboardNoReveal, style: "film" };
    await expect(planSceneBible(commercialBrief, filmStoryboard)).rejects.toThrow(SceneBibleError);
  });

  it("throws when the LLM response isn't valid JSON", async () => {
    generateScriptMock.mockResolvedValue({ text: "not json" });
    await expect(planSceneBible(commercialBrief, storyboardNoReveal)).rejects.toThrow(SceneBibleError);
  });

  it("throws when the LLM response is missing required fields", async () => {
    mockLLMResponse({ scenes: [] });
    await expect(planSceneBible(commercialBrief, storyboardNoReveal)).rejects.toThrow(SceneBibleError);
  });

  it("throws when a storyboard scene has no matching Scene Bible entry", async () => {
    mockLLMResponse({
      globalDirection: fullGlobalDirection(),
      successDefinition: fullSuccessDefinition(),
      scenes: [fullSceneEntry(1)], // scene 2 missing
      heroShot: fullHeroShot(),
      logoReveal: null,
      cta: fullCta(),
    });

    await expect(planSceneBible(commercialBrief, storyboardNoReveal)).rejects.toThrow(SceneBibleError);
  });

  it("never fabricates brief facts that were null — the prompt omits offerDetails when absent, and marks role tags correctly", async () => {
    mockLLMResponse({
      globalDirection: fullGlobalDirection(),
      successDefinition: fullSuccessDefinition(),
      scenes: [fullSceneEntry(1), fullSceneEntry(2)],
      heroShot: fullHeroShot(),
      logoReveal: null,
      cta: fullCta(),
    });

    await planSceneBible(commercialBrief, storyboardNoReveal);

    const [request] = generateScriptMock.mock.calls[0];
    expect(request.prompt).not.toContain("Offer details:");
    expect(request.prompt).toContain("Order now at glowcandles.com");
    expect(request.prompt).toContain("Scene 1 [HERO SHOT]");
    expect(request.prompt).toContain("Scene 2 [CTA]");
    expect(request.prompt).toContain("no Logo Reveal scene planned");
  });
});
