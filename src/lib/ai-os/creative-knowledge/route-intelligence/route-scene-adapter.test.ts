import { describe, expect, it } from "vitest";

import { applyRouteToScene } from "./route-scene-adapter";
import type { VisualScenePlan } from "../../scene-planner/types";
import type { CreativeRoute } from "../../creative-route-engine/types";

// ── Minimal fixture builders ────────────────────────────────────────────────

function sf(value: string, confidence = "high" as const) {
  return { value, confidence, reasoning: "test" };
}

function minimalScene(): VisualScenePlan {
  return {
    sceneObjective: {
      scenePurpose:    sf("Drive awareness for restaurant"),
      emotionalGoal:   sf("aspiration_and_desire"),
      marketingGoal:   sf("unknown"),
      primaryUserAction: sf("unknown"),
    },
    heroSubject: {
      exactHeroSubject: sf("A chef plating food"),
      heroPose:         sf("mid_action"),
      heroExpression:   sf("focused_expertise"),
      heroScale:        sf("two_thirds_dominant"),
      heroPosition:     sf("left_third"),
      heroImportance:   sf("the_entire_message"),
    },
    supportingSubjects: {
      supportingSubjects: sf("unknown"),
      subjectRelationships: sf("contextual_background"),
      interactionLogic:   sf("unknown"),
      relativeScale:      sf("hero_dominant_others_small"),
    },
    environment: {
      environmentType:      sf("professional_studio"),
      backgroundStory:      sf("unknown"),
      foreground:           sf("unknown"),
      midground:            sf("unknown"),
      background:           sf("unknown"),
      environmentalDetails: sf("unknown"),
    },
    objects: {
      requiredObjects:    sf("unknown"),
      optionalObjects:    sf("unknown"),
      decorativeObjects:  sf("unknown"),
      trustObjects:       sf("unknown"),
      educationalObjects: sf("unknown"),
      brandObjects:       sf("unknown"),
      objectsToExclude:   sf("unknown"),
    },
    composition: {
      primaryComposition:    sf("rule_of_thirds"),
      secondaryComposition:  sf("unknown"),
      visualBalance:         sf("center_weighted"),
      symmetry:              sf("deliberate_asymmetry"),
      negativeSpace:         sf("unknown"),
      depthLayers:           sf("unknown"),
      eyeFlow:               sf("unknown"),
    },
    camera: {
      cameraPosition:    sf("unknown"),
      focalLength:       sf("unknown"),
      depthOfField:      sf("unknown"),
      perspective:       sf("unknown"),
      cameraHeight:      sf("eye_level"),
      cameraAngle:       sf("unknown"),
    },
    lighting: {
      moodLighting:    sf("soft_natural"),
      lightDirection:  sf("unknown"),
      shadowType:      sf("unknown"),
      highlights:      sf("unknown"),
      colorTemperature: sf("unknown"),
    },
    storytelling: {
      beginning:              sf("unknown"),
      middle:                 sf("unknown"),
      end:                    sf("unknown"),
      singleFrameNarrative:   sf("unknown"),
      emotionalArc:           sf("unknown"),
      visualMetaphor:         sf("unknown"),
    },
    renderingIntent: {
      renderStyle:     sf("photorealistic"),
      qualityTarget:   sf("unknown"),
      postProcessing:  sf("unknown"),
      colorGrading:    sf("unknown"),
    },
  } as unknown as VisualScenePlan;
}

function minimalRoute(overrides?: Partial<CreativeRoute>): CreativeRoute {
  return {
    id:             "test_route",
    title:          "Test Route",
    industryId:     "restaurant",
    hero:           "A chef in full whites at the pass",
    heroType:       "human_chef",
    composition:    "Tight frame isolating craftsmanship",
    photography:    "85mm f/1.4, warm rim light",
    layout:         "Full bleed hero with text over blurred zone",
    marketing:      "Establish chef credibility to drive bookings",
    emotion:        "Pride and aspiration",
    productionNote: "Shoot in actual kitchen to convey authenticity",
    bestFor:        ["awareness"],
    notFor:         [],
    baseScore:      80,
    ...overrides,
  };
}

// ── Free-text field augmentation ─────────────────────────────────────────────

