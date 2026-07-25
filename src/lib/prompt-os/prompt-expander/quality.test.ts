import { describe, expect, it } from "vitest";

import { universalPromptSchema } from "../schema";
import { matchIndustryProfile } from "./industry";
import { determineRichnessTier, buildQualityKeywords } from "./quality";

function promptWith(fields: Record<string, unknown>) {
  return universalPromptSchema.parse(fields);
}

describe("determineRichnessTier", () => {
  it("returns cinematic for a high-luxury idea in an inherently luxury industry", () => {
    const prompt = promptWith({ intent: "Luxury villa advertisement", style: { luxuryLevel: "high" } });
    expect(determineRichnessTier(prompt, matchIndustryProfile(prompt))).toBe("cinematic");
  });

  it("returns luxury for an inherently luxury industry without an explicit luxury signal", () => {
    const prompt = promptWith({ intent: "Jewellery launch" });
    expect(determineRichnessTier(prompt, matchIndustryProfile(prompt))).toBe("luxury");
  });

  it("returns marketing for a marketing-flavored idea in a non-luxury industry", () => {
    const prompt = promptWith({ intent: "Restaurant offer", marketing: { goal: "engagement" } });
    expect(determineRichnessTier(prompt, matchIndustryProfile(prompt))).toBe("marketing");
  });

  it("returns simple for a plain idea with no luxury or marketing signal", () => {
    const prompt = promptWith({ intent: "A golden retriever puppy" });
    expect(determineRichnessTier(prompt, matchIndustryProfile(prompt))).toBe("simple");
  });
});

// Image Quality Stabilization — visualDensity override tests
describe("determineRichnessTier with visualDensity override", () => {
  it("caps cinematic/luxury tier to marketing when Director chose minimal density", () => {
    const prompt = promptWith({
      intent: "Luxury villa advertisement",
      style: { luxuryLevel: "high" },
      creativeBrief: { visualDensity: "minimal" },
    });
    // Without density override this would be "cinematic"
    expect(determineRichnessTier(prompt, matchIndustryProfile(prompt))).toBe("marketing");
  });

  it("upgrades marketing tier to luxury when Director chose rich density", () => {
    const prompt = promptWith({
      intent: "Mutual fund SIP awareness",
      marketing: { goal: "educate investors" },
      creativeBrief: { visualDensity: "rich" },
    });
    // Without density override this would be "marketing" (non-luxury industry + marketing signal)
    expect(determineRichnessTier(prompt, matchIndustryProfile(prompt))).toBe("luxury");
  });

  it("leaves tier unchanged when density is medium or absent", () => {
    const prompt = promptWith({
      intent: "Restaurant offer",
      marketing: { goal: "engagement" },
      creativeBrief: { visualDensity: "medium" },
    });
    expect(determineRichnessTier(prompt, matchIndustryProfile(prompt))).toBe("marketing");
  });
});

describe("buildQualityKeywords", () => {
  it("preserves the model's own keywords and adds the curated base bank", () => {
    const prompt = promptWith({ intent: "Product launch", quality: { keywords: ["studio lighting"] } });
    const result = buildQualityKeywords(prompt, "simple");
    expect(result).toContain("studio lighting");
    // Base bank is now a natural sentence, not a bare tag
    expect(result.some((k) => k.includes("photorealistic"))).toBe(true);
  });

  it("pulls in progressively more keywords at higher tiers", () => {
    const prompt = promptWith({ intent: "Product launch" });
    const simple = buildQualityKeywords(prompt, "simple");
    const marketing = buildQualityKeywords(prompt, "marketing");
    const luxury = buildQualityKeywords(prompt, "luxury");
    const cinematic = buildQualityKeywords(prompt, "cinematic");
    expect(marketing.length).toBeGreaterThan(simple.length);
    expect(luxury.length).toBeGreaterThan(marketing.length);
    expect(cinematic.length).toBeGreaterThan(luxury.length);
  });

  it("de-duplicates when the model already supplied a curated-bank keyword", () => {
    const prompt = promptWith({ intent: "Product launch", quality: { keywords: ["photorealistic"] } });
    const result = buildQualityKeywords(prompt, "simple");
    expect(result.filter((k) => k === "photorealistic")).toHaveLength(1);
  });

  it("merges quality.realism into the keyword list so it reaches the provider", () => {
    const prompt = promptWith({ intent: "Product launch", quality: { realism: "hyper-realistic" } });
    const result = buildQualityKeywords(prompt, "simple");
    expect(result).toContain("hyper-realistic");
  });

  it("merges quality.resolution into the keyword list so it reaches the provider", () => {
    const prompt = promptWith({ intent: "Product launch", quality: { resolution: "8K resolution" } });
    const result = buildQualityKeywords(prompt, "simple");
    expect(result).toContain("8K resolution");
  });

  it("merges both realism and resolution alongside existing keywords without duplicates", () => {
    const prompt = promptWith({
      intent: "Product launch",
      quality: { keywords: ["ultra detailed"], realism: "photorealistic", resolution: "4K" },
    });
    const result = buildQualityKeywords(prompt, "simple");
    expect(result).toContain("ultra detailed");
    expect(result).toContain("photorealistic");
    expect(result).toContain("4K");
  });
});
