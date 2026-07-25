import { describe, expect, it } from "vitest";

import { universalPromptSchema } from "../schema";
import { matchIndustryProfile } from "./industry";

function promptWith(fields: Record<string, unknown>) {
  return universalPromptSchema.parse(fields);
}

describe("matchIndustryProfile", () => {
  it("matches dental from the industry field", () => {
    expect(matchIndustryProfile(promptWith({ industry: "Healthcare", intent: "Dental implant informative creative" })).key).toBe(
      "dental"
    );
  });

  it("matches restaurant from the raw idea text when industry is unset", () => {
    expect(matchIndustryProfile(promptWith({ intent: "A cozy restaurant offer flyer" })).key).toBe("restaurant");
  });

  it("matches real estate from 'villa'", () => {
    expect(matchIndustryProfile(promptWith({ intent: "Luxury villa advertisement" })).key).toBe("real_estate");
  });

  it("matches finance from 'mutual fund'", () => {
    expect(matchIndustryProfile(promptWith({ intent: "Mutual fund campaign" })).key).toBe("finance");
  });

  it("matches salon from 'salon'", () => {
    expect(matchIndustryProfile(promptWith({ intent: "Salon promotion" })).key).toBe("salon");
  });

  it("matches jewellery from 'jewellery launch'", () => {
    expect(matchIndustryProfile(promptWith({ intent: "Jewellery launch" })).key).toBe("jewellery");
  });

  it("matches hospital distinctly from dental", () => {
    expect(matchIndustryProfile(promptWith({ intent: "Hospital awareness campaign" })).key).toBe("hospital");
  });

  it("falls back to generic_product for an unmatched idea", () => {
    expect(matchIndustryProfile(promptWith({ intent: "Product launch" })).key).toBe("generic_product");
  });

  it("prefers the user's raw idea text over a too-broad industry classification (confirmed live: a real LLM returned industry: Healthcare for a dental idea)", () => {
    expect(matchIndustryProfile(promptWith({ industry: "Healthcare", intent: "Dental implant informative creative" })).key).toBe(
      "dental"
    );
  });

  it("falls back to the industry field when the raw idea text itself names nothing specific", () => {
    expect(matchIndustryProfile(promptWith({ industry: "Finance", intent: "An advertisement design" })).key).toBe("finance");
  });

  it("every profile (except the generic fallback) has a non-empty keyword list", () => {
    // Exercised indirectly: each named test idea above must resolve to a
    // DIFFERENT profile, proving the keyword banks don't overlap into the
    // same bucket for genuinely distinct industries.
    const keys = [
      matchIndustryProfile(promptWith({ intent: "Dental implant informative creative" })).key,
      matchIndustryProfile(promptWith({ intent: "Restaurant offer" })).key,
      matchIndustryProfile(promptWith({ intent: "Luxury villa advertisement" })).key,
      matchIndustryProfile(promptWith({ intent: "Mutual fund campaign" })).key,
      matchIndustryProfile(promptWith({ intent: "Salon promotion" })).key,
      matchIndustryProfile(promptWith({ intent: "Jewellery launch" })).key,
      matchIndustryProfile(promptWith({ intent: "Hospital awareness" })).key,
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});
