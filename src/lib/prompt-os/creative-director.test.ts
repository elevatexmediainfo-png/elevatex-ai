import { describe, expect, it, vi } from "vitest";

import { creativeBriefSchema } from "./creative-director";

vi.mock("@/lib/generation/llm", () => ({
  generateScript: vi.fn(),
}));

describe("creativeBriefSchema", () => {
  it("accepts a minimal/empty object, filling in safe defaults", () => {
    const parsed = creativeBriefSchema.parse({});
    expect(parsed.visualStrategy).toEqual({});
    expect(parsed.messagingStrategy).toEqual({});
    expect(parsed.compositionStrategy).toEqual({});
    expect(parsed.marketingObjective).toBeUndefined();
    // Creative Director 2.0 sections.
    expect(parsed.informationArchitecture).toEqual({});
    expect(parsed.advertisementComposition).toEqual({});
    expect(parsed.designSystem).toEqual({});
    expect(parsed.visualStory).toBeUndefined();
    expect(parsed.visualHierarchy).toBeUndefined();
    expect(parsed.premiumElements).toBeUndefined();
    // Image Quality Stabilization — Decision Quality fields.
    expect(parsed.visualFormat).toBeUndefined();
    expect(parsed.heroSubject).toBeUndefined();
    expect(parsed.layoutArchetype).toBeUndefined();
    expect(parsed.visualDensity).toBeUndefined();
    expect(parsed.copywriting).toEqual({});
  });

  // Image Quality Stabilization — Decision Quality: 5 new fields from Step 0
  // and Step 10. These are the primary quality improvement over Creative
  // Director 2.0: explicit format classification, hero-subject decision, named
  // layout archetype, density control, and actual render-ready copy.
  it("accepts and preserves all 5 Decision Quality fields", () => {
    const parsed = creativeBriefSchema.parse({
      visualFormat: "Educational Infographic",
      heroSubject: "Patient following post-op dental precautions",
      layoutArchetype: "Split Screen",
      visualDensity: "rich",
      copywriting: {
        headline: "Rediscover Your Smile",
        subheadline: "Board-certified implant specialists",
        cta: "Book Free Consultation",
        benefitTitles: ["Permanent", "Natural-Looking", "Pain-Free"],
        featureLabels: ["Same-Day Procedure", "Lifetime Guarantee"],
        trustStatements: ["15+ Years Experience", "500+ Successful Cases"],
        badgeText: "ISO Certified Clinic",
      },
    });

    expect(parsed.visualFormat).toBe("Educational Infographic");
    expect(parsed.heroSubject).toBe("Patient following post-op dental precautions");
    expect(parsed.layoutArchetype).toBe("Split Screen");
    expect(parsed.visualDensity).toBe("rich");
    expect(parsed.copywriting.headline).toBe("Rediscover Your Smile");
    expect(parsed.copywriting.cta).toBe("Book Free Consultation");
    expect(parsed.copywriting.benefitTitles).toEqual(["Permanent", "Natural-Looking", "Pain-Free"]);
    expect(parsed.copywriting.trustStatements).toEqual(["15+ Years Experience", "500+ Successful Cases"]);
    expect(parsed.copywriting.badgeText).toBe("ISO Certified Clinic");
  });

  it("coerces a bare string into a single-element array for copywriting.benefitTitles", () => {
    const parsed = creativeBriefSchema.parse({
      copywriting: { benefitTitles: "Permanent" },
    });
    expect(parsed.copywriting.benefitTitles).toEqual(["Permanent"]);
  });

  // Creative Director 2.0 — Advertising Campaign Intelligence: every field
  // named across the user's literal 10-step planning process.
  it("accepts a fully-populated 10-step advertising campaign brief", () => {
    const parsed = creativeBriefSchema.parse({
      businessSummary: "A premium dental implant clinic",
      marketingObjective: "Generate qualified consultation bookings",
      creativeObjective: "Position implants as a luxury, trustworthy investment",
      targetAudience: "Adults 35-60 considering dental implants",
      brandPersonality: "Reassuring, expert, modern",
      valueProposition: "A permanent, natural-feeling smile restored by board-certified specialists",
      creativeApproach: "reassure and build trust",
      visualStory:
        "An experienced implant specialist confidently explaining a realistic dental implant model to a reassured patient inside a premium modern clinic immediately after surgery.",
      visualHierarchy: ["Headline", "Hero Subject", "Supporting Information", "Benefits", "Social Proof", "CTA", "Logo"],
      informationArchitecture: {
        heroSection: "The specialist-patient consultation moment",
        headline: "Your Confident Smile Starts Here",
        supportingCopy: "Board-certified specialists, lifetime guarantee",
        featureIcons: "tooth icon, shield icon, calendar icon",
        benefitSection: "Permanent, natural-looking, pain-free recovery",
        trustIndicators: "Board certification badge, 15 years experience",
        testimonialArea: "Patient quote with before/after thumbnail",
        ctaArea: "Book a free consultation button, bottom center",
        contactSection: "Phone number and clinic address, footer",
        brandArea: "Clinic logo and tagline, top left",
        logoSafeArea: "Top-left corner, clear of all other elements",
      },
      messagingStrategy: {
        primaryMessage: "Transform your smile, transform your life.",
        secondaryMessage: "Experience the luxury of a confident smile.",
        headlineDirection: "Concise, impactful, positioned to capture attention quickly",
        trustSignals: ["Clinical certifications", "Testimonials from satisfied clients"],
      },
      colorPsychology: "Clinical blue conveys trust, warm cream conveys approachability",
      layoutDirection: "Generous negative space, central hero composition",
      compositionStrategy: { compositionPriority: "the specialist-patient interaction" },
      advertisementComposition: {
        heroImage: "Specialist explaining implant model to patient",
        supportingVisuals: "Close-up of the implant model",
        backgroundStory: "Premium modern clinic interior, softly blurred",
        informationCards: "Three benefit cards beneath the hero image",
        premiumUIPanels: "A frosted-glass panel framing the trust indicators",
        floatingCards: "A floating testimonial card, lower right",
        premiumGlassSections: "Glassmorphism panel behind the CTA",
        ctaBlocks: "A bold pill-shaped CTA button",
        logoPlacement: "Top-left corner",
        contactInformation: "Footer bar with phone and address",
        editorialGrid: "12-column magazine-style grid",
      },
      premiumElements: ["Trust Badges", "Testimonials", "Before/After"],
      typographyStrategy: "Clean sans-serif with generous letter-spacing",
      designSystem: {
        gridSystem: "12-column editorial grid",
        alignment: "left-aligned body copy, centered hero",
        typographyScale: "Modular scale, 1.25 ratio",
        fontPairing: "Geometric sans headline, humanist sans body",
        iconStyle: "Thin-line, rounded-cap icons",
        colorHarmony: "Analogous blues with one warm accent",
        visualRhythm: "Alternating dense/open sections",
        balance: "Asymmetric but weighted",
        contrast: "High contrast headline against soft background",
        depth: "Subtle drop shadows on floating cards",
        shadows: "Soft, diffused, low-opacity",
        whiteSpace: "Generous margins, 8px spacing system",
      },
      callToAction: "Book your free consultation today",
      attentionHook: "A confident, natural smile mid-laugh",
      scrollStoppingStrategy: "Instantly communicates what (implants), why (confidence), who (this patient), and what's next (book now)",
      platformOptimization: "Square crop, safe-zone text for Instagram feed",
      creativeConfidence: "high — strong industry signal and clear product category",
    });

    expect(parsed.valueProposition).toContain("natural-feeling smile");
    expect(parsed.visualStory).toContain("implant specialist");
    expect(parsed.visualHierarchy).toEqual(["Headline", "Hero Subject", "Supporting Information", "Benefits", "Social Proof", "CTA", "Logo"]);
    expect(parsed.informationArchitecture.heroSection).toContain("specialist-patient");
    expect(parsed.advertisementComposition.premiumGlassSections).toContain("Glassmorphism");
    expect(parsed.premiumElements).toEqual(["Trust Badges", "Testimonials", "Before/After"]);
    expect(parsed.designSystem.colorHarmony).toContain("Analogous");
    expect(parsed.scrollStoppingStrategy).toContain("what's next");
  });

  it("accepts a fully-populated object", () => {
    const parsed = creativeBriefSchema.parse({
      businessSummary: "A boutique jewellery brand launching a new collection",
      marketingObjective: "Drive pre-launch waitlist signups",
      creativeObjective: "Position the collection as aspirational yet attainable",
      targetAudience: "Affluent women 28-45 interested in fine jewellery",
      brandPersonality: "Elegant, confident, understated luxury",
      visualStrategy: {
        visualDirection: "Macro product shots with soft jewel-toned light",
        emotionalDirection: "Aspirational desire",
        luxuryLevel: "high",
        minimalismLevel: "moderate",
        realismLevel: "photorealistic",
        storyDirection: "A moment of quiet self-reward",
      },
      messagingStrategy: {
        primaryMessage: "Crafted to be treasured",
        secondaryMessage: "Limited launch collection",
        headlineDirection: "Short, evocative, no exclamation marks",
        trustSignals: ["handcrafted", "lifetime warranty"],
      },
      colorPsychology: "Deep jewel tones signal richness and exclusivity",
      layoutDirection: "Centered product, generous negative space",
      compositionStrategy: { compositionPriority: "the piece itself, lit to catch the eye first" },
      typographyStrategy: "Thin serif, all-caps headline",
      callToAction: "Join the waitlist",
      attentionHook: "A single ring catching directional light mid-frame",
      platformOptimization: "Square crop, safe-zone text for Instagram feed",
      creativeConfidence: "high — clear product category and strong industry signal",
    });
    expect(parsed.marketingObjective).toBe("Drive pre-launch waitlist signups");
    expect(parsed.visualStrategy.visualDirection).toBe("Macro product shots with soft jewel-toned light");
    expect(parsed.messagingStrategy.trustSignals).toEqual(["handcrafted", "lifetime warranty"]);
  });

  it("tolerates unknown fields inside a nested section via catchall (extensibility)", () => {
    const parsed = creativeBriefSchema.parse({
      visualStrategy: { visualDirection: "bold", futureField: "some later concept" },
    });
    expect(parsed.visualStrategy.visualDirection).toBe("bold");
    expect((parsed.visualStrategy as Record<string, unknown>).futureField).toBe("some later concept");
  });

  it("coerces a bare string into a single-element array for trustSignals (same LLM-shape-drift class as universalPromptSchema's array fields)", () => {
    const parsed = creativeBriefSchema.parse({
      messagingStrategy: { trustSignals: "handcrafted" },
    });
    expect(parsed.messagingStrategy.trustSignals).toEqual(["handcrafted"]);
  });

  it("coerces a bare string into a single-element array for visualHierarchy and premiumElements", () => {
    const parsed = creativeBriefSchema.parse({
      visualHierarchy: "Headline",
      premiumElements: "Trust Badges",
    });
    expect(parsed.visualHierarchy).toEqual(["Headline"]);
    expect(parsed.premiumElements).toEqual(["Trust Badges"]);
  });

  // Confirmed live with gpt-4o-mini, not hypothetical: compositionStrategy
  // (a single-field section) was returned as a bare string, which
  // previously threw the entire Creative Brief out via ZodError.
  it("coerces a bare string into { compositionPriority: ... } for compositionStrategy", () => {
    const parsed = creativeBriefSchema.parse({
      compositionStrategy: "the specialist-patient interaction should draw the eye first",
    });
    expect(parsed.compositionStrategy.compositionPriority).toBe("the specialist-patient interaction should draw the eye first");
  });

  it("still accepts compositionStrategy in its documented object shape", () => {
    const parsed = creativeBriefSchema.parse({
      compositionStrategy: { compositionPriority: "the hero image" },
    });
    expect(parsed.compositionStrategy.compositionPriority).toBe("the hero image");
  });

  // Confirmed live with gpt-4o-mini: a plural-sounding field (featureIcons)
  // was returned as an array instead of one descriptive string, which
  // previously threw the entire Creative Brief out via ZodError.
  it("joins an array into one string for plural-sounding informationArchitecture/advertisementComposition fields", () => {
    const parsed = creativeBriefSchema.parse({
      informationArchitecture: { featureIcons: ["tooth icon", "shield icon"], trustIndicators: ["board certification"] },
      advertisementComposition: { supportingVisuals: ["close-up", "wide shot"] },
    });
    expect(parsed.informationArchitecture.featureIcons).toBe("tooth icon, shield icon");
    expect(parsed.informationArchitecture.trustIndicators).toBe("board certification");
    expect(parsed.advertisementComposition.supportingVisuals).toBe("close-up, wide shot");
  });

  it("still accepts those same fields as plain strings", () => {
    const parsed = creativeBriefSchema.parse({
      informationArchitecture: { featureIcons: "tooth icon, shield icon" },
    });
    expect(parsed.informationArchitecture.featureIcons).toBe("tooth icon, shield icon");
  });
});

