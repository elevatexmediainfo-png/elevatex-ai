import { describe, expect, it } from "vitest";

import { compileToVisualLanguage } from "./engine";
import { BANNED_TERMS, containsBannedLanguage, findBannedTerms } from "./banned-language";
import { countEnumLeaks, hasBrokenPunctuation, naturalizeEnumToken, cleanPunctuation } from "./enum-language";
import { measurePrompt } from "./metrics";
import { assembleBlueprint } from "../blueprint";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCampaignPlan } from "../creative-director";
import { buildVisualLayoutPlan } from "../visual-layout";
import { buildTypographyPlan } from "../typography";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import { buildVisualScenePlan } from "../scene-planner/engine";
import { buildPromptSpecification } from "../prompt-spec/engine";
import type { CreativeRequest } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Helper — full real pipeline to PromptSpecification (nothing in this helper
// is part of the compiler; it only calls existing, untouched functions).
// ─────────────────────────────────────────────────────────────────────────────

function makeSpec(rawIdea: string, kind?: CreativeRequest["kind"], presetKey?: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, kind, presetKey, requestedAt: new Date() };
  const uu = analyzeUserRequest(request);
  const ctx = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const plan = buildCampaignPlan(strategy);
  const layout = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  const blueprint = assembleBlueprint({ context: ctx, strategy, campaignPlan: plan, layoutPlan: layout, typographyPlan: typography });
  const scene = buildVisualScenePlan(blueprint);
  return buildPromptSpecification(blueprint, scene);
}

// ─────────────────────────────────────────────────────────────────────────────
// Banned language
// ─────────────────────────────────────────────────────────────────────────────

describe("banned-language", () => {
  it("detects every term in the banned list", () => {
    for (const term of BANNED_TERMS) {
      expect(containsBannedLanguage(`This mentions ${term} directly.`), term).toBe(true);
    }
  });

  it("does not false-positive on unrelated words", () => {
    expect(containsBannedLanguage("A chef plates the signature dish under warm light.")).toBe(false);
  });

  it("word-boundary matching does not flag substrings inside unrelated words", () => {
    // "usp" as a standalone banned term should not match inside "auspicious"
    expect(containsBannedLanguage("The auspicious morning light fills the room.")).toBe(false);
  });
});

