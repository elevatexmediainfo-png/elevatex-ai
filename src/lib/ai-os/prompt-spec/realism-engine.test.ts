import { describe, expect, it } from "vitest";
import { applyRealismVocabulary, getIndustryPhysicsNote } from "./realism-engine";
import { buildImageNativePrompt } from "./gpt-narrative";
import type { GPTCampaignDirection } from "../creative-director/gpt-types";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4A — applyRealismVocabulary: phrase substitutions
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.4A — applyRealismVocabulary: lighting substitutions", () => {
  it("converts 'warm ambient lighting' to Kelvin-based fill description", () => {
    const result = applyRealismVocabulary("warm ambient lighting");
    expect(result).toContain("3200K");
    expect(result).not.toBe("warm ambient lighting");
  });

  it("converts 'warm lighting' to tungsten practical description", () => {
    const result = applyRealismVocabulary("warm lighting");
    expect(result).toContain("3200K");
    expect(result).toContain("tungsten");
  });

  it("converts 'natural light' to 5500K daylight description", () => {
    const result = applyRealismVocabulary("natural light");
    expect(result).toContain("5500K");
  });

  it("converts 'natural lighting' (with -ing suffix) to 5500K daylight description", () => {
    const result = applyRealismVocabulary("natural lighting");
    expect(result).toContain("5500K");
  });

  it("converts 'soft lighting' to diffused description", () => {
    const result = applyRealismVocabulary("soft lighting");
    expect(result).toContain("diffused");
  });

  it("converts 'ambient lighting' to no-dominant-source description", () => {
    const result = applyRealismVocabulary("ambient lighting");
    expect(result).toContain("diffused");
  });

  it("converts 'golden light' to angled sun description", () => {
    const result = applyRealismVocabulary("golden light");
    expect(result).toContain("3000K");
  });

  it("converts 'warm station lighting' without double-'warm' in result", () => {
    const result = applyRealismVocabulary("warm station lighting");
    expect(result).toContain("3000K");
    // compound pattern fires — 'warm station lighting' replaced as one unit
    expect((result.match(/warm/gi) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("converts 'warm directional lighting' to raking-shadow description", () => {
    const result = applyRealismVocabulary("warm directional lighting");
    expect(result).toContain("3200K");
    expect(result).toContain("raking");
  });
});

describe("Phase 10.4A — applyRealismVocabulary: quality/material substitutions", () => {
  it("converts 'high quality' to micro-texture description", () => {
    const result = applyRealismVocabulary("high quality");
    expect(result).toContain("micro-texture");
  });

  it("converts 'high-quality' (hyphenated) to micro-texture description", () => {
    const result = applyRealismVocabulary("high-quality");
    expect(result).toContain("micro-texture");
  });

  it("converts 'high end' to material grain description", () => {
    const result = applyRealismVocabulary("high end");
    expect(result).toContain("material grain");
  });

  it("converts 'luxury feel' to hand-finished description", () => {
    const result = applyRealismVocabulary("luxury feel");
    expect(result).toContain("hand-finished");
  });

  it("converts 'luxurious' to hand-crafted description", () => {
    const result = applyRealismVocabulary("luxurious");
    expect(result).toContain("hand-crafted");
  });

  it("converts 'premium quality' to micro-texture description", () => {
    const result = applyRealismVocabulary("premium quality");
    expect(result).toContain("micro-texture");
  });

  it("converts 'premium feel' to tactility description", () => {
    const result = applyRealismVocabulary("premium feel");
    expect(result).toContain("tactility");
  });

  it("converts 'professional photography' to depth-of-field description", () => {
    const result = applyRealismVocabulary("professional photography");
    expect(result).toContain("depth-of-field");
  });
});

describe("Phase 10.4A — applyRealismVocabulary: safety guards", () => {
  it("does NOT alter already-specific text (3200K chandeliers)", () => {
    const specific = "Warm amber chandeliers at 3200K with soft backlight catching the steam from the dish.";
    expect(applyRealismVocabulary(specific)).toBe(specific);
  });

  it("does NOT replace standalone 'luxury' in noun position ('grounds the luxury')", () => {
    const text = "dark walnut grounds the luxury.";
    // 'luxury' alone has no substitution — only compound forms like 'luxury feel' are replaced
    expect(applyRealismVocabulary(text)).toBe(text);
  });

  it("does NOT replace standalone 'premium' as establishment-tier adjective", () => {
    const text = "A premium Indian fine-dining restaurant with dark walnut walls.";
    expect(applyRealismVocabulary(text)).toBe(text);
  });

  it("does NOT modify 'Warm and soft' phrase (DENTAL_DIR lightingMood prefix)", () => {
    const text = "Warm and soft — the light of a clinic that wants you to relax.";
    expect(applyRealismVocabulary(text)).toBe(text);
  });

  it("does NOT match 'soft' when separated from 'light' by an em-dash", () => {
    const text = "Soft — the light filling the room.";
    // 'soft — the light' has punctuation between soft and light; regex \bsoft\s+light\b won't match
    expect(applyRealismVocabulary(text)).toBe(text);
  });

  it("is deterministic — same input always produces same output", () => {
    const input = "warm lighting and high quality premium feel in this professional photography";
    expect(applyRealismVocabulary(input)).toBe(applyRealismVocabulary(input));
  });

  it("is idempotent — applying twice produces same result as applying once", () => {
    const input = "warm lighting, high-end materials";
    const once  = applyRealismVocabulary(input);
    const twice = applyRealismVocabulary(once);
    expect(twice).toBe(once);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4A — getIndustryPhysicsNote: per-industry physical descriptors
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.4A — getIndustryPhysicsNote: industry physics notes", () => {
  it("restaurant note contains candle Kelvin temperature", () => {
    const note = getIndustryPhysicsNote("restaurant");
    expect(note).toMatch(/2900K/);
    expect(note).toContain("steam");
  });

  it("dental note mentions 4500K LED", () => {
    const note = getIndustryPhysicsNote("dental");
    expect(note).toContain("4500K");
    expect(note).toContain("LED");
  });

  it("jewellery note mentions prismatic or facet optics", () => {
    const note = getIndustryPhysicsNote("jewellery").toLowerCase();
    expect(note.includes("prismatic") || note.includes("facet") || note.includes("diamond")).toBe(true);
  });

  it("salon note mentions wet-hair or mirror bounce", () => {
    const note = getIndustryPhysicsNote("salon").toLowerCase();
    expect(note.includes("wet-hair") || note.includes("mirror") || note.includes("sheen")).toBe(true);
  });

  it("all 8 regression industries return non-empty physics notes (>20 chars)", () => {
    const industries = [
      "restaurant", "dental", "real-estate", "jewellery",
      "salon", "hospital", "furniture", "retail",
    ] as const;
    for (const ind of industries) {
      expect(getIndustryPhysicsNote(ind).length).toBeGreaterThan(20);
    }
  });

  it("no physics note contains generic marketing adjectives", () => {
    const allIndustries = [
      "restaurant", "dental", "salon", "jewellery", "hospital",
      "interior", "real-estate", "furniture", "school", "retail", "generic",
    ] as const;
    for (const ind of allIndustries) {
      const note = getIndustryPhysicsNote(ind).toLowerCase();
      expect(note).not.toContain("luxury");
      expect(note).not.toContain("premium");
      expect(note).not.toContain("beautiful");
      expect(note).not.toContain("stunning");
    }
  });

  it("all 11 industries return a note (no missing key)", () => {
    const allIndustries = [
      "restaurant", "dental", "salon", "jewellery", "hospital",
      "interior", "real-estate", "furniture", "school", "retail", "generic",
    ] as const;
    for (const ind of allIndustries) {
      expect(typeof getIndustryPhysicsNote(ind)).toBe("string");
      expect(getIndustryPhysicsNote(ind).length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4A — integration: physics note appears in SCENE ATMOSPHERE
// ─────────────────────────────────────────────────────────────────────────────

const DENTAL_DIR: GPTCampaignDirection = {
  campaignConcept:    "Trust earned through expertise — not promises.",
  marketingObjective: "Drive consultation bookings from hesitant first-time patients.",
  psychologicalGoal:  "Convert fear of the unknown into confidence that care is in the right hands.",
  viewerEmotion:      "Quiet reassurance — the feeling of being understood.",
  coreMessage:        "Expert care, compassionate approach, natural results.",
  heroSubject:        "A calm dentist with a genuine smile leans forward slightly.",
  secondarySubjects:  "The patient's hands relaxed on the armrests.",
  supportingObjects:  "A framed certification on the wall.",
  visualStory: {
    before: "The patient has delayed this appointment for months.",
    moment: "A dentist's calm explanation lands. The patient sees someone who listens.",
    after:  "The patient leaves with their first appointment booked.",
  },
  sceneDescription:    "A warm, modern consultation room. Morning light through frosted glass.",
  visualHierarchy: {
    primary:    "The dentist-patient connection.",
    secondary:  "The patient's expression shifting from worry to relief.",
    background: "A subtly visible certification and tidy clinic environment.",
    decorative: "Natural light and soft interior tones.",
  },
  negativeSpace: {
    headline: "Upper third.",
    cta:      "Bottom strip.",
    logo:     "Lower right corner.",
  },
  compositionIntent: {
    eyeFlow:        "From headline to dentist's face to patient's expression to CTA.",
    subjectBalance: "Two human subjects of near-equal weight.",
    framingLogic:   "Slightly closer than comfortable — intimate enough to feel the moment.",
  },
  lightingMood:    "Warm and soft — the light of a clinic that wants you to relax, not a hospital that wants to process you.",
  environment:     "A contemporary dental consultation room that feels more like a private office than a medical facility.",
  colorPsychology: "Blues and warm whites build clinical trust; accents of warm amber say we care about your comfort.",
  marketingTriggers: ["Authority — visible credentials signal expertise"],
  trustTriggers:     ["Visible certification or accreditation"],
  microInteractions: ["The patient's hands relaxed on the armrests"],
  mustInclude:       ["Real human connection between dentist and patient"],
  mustAvoid:         ["Any image of dental tools in the foreground"],
  commercialStyle:   "Premium local professional service — warm authority, human-first.",
  narrative:         "A hesitant patient finally walks into the consultation they've been delaying.",
};

const GENERIC_LIGHTING_DIR: GPTCampaignDirection = {
  ...DENTAL_DIR,
  lightingMood: "Warm lighting fills the space with a professional atmosphere.",
};

describe("Phase 10.4A — integration: buildImageNativePrompt realism enrichment", () => {
  it("SCENE ATMOSPHERE contains the dental industry physics note", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const atmo   = result.split("\n\n").find(b => b.startsWith("SCENE ATMOSPHERE")) ?? "";
    expect(atmo).toContain("4500K");       // dental physics note
    expect(atmo).toContain("LED");         // dental physics note
    expect(atmo).toContain("specular");    // dental physics note
  });

  it("existing DENTAL_DIR tests: 'Warm and soft' lightingMood is preserved unchanged", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("Warm and soft");
  });

  it("existing DENTAL_DIR tests: 'Blues and warm whites' colorPsychology is preserved unchanged", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("Blues and warm whites");
  });

  it("generic 'warm lighting' phrase is converted to physical Kelvin description in SCENE ATMOSPHERE", () => {
    const result = buildImageNativePrompt(GENERIC_LIGHTING_DIR);
    const atmo   = result.split("\n\n").find(b => b.startsWith("SCENE ATMOSPHERE")) ?? "";
    // 'warm lighting' replaced; original phrase not present
    expect(atmo).not.toContain("warm lighting");
    expect(atmo).toMatch(/\d+K/); // contains Kelvin value
  });

  it("SCENE ATMOSPHERE block contains physics note for restaurant industry", () => {
    const restaurantDir: GPTCampaignDirection = {
      ...DENTAL_DIR,
      heroSubject:    "An Indian head chef plates the final garnish.",
      environment:    "A premium Indian fine-dining restaurant with dark walnut walls and ambient chandelier lighting.",
      lightingMood:   "Warm amber chandeliers at 3200K with soft backlight catching the steam from the dish.",
      colorPsychology: "Deep ambers and warm golds communicate celebration.",
      viewerEmotion:   "Desire and exclusivity.",
    };
    const result = buildImageNativePrompt(restaurantDir);
    const atmo   = result.split("\n\n").find(b => b.startsWith("SCENE ATMOSPHERE")) ?? "";
    expect(atmo).toContain("2900K");     // candle-flame temperature in restaurant physics note
    expect(atmo).toContain("glassware"); // restaurant physics note
  });

  it("physics note is not duplicated — SCENE ATMOSPHERE appears exactly once", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const atmoCount = result.split("\n\n").filter(b => b.startsWith("SCENE ATMOSPHERE")).length;
    expect(atmoCount).toBe(1);
  });

  it("output is still deterministic with realism engine active", () => {
    expect(buildImageNativePrompt(DENTAL_DIR)).toBe(buildImageNativePrompt(DENTAL_DIR));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4A — regression: 8-industry smoke test
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.4A — regression: all 8 required industries produce physics-enriched output", () => {
  const makeDir = (env: string, mood: string): GPTCampaignDirection => ({
    campaignConcept:    "Professional excellence.",
    marketingObjective: "Build trust and drive enquiries.",
    psychologicalGoal:  "Establish authority and reassurance.",
    viewerEmotion:      "Trust and confidence.",
    coreMessage:        "Quality service, professional results.",
    heroSubject:        "A professional at work.",
    secondarySubjects:  "The workspace environment.",
    supportingObjects:  "Professional tools and credentials.",
    visualStory: { before: "", moment: "The professional moment.", after: "" },
    sceneDescription:   "A professional environment. Clear light and order.",
    visualHierarchy: {
      primary:    "The professional.",
      secondary:  "The workspace.",
      background: "Supporting environment.",
      decorative: "Light and texture.",
    },
    negativeSpace: {
      headline: "Upper third.",
      cta:      "Bottom strip.",
      logo:     "Lower right corner.",
    },
    compositionIntent: {
      eyeFlow:        "Top to bottom, professional to CTA.",
      subjectBalance: "Professional centred.",
      framingLogic:   "Mid-shot, respectful framing.",
    },
    environment:     env,
    lightingMood:    mood,
    colorPsychology: "Neutral professional palette.",
    marketingTriggers: ["Authority"],
    trustTriggers:     ["Professional credentials"],
    microInteractions: ["Steady professional presence"],
    mustInclude:       ["Professional at work"],
    mustAvoid:         ["Stock-photo poses"],
    commercialStyle:   "Professional service.",
    narrative:         "A professional delivering quality results.",
  });

  const CASES = [
    { industry: "restaurant",   env: "Indian fine-dining restaurant",       mood: "warm ambient lighting" },
    { industry: "dental",       env: "dental consultation room",             mood: "clinical lighting" },
    { industry: "real-estate",  env: "modern real estate office",            mood: "natural lighting" },
    { industry: "jewellery",    env: "luxury jewellery display boutique",    mood: "directional lighting" },
    { industry: "salon",        env: "hair and beauty salon",                mood: "warm station lighting" },
    { industry: "hospital",     env: "hospital consultation room",           mood: "clinical overhead lighting" },
    { industry: "furniture",    env: "furniture showroom",                   mood: "warm directional lighting" },
    { industry: "retail",       env: "modern retail store",                  mood: "soft lighting" },
  ] as const;

  for (const { industry, env, mood } of CASES) {
    it(`${industry}: SCENE ATMOSPHERE contains physically-specific vocabulary`, () => {
      const result = buildImageNativePrompt(makeDir(env, mood));
      const atmo   = result.split("\n\n").find(b => b.startsWith("SCENE ATMOSPHERE")) ?? "";
      // Physics note ensures Kelvin temperature always present for all industries
      expect(atmo).toMatch(/\d+K/);
      // Generic "warm lighting" type phrases should be converted where they appear
      expect(atmo.length).toBeGreaterThan(30);
    });
  }
});
