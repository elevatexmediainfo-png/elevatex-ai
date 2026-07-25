import { describe, expect, it } from "vitest";

import { universalPromptSchema } from "../schema";
import { matchIndustryProfile } from "./industry";
import { determineRichnessTier } from "./quality";
import { buildMarketingEnrichment } from "./marketing";

function promptWith(fields: Record<string, unknown>) {
  return universalPromptSchema.parse(fields);
}

describe("buildMarketingEnrichment", () => {
  it("reads the Creative Director's brief rather than re-inferring marketing objective/audience", () => {
    const prompt = promptWith({
      intent: "Dental implant informative creative",
      creativeBrief: {
        marketingObjective: "Drive new-patient consultations",
        targetAudience: "Adults 35-60 considering dental implants",
        brandPersonality: "Reassuring, expert, modern",
        callToAction: "Book a free consultation",
        attentionHook: "A confident, natural smile mid-laugh",
      },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildMarketingEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.marketing.goal).toContain("Drive new-patient consultations");
    expect(result.marketing.targetAudience).toBe("Adults 35-60 considering dental implants");
    expect(result.style.aesthetic).toContain("Reassuring, expert, modern");
    expect(result.marketing.psychologyHooks.some((h) => h.includes("Book a free consultation"))).toBe(true);
    expect(result.marketing.psychologyHooks).toContain("A confident, natural smile mid-laugh");
  });

  it("falls back to industry trust elements when no creativeBrief or marketing fields exist", () => {
    const prompt = promptWith({ intent: "Jewellery launch" });
    const profile = matchIndustryProfile(prompt);
    const result = buildMarketingEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(profile.trustElements.every((t) => result.marketing.psychologyHooks.includes(t))).toBe(true);
  });

  it("preserves the model's own style.mood instead of discarding it", () => {
    const prompt = promptWith({ intent: "Restaurant offer", style: { mood: "playful and energetic" } });
    const profile = matchIndustryProfile(prompt);
    const result = buildMarketingEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.style.mood).toContain("playful and energetic");
  });

  // Creative Director 2.0 — messagingStrategy.primaryMessage already existed
  // in the schema (Phase 2.4) but was never read here before this phase;
  // valueProposition is genuinely new (Step 1).
  it("folds messagingStrategy.primaryMessage and valueProposition into marketing.goal", () => {
    const prompt = promptWith({
      intent: "Dental implant informative creative",
      creativeBrief: {
        messagingStrategy: { primaryMessage: "Transform your smile, transform your life." },
        valueProposition: "A permanent, natural-feeling smile restored by board-certified specialists",
      },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildMarketingEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.marketing.goal).toContain("Transform your smile, transform your life.");
    expect(result.marketing.goal).toContain("A permanent, natural-feeling smile");
  });

  // Creative Director 2.0, Step 9 — scrollStoppingStrategy is the broader
  // instant-comprehension plan, distinct from attentionHook (the one
  // scroll-stopping element); messagingStrategy.secondaryMessage was also
  // previously unused.
  it("folds messagingStrategy.secondaryMessage and scrollStoppingStrategy into psychologyHooks", () => {
    const prompt = promptWith({
      intent: "Restaurant offer",
      creativeBrief: {
        messagingStrategy: { secondaryMessage: "Limited-time seasonal menu" },
        scrollStoppingStrategy: "Instantly communicates what, why, who, and what to do next",
      },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildMarketingEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.marketing.psychologyHooks).toContain("Limited-time seasonal menu");
    expect(result.marketing.psychologyHooks).toContain("Instantly communicates what, why, who, and what to do next");
  });

  // Image Quality Stabilization — copywriting section wiring
  it("folds copywriting.benefitTitles into psychologyHooks", () => {
    const prompt = promptWith({
      intent: "Dental implant informative creative",
      creativeBrief: {
        copywriting: {
          benefitTitles: ["Permanent", "Natural-Looking", "Pain-Free"],
        },
      },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildMarketingEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.marketing.psychologyHooks).toContain("Permanent");
    expect(result.marketing.psychologyHooks).toContain("Natural-Looking");
    expect(result.marketing.psychologyHooks).toContain("Pain-Free");
  });

  it("folds copywriting.trustStatements and badgeText into psychologyHooks", () => {
    const prompt = promptWith({
      intent: "Hospital health checkup",
      creativeBrief: {
        copywriting: {
          trustStatements: ["15+ Years Experience", "NABH Accredited"],
          badgeText: "ISO 9001 Certified",
        },
      },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildMarketingEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.marketing.psychologyHooks).toContain("15+ Years Experience");
    expect(result.marketing.psychologyHooks).toContain("NABH Accredited");
    expect(result.marketing.psychologyHooks).toContain("ISO 9001 Certified");
  });

  it("merges branding.brandVoice into style.aesthetic so it reaches the provider", () => {
    const prompt = promptWith({
      intent: "Brand campaign",
      branding: { brandVoice: "warm, approachable, expert" },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildMarketingEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.style.aesthetic).toContain("warm, approachable, expert");
  });

  it("combines brandVoice with brandPersonality from creativeBrief without losing either", () => {
    const prompt = promptWith({
      intent: "Brand campaign",
      branding: { brandVoice: "bold, confident" },
      creativeBrief: { brandPersonality: "trustworthy, premium" },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildMarketingEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.style.aesthetic).toContain("trustworthy, premium");
    expect(result.style.aesthetic).toContain("bold, confident");
  });
});
