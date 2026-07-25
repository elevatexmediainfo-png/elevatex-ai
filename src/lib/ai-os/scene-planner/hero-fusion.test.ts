import { describe, expect, it } from "vitest";

import { buildHero } from "./hero-fusion";
import type { UniversalCampaignBlueprint } from "../blueprint/types";
import type { VisualPrimitive } from "../visual-translation/types";
import type { VTEEnrichment } from "./vte-bridge";
import { buildVisualScenePlan } from "./engine";
import { assembleBlueprint } from "../blueprint";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCampaignPlan } from "../creative-director";
import { buildVisualLayoutPlan } from "../visual-layout";
import { buildTypographyPlan } from "../typography";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import type { CreativeRequest } from "../types";
import { buildVTEEnrichment } from "./vte-bridge";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — a minimal blueprint stub covering only the fields buildHero()
// reads, for isolated edge-case tests (defensive fallback, reference-image
// dominance) that are impractical to trigger via the full pipeline.
// ─────────────────────────────────────────────────────────────────────────────

function primitive(type: VisualPrimitive["type"], value: string, weight = 0.9, tags: string[] = []): VisualPrimitive {
  return { type, value, weight, tags };
}

function emptyVTE(overrides: Partial<VTEEnrichment> = {}): VTEEnrichment {
  return {
    action: [], person: [], object: [], material: [], lighting: [], spatial: [], composition: [],
    composedDirective: "", resolvedIndustry: "test", hasContent: false,
    ...overrides,
  };
}

interface FakeBlueprintOptions {
  heroSubjectValue?: string;
  heroSubjectConfidence?: "high" | "medium" | "low" | "unknown";
  primarySignals?: string[];
  subIndustry?: string;
  industry?: string;
  campaignGoal?: string;
  experiencePrimary?: string;
  campaignCategory?: string;
  luxuryLevel?: string;
  photographyStyle?: string;
}

function fakeBlueprint(opts: FakeBlueprintOptions = {}): UniversalCampaignBlueprint {
  const stub = {
    strategy: {
      heroDecision: { primarySignals: opts.primarySignals ?? [] },
      creative: { heroSubject: { value: opts.heroSubjectValue ?? "A confident professional at work", confidence: opts.heroSubjectConfidence ?? "high" } },
      business: { subIndustry: { value: opts.subIndustry ?? "unknown" }, industry: { value: opts.industry ?? "unknown" } },
      marketing: { campaignGoal: { value: opts.campaignGoal ?? "unknown" } },
      experienceProfile: opts.experiencePrimary ? { primary: opts.experiencePrimary } : undefined,
      campaign: { campaignCategory: { value: opts.campaignCategory ?? "unknown" } },
      visual: { luxuryLevel: { value: opts.luxuryLevel ?? "none" }, photographyStyle: { value: opts.photographyStyle ?? "none" } },
    },
  };
  return stub as unknown as UniversalCampaignBlueprint;
}

// ─────────────────────────────────────────────────────────────────────────────
// Real-pipeline helper (mirrors engine.test.ts's makeScenePlan)
// ─────────────────────────────────────────────────────────────────────────────

function runPipeline(rawIdea: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, kind: "SOCIAL_MEDIA", presetKey: "instagram_post", requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const plan = buildCampaignPlan(strategy);
  const layout = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  const blueprint = assembleBlueprint({ context: ctx, strategy, campaignPlan: plan, layoutPlan: layout, typographyPlan: typography });
  const scene = buildVisualScenePlan(blueprint);
  const vte = buildVTEEnrichment(blueprint);
  return { blueprint, scene, vte };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Hero Fusion — spine preservation", () => {
  it("never alters the Creative Brain spine text", () => {
    const bp = fakeBlueprint({ heroSubjectValue: "A dentist explains a treatment plan to a patient" });
    const result = buildHero(bp, emptyVTE());
    expect(result.value.startsWith("A dentist explains a treatment plan to a patient")).toBe(true);
  });

  it("returns the spine verbatim when no source has non-duplicate enrichment", () => {
    const bp = fakeBlueprint({ heroSubjectValue: "A generic hero subject with no matching signals" });
    const result = buildHero(bp, emptyVTE());
    expect(result.value).toBe("A generic hero subject with no matching signals");
    expect(result.reasoning).toContain("spine only");
    expect(result.contributions.creativeBrain).toBe(true);
    expect(result.contributions.experience).toBe(false);
    expect(result.contributions.vte).toBe(false);
  });

  it("always marks creativeBrain as contributing (it is always the spine)", () => {
    const bp = fakeBlueprint({});
    const result = buildHero(bp, emptyVTE());
    expect(result.contributions.creativeBrain).toBe(true);
  });
});

