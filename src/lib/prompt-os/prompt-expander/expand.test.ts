import { describe, expect, it } from "vitest";

import { universalPromptSchema } from "../schema";
import { buildOpenAIPrompt } from "../adapters/openai.adapter";
import { expandUniversalPrompt } from "./expand";

function promptWith(fields: Record<string, unknown>) {
  return universalPromptSchema.parse(fields);
}

// Representative terse output the existing pipeline produces today (see the
// live trace captured in PROJECT_STATUS.md) — sparse enough that the
// UNCHANGED adapters currently produce only a short, mechanical prompt.
function terseDentalPrompt() {
  return promptWith({
    intent: "Dental implant informative creative",
    industry: "Healthcare",
    creative_type: "a social media platform graphic",
    style: { mood: "confident", aesthetic: "modern editorial" },
    marketing: { goal: "increase awareness", targetAudience: "adults considering dental implants" },
    objects: ["dental professionals", "bright smile"],
  });
}

describe("expandUniversalPrompt", () => {
  it("produces a final adapter prompt substantially longer than the unexpanded one — through the COMPLETELY UNCHANGED adapter", () => {
    const terse = terseDentalPrompt();
    const before = buildOpenAIPrompt(terse);
    const after = buildOpenAIPrompt(expandUniversalPrompt(terse));
    expect(after.length).toBeGreaterThan(before.length * 2);
  });

  it("produces visibly distinct, industry-appropriate content for 4 different industries — never shared boilerplate alone", () => {
    const dental = buildOpenAIPrompt(expandUniversalPrompt(promptWith({ intent: "Dental implant informative creative" })));
    const restaurant = buildOpenAIPrompt(expandUniversalPrompt(promptWith({ intent: "Restaurant offer" })));
    const realEstate = buildOpenAIPrompt(expandUniversalPrompt(promptWith({ intent: "Luxury villa advertisement" })));
    const finance = buildOpenAIPrompt(expandUniversalPrompt(promptWith({ intent: "Mutual fund campaign" })));

    expect(dental).toMatch(/medical|dental|clinic/i);
    expect(restaurant).toMatch(/food|dish|dining|appetite/i);
    expect(realEstate).toMatch(/architect|golden-hour|villa|propert/i);
    expect(finance).toMatch(/trust|growth|financial|corporate/i);

    // No two industries should produce byte-identical output.
    const outputs = [dental, restaurant, realEstate, finance];
    expect(new Set(outputs).size).toBe(outputs.length);
  });

  it("passes through fields it doesn't own unchanged (objects, output, industry, creativeBrief, referenceAnalysis)", () => {
    const prompt = promptWith({
      intent: "Product launch",
      industry: "Consumer Goods",
      objects: ["product hero shot"],
      output: { aspectRatio: "RATIO_1_1", targetWidth: 1080 },
      creativeBrief: { marketingObjective: "Drive pre-orders" },
      referenceAnalysis: { mood: "minimal" },
    });
    const result = expandUniversalPrompt(prompt);
    expect(result.objects).toEqual(["product hero shot"]);
    expect(result.output).toEqual(prompt.output);
    expect(result.industry).toBe("Consumer Goods");
    expect(result.creativeBrief).toEqual(prompt.creativeBrief);
    expect(result.referenceAnalysis).toEqual(prompt.referenceAnalysis);
  });

  it("merges and enriches negative_constraints rather than dropping the model's own", () => {
    const prompt = promptWith({ intent: "Salon promotion", negative_constraints: ["harsh shadows"] });
    const result = expandUniversalPrompt(prompt);
    expect(result.negative_constraints).toContain("harsh shadows");
    expect(result.negative_constraints).toContain("watermarks");
  });

  it("never throws on a minimal/empty Universal JSON Prompt", () => {
    expect(() => expandUniversalPrompt(promptWith({}))).not.toThrow();
  });
});
