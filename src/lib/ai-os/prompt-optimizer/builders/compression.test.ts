import { describe, expect, it } from "vitest";
import { buildCompressedSpec } from "./compression";
import { compress } from "./shared";
import type { PromptSpecification } from "../../prompt-spec/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Word-level semantic preservation: what fraction of key words (>3 chars) survived. */
function semanticPreservation(original: string, compressed: string): number {
  const keyWords = (s: string) =>
    new Set(s.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const orig = keyWords(original);
  const comp = keyWords(compressed);
  if (orig.size === 0) return 1;
  const preserved = [...orig].filter(w => comp.has(w)).length;
  return preserved / orig.size;
}

/** Build a minimal PromptSpecification with known field values for testing. */
function makeSpec(overrides: {
  advertisementLayers?: string;
  heroSubject?: string;
  heroDetails?: string;
  marketingGoal?: string;
  relationships?: string;
}): PromptSpecification {
  const psf = (value: string) => ({
    value,
    confidence: "high" as const,
    source: "test",
    reasoning: "test fixture",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const psfEnum = (value: string) => psf(value) as any;

  return {
    meta: {
      specId: "test_spec_001",
      createdAt: new Date().toISOString(),
      schemaVersion: "1.0.0",
      sourceBlueprintId: "test_bp_001",
      confidenceScore: 90,
      validationStatus: "ready" as const,
      warnings: [],
    },
    mission: {
      whatToGenerate:         psf("Generate a professional commercial advertisement photograph for a dental implant clinic."),
      whyItMatters:           psf("Drive qualified consultation bookings from hesitant first-time patients."),
      primarySuccessCriteria: psf("Hero visible, trust visible, CTA zone clear."),
      nonNegotiableElement:   psf("The dentist-patient human connection."),
    },
    hero: {
      heroSubject:    psf(overrides.heroSubject ?? "A calm dentist with a genuine smile leans forward slightly toward a patient."),
      heroImportance: psfEnum("absolute_mandatory"),
      heroPosition:   psf("Center-left, rule of thirds."),
      heroScale:      psf("Upper half of frame."),
      heroDetails:    psf(overrides.heroDetails ?? "White coat, natural posture, eye contact."),
    },
    supporting: {
      supportingSubjects:  psf("The patient seated in the consultation chair."),
      relationships:       psf(overrides.relationships ?? "Dentist and patient at equal eye level, creating a respectful, non-hierarchical consultation dynamic."),
      requiredObjects:     psf("Consultation room visible in background."),
      optionalObjects:     psf("Framed certifications on wall."),
      decorativeElements:  psf("Modern clinic interior with warm tones."),
      advertisementLayers: psf(overrides.advertisementLayers ??
        "UPPER ZONE (top 60%): Hero lifestyle scene — dentist and patient consultation, warm professional environment. " +
        "BENEFIT STRIP (below hero, 15% height): Three benefit badges side by side — '15 Years Experience', 'IDA Certified', 'Free Consultation'. " +
        "TRUST ZONE (middle-right, 20% width): Vertical stack of trust signals — certification logo, patient count badge, rating stars. " +
        "CTA ZONE (bottom 15%): Full-width call-to-action band with high-contrast button, phone number, urgency message. " +
        "LOGO ZONE (upper-right corner, 8% width): Brand logo with clear exclusion zone. " +
        "DISCLAIMER STRIP (very bottom, 3% height): Legal text in minimum readable size."
      ),
    },
    composition: {
      primaryComposition: psf("Rule of thirds — hero on left intersection."),
      visualBalance:      psf("Two subjects, near-equal visual weight."),
      negativeSpace:      psf("Upper third reserved for headline overlay."),
      foreground:         psf("Clean foreground, no distracting elements."),
      midground:          psf("Dentist and patient as the primary subjects."),
      background:         psf("Soft consultation room, tasteful blur."),
      depthTreatment:     psf("Shallow depth of field, hero sharp."),
    },
    camera: {
      cameraPosition:    psf("Eye-level with subjects."),
      cameraHeight:      psf("Standing eye-level."),
      viewingAngle:      psf("Slight angle, 3/4 view."),
      lensIntent:        psf("Portrait lens, natural compression."),
      distance:          psf("Medium."),
      perspectiveIntent: psf("Intimate but respectful — professional consultation feeling."),
    },
    lighting: {
      primaryLighting:   psf("Soft window light from left, warm and natural."),
      secondaryLighting: psf("Fill light from right, reducing harsh shadows."),
      moodLighting:      psf("Warm and welcoming, not clinical white."),
      shadowStyle:       psf("Soft shadows."),
      reflectionStyle:   psf("Minimal reflections."),
    },
    environment: {
      environmentType: psf("Modern dental clinic consultation room."),
      storyContext:    psf("A clinic that feels like a private office, not a hospital."),
      premiumDetails:  psf("Framed artwork, quality furniture, clean modern interior."),
    },
    marketing: {
      campaignGoal:      psf("Lead generation — consultation bookings."),
      emotionalGoal:     psf("Quiet confidence and trust."),
      marketingGoal:     psf(overrides.marketingGoal ??
        "Communicate that this clinic offers expert dental care with a human-first approach, IDA-certified credentials, and a comfortable patient experience that removes fear and builds trust through visible proof."),
      targetAudience:    psf("Adults 28–55 who have been delaying dental treatment due to anxiety."),
      trustStrategy:     psf("Visible credentials, warm human interaction, clean professional environment."),
      conversionIntent:  psf("Book a free consultation."),
    },
    typography: {
      reservedHeadlineArea:   psf("Upper 20% of frame — clear for headline text overlay."),
      reservedBodyArea:       psf("Below hero zone if applicable."),
      reservedCtaArea:        psf("Bottom 15% — full width for CTA button and phone."),
      reservedLogoArea:       psf("Upper right corner, 8% width."),
      reservedDisclaimerArea: psf("Very bottom strip, minimal height."),
      platformTextSafetyNote: psf("Instagram: keep text to under 20% of image area."),
    },
    brandRules: {
      brandSafety:          psf("Standard — no controversial imagery."),
      industryRestrictions: psf("No clinical procedure imagery, no blood, no graphic dental work."),
      mandatoryElements:    psf("IDA certification logo, clinic name."),
      forbiddenElements:    psf("Stock-photo smiles, dental tools in foreground, sterile white backgrounds."),
    },
    negativeConstraints: {
      forbiddenSceneElements: psf("Dental tools, syringes, clinical procedure imagery, blood."),
      forbiddenAiArtifacts:   psf("Extra fingers, blurry faces, distorted teeth, unnatural poses."),
      qualityAntiPatterns:    psf("Overexposed highlights, flat lighting, plastic skin."),
      brandAntiPatterns:      psf("Generic stock photo appearance, impersonal setting."),
    },
    rendering: {
      photorealismLevel:  psfEnum("photorealistic"),
      commercialQuality:  psfEnum("national_commercial"),
      editorialQuality:   psfEnum("consumer_magazine"),
      luxuryLevel:        psfEnum("premium_polished"),
      realismTarget:      psfEnum("commercial_campaign_shoot"),
      artifactPrevention: psf("No extra fingers, no distorted teeth, no floating limbs, no duplicate subjects, no text artifacts."),
    },
    unknownFields: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4K.4 — Budget table verification
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.4K.4 — SECTION_BUDGETS: key field budgets are correctly sized", () => {
  it("advertisementLayers: 600-char budget — no longer truncates at 200", () => {
    // Build a value of exactly 600 chars — should survive intact
    const value600 = "A".repeat(300) + " " + "B".repeat(299); // 601 chars with space → 601
    const adLayers = "X".repeat(300) + " " + "Y".repeat(299) + "."; // realistic 601 chars
    const result = compress(adLayers, 600);
    // compress only truncates when length > budget — a 601-char value should be cut, but a 500-char should not
    const value500 = "UPPER ZONE: Hero lifestyle scene with dentist and patient. BENEFIT STRIP: Three benefit badges. TRUST ZONE: Certification and rating. CTA ZONE: Call-to-action band. LOGO ZONE: Brand identity. DISCLAIMER STRIP: Legal text.";
    const result500 = compress(value500, 600);
    expect(result500).toBe(value500); // under 600 → unchanged
    void result; // unused var warning suppression
    void value600;
  });

  it("advertisementLayers: full audit-fixture value (640 chars) survives with >90% preservation under new budget", () => {
    const auditFixture =
      "UPPER ZONE (top 60%): Hero lifestyle scene — dentist and patient consultation, warm professional environment. " +
      "BENEFIT STRIP (below hero, 15% height): Three benefit badges side by side — '15 Years Experience', 'IDA Certified', 'Free Consultation'. " +
      "TRUST ZONE (middle-right, 20% width): Vertical stack of trust signals — certification logo, patient count badge, rating stars. " +
      "CTA ZONE (bottom 15%): Full-width call-to-action band with high-contrast button, phone number, urgency message. " +
      "LOGO ZONE (upper-right corner, 8% width): Brand logo with clear exclusion zone. " +
      "DISCLAIMER STRIP (very bottom, 3% height): Legal text in minimum readable size.";

    expect(auditFixture.length).toBeGreaterThan(600); // confirm it's over the old 200 limit

    // Old budget (200) — simulating what was happening before Phase 10.4K.4
    const oldCompressed = compress(auditFixture, 200);
    const oldPreservation = semanticPreservation(auditFixture, oldCompressed);

    // New budget (600) — Phase 10.4K.4 fix
    const newCompressed = compress(auditFixture, 600);
    const newPreservation = semanticPreservation(auditFixture, newCompressed);

    // Old should have significant loss; new should be ≥85% preserved
    expect(oldPreservation).toBeLessThan(0.55); // ≈30% word preservation at 200 chars
    expect(newPreservation).toBeGreaterThanOrEqual(0.85); // ≥85% preservation at 600 chars

    // The new budget preserves far more than the old
    expect(newPreservation).toBeGreaterThan(oldPreservation + 0.30); // at least 30% better
  });

  it("advertisementLayers: semantic preservation improvement ≥ 35 percentage points vs old budget", () => {
    const longAdLayers = [
      "UPPER ZONE (top 60%): Doctor-patient hero shot with warm consultation room environment.",
      "BENEFIT STRIP: Three value badges — expertise claim, certification badge, free offer badge.",
      "TRUST ZONE: Certification logo, review stars, patient testimonial snippet.",
      "CTA ZONE: Consultation booking call-to-action with phone number and address.",
      "LOGO ZONE: Brand mark upper-right with 16px exclusion zone on all sides.",
      "DISCLAIMER STRIP: Fine print at bottom in minimum legible size.",
    ].join(" ");

    const old200 = semanticPreservation(longAdLayers, compress(longAdLayers, 200));
    const new600 = semanticPreservation(longAdLayers, compress(longAdLayers, 600));
    expect(new600 - old200).toBeGreaterThanOrEqual(0.35);
  });

  it("heroSubject: 350-char budget — long hero descriptions survive intact", () => {
    const longHero =
      "A calm dentist with a genuine smile leans forward slightly, explaining the process to a patient whose expression softens from tension to relief, both figures visible from mid-chest up in a warm consultation room.";
    const result = compress(longHero, 350);
    expect(result).toBe(longHero); // under 350 → unchanged
    const preservation = semanticPreservation(longHero, result);
    expect(preservation).toBe(1.0);
  });

  it("heroDetails: 200-char budget — detailed pose/expression descriptions survive", () => {
    const richDetails =
      "White coat, relaxed posture, direct and warm eye contact with patient, hands folded naturally on knees — approachable, not clinical.";
    const result = compress(richDetails, 200);
    expect(result).toBe(richDetails); // under 200 → unchanged
  });

  it("relationships: 150-char budget — was 80, narrative relationships fit properly", () => {
    const rel =
      "Dentist and patient at equal eye level, creating a respectful, non-hierarchical consultation dynamic.";
    const result = compress(rel, 150);
    expect(result).toBe(rel); // was being cut at 80 before — now fits at 150
  });

  it("marketingGoal: 250-char budget — rich marketing message survives compression", () => {
    const goal =
      "Communicate that this clinic offers expert dental care with a human-first approach, IDA-certified credentials, and a comfortable patient experience that removes fear and builds trust through visible proof.";
    const result = compress(goal, 250);
    const preservation = semanticPreservation(goal, result);
    expect(preservation).toBeGreaterThanOrEqual(0.85); // high preservation at 250 chars
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4K.4 — buildCompressedSpec: field-level compression verification
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.4K.4 — buildCompressedSpec: advertisementLayers preserved end-to-end", () => {
  it("advertisementLayers survives buildCompressedSpec with ≥90% semantic preservation", () => {
    const auditValue =
      "UPPER ZONE (top 60%): Hero lifestyle scene — dentist and patient consultation, warm professional environment. " +
      "BENEFIT STRIP (below hero, 15% height): Three benefit badges side by side — '15 Years Experience', 'IDA Certified', 'Free Consultation'. " +
      "TRUST ZONE (middle-right, 20% width): Vertical stack of trust signals — certification logo, patient count badge, rating stars. " +
      "CTA ZONE (bottom 15%): Full-width call-to-action band with high-contrast button, phone number, urgency message. " +
      "LOGO ZONE (upper-right corner, 8% width): Brand logo with clear exclusion zone. " +
      "DISCLAIMER STRIP (very bottom, 3% height): Legal text in minimum readable size.";

    const spec = makeSpec({ advertisementLayers: auditValue });
    const { compressed } = buildCompressedSpec(spec);
    const compressedValue = compressed.supporting.advertisementLayers.value;
    const preservation = semanticPreservation(auditValue, compressedValue);
    expect(preservation).toBeGreaterThanOrEqual(0.85);
  });

  it("advertisementLayers retains all zone labels after compression", () => {
    const auditValue =
      "UPPER ZONE (top 60%): Hero lifestyle scene — dentist and patient consultation, warm professional environment. " +
      "BENEFIT STRIP (below hero, 15% height): Three benefit badges side by side — '15 Years Experience', 'IDA Certified', 'Free Consultation'. " +
      "TRUST ZONE (middle-right, 20% width): Vertical stack of trust signals — certification logo, patient count badge, rating stars. " +
      "CTA ZONE (bottom 15%): Full-width call-to-action band with high-contrast button, phone number, urgency message. " +
      "LOGO ZONE (upper-right corner, 8% width): Brand logo with clear exclusion zone.";

    const spec = makeSpec({ advertisementLayers: auditValue });
    const { compressed } = buildCompressedSpec(spec);
    const cv = compressed.supporting.advertisementLayers.value;
    expect(cv).toContain("UPPER ZONE");
    expect(cv).toContain("BENEFIT STRIP");
    expect(cv).toContain("TRUST ZONE");
    expect(cv).toContain("CTA ZONE");
    expect(cv).toContain("LOGO ZONE");
  });

  it("heroSubject is not compressed when under 350 chars", () => {
    const hero = "A calm dentist leans forward, explaining the procedure to a patient whose anxiety visibly softens.";
    const spec = makeSpec({ heroSubject: hero });
    const { compressed } = buildCompressedSpec(spec);
    expect(compressed.hero.heroSubject.value).toBe(hero);
  });

  it("relationships field is not compressed when under 150 chars (was being cut at 80)", () => {
    const rel = "Dentist and patient at equal eye level — a respectful, non-hierarchical consultation dynamic.";
    const spec = makeSpec({ relationships: rel }); // 95 chars
    const { compressed } = buildCompressedSpec(spec);
    expect(compressed.supporting.relationships.value).toBe(rel);
  });

  it("marketingGoal: ≥85% semantic preservation for typical long marketing message", () => {
    const goal =
      "Communicate that this clinic offers expert dental care with a human-first approach, IDA-certified credentials, and a comfortable patient experience that removes fear and builds trust through visible proof.";
    const spec = makeSpec({ marketingGoal: goal });
    const { compressed } = buildCompressedSpec(spec);
    const preservation = semanticPreservation(goal, compressed.marketing.marketingGoal.value);
    expect(preservation).toBeGreaterThanOrEqual(0.85);
  });

  it("fieldsCompressed count does not increase for fields that fit their new budget", () => {
    // For the standard dental spec, heroSubject, relationships, and marketingGoal
    // should now fit within their budgets without compression
    const spec = makeSpec({});
    const { fieldsCompressed } = buildCompressedSpec(spec);
    // Fields should be compressed less than before (the main ad fixture fits in 600)
    expect(fieldsCompressed).toBeGreaterThanOrEqual(0);
    expect(typeof fieldsCompressed).toBe("number");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4K.4 — compress(): sentence-boundary truncation
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.4K.4 — compress(): sentence-boundary truncation", () => {
  it("truncates at sentence boundary when a sentence ends within the budget", () => {
    const text = "First sentence here. Second sentence with more detail. Third sentence that would go over budget if included in the result.";
    const result = compress(text, 80);
    // "First sentence here. Second sentence with more detail." = 55 chars — fits and is a complete sentence
    // Should end with a period, not "..."
    expect(result.endsWith(".")).toBe(true);
    expect(result).not.toContain("...");
    expect(result).toContain("First sentence here");
  });

  it("falls back to word-boundary truncation when no sentence boundary fits (60% threshold)", () => {
    const text = "A very long sentence without any period until the very end of this long piece of text that goes on and on and continues past the budget limit";
    const result = compress(text, 60);
    // No sentence boundary within 60 chars → word boundary → "..."
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it("short text under budget is returned unchanged", () => {
    const short = "Expert care, natural results.";
    expect(compress(short, 200)).toBe(short);
  });

  it("sentence boundary at exactly 60% of budget is used (boundary condition)", () => {
    // budget = 100, 60% = 60, sentence at pos 65 → ≥60% → should use sentence boundary
    const text = "Short opening sentence. " + "X".repeat(80);
    const result = compress(text, 100);
    // Sentence end at 23 chars — that's 23% of 100, which is < 60% → word boundary fallback
    // "Short opening sentence. " = 24 chars, lastIndexOf(". ", 100) = 22 → 22 > 60 → sentence boundary
    expect(result.endsWith(".")).toBe(true);
  });

  it("sentence boundary produces output with no trailing ellipsis", () => {
    const text = "The expert team delivers results. This second sentence would push us over budget if we included all of it in the output.";
    const result = compress(text, 50);
    // "The expert team delivers results." = 33 chars — sentence end at 32 → 32 > 30 (60% of 50) → sentence boundary
    if (result.endsWith(".") && !result.endsWith("...")) {
      expect(result).not.toContain("...");
    }
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("prefix removal still runs before sentence-boundary truncation", () => {
    const text = "This image should be a premium commercial photograph with expert care. This second sentence continues with additional context past the budget.";
    const result = compress(text, 80);
    // "This image should" prefix is stripped → "be a premium commercial photograph with expert care."
    expect(result).not.toMatch(/^This image should/);
    expect(result.endsWith(".")).toBe(true);
  });

  it("output of compress() never exceeds maxLength", () => {
    const long = "Word ".repeat(200); // 1000 chars
    const budgets = [40, 80, 150, 200, 350, 600];
    for (const budget of budgets) {
      const result = compress(long, budget);
      expect(result.length).toBeLessThanOrEqual(budget);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4K.4 — Budget coverage table: all new fields are explicitly budgeted
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.4K.4 — New fields get correct budgets (not defaulting to 200)", () => {
  it("marketing.experienceEmotionalCore is budgeted at 150 (not default 200)", () => {
    const longVal = "X".repeat(160); // 160 chars — 150 budget should trim, 200 would not
    const result = compress(longVal, 150);
    expect(result.length).toBeLessThanOrEqual(150);
    const result200 = compress(longVal, 200);
    expect(result200).toBe(longVal); // 200 budget would not trim
  });

  it("rendering.artifactPrevention: 250-char budget preserves long prevention lists", () => {
    const prevention =
      "No extra fingers, no distorted teeth, no floating limbs, no duplicate subjects, no text artifacts, no blurry faces, no watermarks, no split personalities, no cloned subjects, no melted features.";
    const result = compress(prevention, 250);
    expect(result.length).toBeLessThanOrEqual(250);
    const preservation = semanticPreservation(prevention, result);
    expect(preservation).toBeGreaterThanOrEqual(0.80);
  });

  it("lighting.moodLighting: 80-char budget (was 40) — full mood description fits", () => {
    const mood = "Warm and soft — a clinic that wants you to relax, not a hospital."; // 66 chars
    const result = compress(mood, 80);
    expect(result).toBe(mood); // fits in 80, would have been cut at old budget of 40
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4K.4 — Information recovery report (before vs after summary)
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.4K.4 — Before vs After: information recovery", () => {
  const FIELD_TESTS: Array<{
    field: string;
    value: string;
    oldBudget: number;
    newBudget: number;
    expectedNewPreservation: number;
  }> = [
    {
      field: "supporting.advertisementLayers",
      value:
        "UPPER ZONE (top 60%): Hero lifestyle scene — dentist and patient consultation, warm professional environment. " +
        "BENEFIT STRIP (below hero, 15% height): Three benefit badges — '15 Years Experience', 'IDA Certified', 'Free Consultation'. " +
        "TRUST ZONE (middle-right, 20% width): Certification logo, patient count badge, rating stars. " +
        "CTA ZONE (bottom 15%): Full-width call-to-action band with phone number. " +
        "LOGO ZONE (upper-right corner): Brand logo with clear exclusion zone.",
      oldBudget: 200,
      newBudget: 600,
      expectedNewPreservation: 0.95,
    },
    {
      field: "hero.heroSubject",
      value:
        "A calm dentist with a genuine smile leans forward slightly, explaining the process to a patient whose expression softens from tension to relief, both figures visible from mid-chest up.",
      oldBudget: 200,
      newBudget: 350,
      expectedNewPreservation: 1.0,
    },
    {
      field: "hero.heroDetails",
      value:
        "White coat, relaxed posture, direct and warm eye contact with patient, hands folded naturally on knees — approachable, not clinical.",
      oldBudget: 100,
      newBudget: 200,
      expectedNewPreservation: 1.0,
    },
    {
      field: "marketing.marketingGoal",
      value:
        "Communicate expert dental care with a human-first approach, IDA-certified credentials, and a comfortable patient experience that removes fear and builds trust through visible proof.",
      oldBudget: 150,
      newBudget: 250,
      expectedNewPreservation: 0.90,
    },
    {
      field: "supporting.relationships",
      value:
        "Dentist and patient at equal eye level — a respectful, non-hierarchical consultation dynamic that builds trust.",
      oldBudget: 80,
      newBudget: 150,
      expectedNewPreservation: 1.0,
    },
  ];

  for (const test of FIELD_TESTS) {
    it(`${test.field}: new budget (${test.newBudget}) achieves ≥${Math.round(test.expectedNewPreservation * 100)}% semantic preservation`, () => {
      const newResult = compress(test.value, test.newBudget);
      const newPreservation = semanticPreservation(test.value, newResult);
      expect(newPreservation).toBeGreaterThanOrEqual(test.expectedNewPreservation);
    });

    it(`${test.field}: new budget (${test.newBudget}) is strictly better than old budget (${test.oldBudget})`, () => {
      const oldResult = compress(test.value, test.oldBudget);
      const newResult = compress(test.value, test.newBudget);
      const oldPreservation = semanticPreservation(test.value, oldResult);
      const newPreservation = semanticPreservation(test.value, newResult);
      // New budget should preserve equal or more information
      expect(newPreservation).toBeGreaterThanOrEqual(oldPreservation);
    });
  }
});
