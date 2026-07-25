import { describe, expect, it } from "vitest";

import { universalPromptSchema } from "../schema";
import { matchIndustryProfile } from "./industry";
import { determineRichnessTier } from "./quality";
import { buildLightingEnrichment } from "./lighting";

function promptWith(fields: Record<string, unknown>) {
  return universalPromptSchema.parse(fields);
}

describe("buildLightingEnrichment", () => {
  it("folds the industry's atmosphere into lighting.type", () => {
    const prompt = promptWith({ intent: "Restaurant offer" });
    const profile = matchIndustryProfile(prompt);
    const result = buildLightingEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.lighting.type).toContain(profile.atmosphere);
  });

  it("escalates lighting quality language for luxury tiers", () => {
    const prompt = promptWith({ intent: "Jewellery launch" });
    const profile = matchIndustryProfile(prompt);
    const tier = determineRichnessTier(prompt, profile);
    const result = buildLightingEnrichment(prompt, profile, tier);
    expect(result.lighting.quality).toMatch(/cinematic/i);
  });

  it("blends reference analysis lighting/visualLanguage when present, without discarding the industry palette", () => {
    const prompt = promptWith({
      intent: "Restaurant offer",
      referenceAnalysis: { lighting: "warm tungsten side light", visualLanguage: "rustic-industrial" },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildLightingEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.lighting.direction).toContain("warm tungsten side light");
    expect(result.colors.palette).toContain("rustic-industrial");
  });

  it("de-duplicates palette entries that appear in both the model's output and the curated/reference banks", () => {
    const prompt = promptWith({
      intent: "Restaurant offer",
      colors: { palette: ["rustic-industrial"] },
      referenceAnalysis: { visualLanguage: "rustic-industrial" },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildLightingEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.colors.palette.filter((p) => p === "rustic-industrial")).toHaveLength(1);
  });

  it("merges branding.brandColors into the color palette so they reach the provider", () => {
    const prompt = promptWith({
      intent: "Brand campaign",
      branding: { brandColors: ["#1a3c6e", "#f97316"] },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildLightingEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.colors.palette).toContain("#1a3c6e");
    expect(result.colors.palette).toContain("#f97316");
  });

  it("de-duplicates brand colors that also appear in colors.palette", () => {
    const prompt = promptWith({
      intent: "Brand campaign",
      colors: { palette: ["#1a3c6e"] },
      branding: { brandColors: ["#1a3c6e", "#f97316"] },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildLightingEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.colors.palette.filter((p) => p === "#1a3c6e")).toHaveLength(1);
    expect(result.colors.palette).toContain("#f97316");
  });
});