describe("buildCreativeBrief", () => {
  it("parses the LLM's JSON response into a valid CreativeBrief", async () => {
    const { generateScript } = await import("@/lib/generation/llm");
    vi.mocked(generateScript).mockResolvedValue({
      text: JSON.stringify({
        marketingObjective: "Generate qualified leads for the new branch opening",
        targetAudience: "Local families seeking a trusted family dentist",
        visualStrategy: { visualDirection: "Bright, clean clinical photography with warm human moments" },
      }),
    });

    const { buildCreativeBrief } = await import("./creative-director");
    const result = await buildCreativeBrief({ idea: "Dental clinic promotion", kind: "MARKETING_CREATIVE" }, "test-user");

    expect(result.marketingObjective).toBe("Generate qualified leads for the new branch opening");
    expect(result.targetAudience).toBe("Local families seeking a trusted family dentist");
    expect(result.visualStrategy.visualDirection).toBe("Bright, clean clinical photography with warm human moments");
  });

  it("produces a genuinely different brief per idea — the wiring carries through whatever the model decides", async () => {
    const { generateScript } = await import("@/lib/generation/llm");
    const { buildCreativeBrief } = await import("./creative-director");

    vi.mocked(generateScript).mockResolvedValue({
      text: JSON.stringify({ marketingObjective: "Grow assets under management via SIP signups" }),
    });
    const mutualFund = await buildCreativeBrief({ idea: "Mutual Fund Advertisement", kind: "MARKETING_CREATIVE" }, "test-user");

    vi.mocked(generateScript).mockResolvedValue({
      text: JSON.stringify({ marketingObjective: "Drive pre-launch waitlist signups for a jewellery collection" }),
    });
    const jewellery = await buildCreativeBrief({ idea: "Jewellery Launch", kind: "MARKETING_CREATIVE" }, "test-user");

    expect(mutualFund.marketingObjective).not.toBe(jewellery.marketingObjective);
  });
});
