import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreativeBrief } from "../brief/types";

const generateScriptMock = vi.fn();
vi.mock("@/lib/generation/llm", () => ({
  generateScript: (...args: unknown[]) => generateScriptMock(...args),
}));

const { planStoryboard, StoryboardError } = await import("./plan-storyboard");

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
    callToAction: "Order now",
    tone: "FRIENDLY",
  },
};

const filmBrief: CreativeBrief = {
  videoProjectId: "proj_2",
  contentLanguage: "HINGLISH",
  brand: {
    businessName: "Chai Point",
    businessVertical: "FOOD_BEVERAGE",
    city: "Delhi",
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
    style: "film",
    idea: "A chai seller's morning routine turns into a heartwarming ad.",
    filmStyle: "CINEMATIC",
    totalDurationSeconds: 20,
    characterCount: 2,
  },
};

function mockLLMResponse(json: unknown) {
  generateScriptMock.mockResolvedValue({ text: JSON.stringify(json) });
}

describe("planStoryboard", () => {
  beforeEach(() => {
    generateScriptMock.mockReset();
  });

  it("builds a commercial storyboard, deriving totalDurationSeconds from the scenes since none was given", async () => {
    mockLLMResponse({
      narrativeArc: "A quiet morning ritual interrupted by delight, closing on a direct offer.",
      scenes: [
        { sceneNumber: 1, purpose: "Hook", storyBeat: "An unexpected morning moment.", emotionalBeat: "Curiosity", durationSeconds: 8, transitionToNext: "Hard cut on the reveal" },
        { sceneNumber: 2, purpose: "Call to action", storyBeat: "The offer is made directly.", emotionalBeat: "Urgency", durationSeconds: 8, transitionToNext: null },
      ],
      heroShotSceneNumber: 1,
      logoRevealSceneNumber: null,
      ctaSceneNumber: 2,
    });

    const storyboard = await planStoryboard(commercialBrief);

    expect(storyboard.style).toBe("commercial");
    expect(storyboard.totalDurationSeconds).toBe(16);
    expect(storyboard.scenes).toHaveLength(2);
    expect(storyboard.heroShotSceneNumber).toBe(1);
    expect(storyboard.logoRevealSceneNumber).toBeNull();
    expect(storyboard.ctaSceneNumber).toBe(2);
  });

  it("never fabricates brief facts that were null — the prompt omits offerDetails when absent", async () => {
    mockLLMResponse({
      narrativeArc: "arc",
      scenes: [{ sceneNumber: 1, purpose: "Hook", storyBeat: "beat", emotionalBeat: "joy", durationSeconds: 8, transitionToNext: null }],
      heroShotSceneNumber: 1,
      logoRevealSceneNumber: null,
      ctaSceneNumber: 1,
    });

    await planStoryboard(commercialBrief);

    const [request] = generateScriptMock.mock.calls[0];
    expect(request.prompt).not.toContain("Offer details:");
    expect(request.prompt).toContain("Order now");
  });

  it("rescales a film storyboard's scene durations to exactly match the brief's already-fixed total", async () => {
    mockLLMResponse({
      narrativeArc: "A chai seller's routine becomes a heartfelt ad.",
      scenes: [
        { sceneNumber: 1, purpose: "Hook", storyBeat: "beat1", emotionalBeat: "warmth", durationSeconds: 3, transitionToNext: "cut" },
        { sceneNumber: 2, purpose: "Context", storyBeat: "beat2", emotionalBeat: "connection", durationSeconds: 3, transitionToNext: "cut" },
        { sceneNumber: 3, purpose: "Call to action", storyBeat: "beat3", emotionalBeat: "hope", durationSeconds: 3, transitionToNext: null },
      ], // sums to 9, not the fixed 20
      heroShotSceneNumber: 2,
      logoRevealSceneNumber: 3,
      ctaSceneNumber: 3,
    });

    const storyboard = await planStoryboard(filmBrief);

    expect(storyboard.totalDurationSeconds).toBe(20);
    const sum = storyboard.scenes.reduce((s, scene) => s + scene.durationSeconds, 0);
    expect(sum).toBe(20);
  });

  it("throws when the LLM response isn't valid JSON", async () => {
    generateScriptMock.mockResolvedValue({ text: "not json" });
    await expect(planStoryboard(commercialBrief)).rejects.toThrow(StoryboardError);
  });

  it("throws when the LLM response is missing required fields", async () => {
    mockLLMResponse({ scenes: [] });
    await expect(planStoryboard(commercialBrief)).rejects.toThrow(StoryboardError);
  });

  it("throws when heroShotSceneNumber references a scene that doesn't exist", async () => {
    mockLLMResponse({
      narrativeArc: "arc",
      scenes: [{ sceneNumber: 1, purpose: "Hook", storyBeat: "beat", emotionalBeat: "joy", durationSeconds: 8, transitionToNext: null }],
      heroShotSceneNumber: 99,
      logoRevealSceneNumber: null,
      ctaSceneNumber: 1,
    });
    await expect(planStoryboard(commercialBrief)).rejects.toThrow(StoryboardError);
  });

  it("throws when logoRevealSceneNumber references a scene that doesn't exist", async () => {
    mockLLMResponse({
      narrativeArc: "arc",
      scenes: [{ sceneNumber: 1, purpose: "Hook", storyBeat: "beat", emotionalBeat: "joy", durationSeconds: 8, transitionToNext: null }],
      heroShotSceneNumber: 1,
      logoRevealSceneNumber: 99,
      ctaSceneNumber: 1,
    });
    await expect(planStoryboard(commercialBrief)).rejects.toThrow(StoryboardError);
  });

  it("throws when ctaSceneNumber references a scene that doesn't exist", async () => {
    mockLLMResponse({
      narrativeArc: "arc",
      scenes: [{ sceneNumber: 1, purpose: "Hook", storyBeat: "beat", emotionalBeat: "joy", durationSeconds: 8, transitionToNext: null }],
      heroShotSceneNumber: 1,
      logoRevealSceneNumber: null,
      ctaSceneNumber: 99,
    });
    await expect(planStoryboard(commercialBrief)).rejects.toThrow(StoryboardError);
  });
});
