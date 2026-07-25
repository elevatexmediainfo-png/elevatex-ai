import { describe, expect, it } from "vitest";
import { buildVariantNarrative, buildAllVariants } from "./builders";
import { buildNarrativePrompt } from "../prompt-spec/gpt-narrative";
import type { GPTCampaignDirection } from "../creative-director/gpt-types";
import { VARIANT_LABELS } from "./types";

// ─── Minimal fixture ──────────────────────────────────────────────────────────

const DIR: GPTCampaignDirection = {
  campaignConcept:    "Whitening that works in one visit",
  marketingObjective: "Drive walk-in appointments within 48 hours",
  sceneDescription:   "A dental clinic bright as a sunrise, every surface gleaming",
  heroSubject:        "A patient in the chair — radiant smile, eyes closed in relief",
  secondarySubjects:  "A smiling dentist in gloves poised beside them",
  supportingObjects:  "Framed diplomas on the wall, a tray of pristine instruments",
  visualStory:        { before: "Anxiety in the waiting room", moment: "The chair reclines", after: "Mirror held up — wide smile revealed" },
  psychologicalGoal:  "Replace fear of dentistry with anticipation of the result",
  compositionIntent:  { eyeFlow: "Diagonal from instruments to smile", subjectBalance: "Patient left, dentist right", framingLogic: "Close crop keeps the emotional exchange intimate" },
  visualHierarchy:    { primary: "The patient smile", secondary: "Dentist hands", background: "Clinic environment", decorative: "Framed credentials" },
  negativeSpace:      { headline: "Upper-left third is clean sky blue", cta:      "Bottom bar intentionally uncluttered", logo:     "Top-right corner clear" },
  lightingMood:       "Clinical white with warm overhead fill",
  colorPsychology:    "Arctic whites and soft teals communicate cleanliness and calm",
  environment:        "Premium private clinic, not NHS grey",
  marketingTriggers:  ["social proof", "authority", "transformation"],
  trustTriggers:      ["Certified cosmetic dentist since 2008", "500+ five-star reviews"],
  microInteractions:  ["Gleam of instrument steel", "Steam rising from steriliser"],
  commercialStyle:    "Aspirational healthcare photography — think Harley Street brochure",
  narrative:          "Every patient deserves to walk out feeling like a different person",
  coreMessage:        "Pain-free, same-day, life-changing whitening",
  mustInclude:        ["patient smile", "professional gloves"],
  mustAvoid:          ["blood", "needles", "clinical horror"],
  viewerEmotion:      "calm excitement and confident anticipation",
};

// ─── buildVariantNarrative ────────────────────────────────────────────────────

describe("buildVariantNarrative", () => {
  it("balanced variant matches the production buildNarrativePrompt output exactly", () => {
    const production = buildNarrativePrompt(DIR);
    const balanced   = buildVariantNarrative("balanced", DIR);
    expect(balanced).toBe(production);
  });

  it("all 4 variants produce non-empty strings", () => {
    for (const type of ["balanced", "story_first", "composition_first", "marketing_first"] as const) {
      const result = buildVariantNarrative(type, DIR);
      expect(result.length).toBeGreaterThan(100);
    }
  });

  it("every variant includes the core message", () => {
    for (const type of ["balanced", "story_first", "composition_first", "marketing_first"] as const) {
      const result = buildVariantNarrative(type, DIR);
      expect(result).toContain(DIR.coreMessage!);
    }
  });

  it("every variant includes the scene description", () => {
    for (const type of ["balanced", "story_first", "composition_first", "marketing_first"] as const) {
      const result = buildVariantNarrative(type, DIR);
      expect(result).toContain(DIR.sceneDescription);
    }
  });

  it("every variant includes mustAvoid content exactly once", () => {
    for (const type of ["balanced", "story_first", "composition_first", "marketing_first"] as const) {
      const result = buildVariantNarrative(type, DIR);
      // Each item appears exactly once regardless of the wrapper phrase used
      // ("Never: X, Y." for balanced / "This image must never become: X, Y." for others)
      for (const item of DIR.mustAvoid) {
        const count = result.split(item).length - 1;
        expect(count).toBe(1);
      }
    }
  });

  it("story_first opens with viewer emotion", () => {
    const result = buildVariantNarrative("story_first", DIR);
    expect(result.startsWith(`Every visual decision in this image exists to make the viewer feel ${DIR.viewerEmotion}`)).toBe(true);
  });

  it("composition_first opens with the scene description", () => {
    const result = buildVariantNarrative("composition_first", DIR);
    expect(result.startsWith(DIR.sceneDescription)).toBe(true);
  });

  it("marketing_first opens with the campaign concept", () => {
    const result = buildVariantNarrative("marketing_first", DIR);
    expect(result.startsWith(DIR.campaignConcept!)).toBe(true);
  });

  it("4 variants produce 4 distinct prompts", () => {
    const types   = ["balanced", "story_first", "composition_first", "marketing_first"] as const;
    const results = types.map(t => buildVariantNarrative(t, DIR));
    const unique  = new Set(results);
    expect(unique.size).toBe(4);
  });

  it("marketing_first places campaign concept before scene description", () => {
    const result  = buildVariantNarrative("marketing_first", DIR);
    const idxConcept = result.indexOf(DIR.campaignConcept!);
    const idxScene   = result.indexOf(DIR.sceneDescription);
    expect(idxConcept).toBeLessThan(idxScene);
  });

  it("story_first places visual story before scene description", () => {
    const result   = buildVariantNarrative("story_first", DIR);
    const idxStory = result.indexOf(DIR.visualStory!.moment);
    const idxScene = result.indexOf(DIR.sceneDescription);
    expect(idxStory).toBeLessThan(idxScene);
  });

  it("composition_first places composition intent before viewer emotion", () => {
    const result     = buildVariantNarrative("composition_first", DIR);
    const idxComp    = result.indexOf(DIR.compositionIntent!.eyeFlow!);
    const idxEmotion = result.indexOf(DIR.viewerEmotion!);
    expect(idxComp).toBeLessThan(idxEmotion);
  });
});