describe("Hero Fusion — merging, not overwriting", () => {
  it("appends a non-duplicate Experience clause", () => {
    const bp = fakeBlueprint({ heroSubjectValue: "A chef plates the signature dish", experiencePrimary: "celebration" });
    const result = buildHero(bp, emptyVTE());
    expect(result.value).toContain("A chef plates the signature dish");
    expect(result.value).toContain("occasion");
    expect(result.contributions.experience).toBe(true);
  });

  it("appends non-duplicate VTE primitives", () => {
    const bp = fakeBlueprint({ heroSubjectValue: "A chef plates the signature dish" });
    const vte = emptyVTE({
      hasContent: true,
      action: [primitive("action", "A sommelier pours the first glass of wine nearby")],
      person: [primitive("person", "A family begins applauding a birthday celebration")],
    });
    const result = buildHero(bp, vte);
    expect(result.value).toContain("sommelier pours the first glass of wine");
    expect(result.value).toContain("family begins applauding");
    expect(result.contributions.vte).toBe(true);
  });

  it("appends Campaign Intelligence, Marketing, and Commercial Style clauses together", () => {
    const bp = fakeBlueprint({
      heroSubjectValue: "A property consultant presents a villa",
      campaignCategory: "launch",
      campaignGoal: "lead_generation",
      photographyStyle: "editorial",
      luxuryLevel: "high",
    });
    const result = buildHero(bp, emptyVTE());
    expect(result.contributions.campaignIntelligence).toBe(true);
    expect(result.contributions.marketing).toBe(true);
    expect(result.contributions.commercialStyle).toBe(true);
    expect(result.value).toContain("editorial");
    expect(result.value).toContain("luxury-editorial");
  });

  it("produces a single well-formed sentence ending in one period", () => {
    const bp = fakeBlueprint({
      heroSubjectValue: "A stylist finishes a client's transformation",
      experiencePrimary: "transformation",
      campaignCategory: "promotion",
      campaignGoal: "sales",
    });
    const result = buildHero(bp, emptyVTE());
    expect(result.value.match(/\.$/)).toBeTruthy();
    expect(result.value.match(/\./g)?.length).toBe(1);
  });
});

describe("Hero Fusion — no duplication", () => {
  it("rejects a VTE action primitive that repeats the spine's core concept", () => {
    const bp = fakeBlueprint({ heroSubjectValue: "A chef carefully plates the signature dish for the table" });
    const vte = emptyVTE({
      hasContent: true,
      action: [primitive("action", "The chef plates the signature dish with great care today")],
    });
    const result = buildHero(bp, vte);
    // Should fall through untouched — the candidate is a near-duplicate of the spine
    expect(result.value).toBe("A chef carefully plates the signature dish for the table");
    expect(result.contributions.vte).toBe(false);
  });

  it("accepts a later distinct VTE primitive after rejecting a duplicate one", () => {
    const bp = fakeBlueprint({ heroSubjectValue: "A chef carefully plates the signature dish for the table" });
    const vte = emptyVTE({
      hasContent: true,
      action: [
        primitive("action", "The chef plates the signature dish with great care today"), // duplicate — rejected
        primitive("action", "A sommelier pours the first glass of wine nearby"),           // distinct — accepted
      ],
    });
    const result = buildHero(bp, vte);
    expect(result.value).toContain("sommelier pours the first glass of wine");
    expect(result.contributions.vte).toBe(true);
  });

  it("does not accept the same clause content twice across sources", () => {
    const bp = fakeBlueprint({ heroSubjectValue: "A specialist reviews a 3D scan with the patient", experiencePrimary: "trust" });
    const vte = emptyVTE({
      hasContent: true,
      object: [primitive("object", "A patient relaxes visibly, no longer tense")],
    });
    const result = buildHero(bp, vte);
    const occurrences = result.value.split("relaxes").length - 1;
    expect(occurrences).toBeLessThanOrEqual(1);
  });
});

describe("Hero Fusion — reference image dominance", () => {
  it("marks reference contribution true when primarySignals includes reference_image", () => {
    const bp = fakeBlueprint({ heroSubjectValue: "Woman in red dress by the window, three-quarter pose", primarySignals: ["reference_image"] });
    const result = buildHero(bp, emptyVTE());
    expect(result.contributions.reference).toBe(true);
    expect(result.confidence).toBe("high");
  });

  it("excludes VTE action/person primitives when reference image dominates (pose/subject must not change)", () => {
    const bp = fakeBlueprint({ heroSubjectValue: "Woman in red dress by the window, three-quarter pose", primarySignals: ["reference_image"] });
    const vte = emptyVTE({
      hasContent: true,
      action: [primitive("action", "She raises a hand to adjust her hair while laughing")],
      person: [primitive("person", "A second model stands just behind her")],
      object: [primitive("object", "Sunlight catches a brass vase on the windowsill")],
    });
    const result = buildHero(bp, vte);
    expect(result.value).not.toContain("raises a hand to adjust her hair");
    expect(result.value).not.toContain("second model stands");
  });

  it("still allows VTE object/material primitives when reference image dominates", () => {
    const bp = fakeBlueprint({ heroSubjectValue: "Woman in red dress by the window, three-quarter pose", primarySignals: ["reference_image"] });
    const vte = emptyVTE({
      hasContent: true,
      action: [primitive("action", "She raises a hand to adjust her hair while laughing")],
      material: [primitive("material", "Brushed brass catches warm afternoon light beside her")],
    });
    const result = buildHero(bp, vte);
    expect(result.value.toLowerCase()).toContain("brushed brass catches warm afternoon light");
    expect(result.contributions.vte).toBe(true);
  });

  it("does NOT mark reference true when primarySignals is empty", () => {
    const bp = fakeBlueprint({ heroSubjectValue: "A generic hero", primarySignals: [] });
    const result = buildHero(bp, emptyVTE());
    expect(result.contributions.reference).toBe(false);
  });
});

