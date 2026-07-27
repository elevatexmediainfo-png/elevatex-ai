import { describe, expect, it } from "vitest";
import type { CreativeBrief } from "../brief/types";
import type { Storyboard } from "../storyboard/types";
import type { SceneBible } from "../scene-bible/types";
import { compileCreativePlan, CreativeCompilerError } from "./compile-creative-plan";

const brief: CreativeBrief = {
  videoProjectId: "proj_1",
  contentLanguage: "EN",
  brand: {
    businessName: "Glow Candles",
    businessVertical: "RETAIL",
    city: "Mumbai",
    primaryColor: "#FFAA00",
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
    offerDetails: "20% off this week",
    callToAction: "Order now at glowcandles.com",
    tone: "FRIENDLY",
  },
};

const storyboard: Storyboard = {
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

function fullSceneEntry(sceneNumber: number, negativeInstructions: string): import("../scene-bible/types").SceneBibleEntry {
  return {
    sceneNumber,
    purpose: `purpose${sceneNumber}`,
    storyGoal: `storyGoal${sceneNumber}`,
    marketingGoal: `sceneMarketingGoal${sceneNumber}`,
    viewerEmotion: `viewerEmotion${sceneNumber}`,
    viewerPsychology: `viewerPsychology${sceneNumber}`,
    environment: "Cozy living room at dusk",
    location: `location${sceneNumber}`,
    weather: "N/A indoors",
    timeOfDay: "Dusk",
    characterBehaviour: `characterBehaviour${sceneNumber}`,
    expression: `expression${sceneNumber}`,
    wardrobe: `wardrobe${sceneNumber}`,
    props: `props${sceneNumber}`,
    productBehaviour: `productBehaviour${sceneNumber}`,
    camera: `camera${sceneNumber}`,
    lens: `lens${sceneNumber}`,
    cameraHeight: "Eye level",
    cameraDistance: `cameraDistance${sceneNumber}`,
    cameraMovement: `cameraMovement${sceneNumber}`,
    composition: `composition${sceneNumber}`,
    framing: `framing${sceneNumber}`,
    foreground: `foreground${sceneNumber}`,
    background: `background${sceneNumber}`,
    lighting: `lighting${sceneNumber}`,
    atmosphere: `atmosphere${sceneNumber}`,
    colorPalette: `colorPalette${sceneNumber}`,
    depthOfField: `depthOfField${sceneNumber}`,
    motion: `motion${sceneNumber}`,
    transition: `transition${sceneNumber}`,
    editingRhythm: `editingRhythm${sceneNumber}`,
    continuityNotes: `continuityNotes${sceneNumber}`,
    negativeInstructions,
    successCriteria: `successCriteria${sceneNumber}`,
  };
}

function makeSceneBible(overrides: Partial<SceneBible> = {}): SceneBible {
  return {
    style: "commercial",
    globalDirection: {
      marketingGoal: "Drive weekend sales",
      marketingPsychology: "Scarcity + warmth",
      brandDna: "Cozy, handmade, premium-affordable",
      creativeTheme: "Golden hour warmth",
      visualLanguage: "Warm, tactile, handheld",
      lightingLanguage: "Warm practicals",
      cameraLanguage: "Handheld, energetic",
      editingLanguage: "Fast cuts",
      colorLanguage: "Amber and cream palette",
      environmentRules: ["Indoors, cozy setting throughout."],
      productRules: ["Candle label must stay legible."],
      characterRules: ["Same host across every scene."],
      continuityRules: ["Same candle prop across every scene."],
      qualityRules: ["No visible production equipment."],
    },
    successDefinition: {
      viewerShouldFeel: "Cozy and delighted",
      viewerShouldRemember: "The amber glow",
      viewerShouldDesire: "Owning a candle for their own home",
      primarySellingPoint: "Handmade quality",
      secondarySellingPoint: "Limited-time 20% discount",
      brandRecallGoal: "Glow Candles = cozy evenings",
    },
    scenes: [
      fullSceneEntry(1, "No logo or watermark visible anywhere in frame."),
      fullSceneEntry(2, "No logo or watermark visible anywhere in frame."),
    ],
    heroShot: {
      purpose: "Show the candle glowing in hand",
      marketingGoal: "Make the product desirable",
      specialCreativeInstructions: "Hold on the flame flicker one beat longer than expected",
      successCriteria: "Viewer wants to hold the candle",
    },
    logoReveal: null,
    cta: {
      messageStyle: "Warm and direct, no hard sell",
      viewerActionStyle: "A friendly nudge, not a demand",
      voiceOverStyle: "Warm, mid-paced, conversational",
      screenTextStyle: "Bold, minimal, high-contrast",
    },
    ...overrides,
  };
}

describe("compileCreativePlan", () => {
  it("compiles a full plan, preserving every field and folding the right content into the right scene", () => {
    const plan = compileCreativePlan({ brief, storyboard, sceneBible: makeSceneBible() });

    expect(plan.videoProjectId).toBe("proj_1");
    expect(plan.scenes).toHaveLength(2);
    expect(plan.heroShotSceneNumber).toBe(1);
    expect(plan.logoRevealSceneNumber).toBeNull();
    expect(plan.ctaSceneNumber).toBe(2);

    const scene1 = plan.scenes[0];
    const scene2 = plan.scenes[1];

    // Hero shot fields only fold into scene 1 (the Storyboard's placement).
    expect(scene1.renderPrompt).toContain("Make the product desirable");
    expect(scene2.renderPrompt).not.toContain("Make the product desirable");

    // Non-reveal scenes get the negative logo/watermark exclusion, both the
    // deterministic guardrail and the Director's own negativeInstructions.
    expect(scene1.renderPrompt).toContain("No logo or watermark should appear in this shot.");
    expect(scene1.renderPrompt).toContain("No logo or watermark visible anywhere in frame.");

    // CTA scene gets the literal Creative Brief wording plus the Director's style guidance.
    expect(scene2.renderPrompt).toContain("Order now at glowcandles.com");
    expect(scene2.renderPrompt).toContain("Warm and direct, no hard sell");
    expect(scene1.renderPrompt).not.toContain("Warm and direct, no hard sell");

    // Global continuity/rules reach every scene.
    expect(scene1.renderPrompt).toContain("Same candle prop across every scene.");
    expect(scene2.renderPrompt).toContain("Same candle prop across every scene.");

    // New Scene Bible fields (renamed/added since the placeholder schema) really flow through.
    expect(scene1.renderPrompt).toContain("location1");
    expect(scene1.renderPrompt).toContain("cameraMovement1");
    expect(scene1.renderPrompt).toContain("atmosphere1");
    expect(scene1.renderPrompt).toContain("continuityNotes1");
    expect(scene1.renderPrompt).toContain("viewerPsychology1");

    // Abstract strategic fields are preserved wholesale, not stripped, even
    // though they aren't injected into the visual renderPrompt text.
    expect(plan.globalDirection.marketingPsychology).toBe("Scarcity + warmth");
    expect(plan.successDefinition.brandRecallGoal).toBe("Glow Candles = cozy evenings");
    expect(plan.brief).toBe(brief);
  });

  it("uses each scene's own colorPalette (no more global colorLanguage override mechanism)", () => {
    const plan = compileCreativePlan({ brief, storyboard, sceneBible: makeSceneBible() });
    expect(plan.scenes[0].renderPrompt).toContain("colorPalette1");
  });

  it("folds the intentional logo reveal instruction into its scene instead of the negative exclusion", () => {
    const revealStoryboard: Storyboard = { ...storyboard, logoRevealSceneNumber: 2 };
    const sceneBible = makeSceneBible({
      logoReveal: { instruction: "The logo fades in on the final frame", animationStyle: "Soft fade-in" },
    });

    const plan = compileCreativePlan({ brief, storyboard: revealStoryboard, sceneBible });

    expect(plan.scenes[1].renderPrompt).toContain("The logo fades in on the final frame");
    expect(plan.scenes[1].renderPrompt).toContain("Soft fade-in");
    expect(plan.scenes[1].renderPrompt).not.toContain("No logo or watermark should appear in this shot.");
    expect(plan.scenes[0].renderPrompt).toContain("No logo or watermark should appear in this shot.");
  });

  it("throws when brief/storyboard/sceneBible styles disagree", () => {
    const filmStoryboard: Storyboard = { ...storyboard, style: "film" };
    expect(() => compileCreativePlan({ brief, storyboard: filmStoryboard, sceneBible: makeSceneBible() })).toThrow(CreativeCompilerError);
  });

  it("throws when a storyboard scene has no matching Scene Bible entry", () => {
    const sceneBible = makeSceneBible();
    sceneBible.scenes = [sceneBible.scenes[0]];
    expect(() => compileCreativePlan({ brief, storyboard, sceneBible })).toThrow(CreativeCompilerError);
  });

  it("throws when the Storyboard's Hero Shot references a scene that doesn't exist", () => {
    const badStoryboard: Storyboard = { ...storyboard, heroShotSceneNumber: 99 };
    expect(() => compileCreativePlan({ brief, storyboard: badStoryboard, sceneBible: makeSceneBible() })).toThrow(CreativeCompilerError);
  });

  it("throws when the Storyboard's Logo Reveal references a scene that doesn't exist", () => {
    const badStoryboard: Storyboard = { ...storyboard, logoRevealSceneNumber: 99 };
    const sceneBible = makeSceneBible({ logoReveal: { instruction: "fade in", animationStyle: "fade" } });
    expect(() => compileCreativePlan({ brief, storyboard: badStoryboard, sceneBible })).toThrow(CreativeCompilerError);
  });

  it("throws when the Storyboard's CTA references a scene that doesn't exist", () => {
    const badStoryboard: Storyboard = { ...storyboard, ctaSceneNumber: 99 };
    expect(() => compileCreativePlan({ brief, storyboard: badStoryboard, sceneBible: makeSceneBible() })).toThrow(CreativeCompilerError);
  });

  it("throws when the Storyboard plans a logo reveal but the Scene Bible doesn't enrich one", () => {
    const revealStoryboard: Storyboard = { ...storyboard, logoRevealSceneNumber: 2 };
    expect(() => compileCreativePlan({ brief, storyboard: revealStoryboard, sceneBible: makeSceneBible() })).toThrow(CreativeCompilerError);
  });

  it("throws when the Scene Bible enriches a logo reveal the Storyboard never planned", () => {
    const sceneBible = makeSceneBible({ logoReveal: { instruction: "fade in", animationStyle: "fade" } });
    expect(() => compileCreativePlan({ brief, storyboard, sceneBible })).toThrow(CreativeCompilerError);
  });

  it("folds whatever the Creative Brief's literal CTA wording actually is into the compiled CTA scene", () => {
    const differentBrief: CreativeBrief = {
      ...brief,
      content: { style: "commercial", objective: "PROMOTION", productOrService: "Handmade candles", keyMessage: "Light up your evenings", offerDetails: null, callToAction: "Visit us this weekend only", tone: "FRIENDLY" },
    };
    const plan = compileCreativePlan({ brief: differentBrief, storyboard, sceneBible: makeSceneBible() });
    expect(plan.scenes[1].renderPrompt).toContain("Visit us this weekend only");
  });

  it("doesn't force any literal CTA text when the Creative Brief has none", () => {
    const noCtaBrief: CreativeBrief = {
      ...brief,
      content: { style: "commercial", objective: "PROMOTION", productOrService: "Handmade candles", keyMessage: "Light up your evenings", offerDetails: null, callToAction: null, tone: "FRIENDLY" },
    };
    expect(() => compileCreativePlan({ brief: noCtaBrief, storyboard, sceneBible: makeSceneBible() })).not.toThrow();
  });
});