// ─── buildAllVariants ─────────────────────────────────────────────────────────

describe("buildAllVariants", () => {
  it("returns exactly 4 variants", () => {
    const variants = buildAllVariants(DIR);
    expect(variants).toHaveLength(4);
  });

  it("has the correct types in the correct order", () => {
    const variants = buildAllVariants(DIR);
    expect(variants[0].type).toBe("balanced");
    expect(variants[1].type).toBe("story_first");
    expect(variants[2].type).toBe("composition_first");
    expect(variants[3].type).toBe("marketing_first");
  });

  it("each variant has the correct label from VARIANT_LABELS", () => {
    const variants = buildAllVariants(DIR);
    for (const v of variants) {
      expect(v.label).toBe(VARIANT_LABELS[v.type]);
    }
  });

  it("each BuiltVariant has a non-empty focus string", () => {
    const variants = buildAllVariants(DIR);
    for (const v of variants) {
      expect(v.focus.length).toBeGreaterThan(0);
    }
  });

  it("each BuiltVariant narrative matches its individual build call", () => {
    const variants = buildAllVariants(DIR);
    for (const v of variants) {
      const individual = buildVariantNarrative(v.type, DIR);
      expect(v.narrative).toBe(individual);
    }
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("buildVariantNarrative — edge cases", () => {
  it("handles missing optional fields without throwing", () => {
    const minimal: GPTCampaignDirection = {
      sceneDescription: "A simple scene",
      heroSubject:      undefined,
      secondarySubjects: undefined,
      supportingObjects: undefined,
      visualStory:      undefined,
      compositionIntent: undefined,
      visualHierarchy:  undefined,
      negativeSpace:    undefined,
      lightingMood:     undefined,
      colorPsychology:  undefined,
      environment:      undefined,
      marketingTriggers: [],
      trustTriggers:    [],
      microInteractions: [],
      mustInclude:      [],
      mustAvoid:        [],
    } as unknown as GPTCampaignDirection;

    for (const type of ["balanced", "story_first", "composition_first", "marketing_first"] as const) {
      expect(() => buildVariantNarrative(type, minimal)).not.toThrow();
      const result = buildVariantNarrative(type, minimal);
      expect(result).toContain("simple scene");
    }
  });

  it("single marketing trigger appears without conjunction", () => {
    const single = { ...DIR, marketingTriggers: ["trust"] };
    // Balanced variant uses compressed "Signals: trust." format (Phase 5.5)
    const balanced = buildVariantNarrative("balanced", single as GPTCampaignDirection);
    expect(balanced).toContain("trust");
    expect(balanced).not.toContain("trust and");
    // Other variants still use the expanded emitter format
    for (const type of ["story_first", "composition_first", "marketing_first"] as const) {
      const result = buildVariantNarrative(type, single as GPTCampaignDirection);
      expect(result).toContain("This image activates trust.");
      expect(result).not.toContain("This image activates trust and");
    }
  });

  it("mustAvoid is included when present", () => {
    const result = buildVariantNarrative("balanced", DIR);
    for (const avoid of DIR.mustAvoid) {
      expect(result).toContain(avoid);
    }
  });
});