describe("Hero Fusion — clause cap", () => {
  it("stops accepting once 4 enrichment clauses are reached, blocking later pipeline sources", () => {
    // Experience(1) + VTE action+person(2) + Campaign Intelligence(1) = 4 accepted,
    // reaching MAX_ENRICHMENT_CLAUSES before Marketing/Commercial Style are evaluated —
    // both must be blocked even though their clauses are valid and non-duplicate.
    const bp = fakeBlueprint({
      heroSubjectValue: "A jeweller presents the collection",
      experiencePrimary: "luxury",
      campaignCategory: "launch",
      campaignGoal: "sales",
      photographyStyle: "macro_detail",
      luxuryLevel: "ultra_luxury",
    });
    const vte = emptyVTE({
      hasContent: true,
      action: [primitive("action", "A gloved hand rotates the ring under a single light source")],
      person: [primitive("person", "A client leans in, visibly captivated by the piece")],
      object: [primitive("object", "A velvet tray holds three additional pieces in reserve")],
    });
    const result = buildHero(bp, vte);
    expect(result.contributions.experience).toBe(true);
    expect(result.contributions.vte).toBe(true);
    expect(result.contributions.campaignIntelligence).toBe(true);
    // Cap reached — these two must be blocked even though valid clauses exist for them
    expect(result.contributions.marketing).toBe(false);
    expect(result.contributions.commercialStyle).toBe(false);
  });
});

describe("Hero Fusion — defensive fallback (Creative Brain hero unknown)", () => {
  it("uses VTE action/person primitive directly when Creative Brain produced no hero", () => {
    const bp = fakeBlueprint({ heroSubjectValue: "unknown", heroSubjectConfidence: "unknown" });
    const vte = emptyVTE({ hasContent: true, action: [primitive("action", "A specific decisive moment from VTE")] });
    const result = buildHero(bp, vte);
    expect(result.value).toBe("A specific decisive moment from VTE");
    expect(result.contributions.creativeBrain).toBe(false);
    expect(result.contributions.vte).toBe(true);
    expect(result.reasoning).toContain("defensive path");
  });

  it("falls back to the knowledge bank when Creative Brain and VTE both produce nothing", () => {
    const bp = fakeBlueprint({ heroSubjectValue: "unknown", heroSubjectConfidence: "unknown", subIndustry: "dental" });
    const result = buildHero(bp, emptyVTE());
    expect(result.value).not.toBe("");
    expect(result.value.toLowerCase()).toMatch(/dental|clinic|implant|patient|practitioner/);
    expect(result.contributions.creativeBrain).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Real-pipeline integration checks
// ─────────────────────────────────────────────────────────────────────────────

describe("Hero Fusion — real pipeline integration", () => {
  it("restaurant: reasoning shows Hero Fusion merged multiple sources", () => {
    const { blueprint, vte } = runPipeline("Restaurant Grand Opening Celebration");
    const result = buildHero(blueprint, vte);
    expect(result.reasoning).toContain("Hero Fusion");
    expect(result.contributions.creativeBrain).toBe(true);
  });

  it("dental: final hero is longer and more specific than the raw Creative Brain hero alone", () => {
    const { blueprint, vte } = runPipeline("Dental Implant Informative Creative");
    const brainHero = blueprint.strategy.creative.heroSubject.value;
    const result = buildHero(blueprint, vte);
    expect(result.value.length).toBeGreaterThanOrEqual(brainHero.length);
    expect(result.value.startsWith(brainHero.split(" — ")[0])).toBe(true);
  });

  it("scene.heroSubject.exactHeroSubject flows through Hero Fusion end-to-end", () => {
    const { scene } = runPipeline("Jewellery Wedding Collection Campaign");
    expect(scene.heroSubject.exactHeroSubject.reasoning).toContain("Hero Fusion");
  });

  it("existing non-prose hero fields (pose/expression/scale/position/importance) still resolve", () => {
    const { scene } = runPipeline("Salon Transformation Before After");
    expect(scene.heroSubject.heroPose.value).not.toBe("unknown");
    expect(scene.heroSubject.heroExpression.value).not.toBe("unknown");
    expect(scene.heroSubject.heroScale.value).not.toBe("unknown");
    expect(scene.heroSubject.heroPosition.value).not.toBe("unknown");
    expect(scene.heroSubject.heroImportance.value).not.toBe("unknown");
  });
});
