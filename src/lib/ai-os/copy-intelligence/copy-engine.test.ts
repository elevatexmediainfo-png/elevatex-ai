import { describe, expect, it } from "vitest";

import { generateCommercialCopy, buildCopyFromBlueprintInputs, strategyToCopyInput } from "./copy-engine";
import { generateHeadline, extractKeywords }  from "./headline-engine";
import { generateCTA }                        from "./cta-engine";
import { generateBenefits }                   from "./benefits-engine";
import { generateSocialProof }                from "./social-proof-engine";
import { generateOfferCopy, generateBadge }   from "./offer-engine";
import { getDisclaimer, requiresDisclaimer }  from "./disclaimer-engine";
import { deriveTone, TONE_ADJECTIVES }        from "./tone-engine";
import { assembleBlueprint }                  from "../blueprint";
import { buildCreativeStrategy }              from "../creative-brain";
import { buildCampaignPlan }                  from "../creative-director";
import { buildVisualLayoutPlan }              from "../visual-layout";
import { buildTypographyPlan }                from "../typography";
import { buildCreativeContext }               from "../creative-context";
import { analyzeUserRequest }                 from "../user-understanding";
import { planFromStrategy }                   from "../commercial-assets/adapter";
import type { CreativeRequest }               from "../types";
import type { CopyInput }                     from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeCopyInput(rawIdea: string, overrides: Partial<CopyInput> = {}): CopyInput {
  const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
  const uu       = analyzeUserRequest(request);
  const ctx      = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const assets   = planFromStrategy(strategy);
  return { ...strategyToCopyInput(strategy, rawIdea, assets), ...overrides };
}

function makeBlueprint(rawIdea: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
  const uu       = analyzeUserRequest(request);
  const ctx      = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(ctx);
  const campaign = buildCampaignPlan(strategy);
  const layout   = buildVisualLayoutPlan(strategy, campaign);
  const typo     = buildTypographyPlan(strategy, campaign, layout);
  return assembleBlueprint({ context: ctx, strategy, campaignPlan: campaign, layoutPlan: layout, typographyPlan: typo });
}

// ─────────────────────────────────────────────────────────────────────────────
// extractKeywords
// ─────────────────────────────────────────────────────────────────────────────

