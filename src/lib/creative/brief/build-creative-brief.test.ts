import { describe, expect, it } from "vitest";
import { buildCommercialCreativeBrief, buildFilmCreativeBrief } from "./build-creative-brief";

describe("buildCommercialCreativeBrief", () => {
  const baseInput = {
    videoProjectId: "proj_1",
    contentLanguage: "EN",
    objective: "PROMOTION",
    brief: {
      productOrService: "Handmade candles",
      keyMessage: "Light up your evenings",
      offerDetails: "20% off this week",
      callToAction: "Order now",
      tone: "FRIENDLY" as const,
    },
    profile: {
      businessName: "Glow Candles",
      businessVertical: "RETAIL",
      city: "Mumbai",
    },
    brandKit: {
      primaryColor: "#FFAA00",
      secondaryColor: "#333333",
      fontFamily: "Inter",
      guidelinesText: "Warm, cozy, minimal.",
      contactPhone: "+911234567890",
      contactWhatsapp: "+911234567890",
      addressLine: "123 Market Rd",
      websiteOrSocial: "glowcandles.com",
    },
  };

  it("assembles full brand + commercial content from real inputs", () => {
    const brief = buildCommercialCreativeBrief(baseInput);

    expect(brief).toEqual({
      videoProjectId: "proj_1",
      contentLanguage: "EN",
      brand: {
        businessName: "Glow Candles",
        businessVertical: "RETAIL",
        city: "Mumbai",
        primaryColor: "#FFAA00",
        secondaryColor: "#333333",
        fontFamily: "Inter",
        guidelinesText: "Warm, cozy, minimal.",
        contactPhone: "+911234567890",
        contactWhatsapp: "+911234567890",
        addressLine: "123 Market Rd",
        websiteOrSocial: "glowcandles.com",
      },
      content: {
        style: "commercial",
        objective: "PROMOTION",
        productOrService: "Handmade candles",
        keyMessage: "Light up your evenings",
        offerDetails: "20% off this week",
        callToAction: "Order now",
        tone: "FRIENDLY",
      },
    });
  });

  it("never fabricates brand facts when profile and brandKit are both null", () => {
    const brief = buildCommercialCreativeBrief({ ...baseInput, profile: null, brandKit: null });

    expect(brief.brand).toEqual({
      businessName: null,
      businessVertical: null,
      city: null,
      primaryColor: null,
      secondaryColor: null,
      fontFamily: null,
      guidelinesText: null,
      contactPhone: null,
      contactWhatsapp: null,
      addressLine: null,
      websiteOrSocial: null,
    });
  });

  it("normalizes empty/whitespace-only optional fields to null instead of empty strings", () => {
    const brief = buildCommercialCreativeBrief({
      ...baseInput,
      brief: { ...baseInput.brief, offerDetails: "  ", callToAction: "", tone: undefined },
    });

    expect(brief.content).toMatchObject({ offerDetails: null, callToAction: null, tone: null });
  });
});

describe("buildFilmCreativeBrief", () => {
  const baseInput = {
    videoProjectId: "proj_2",
    contentLanguage: "HINGLISH",
    filmBrief: {
      idea: "A chai seller's morning routine turns into a heartwarming ad.",
      style: "CINEMATIC" as const,
      totalDurationSeconds: 20,
      characterCount: 2,
    },
    profile: {
      businessName: "Chai Point",
      businessVertical: "FOOD_BEVERAGE",
      city: "Delhi",
    },
    brandKit: {
      primaryColor: "#8B4513",
      secondaryColor: null,
      fontFamily: null,
      guidelinesText: null,
      contactPhone: null,
      contactWhatsapp: null,
      addressLine: null,
      websiteOrSocial: null,
    },
  };

  it("assembles film-style content distinct from commercial content", () => {
    const brief = buildFilmCreativeBrief(baseInput);

    expect(brief.content).toEqual({
      style: "film",
      idea: "A chai seller's morning routine turns into a heartwarming ad.",
      filmStyle: "CINEMATIC",
      totalDurationSeconds: 20,
      characterCount: 2,
    });
    expect(brief.brand.businessName).toBe("Chai Point");
  });

  it("never fabricates brand facts when profile and brandKit are both null", () => {
    const brief = buildFilmCreativeBrief({ ...baseInput, profile: null, brandKit: null });
    expect(brief.brand.businessName).toBeNull();
    expect(brief.brand.primaryColor).toBeNull();
  });
});