describe("enum-language", () => {
  it("naturalizes known enum tokens into real English phrases", () => {
    expect(naturalizeEnumToken("soft_diffused_shadows")).toBe("soft, diffused shadows");
    expect(naturalizeEnumToken("minimal_line_icons")).toBe("simple line-art icons");
    expect(naturalizeEnumToken("hero_dominant_others_small")).toContain("dominant");
    expect(naturalizeEnumToken("top_right")).toBe("the top-right corner");
    expect(naturalizeEnumToken("catchlight_eyes")).toBe("a catchlight visible in the eyes");
  });

  it("falls back to underscore expansion for unmapped enums, never leaving underscores", () => {
    const result = naturalizeEnumToken("some_totally_unmapped_value");
    expect(result).not.toContain("_");
  });

  it("counts zero leaks in already-clean text", () => {
    expect(countEnumLeaks("A chef plates the signature dish.")).toBe(0);
  });

  it("counts leaks correctly in raw enum text", () => {
    expect(countEnumLeaks("Position: top_right. Icon elements: minimal_line_icons.")).toBe(2);
  });

  it("cleanPunctuation collapses multi-period runs", () => {
    expect(cleanPunctuation("A scene ends here.... Next sentence.")).not.toMatch(/\.\.+/);
  });

  it("cleanPunctuation collapses double commas", () => {
    expect(cleanPunctuation("A chef, , plates the dish.")).not.toMatch(/,\s*,/);
  });

  it("cleanPunctuation removes pipe-style enum separators", () => {
    const cleaned = cleanPunctuation("Benefit 1: X | Benefit 2: Y");
    expect(cleaned).not.toContain("|");
  });

  it("cleanPunctuation strips raw JSON artifacts", () => {
    const cleaned = cleanPunctuation('Some text {"key": "value"} more text "field": more.');
    expect(cleaned).not.toMatch(/[{}]/);
    expect(cleaned).not.toMatch(/"[a-zA-Z0-9_]+"\s*:/);
  });

  it("hasBrokenPunctuation detects what cleanPunctuation fixes", () => {
    expect(hasBrokenPunctuation("Text here.... more")).toBe(true);
    expect(hasBrokenPunctuation("Clean text here.")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Compiler — classification + conversion, against real pipeline output
// ─────────────────────────────────────────────────────────────────────────────

describe("compileToVisualLanguage — classification", () => {
  it("classifies every field into exactly one of A/B/C/D/E", () => {
    const spec = makeSpec("Restaurant Grand Opening Celebration");
    const result = compileToVisualLanguage(spec);
    for (const f of result.fields) {
      expect(["A", "B", "C", "D", "E"]).toContain(f.classification);
    }
  });

  it("Category C fields (marketing business language) never appear in compiled output", () => {
    const spec = makeSpec("Dental Implant Informative Creative");
    const result = compileToVisualLanguage(spec);
    const cFields = result.fields.filter((f) => f.classification === "C");
    expect(cFields.length).toBeGreaterThan(0); // marketing.* should produce several
    for (const f of cFields) {
      expect(f.compiledValue).toBeUndefined();
    }
  });

  it("Category E fields never surface in the compiled text", () => {
    const spec = makeSpec("Luxury Real Estate Villa Advertisement");
    const result = compileToVisualLanguage(spec);
    const eFields = result.fields.filter((f) => f.classification === "E");
    for (const f of eFields) {
      expect(f.compiledValue).toBeUndefined();
    }
  });

  it("hero subject (Category A) always survives into the compiled text", () => {
    const spec = makeSpec("Jewellery Wedding Collection Campaign");
    const result = compileToVisualLanguage(spec);
    const heroField = result.fields.find((f) => f.path === "hero.heroSubject");
    expect(heroField?.classification).toBe("A");
    if (heroField?.compiledValue) {
      expect(result.compiledText).toContain(heroField.compiledValue.slice(0, 30));
    }
  });
});

describe("compileToVisualLanguage — never emits banned language", () => {
  const prompts = [
    "Restaurant Grand Opening Celebration", "Dental Implant Informative Creative",
    "Salon Transformation Before After", "Jewellery Wedding Collection Campaign",
    "Luxury Real Estate Villa Advertisement",
  ];

  it("compiled text contains zero banned terms across all 5 industries", () => {
    for (const prompt of prompts) {
      const spec = makeSpec(prompt);
      const result = compileToVisualLanguage(spec);
      const found = findBannedTerms(result.compiledText);
      expect(found, `${prompt}: found banned terms ${JSON.stringify(found)} in "${result.compiledText.slice(0, 300)}"`).toEqual([]);
    }
  });

  it("compiled text contains zero raw enum leaks across all 5 industries", () => {
    for (const prompt of prompts) {
      const spec = makeSpec(prompt);
      const result = compileToVisualLanguage(spec);
      expect(countEnumLeaks(result.compiledText), `${prompt}: "${result.compiledText}"`).toBe(0);
    }
  });

  it("compiled text has no broken punctuation across all 5 industries", () => {
    for (const prompt of prompts) {
      const spec = makeSpec(prompt);
      const result = compileToVisualLanguage(spec);
      expect(hasBrokenPunctuation(result.compiledText), `${prompt}: "${result.compiledText}"`).toBe(false);
    }
  });
});

describe("compileToVisualLanguage — concept conversion (the trust/luxury examples)", () => {
  it("converts an emotionalGoal/trust-flavoured field into a concrete visual sentence, not an abstract label", () => {
    const spec = makeSpec("Dental Implant Trust Campaign");
    const result = compileToVisualLanguage(spec);
    const trustField = result.fields.find((f) => f.path === "marketing.trustStrategy");
    if (trustField && trustField.originalValue) {
      expect(trustField.classification).toBe("B");
      expect(trustField.conceptUsed).toBe("trust");
      // The compiled sentence must not just restate "trust" abstractly.
      expect(trustField.compiledValue?.toLowerCase()).not.toContain("trust made visible");
      expect(trustField.compiledValue).not.toBe(trustField.originalValue);
    }
  });

  it("converts rendering.luxuryLevel into concrete material/visual language when luxury is high", () => {
    const spec = makeSpec("Luxury Real Estate Villa Advertisement");
    const result = compileToVisualLanguage(spec);
    const luxuryField = result.fields.find((f) => f.path === "rendering.luxuryLevel");
    if (luxuryField && luxuryField.conceptUsed) {
      expect(["luxury", "premium", "expertise"]).toContain(luxuryField.conceptUsed);
      expect(luxuryField.compiledValue).not.toMatch(/_/); // no raw enum leak
    }
  });
});

describe("compileToVisualLanguage — deduplication (Category D)", () => {
  it("marks later near-duplicate fields as D and excludes them from output", () => {
    const spec = makeSpec("Restaurant Grand Opening Celebration");
    const result = compileToVisualLanguage(spec);
    const dFields = result.fields.filter((f) => f.classification === "D");
    for (const f of dFields) {
      expect(f.compiledValue).toBeUndefined();
    }
  });

  it("known duplicate pair (experienceEmotionalCore vs experienceVisualImplication when identical) collapses to one", () => {
    // These two fields historically carry near-identical text for the same experienceType.
    const spec = makeSpec("Restaurant Grand Opening Celebration");
    const result = compileToVisualLanguage(spec);
    const coreField = result.fields.find((f) => f.path === "marketing.experienceEmotionalCore");
    const implicationField = result.fields.find((f) => f.path === "marketing.experienceVisualImplication");
    if (coreField?.compiledValue && implicationField?.compiledValue) {
      // If they ended up identical pre-dedup, one of the two must now be D.
      const bothSurvived = coreField.classification !== "D" && implicationField.classification !== "D";
      if (coreField.originalValue === implicationField.originalValue) {
        expect(bothSurvived).toBe(false);
      }
    }
  });
});

describe("compileToVisualLanguage — metrics and targets", () => {
  it("computes before/after metrics with after showing improvement over before", () => {
    const spec = makeSpec("Salon Transformation Before After");
    const result = compileToVisualLanguage(spec);
    expect(result.report.before.abstractPct).toBeGreaterThanOrEqual(0);
    expect(result.report.after.visualTokenRatio).toBeGreaterThanOrEqual(result.report.before.visualTokenRatio);
  });

  it("reports which of the 6 hard targets are met", () => {
    const spec = makeSpec("Restaurant Grand Opening Celebration");
    const result = compileToVisualLanguage(spec);
    const targets = result.report.targetsMet;
    expect(targets.noEnumLeakage).toBe(true);
    expect(targets.noBrokenPunctuation).toBe(true);
    expect(targets.noBannedLanguage).toBe(true);
  });

  it("measurePrompt is deterministic for the same input", () => {
    const text = "A chef plates the signature dish under warm amber light.";
    expect(measurePrompt(text)).toEqual(measurePrompt(text));
  });
});

describe("compileToVisualLanguage — sections use only the 15 permitted visual categories", () => {
  const ALLOWED = new Set(["people","objects","actions","relationships","environment","materials",
    "camera","lighting","textures","weather","architecture","motion","depth","interaction","micro-details"]);

  it("every compiled section's visualCategory is one of the 15 permitted categories", () => {
    const spec = makeSpec("Jewellery Wedding Collection Campaign");
    const result = compileToVisualLanguage(spec);
    for (const section of result.sections) {
      expect(ALLOWED.has(section.visualCategory), section.visualCategory).toBe(true);
    }
  });
});

describe("compileToVisualLanguage — determinism", () => {
  it("produces identical output for the same spec across repeated calls", () => {
    const spec = makeSpec("Dental Implant Informative Creative");
    const a = compileToVisualLanguage(spec);
    const b = compileToVisualLanguage(spec);
    expect(a.compiledText).toBe(b.compiledText);
  });
});
