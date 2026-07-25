import { describe, expect, it } from "vitest";

import { universalPromptSchema } from "../schema";
import { matchIndustryProfile } from "./industry";
import { determineRichnessTier } from "./quality";
import { buildCompositionEnrichment } from "./composition";

function promptWith(fields: Record<string, unknown>) {
  return universalPromptSchema.parse(fields);
}

describe("buildCompositionEnrichment", () => {
  it("weaves the model's own framing value in rather than discarding it", () => {
    const prompt = promptWith({ intent: "Product launch", composition: { framing: "low-angle hero shot" } });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    // composeFluently() capitalizes the first short-tag clause — test
    // case-insensitively since the value IS present, just capitalized.
    expect(result.composition.framing).toMatch(/low-angle hero shot/i);
  });

  it("always includes scroll-stopping/strong-focal-point visual-impact language", () => {
    const prompt = promptWith({ intent: "Product launch" });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.composition.framing).toMatch(/scroll-stopping/i);
  });

  it("reserves safe space for headline, CTA, and logo", () => {
    const prompt = promptWith({ intent: "Restaurant offer" });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.layout.headlinePosition).toMatch(/headline/i);
    expect(result.layout.ctaPosition).toMatch(/call-to-action/i);
    expect(result.layout.logoPosition).toMatch(/logo-safe/i);
  });

  it("folds the industry's premium-detail texture into composition.texture", () => {
    const prompt = promptWith({ intent: "Jewellery launch" });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.composition.texture).toContain(profile.premiumDetails);
  });

  // Provider Prompt Optimization, issue #4 — subjectHints previously only
  // appeared when prompt.composition.framing was empty, meaning it almost
  // never appeared once real LLM reasoning reliably fills framing (the
  // common case, confirmed live this session). It must now always enrich.
  it("includes the industry's subjectHints even when the model already supplied its own framing value", () => {
    const prompt = promptWith({
      intent: "Dental implant informative creative",
      composition: { framing: "a confident patient mid-smile" },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    // composeFluently() capitalizes the first short-tag clause — test case-insensitively.
    expect(result.composition.framing).toMatch(/a confident patient mid-smile/i);
    expect(result.composition.framing).toContain(profile.subjectHints);
  });

  it("still includes subjectHints when framing was empty (the previously-working fallback case)", () => {
    const prompt = promptWith({ intent: "Dental implant informative creative" });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.composition.framing).toContain(profile.subjectHints);
  });

  // Creative Director 2.0, Step 4 — "never generate isolated people, always
  // generate a complete story." visualStory must reach composition.framing
  // (the exact field describeComposition()/buildOpenAIPrompt() read).
  // composeFluently() correctly puts complete sentences AFTER the short-tag
  // clause, so visualStory appears after "scroll-stopping" in the final
  // string — that's the right grammar behavior, not a bug.
  it("weaves the Creative Director's complete visual story into composition.framing", () => {
    const prompt = promptWith({
      intent: "Dental implant informative creative",
      creativeBrief: {
        visualStory:
          "An experienced implant specialist confidently explaining a realistic dental implant model to a reassured patient inside a premium modern clinic immediately after surgery.",
      },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.composition.framing).toContain("An experienced implant specialist confidently explaining");
    // visualStory is a complete sentence (ends with period) so composeFluently()
    // correctly appends it AFTER the short-tag clause — not first, but present.
    expect(result.composition.framing).toContain("scroll-stopping");
  });

  it("prepends the Creative Director's ordered visual hierarchy sequence into layout.hierarchy", () => {
    const prompt = promptWith({
      intent: "Restaurant offer",
      creativeBrief: { visualHierarchy: ["Headline", "Hero Subject", "CTA"] },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.layout.hierarchy).toContain("Headline leading to Hero Subject leading to CTA");
  });

  it("folds a concise information-architecture summary (hero/benefit/trust/CTA) into layout.composition", () => {
    const prompt = promptWith({
      intent: "Dental implant informative creative",
      creativeBrief: {
        informationArchitecture: {
          heroSection: "Specialist-patient consultation moment",
          benefitSection: "Permanent, natural-looking results",
          trustIndicators: "Board certification badge",
          ctaArea: "Book a consultation button",
        },
      },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.layout.composition).toContain("Specialist-patient consultation moment");
    expect(result.layout.composition).toContain("Board certification badge");
  });

  // Image Quality Stabilization — Decision Quality wiring tests

  it("uses heroSubject from Creative Director as focalPoint instead of generic fallback", () => {
    const prompt = promptWith({
      intent: "Dental implant informative creative",
      creativeBrief: {
        heroSubject: "Patient following post-op dental precautions",
      },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.composition.focalPoint).toBe("Patient following post-op dental precautions");
    // Must NOT fall back to the generic phrase
    expect(result.composition.focalPoint).not.toContain("central subject, lit and framed");
  });

  it("falls back to the generic focalPoint when heroSubject is absent", () => {
    const prompt = promptWith({ intent: "Product launch" });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.composition.focalPoint).toContain("central subject");
  });

  it("prepends layoutArchetype into layout.composition when Director chose one", () => {
    const prompt = promptWith({
      intent: "Restaurant grand opening",
      creativeBrief: { layoutArchetype: "Split Screen" },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.layout.composition).toContain("Split Screen layout");
  });

  it("signals infographic format in layout.composition for non-photography visualFormats", () => {
    const prompt = promptWith({
      intent: "Mutual fund SIP awareness",
      creativeBrief: { visualFormat: "Educational Infographic" },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.layout.composition).toContain("Educational Infographic layout");
  });

  it("embeds actual headline text into headlinePosition when copywriting.headline is present", () => {
    const prompt = promptWith({
      intent: "Dental implant informative creative",
      creativeBrief: { copywriting: { headline: "Rediscover Your Smile" } },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.layout.headlinePosition).toContain(`headline: "Rediscover Your Smile"`);
    // The safe-area phrase must still be present
    expect(result.layout.headlinePosition).toContain("safe space for a bold headline");
  });

  it("embeds actual CTA text into ctaPosition when copywriting.cta is present", () => {
    const prompt = promptWith({
      intent: "Hospital health checkup",
      creativeBrief: { copywriting: { cta: "Book Free Checkup" } },
    });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    expect(result.layout.ctaPosition).toContain(`CTA button: "Book Free Checkup"`);
    expect(result.layout.ctaPosition).toContain("call-to-action");
  });

  it("falls back to position-only strings when copywriting is absent", () => {
    const prompt = promptWith({ intent: "Restaurant offer" });
    const profile = matchIndustryProfile(prompt);
    const result = buildCompositionEnrichment(prompt, profile, determineRichnessTier(prompt, profile));
    // No quoted text injected
    expect(result.layout.headlinePosition).not.toContain('headline: "');
    expect(result.layout.ctaPosition).not.toContain('CTA button: "');
    // But safe-area phrases still present
    expect(result.layout.headlinePosition).toContain("safe space");
    expect(result.layout.ctaPosition).toContain("call-to-action");
  });
});