describe("applyRouteToScene — free-text field augmentation", () => {
  it("appends route.hero to heroSubject.exactHeroSubject", () => {
    const scene  = minimalScene();
    const route  = minimalRoute();
    const result = applyRouteToScene(scene, route);
    expect(result.heroSubject.exactHeroSubject.value).toContain(route.hero);
    expect(result.heroSubject.exactHeroSubject.value).toContain(scene.heroSubject.exactHeroSubject.value);
  });

  it("appends route.marketing to sceneObjective.scenePurpose", () => {
    const result = applyRouteToScene(minimalScene(), minimalRoute());
    expect(result.sceneObjective.scenePurpose.value).toContain("Establish chef credibility");
  });

  it("appends route.composition to composition.secondaryComposition", () => {
    const result = applyRouteToScene(minimalScene(), minimalRoute());
    expect(result.composition.secondaryComposition.value).toContain("Tight frame");
  });

  it("appends route.photography to camera.cameraPosition", () => {
    const result = applyRouteToScene(minimalScene(), minimalRoute());
    expect(result.camera.cameraPosition.value).toContain("85mm");
  });

  it("appends route.layout to camera.perspective", () => {
    const result = applyRouteToScene(minimalScene(), minimalRoute());
    expect(result.camera.perspective.value).toContain("Full bleed hero");
  });

  it("appends route.productionNote to environment.environmentalDetails", () => {
    const result = applyRouteToScene(minimalScene(), minimalRoute());
    expect(result.environment.environmentalDetails.value).toContain("Shoot in actual kitchen");
  });

  it("appends route.emotion to storytelling.singleFrameNarrative", () => {
    const result = applyRouteToScene(minimalScene(), minimalRoute());
    expect(result.storytelling.singleFrameNarrative.value).toContain("Pride and aspiration");
  });

  it("appends route.emotion to storytelling.emotionalArc", () => {
    const result = applyRouteToScene(minimalScene(), minimalRoute());
    expect(result.storytelling.emotionalArc.value).toContain("Pride and aspiration");
  });

  it("appends route.layout to storytelling.middle", () => {
    const result = applyRouteToScene(minimalScene(), minimalRoute());
    expect(result.storytelling.middle.value).toContain("Full bleed hero");
  });
});

// ── Enum-constrained fields untouched ────────────────────────────────────────

describe("applyRouteToScene — enum-constrained fields are not modified", () => {
  it("primaryComposition is unchanged", () => {
    const scene  = minimalScene();
    const result = applyRouteToScene(scene, minimalRoute());
    expect(result.composition.primaryComposition.value).toBe(scene.composition.primaryComposition.value);
  });

  it("heroPose is unchanged", () => {
    const scene  = minimalScene();
    const result = applyRouteToScene(scene, minimalRoute());
    expect(result.heroSubject.heroPose.value).toBe(scene.heroSubject.heroPose.value);
  });

  it("emotionalGoal is unchanged", () => {
    const scene  = minimalScene();
    const result = applyRouteToScene(scene, minimalRoute());
    expect(result.sceneObjective.emotionalGoal.value).toBe(scene.sceneObjective.emotionalGoal.value);
  });

  it("cameraHeight is unchanged", () => {
    const scene  = minimalScene();
    const result = applyRouteToScene(scene, minimalRoute());
    expect(result.camera.cameraHeight.value).toBe(scene.camera.cameraHeight.value);
  });

  it("moodLighting is unchanged", () => {
    const scene  = minimalScene();
    const result = applyRouteToScene(scene, minimalRoute());
    expect(result.lighting.moodLighting.value).toBe(scene.lighting.moodLighting.value);
  });
});

// ── Empty / unknown directive → no-op ────────────────────────────────────────

describe("applyRouteToScene — empty or unknown directives are skipped", () => {
  it("does not augment when directive is empty string", () => {
    const scene  = minimalScene();
    const route  = minimalRoute({ marketing: "" });
    const result = applyRouteToScene(scene, route);
    expect(result.sceneObjective.scenePurpose.value).toBe(scene.sceneObjective.scenePurpose.value);
  });

  it("does not augment when directive is 'unknown'", () => {
    const scene  = minimalScene();
    const route  = minimalRoute({ marketing: "unknown" });
    const result = applyRouteToScene(scene, route);
    expect(result.sceneObjective.scenePurpose.value).toBe(scene.sceneObjective.scenePurpose.value);
  });

  it("uses directive alone when field value is 'unknown'", () => {
    const scene  = minimalScene();
    scene.composition.secondaryComposition = sf("unknown");
    const route  = minimalRoute({ composition: "Leading diagonal" });
    const result = applyRouteToScene(scene, route);
    expect(result.composition.secondaryComposition.value).toBe("Leading diagonal");
  });
});

// ── Immutability ─────────────────────────────────────────────────────────────

describe("applyRouteToScene — immutability", () => {
  it("does not mutate the original scene plan", () => {
    const scene        = minimalScene();
    const originalHero = scene.heroSubject.exactHeroSubject.value;
    applyRouteToScene(scene, minimalRoute());
    expect(scene.heroSubject.exactHeroSubject.value).toBe(originalHero);
  });

  it("returns a new object reference", () => {
    const scene  = minimalScene();
    const result = applyRouteToScene(scene, minimalRoute());
    expect(result).not.toBe(scene);
  });
});

// ── Separator format ─────────────────────────────────────────────────────────

describe("applyRouteToScene — merge separator", () => {
  it("separates existing value and directive with '. '", () => {
    const scene  = minimalScene();
    const route  = minimalRoute({ hero: "Close-up of hands" });
    const result = applyRouteToScene(scene, route);
    // existing value + ". " + directive
    expect(result.heroSubject.exactHeroSubject.value).toBe(
      `${scene.heroSubject.exactHeroSubject.value}. Close-up of hands`,
    );
  });
});
