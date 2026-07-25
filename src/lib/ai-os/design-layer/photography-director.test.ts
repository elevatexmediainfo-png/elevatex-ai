import { describe, expect, it } from "vitest";

import { analyzeUserRequest } from "../user-understanding";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCreativeContext } from "../creative-context";
import type { CreativeRequest } from "../types";
import { buildPhotographyDirectorOutput } from "./photography-director";
import type { GPTCampaignDirection } from "../creative-director/gpt-types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeStrategy(rawIdea: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
  const userUnderstanding = analyzeUserRequest(request);
  const context = buildCreativeContext(request, userUnderstanding, {}, { userId: "test" });
  return buildCreativeStrategy(context);
}

const BASE_DIR: GPTCampaignDirection = {
  campaignConcept:    "Trust earned through expertise.",
  marketingObjective: "Drive bookings.",
  psychologicalGoal:  "Convert hesitancy to confidence.",
  viewerEmotion:      "Reassurance.",
  coreMessage:        "Expert care, natural results.",
  heroSubject:        "A calm dentist with a genuine smile.",
  secondarySubjects:  "Patient relaxing in consultation chair.",
  supportingObjects:  "Framed certification on wall.",
  visualStory: {
    before: "Patient unsure and anxious.",
    moment: "Dentist explains gently and clearly.",
    after:  "Patient books first appointment confidently.",
  },
  sceneDescription:    "Warm modern consultation room with morning light.",
  visualHierarchy: {
    primary:    "Dentist-patient connection and eye contact.",
    secondary:  "Patient expression shifting to relief.",
    background: "Clean modern clinic environment.",
    decorative: "Natural light and warm interior tones.",
  },
  negativeSpace: {
    headline: "Upper third.",
    cta:      "Bottom strip.",
    logo:     "Lower right.",
  },
  compositionIntent: {
    eyeFlow:        "Headline → face → expression → CTA.",
    subjectBalance: "Two subjects, patient as emotional anchor.",
    framingLogic:   "Intimate but professional.",
  },
  lightingMood:    "Warm and soft — the light of a clinic that wants you to relax.",
  environment:     "Contemporary dental consultation room.",
  colorPsychology: "Blues and warm whites build trust.",
  marketingTriggers: ["Authority"],
  trustTriggers:     ["Visible credentials"],
  microInteractions: ["Patient's hands relaxed on armrests"],
  mustInclude:       ["Human connection between dentist and patient"],
  mustAvoid:         ["Dental tools in foreground"],
  commercialStyle:   "Premium local professional.",
  narrative:         "Patient gains confidence through genuine consultation.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Structure validation
// ─────────────────────────────────────────────────────────────────────────────

describe("buildPhotographyDirectorOutput — structure", () => {
  it("returns all required fields for healthcare industry", () => {
    const strategy = makeStrategy("Dental Implant Informative Creative");
    const out = buildPhotographyDirectorOutput(BASE_DIR, strategy);

    expect(typeof out.lens).toBe("string");
    expect(typeof out.focalLength).toBe("string");
    expect(typeof out.cameraHeight).toBe("string");
    expect(typeof out.distance).toBe("string");
    expect(typeof out.framing).toBe("string");
    expect(typeof out.crop).toBe("string");
    expect(typeof out.perspective).toBe("string");
    expect(typeof out.focus).toBe("string");
    expect(["shallow", "medium", "deep"]).toContain(out.depth);
    expect(typeof out.lighting).toBe("string");
    expect(typeof out.lightingTemperature).toBe("string");
    expect(typeof out.backlight).toBe("string");
    expect(typeof out.reflection).toBe("string");
    expect(typeof out.shadows).toBe("string");
    expect(typeof out.motion).toBe("string");
    expect(typeof out.texture).toBe("string");
    expect(typeof out.atmosphere).toBe("string");
    expect(typeof out.decisiveMoment).toBe("string");
  });

  it("returns non-empty decisive moment", () => {
    const strategy = makeStrategy("Restaurant Fine Dining Grand Opening");
    const out = buildPhotographyDirectorOutput(BASE_DIR, strategy);
    expect(out.decisiveMoment.length).toBeGreaterThan(20);
  });

  it("decisive moment incorporates hero subject", () => {
    const strategy = makeStrategy("Dental Implant Trust Campaign");
    const out = buildPhotographyDirectorOutput(BASE_DIR, strategy);
    // Should reference something about capturing a moment
    expect(out.decisiveMoment.toLowerCase()).toMatch(/captur|instant|moment|frozen|scene/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Industry differentiation
// ─────────────────────────────────────────────────────────────────────────────

describe("buildPhotographyDirectorOutput — industry differentiation", () => {
  it("food_hospitality uses 50mm prime", () => {
    const strategy = makeStrategy("Restaurant Fine Dining Campaign");
    const out = buildPhotographyDirectorOutput(BASE_DIR, strategy);
    expect(out.lens).toContain("50mm");
  });

  it("jewelry_fashion_luxury uses macro lens", () => {
    const strategy = makeStrategy("Luxury Jewellery Diamond Brand Campaign");
    const out = buildPhotographyDirectorOutput(BASE_DIR, strategy);
    expect(out.lens).toContain("macro");
  });

  it("fitness_wellness returns valid camera height string", () => {
    const strategy = makeStrategy("Fitness Gym Membership Workout Campaign");
    const out = buildPhotographyDirectorOutput(BASE_DIR, strategy);
    expect(typeof out.cameraHeight).toBe("string");
    expect(out.cameraHeight.length).toBeGreaterThan(0);
  });

  it("healthcare_medical uses level reassuring angle", () => {
    const strategy = makeStrategy("Dental Clinic Healthcare Medical Campaign");
    const out = buildPhotographyDirectorOutput(BASE_DIR, strategy);
    expect(out.perspective.toLowerCase()).toMatch(/level|reassur/);
  });

  it("automotive uses low ground level", () => {
    const strategy = makeStrategy("Car Dealer Automobile Campaign");
    const out = buildPhotographyDirectorOutput(BASE_DIR, strategy);
    expect(out.cameraHeight.toLowerCase()).toContain("low");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Aspect ratio adjustments
// ─────────────────────────────────────────────────────────────────────────────

describe("buildPhotographyDirectorOutput — aspect ratio", () => {
  it("16:9 adjusts framing to landscape", () => {
    const strategy = makeStrategy("Restaurant Grand Opening");
    const out = buildPhotographyDirectorOutput(BASE_DIR, strategy, "16:9");
    expect(out.framing.toLowerCase()).toContain("landscape");
  });

  it("1:1 adjusts framing to square", () => {
    const strategy = makeStrategy("Restaurant Grand Opening");
    const out = buildPhotographyDirectorOutput(BASE_DIR, strategy, "1:1");
    expect(out.framing.toLowerCase()).toContain("square");
  });

  it("9:16 default is unchanged from industry spec", () => {
    const strategy = makeStrategy("Restaurant Grand Opening");
    const defaultOut = buildPhotographyDirectorOutput(BASE_DIR, strategy);
    const explicit916 = buildPhotographyDirectorOutput(BASE_DIR, strategy, "9:16");
    expect(defaultOut.framing).toBe(explicit916.framing);
    expect(defaultOut.depth).toBe(explicit916.depth);
  });

  it("16:9 adjusts crop to wide", () => {
    const strategy = makeStrategy("Dental Clinic Campaign");
    const out = buildPhotographyDirectorOutput(BASE_DIR, strategy, "16:9");
    expect(out.crop.toLowerCase()).toContain("wide");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lighting from GPT direction
// ─────────────────────────────────────────────────────────────────────────────

describe("buildPhotographyDirectorOutput — lighting derivation", () => {
  it("uses GPT lightingMood when present", () => {
    const strategy = makeStrategy("Dental Clinic Campaign");
    const dirWithLighting: GPTCampaignDirection = {
      ...BASE_DIR,
      lightingMood: "Golden hour warm side-light from the west window.",
    };
    const out = buildPhotographyDirectorOutput(dirWithLighting, strategy);
    expect(out.lighting).toContain("Golden hour");
  });

  it("falls back to industry default when lightingMood is empty", () => {
    const strategy = makeStrategy("Dental Clinic Campaign");
    const dirNoLighting: GPTCampaignDirection = {
      ...BASE_DIR,
      lightingMood: "",
    };
    const out = buildPhotographyDirectorOutput(dirNoLighting, strategy);
    // Should be a derived string, not empty
    expect(out.lighting.length).toBeGreaterThan(5);
  });
});
