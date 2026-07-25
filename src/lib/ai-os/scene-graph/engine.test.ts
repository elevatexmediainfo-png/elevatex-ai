import { describe, expect, it } from "vitest";

import { buildSceneGraph } from "./engine";
import { buildPoseGraph } from "./builders/pose";
import { buildMicroMotionGraph } from "./builders/micro-motion";
import type { KnowledgeSignal } from "./knowledge-bridge";
import { safeInheritedText, looksLikeLayoutOrCopyInstruction } from "./sanitize";
import { assembleBlueprint } from "../blueprint";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCampaignPlan } from "../creative-director";
import { buildVisualLayoutPlan } from "../visual-layout";
import { buildTypographyPlan } from "../typography";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import { buildVisualScenePlan } from "../scene-planner/engine";
import type { CreativeRequest } from "../types";
import type { UniversalCampaignBlueprint } from "../blueprint/types";
import type { VisualScenePlan } from "../scene-planner/types";

// Phase 10.6B — Scene Graph Compiler unit tests.

function makeBlueprintAndScene(rawIdea: string): { blueprint: UniversalCampaignBlueprint; scene: VisualScenePlan } {
  const request: CreativeRequest = { userId: "test", rawIdea, kind: "SOCIAL_MEDIA", presetKey: "instagram_post", requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const plan = buildCampaignPlan(strategy);
  const layout = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  const blueprint = assembleBlueprint({ context: ctx, strategy, campaignPlan: plan, layoutPlan: layout, typographyPlan: typography });
  const scene = buildVisualScenePlan(blueprint);
  return { blueprint, scene };
}

const AUDIT_NAMED_GAPS: Array<[string, (g: ReturnType<typeof buildSceneGraph>) => { value: string }]> = [
  ["Body orientation (torsoRotation)", (g) => g.body.torsoRotation],
  ["Head direction",                   (g) => g.body.headDirection],
  ["Eye direction",                    (g) => g.body.eyeDirection],
  ["Hand position",                    (g) => g.body.handPosition],
  ["Object contact",                   (g) => g.objectContact.primaryContact],
  ["Subject count",                    (g) => g.who.subjectCount],
  ["Architecture",                     (g) => g.where.architecture],
  ["Occlusion",                        (g) => g.camera.occlusion],
  ["Micro motion",                     (g) => g.microMotion.elements],
  ["Temporal instant",                 (g) => g.microMotion.temporalInstant],
];

describe("Phase 10.6B — Scene Graph Compiler", () => {
  it("closes all ten Phase 10.5C audit-named gaps with a non-unknown value", () => {
    const { blueprint, scene } = makeBlueprintAndScene("Fine dining restaurant Grand Opening Celebration");
    const graph = buildSceneGraph(blueprint, scene);
    for (const [name, getter] of AUDIT_NAMED_GAPS) {
      expect(getter(graph).value, `${name} should not be "unknown"`).not.toBe("unknown");
      expect(getter(graph).value.length, `${name} should not be empty`).toBeGreaterThan(0);
    }
  });

  it("is deterministic — same blueprint + scene always produce an identical graph", () => {
    const { blueprint, scene } = makeBlueprintAndScene("Luxury jewellery house New Collection Launch");
    const a = buildSceneGraph(blueprint, scene);
    const b = buildSceneGraph(blueprint, scene);
    expect(a).toEqual(b);
  });

  it("produces a completeness score well above the Phase 10.5C 64.5 baseline", () => {
    const { blueprint, scene } = makeBlueprintAndScene("Dental implant clinic New Patient Special Offer");
    const graph = buildSceneGraph(blueprint, scene);
    expect(graph.meta.completenessScore).toBeGreaterThan(64.5);
    expect(graph.meta.completenessScore).toBeGreaterThanOrEqual(90);
  });

  it("uses not_applicable (a confident answer) rather than unknown for legitimately absent dimensions", () => {
    const { blueprint, scene } = makeBlueprintAndScene("Dental implant clinic New Patient Special Offer");
    const graph = buildSceneGraph(blueprint, scene);
    // A dental clinic campaign carries no animal/vehicle keyword — both fields
    // must resolve to a confident "not_applicable", never a bare "unknown".
    expect(graph.who.animals.value).toBe("not_applicable");
    expect(graph.who.vehicles.value).toBe("not_applicable");
  });

  it("produces genuinely different narratives for different campaigns (not a static template)", () => {
    const { blueprint: bp1, scene: s1 } = makeBlueprintAndScene("Fine dining restaurant Grand Opening Celebration");
    const { blueprint: bp2, scene: s2 } = makeBlueprintAndScene("Casual neighbourhood bistro Weekend Special Offer");
    const g1 = buildSceneGraph(bp1, s1);
    const g2 = buildSceneGraph(bp2, s2);
    expect(g1.narrative).not.toBe(g2.narrative);
    expect(g1.body.handPosition.value).not.toBe(g2.body.handPosition.value);
  });

  it("does not degrade into a per-(industry x tier) static lookup: ten restaurant campaigns at the same luxury tier render at least 5 distinct materials sentences", () => {
    const niches = [
      "fine dining French restaurant", "rooftop restaurant", "wine bar", "artisan pizzeria", "seafood restaurant",
      "premium steakhouse", "sushi bar", "gourmet food truck", "cozy cafe", "vegan restaurant",
    ];
    const graphs = niches.map((n) => {
      const { blueprint, scene } = makeBlueprintAndScene(`${n} Grand Opening Celebration`);
      return buildSceneGraph(blueprint, scene);
    });
    const distinctSurfaceMaterials = new Set(graphs.map((g) => g.materials.surfaceMaterial.value));
    expect(distinctSurfaceMaterials.size).toBeGreaterThanOrEqual(5);
  });

  it("renders a narrative with no leftover artifacts (no literal 'unknown', no '[object', no double punctuation)", () => {
    const { blueprint, scene } = makeBlueprintAndScene("Real estate luxury villa development Site Visit Campaign");
    const graph = buildSceneGraph(blueprint, scene);
    expect(graph.narrative).not.toMatch(/\bunknown\b/i);
    expect(graph.narrative).not.toMatch(/\[object/i);
    expect(graph.narrative).not.toMatch(/\.\s*\./);
    expect(graph.narrative.length).toBeGreaterThan(200);
  });

  it("keeps object-contact and body hand descriptions coherent with the same underlying hand-event (no contradicting objects)", () => {
    const { blueprint, scene } = makeBlueprintAndScene("Artisan bakery Weekend Special Offer Promotion");
    const graph = buildSceneGraph(blueprint, scene);
    expect(graph.body.handPosition.value).toContain(graph.objectContact.contactObject.value);
  });

  describe("reference-image-dominant pose constraint", () => {
    it("restricts pose selection to the reference-safe subset and explains why in the reasoning", () => {
      const { scene } = makeBlueprintAndScene("Salon luxury hair salon Stylist Spotlight Feature");
      const pose = buildPoseGraph(scene, 123456, true);
      expect(["standing", "leaning", "holding", "looking_down"]).toContain(pose.primaryPose.value);
      expect(pose.primaryPose.reasoning).toMatch(/reference image/i);
    });

    it("allows the full compatible pose set when no reference image dominates", () => {
      const { scene } = makeBlueprintAndScene("Salon luxury hair salon Stylist Spotlight Feature");
      const pose = buildPoseGraph(scene, 123456, false);
      expect(pose.primaryPose.reasoning).not.toMatch(/reference image/i);
    });
  });

  describe("input hygiene — a real pipeline run surfaced layout/advertisement copy leaking into a supposedly-physical field", () => {
    const CONTAMINATED = "ADVERTISEMENT LAYERS: A horizontal strip of 3-4 key benefits across the lower portion of the image. Benefit 1: Quality | Benefit 2: Value | Benefit 3: Trust. Clean, evenly-spaced layout.\n\nTestimonial element: a small customer photo with a short quote visible in the creative.";

    it("detects the observed layout/copy contamination pattern", () => {
      expect(looksLikeLayoutOrCopyInstruction(CONTAMINATED)).toBe(true);
    });

    it("does not flag genuine physical scene descriptions as layout copy", () => {
      expect(looksLikeLayoutOrCopyInstruction("Two guests seated three metres behind exchange eye contact while a waiter crosses frame carrying wine.")).toBe(false);
    });

    it("safeInheritedText rejects contaminated text so callers fall back to their own vocabulary", () => {
      expect(safeInheritedText(CONTAMINATED)).toBeUndefined();
      expect(safeInheritedText("unknown")).toBeUndefined();
      expect(safeInheritedText("Two guests seated nearby.")).toBe("Two guests seated nearby.");
    });
  });

  describe("micro-motion plausibility gate (controlled inputs — isolated from the real, evolving knowledge-bank tag corpus)", () => {
    const emptySignal: KnowledgeSignal = { tags: [], sourceIds: [] };
    const fakeHandEvent = {
      verbCategory: "holding" as const, primaryVerb: "holds", secondaryVerb: "steadies",
      primaryObject: "a ring", secondaryObject: "a tray", spatialTarget: "over the counter",
    };

    it("never selects an outdoor-only element for jewellery when no knowledge tag unlocks one", () => {
      for (let seed = 0; seed < 50; seed++) {
        const mm = buildMicroMotionGraph(seed, "jewellery", emptySignal, fakeHandEvent);
        expect(mm.elements.value).not.toMatch(/gust moving|wind pressing|air moving visibly|leaf caught|leaves stirring|foliage trembling|raindrop|rain streak/i);
      }
    });

    it("still returns a non-empty elements clause with zero tags (the universal fallback never leaves the field blank)", () => {
      const mm = buildMicroMotionGraph(777, "jewellery", emptySignal, fakeHandEvent);
      expect(mm.elements.value.length).toBeGreaterThan(0);
    });
  });
});