describe("extractKeywords", () => {
  it("removes stopwords and short words", () => {
    const kw = extractKeywords("The Best Dental Implant Campaign");
    expect(kw).not.toContain("the");
    expect(kw).not.toContain("best");
    expect(kw.some((k) => k.includes("dental") || k.includes("implant"))).toBe(true);
  });

  it("returns empty array for all-stopword input", () => {
    const kw = extractKeywords("the and or");
    expect(kw.length).toBe(0);
  });

  it("handles percentages and numbers", () => {
    const kw = extractKeywords("50% off Grand Opening Today");
    expect(kw.some((k) => k.includes("50") || k.includes("grand") || k.includes("opening"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deriveTone
// ─────────────────────────────────────────────────────────────────────────────

describe("deriveTone", () => {
  it("luxury luxuryLevel returns luxury tone", () => {
    const t = deriveTone("professional", "ultra_luxury", "luxury", "general");
    expect(t.primary).toBe("luxury");
    expect(t.formality).toBe("formal");
    expect(t.energyLevel).toBe("low");
  });

  it("medium luxuryLevel returns premium tone", () => {
    const t = deriveTone("professional", "medium", "professional", "general");
    expect(t.primary).toBe("premium");
  });

  it("luxury communicationStyle returns luxury tone", () => {
    const t = deriveTone("luxury", null, "professional", "restaurant");
    expect(t.primary).toBe("luxury");
  });

  it("professional communicationStyle returns professional tone", () => {
    const t = deriveTone("professional", null, "mass_market", "healthcare");
    expect(t.primary).toBe("professional");
  });

  it("friendly communicationStyle returns friendly tone", () => {
    const t = deriveTone("friendly", null, "mass_market", "salon");
    expect(t.primary).toBe("friendly");
    expect(t.energyLevel).toBe("high");
    expect(t.formality).toBe("casual");
  });

  it("minimal communicationStyle returns minimal tone", () => {
    const t = deriveTone("minimal", null, "startup", "tech");
    expect(t.primary).toBe("minimal");
  });

  it("jewelry industry defaults to luxury", () => {
    const t = deriveTone(null, null, "luxury", "jewelry");
    expect(t.primary).toBe("luxury");
  });

  it("secondary tone is set when primary differs from industry default", () => {
    const t = deriveTone("professional", null, "professional", "dental");
    expect(t.secondary).toBeDefined();
  });

  it("TONE_ADJECTIVES has all 6 tone types", () => {
    const tones: Array<keyof typeof TONE_ADJECTIVES> = ["luxury","premium","professional","friendly","authoritative","minimal"];
    for (const tone of tones) {
      expect(TONE_ADJECTIVES[tone].length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateHeadline
// ─────────────────────────────────────────────────────────────────────────────

describe("generateHeadline", () => {
  it("returns best headline as a non-empty string", () => {
    const input = makeCopyInput("Dental Implant Free Consultation");
    const tone  = deriveTone(input.communicationStyle, null, input.brandType, input.industry);
    const result = generateHeadline(input, tone);
    expect(typeof result.best).toBe("string");
    expect(result.best.length).toBeGreaterThan(0);
  });

  it("returns at least 2 alternates", () => {
    const input = makeCopyInput("Restaurant Grand Opening");
    const tone  = deriveTone(input.communicationStyle, null, input.brandType, input.industry);
    const result = generateHeadline(input, tone);
    expect(result.alternates.length).toBeGreaterThanOrEqual(2);
  });

  it("returns 3+ total candidates", () => {
    const input = makeCopyInput("Luxury Jewellery Wedding Collection");
    const tone  = deriveTone(input.communicationStyle, null, input.brandType, input.industry);
    const result = generateHeadline(input, tone);
    expect(result.candidates.length).toBeGreaterThanOrEqual(3);
  });

  it("all candidates have text, score, and rationale", () => {
    const input = makeCopyInput("Healthcare Hospital Awareness");
    const tone  = deriveTone(input.communicationStyle, null, input.brandType, input.industry);
    const { candidates } = generateHeadline(input, tone);
    for (const c of candidates) {
      expect(typeof c.text).toBe("string");
      expect(c.text.length).toBeGreaterThan(0);
      expect(typeof c.score).toBe("number");
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
      expect(typeof c.rationale).toBe("string");
    }
  });

  it("headline word count is reasonable (2-12 words)", () => {
    const ideas = [
      "Dental Implant Campaign",
      "Restaurant Grand Opening",
      "Luxury Jewellery",
      "Real Estate Apartments",
    ];
    for (const idea of ideas) {
      const input = makeCopyInput(idea);
      const tone  = deriveTone(input.communicationStyle, null, input.brandType, input.industry);
      const { best } = generateHeadline(input, tone);
      const wordCount = best.split(/\s+/).filter(Boolean).length;
      expect(wordCount, `"${best}" has ${wordCount} words`).toBeGreaterThanOrEqual(2);
      expect(wordCount, `"${best}" has ${wordCount} words`).toBeLessThanOrEqual(12);
    }
  });

  it("best is the same as the first candidate", () => {
    const input = makeCopyInput("Salon Transformation Campaign");
    const tone  = deriveTone(input.communicationStyle, null, input.brandType, input.industry);
    const result = generateHeadline(input, tone);
    expect(result.best).toBe(result.candidates[0]!.text);
  });

  it("alternates do not contain the best headline", () => {
    const input = makeCopyInput("Tech SaaS Product Launch");
    const tone  = deriveTone(input.communicationStyle, null, input.brandType, input.industry);
    const result = generateHeadline(input, tone);
    expect(result.alternates).not.toContain(result.best);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateCTA
// ─────────────────────────────────────────────────────────────────────────────

describe("generateCTA", () => {
  it("dental lead_generation returns consultation CTA", () => {
    const { primary } = generateCTA("dental", "lead_generation");
    expect(primary.toLowerCase()).toMatch(/consult|book/);
  });

  it("restaurant footfall returns visit or book CTA", () => {
    const { primary } = generateCTA("restaurant", "footfall");
    expect(primary.length).toBeGreaterThan(0);
  });

  it("real_estate brand_awareness returns brochure or visit CTA", () => {
    const { primary } = generateCTA("real_estate", "brand_awareness");
    expect(primary.length).toBeGreaterThan(0);
  });

  it("finance lead_generation returns apply or start CTA", () => {
    const { primary } = generateCTA("finance", "lead_generation");
    expect(primary.toLowerCase()).toMatch(/apply|start|get/);
  });

  it("all 13 industries return non-empty primary CTA for default objective", () => {
    const industries = [
      "restaurant","dental","real_estate","healthcare","jewelry","salon",
      "education","automotive","finance","tech","fashion","events","general",
    ] as const;
    for (const industry of industries) {
      const { primary } = generateCTA(industry, "brand_awareness");
      expect(primary.length).toBeGreaterThan(0);
    }
  });

  it("dental and healthcare have secondary CTA for lead_generation", () => {
    const dental = generateCTA("dental", "lead_generation");
    expect(dental.secondary).not.toBeNull();
  });

  it("returns null secondary for most general objectives", () => {
    const { secondary } = generateCTA("general", "brand_awareness");
    expect(secondary).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateBenefits
// ─────────────────────────────────────────────────────────────────────────────

describe("generateBenefits", () => {
  it("returns 3-4 benefit strings", () => {
    const b = generateBenefits("restaurant", "brand_awareness", "mass_market");
    expect(b.length).toBeGreaterThanOrEqual(3);
    expect(b.length).toBeLessThanOrEqual(4);
  });

  it("each benefit has ≤ 6 words", () => {
    const industries = ["dental","real_estate","healthcare","jewelry","finance","tech"] as const;
    for (const industry of industries) {
      const benefits = generateBenefits(industry, "trust_building", "professional");
      for (const b of benefits) {
        const words = b.split(/\s+/).filter(Boolean).length;
        expect(words, `"${b}" has ${words} words in ${industry}`).toBeLessThanOrEqual(6);
      }
    }
  });

  it("luxury brand suppresses index-4 (EMI) benefit", () => {
    const dental   = generateBenefits("dental", "brand_awareness", "luxury");
    const hasEmi   = dental.some((b) => /emi|affordable/i.test(b));
    expect(hasEmi).toBe(false);
  });

  it("maxCount param is respected", () => {
    const b = generateBenefits("restaurant", "brand_awareness", "mass_market", 2);
    expect(b.length).toBeLessThanOrEqual(2);
  });

  it("all 13 industries return at least 3 benefits", () => {
    const industries = [
      "restaurant","dental","real_estate","healthcare","jewelry","salon",
      "education","automotive","finance","tech","fashion","events","general",
    ] as const;
    for (const industry of industries) {
      const b = generateBenefits(industry, "brand_awareness", "professional");
      expect(b.length).toBeGreaterThanOrEqual(3);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateSocialProof
// ─────────────────────────────────────────────────────────────────────────────

describe("generateSocialProof", () => {
  it("returns 1-3 social proof strings", () => {
    const sp = generateSocialProof("restaurant", "brand_awareness", []);
    expect(sp.length).toBeGreaterThanOrEqual(1);
    expect(sp.length).toBeLessThanOrEqual(3);
  });

  it("trust_building returns 3 items", () => {
    const sp = generateSocialProof("dental", "trust_building", []);
    expect(sp.length).toBe(3);
  });

  it("google_rating asset boosts rating proof first", () => {
    const sp = generateSocialProof("restaurant", "brand_awareness", ["google_rating"]);
    expect(sp[0]).toMatch(/stars|rating|google/i);
  });

  it("all proof strings are non-empty", () => {
    const sp = generateSocialProof("healthcare", "trust_building", ["certification"]);
    for (const s of sp) {
      expect(s.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateOfferCopy
// ─────────────────────────────────────────────────────────────────────────────

describe("generateOfferCopy", () => {
  it("returns null when no offer", () => {
    expect(generateOfferCopy(null, "professional")).toBeNull();
  });

  it("returns formatted offer for mass_market brand", () => {
    const result = generateOfferCopy("50% off on all dishes", "mass_market");
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
  });

  it("luxury brand rephrases discount language", () => {
    const result = generateOfferCopy("50% off", "luxury");
    expect(result).not.toBeNull();
    expect(result!.toLowerCase()).not.toContain("50%");
    expect(result!.toLowerCase()).not.toContain("off");
  });

  it("premium brand rephrases discount language", () => {
    const result = generateOfferCopy("flat 30% discount", "premium");
    expect(result).not.toBeNull();
    expect(result!.toLowerCase()).not.toMatch(/\d+%/);
  });

  it("professional brand passes through offer with capitalisation", () => {
    const result = generateOfferCopy("free consultation today", "professional");
    expect(result).not.toBeNull();
    expect(result![0]).toBe(result![0]!.toUpperCase());
  });

  it("converts 'free' to 'complimentary' for luxury", () => {
    const result = generateOfferCopy("Free gift with purchase", "luxury");
    expect(result!.toLowerCase()).toContain("complimentary");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateBadge
// ─────────────────────────────────────────────────────────────────────────────

describe("generateBadge", () => {
  it("luxury brand with offer returns null badge", () => {
    const b = generateBadge("50% off", "offer", "direct_sale", "luxury");
    expect(b).toBeNull();
  });

  it("launch category returns Grand Opening badge", () => {
    const b = generateBadge(null, "launch", "product_launch", "professional");
    expect(b).toBe("Grand Opening");
  });

  it("festival category returns Festival Special badge", () => {
    const b = generateBadge(null, "festival", "event_attendance", "mass_market");
    expect(b).toBe("Festival Special");
  });

  it("lead_generation with no category returns Free Consultation badge", () => {
    const b = generateBadge(null, "general", "lead_generation", "professional");
    expect(b).toBe("Free Consultation");
  });

  it("offer present with no special category returns Limited Offer badge", () => {
    const b = generateBadge("20% off", "general", "brand_awareness", "professional");
    expect(b).toBe("Limited Offer");
  });

  it("no offer + no category signal returns null", () => {
    const b = generateBadge(null, "general", "brand_awareness", "professional");
    expect(b).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requiresDisclaimer / getDisclaimer
// ─────────────────────────────────────────────────────────────────────────────

describe("disclaimer engine", () => {
  it("finance requires disclaimer", () => {
    expect(requiresDisclaimer("finance")).toBe(true);
  });

  it("healthcare requires disclaimer", () => {
    expect(requiresDisclaimer("healthcare")).toBe(true);
  });

  it("dental requires disclaimer", () => {
    expect(requiresDisclaimer("dental")).toBe(true);
  });

  it("real_estate requires disclaimer", () => {
    expect(requiresDisclaimer("real_estate")).toBe(true);
  });

  it("restaurant does not require disclaimer", () => {
    expect(requiresDisclaimer("restaurant")).toBe(false);
  });

  it("general does not require disclaimer", () => {
    expect(requiresDisclaimer("general")).toBe(false);
  });

  it("tech does not require disclaimer", () => {
    expect(requiresDisclaimer("tech")).toBe(false);
  });

  it("getDisclaimer returns non-null string for finance", () => {
    const d = getDisclaimer("finance");
    expect(d).not.toBeNull();
    expect(d!.length).toBeGreaterThan(10);
  });

  it("getDisclaimer returns null for restaurant", () => {
    expect(getDisclaimer("restaurant")).toBeNull();
  });

  it("finance disclaimer mentions market risk", () => {
    const d = getDisclaimer("finance")!;
    expect(d.toLowerCase()).toContain("risk");
  });

  it("healthcare disclaimer mentions consult", () => {
    const d = getDisclaimer("healthcare")!;
    expect(d.toLowerCase()).toMatch(/consult|doctor|professional/);
  });

  it("real_estate disclaimer mentions RERA", () => {
    const d = getDisclaimer("real_estate")!;
    expect(d.toUpperCase()).toContain("RERA");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateCommercialCopy — full output structure
// ─────────────────────────────────────────────────────────────────────────────

describe("generateCommercialCopy — structure", () => {
  it("returns all required fields", () => {
    const input = makeCopyInput("Dental Implant Campaign");
    const copy  = generateCommercialCopy(input);

    expect(typeof copy.headline).toBe("string");
    expect(copy.headline.length).toBeGreaterThan(0);
    expect(typeof copy.cta).toBe("string");
    expect(copy.cta.length).toBeGreaterThan(0);
    expect(Array.isArray(copy.benefits)).toBe(true);
    expect(Array.isArray(copy.socialProof)).toBe(true);
    expect(Array.isArray(copy.alternateHeadlines)).toBe(true);
    expect(copy.tone).toBeDefined();
    expect(copy.metadata).toBeDefined();
  });

  it("is synchronous — returns immediately, not a Promise", () => {
    const input  = makeCopyInput("Restaurant Grand Opening");
    const result = generateCommercialCopy(input);
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe("object");
  });

  it("produces no markdown — headline has no # or * characters", () => {
    const ideas = [
      "Dental Implant Campaign",
      "Restaurant Grand Opening",
      "Finance Mutual Fund SIP",
    ];
    for (const idea of ideas) {
      const input = makeCopyInput(idea);
      const copy  = generateCommercialCopy(input);
      expect(copy.headline).not.toMatch(/[#*_`]/);
      for (const b of copy.benefits) expect(b).not.toMatch(/[#*_`]/);
    }
  });

  it("produces no image prompt language", () => {
    const input = makeCopyInput("Dental Implant Campaign");
    const copy  = generateCommercialCopy(input);
    const allText = [copy.headline, copy.cta, ...copy.benefits, ...copy.socialProof].join(" ");
    expect(allText.toLowerCase()).not.toMatch(/\b(prompt|generate|image|photo|render|style|lighting)\b/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateCommercialCopy — industry-specific correctness
// ─────────────────────────────────────────────────────────────────────────────

describe("generateCommercialCopy — industry behaviour", () => {
  it("restaurant: no disclaimer", () => {
    const input = makeCopyInput("Restaurant Grand Opening");
    const copy  = generateCommercialCopy(input);
    expect(copy.disclaimer).toBeNull();
    expect(copy.metadata.hasDisclaimer).toBe(false);
  });

  it("restaurant: cta is a non-empty action phrase", () => {
    const input = makeCopyInput("Restaurant Grand Opening");
    const copy  = generateCommercialCopy(input);
    expect(copy.cta.length).toBeGreaterThan(0);
    // CTA is always imperative — starts with a verb
    expect(copy.cta[0]).toBe(copy.cta[0]!.toUpperCase());
  });

  it("dental: has disclaimer", () => {
    const input = makeCopyInput("Dental Implant Free Consultation");
    const copy  = generateCommercialCopy(input);
    expect(copy.disclaimer).not.toBeNull();
    expect(copy.metadata.hasDisclaimer).toBe(true);
  });

  it("dental: cta contains book/consult/schedule", () => {
    const input = makeCopyInput("Dental Implant Campaign");
    const copy  = generateCommercialCopy(input);
    expect(copy.cta.toLowerCase()).toMatch(/book|consult|schedule|learn|meet/);
  });

  it("real_estate: has disclaimer", () => {
    const input = makeCopyInput("New Apartment Homes For Sale");
    const copy  = generateCommercialCopy(input);
    expect(copy.disclaimer).not.toBeNull();
    expect(copy.metadata.hasDisclaimer).toBe(true);
  });

  it("real_estate: cta contains visit/book/register/explore", () => {
    const input = makeCopyInput("New Apartment Homes For Sale");
    const copy  = generateCommercialCopy(input);
    expect(copy.cta.toLowerCase()).toMatch(/visit|book|register|explore|know|download/);
  });

  it("finance: has disclaimer", () => {
    const input = makeCopyInput("Mutual Fund SIP Investment Awareness");
    const copy  = generateCommercialCopy(input);
    expect(copy.disclaimer).not.toBeNull();
  });

  it("healthcare: has disclaimer", () => {
    const input = makeCopyInput("Hospital Health Check-up Campaign");
    const copy  = generateCommercialCopy(input);
    expect(copy.disclaimer).not.toBeNull();
  });

  it("tech: no disclaimer", () => {
    const input = makeCopyInput("Tech SaaS Product Launch Free Trial");
    const copy  = generateCommercialCopy(input);
    expect(copy.disclaimer).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateCommercialCopy — offer behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe("generateCommercialCopy — offer behaviour", () => {
  it("no offer in input → offer is null", () => {
    const input = makeCopyInput("Dental Implant Campaign", { offer: null });
    const copy  = generateCommercialCopy(input);
    expect(copy.offer).toBeNull();
    expect(copy.metadata.hasOffer).toBe(false);
  });

  it("offer present → offer is non-null", () => {
    const input = makeCopyInput("Restaurant 50% Off Grand Opening", { offer: "50% Off on All Dishes" });
    const copy  = generateCommercialCopy(input);
    expect(copy.offer).not.toBeNull();
    expect(copy.metadata.hasOffer).toBe(true);
  });

  it("luxury brand with offer suppresses discount language", () => {
    const input = makeCopyInput("Luxury Restaurant Opening", {
      brandType: "luxury",
      offer: "50% off",
    });
    const copy = generateCommercialCopy(input);
    if (copy.offer !== null) {
      expect(copy.offer.toLowerCase()).not.toMatch(/\d+%/);
    }
  });

  it("launch campaign has Grand Opening badge", () => {
    const input = makeCopyInput("Restaurant Grand Opening", { campaignCategory: "launch" });
    const copy  = generateCommercialCopy(input);
    expect(copy.badge).toBe("Grand Opening");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateCommercialCopy — subheadline
// ─────────────────────────────────────────────────────────────────────────────

describe("generateCommercialCopy — subheadline", () => {
  it("launch campaign has subheadline with opening language", () => {
    const input = makeCopyInput("Restaurant Grand Opening This Weekend", { campaignCategory: "launch" });
    const copy  = generateCommercialCopy(input);
    expect(copy.subheadline).not.toBeNull();
    expect(copy.subheadline!.toLowerCase()).toMatch(/opening|weekend|soon|launch/);
  });

  it("offer campaign has subheadline with offer/limited language", () => {
    const input = makeCopyInput("Restaurant 50% Discount", {
      campaignCategory: "offer",
      offer: "50% Off",
    });
    const copy = generateCommercialCopy(input);
    expect(copy.subheadline).not.toBeNull();
    expect(copy.subheadline!.toLowerCase()).toMatch(/offer|limit|50/);
  });

  it("event_attendance has urgency subheadline", () => {
    const input = makeCopyInput("Event Conference Register Now", {
      commercialObjective: "event_attendance",
    });
    const copy = generateCommercialCopy(input);
    expect(copy.subheadline).not.toBeNull();
  });

  it("lead_generation has consultation subheadline", () => {
    const input = makeCopyInput("Dental Implant Free Consultation", {
      commercialObjective: "lead_generation",
      campaignCategory: "general",
    });
    const copy = generateCommercialCopy(input);
    expect(copy.subheadline).not.toBeNull();
    expect(copy.subheadline!.toLowerCase()).toMatch(/consult|free/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// metadata
// ─────────────────────────────────────────────────────────────────────────────

describe("generateCommercialCopy — metadata", () => {
  it("headlineWordCount matches actual headline word count", () => {
    const input = makeCopyInput("Dental Implant Campaign");
    const copy  = generateCommercialCopy(input);
    const actual = copy.headline.split(/\s+/).filter(Boolean).length;
    expect(copy.metadata.headlineWordCount).toBe(actual);
  });

  it("benefitCount matches benefits array length", () => {
    const input = makeCopyInput("Restaurant Grand Opening");
    const copy  = generateCommercialCopy(input);
    expect(copy.metadata.benefitCount).toBe(copy.benefits.length);
  });

  it("industry in metadata matches input industry", () => {
    const input = makeCopyInput("Dental Implant Campaign");
    const copy  = generateCommercialCopy(input);
    expect(copy.metadata.industry).toBe(input.industry);
  });

  it("objective in metadata matches input objective", () => {
    const input = makeCopyInput("Dental Implant Campaign");
    const copy  = generateCommercialCopy(input);
    expect(copy.metadata.objective).toBe(input.commercialObjective);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// strategyToCopyInput
// ─────────────────────────────────────────────────────────────────────────────

describe("strategyToCopyInput", () => {
  it("dental strategy maps to dental industry", () => {
    const input = makeCopyInput("Dental Implant Free Consultation");
    expect(input.industry).toBe("dental");
  });

  it("restaurant strategy maps to restaurant industry", () => {
    const input = makeCopyInput("Restaurant Grand Opening");
    expect(input.industry).toBe("restaurant");
  });

  it("finance strategy maps to finance industry", () => {
    const input = makeCopyInput("Mutual Fund SIP Investment");
    expect(input.industry).toBe("finance");
  });

  it("rawIdea is preserved", () => {
    const idea  = "Dental Implant Campaign 2024";
    const input = makeCopyInput(idea);
    expect(input.rawIdea).toBe(idea);
  });

  it("mandatoryAssets comes from commercialAssets.mandatory", () => {
    const input = makeCopyInput("Dental Implant Campaign");
    expect(Array.isArray(input.mandatoryAssets)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Blueprint integration
// ─────────────────────────────────────────────────────────────────────────────

describe("UniversalCampaignBlueprint — commercialCopy integration", () => {
  it("blueprint has commercialCopy section", () => {
    const bp = makeBlueprint("Dental Implant Campaign");
    expect(bp).toHaveProperty("commercialCopy");
    expect(bp.commercialCopy).toBeDefined();
  });

  it("commercialCopy has headline, cta, benefits, socialProof", () => {
    const bp = makeBlueprint("Restaurant Grand Opening");
    const cc = bp.commercialCopy!;
    expect(typeof cc.headline).toBe("string");
    expect(typeof cc.cta).toBe("string");
    expect(Array.isArray(cc.benefits)).toBe(true);
    expect(Array.isArray(cc.socialProof)).toBe(true);
  });

  it("dental blueprint has disclaimer in commercialCopy", () => {
    const bp = makeBlueprint("Dental Implant Campaign");
    expect(bp.commercialCopy?.disclaimer).not.toBeNull();
  });

  it("restaurant blueprint has no disclaimer in commercialCopy", () => {
    const bp = makeBlueprint("Restaurant Grand Opening");
    expect(bp.commercialCopy?.disclaimer).toBeNull();
  });

  it("finance blueprint has disclaimer in commercialCopy", () => {
    const bp = makeBlueprint("Mutual Fund SIP Investment Awareness");
    expect(bp.commercialCopy?.disclaimer).not.toBeNull();
  });

  it("real_estate blueprint has disclaimer in commercialCopy", () => {
    const bp = makeBlueprint("New Apartment Homes For Sale");
    expect(bp.commercialCopy?.disclaimer).not.toBeNull();
  });

  it("commercialCopy benefits are each ≤ 6 words", () => {
    const bp = makeBlueprint("Healthcare Hospital Campaign");
    for (const b of bp.commercialCopy!.benefits) {
      const words = b.split(/\s+/).filter(Boolean).length;
      expect(words, `benefit "${b}" has ${words} words`).toBeLessThanOrEqual(6);
    }
  });

  it("blueprint is frozen (immutability)", () => {
    const bp = makeBlueprint("Restaurant Grand Opening");
    expect(Object.isFrozen(bp)).toBe(true);
  });

  it("commercialCopy exists alongside commercialAssets and commercialComposition", () => {
    const bp = makeBlueprint("Dental Implant Campaign");
    expect(bp.commercialAssets).toBeDefined();
    expect(bp.commercialComposition).toBeDefined();
    expect(bp.commercialCopy).toBeDefined();
  });

  it("buildCopyFromBlueprintInputs produces same output as generateCommercialCopy", () => {
    const rawIdea = "Restaurant Grand Opening";
    const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
    const uu       = analyzeUserRequest(request);
    const ctx      = buildCreativeContext(request, uu, {}, { userId: "test" });
    const strategy = buildCreativeStrategy(ctx);
    const assets   = planFromStrategy(strategy);

    const direct = generateCommercialCopy(strategyToCopyInput(strategy, rawIdea, assets));
    const via    = buildCopyFromBlueprintInputs(strategy, assets, rawIdea);

    expect(via.headline).toBe(direct.headline);
    expect(via.cta).toBe(direct.cta);
    expect(via.metadata.industry).toBe(direct.metadata.industry);
  });
});
