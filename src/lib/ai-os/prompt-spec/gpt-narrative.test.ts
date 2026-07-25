import { describe, expect, it } from "vitest";
import {
  buildImageNativePrompt,
  buildNarrativePrompt,
  buildGPTNarrativeSection,
} from "./gpt-narrative";
import type { GPTCampaignDirection } from "../creative-director/gpt-types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DENTAL_DIR: GPTCampaignDirection = {
  campaignConcept:    "Trust earned through expertise — not promises.",
  marketingObjective: "Drive consultation bookings from hesitant first-time patients.",
  psychologicalGoal:  "Convert fear of the unknown into confidence that care is in the right hands.",
  viewerEmotion:      "Quiet reassurance — the feeling of being understood.",
  coreMessage:        "Expert care, compassionate approach, natural results.",
  heroSubject:        "A calm dentist with a genuine smile leans forward slightly, explaining the process to a patient whose expression softens from tension to relief.",
  secondarySubjects:  "The patient's hands relaxed on the armrests — a subtle visual cue that the anxiety has lifted.",
  supportingObjects:  "A framed certification on the wall, just visible enough to signal trust without being the focus.",
  visualStory: {
    before: "The patient has delayed this appointment for months — uncertain, searching for reasons to trust.",
    moment: "A dentist's calm explanation lands. The patient sees someone who listens, not just a clinic that processes.",
    after:  "The patient leaves with their first appointment booked — not just informed, but genuinely reassured.",
  },
  sceneDescription:    "A warm, modern consultation room. Morning light through frosted glass. A dentist seated across from a patient at eye level — equal, not elevated.",
  visualHierarchy: {
    primary:    "The dentist-patient connection — eye contact, body language, warmth.",
    secondary:  "The patient's expression shifting from worry to relief.",
    background: "A subtly visible certification and tidy, modern clinic environment.",
    decorative: "Natural light and soft interior tones that say safe without saying hospital.",
  },
  negativeSpace: {
    headline: "Upper third — the viewer reads the headline before the scene pulls them in.",
    cta:      "Bottom strip — low visual weight but unmissable once the emotional sell is done.",
    logo:     "Lower right corner — present and confident, not competing with the story.",
  },
  compositionIntent: {
    eyeFlow:        "From headline to dentist's face to patient's expression to CTA — a narrative arc.",
    subjectBalance: "Two human subjects of near-equal weight, balanced but with the patient as the emotional anchor.",
    framingLogic:   "Slightly closer than comfortable — intimate enough to feel the moment, respectful enough to feel professional.",
  },
  lightingMood:    "Warm and soft — the light of a clinic that wants you to relax, not a hospital that wants to process you.",
  environment:     "A contemporary dental consultation room that feels more like a private office than a medical facility.",
  colorPsychology: "Blues and warm whites build clinical trust; accents of warm amber say we care about your comfort.",
  marketingTriggers: ["Authority — visible credentials signal expertise", "Liking — the dentist is approachable", "Social proof — a well-maintained consultation room"],
  trustTriggers:     ["Visible certification or accreditation", "A real doctor-patient interaction, not a stock-photo pose"],
  microInteractions: ["The patient's hands relaxed on the armrests — the body says yes before the voice does", "The dentist's slight forward lean — interested, not rushed"],
  mustInclude:       ["Real human connection between dentist and patient", "At least one visible trust credential"],
  mustAvoid:         ["Any image of dental tools in the foreground", "Sterile white backgrounds with isolated props", "Stock-photo smiles that no one believes"],
  commercialStyle:   "Premium local professional service — warm authority, human-first, evidence-supported without feeling corporate.",
  narrative:         "A hesitant patient finally walks into the consultation they've been delaying.",
};

const RESTAURANT_DIR: GPTCampaignDirection = {
  ...DENTAL_DIR,
  heroSubject:        "An Indian head chef places the final microgreen garnish on a beautifully plated signature dish, steam rising in the amber chandeliers' backlight.",
  environment:        "A premium Indian fine-dining restaurant with dark walnut walls and ambient chandelier lighting.",
  sceneDescription:   "In a warmly lit open kitchen, the chef stands at the pass where private dining meets culinary theatre.",
  viewerEmotion:      "Desire and exclusivity — FOMO that makes you reach for your phone to make a reservation.",
  lightingMood:       "Warm amber chandeliers at 3200K with soft backlight catching the steam from the dish.",
  colorPsychology:    "Deep ambers and warm golds communicate celebration; dark walnut grounds the luxury.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.3A — buildImageNativePrompt: image-native block format
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.3A — buildImageNativePrompt: block structure", () => {
  it("Phase 10.4L: output starts with PRIMARY HERO MOMENT — hero dominates first token", () => {
    expect(buildImageNativePrompt(DENTAL_DIR).startsWith("PRIMARY HERO MOMENT")).toBe(true);
    expect(buildImageNativePrompt(RESTAURANT_DIR).startsWith("PRIMARY HERO MOMENT")).toBe(true);
  });

  it("PRIMARY HERO MOMENT block (first block) contains the exact heroSubject value", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const heroBlock = result.split("\n\n").find(b => b.startsWith("PRIMARY HERO MOMENT")) ?? "";
    expect(heroBlock).toContain(DENTAL_DIR.heroSubject);
  });

  it("does NOT begin with a screenplay opener or raw scene description", () => {
    const dental = buildImageNativePrompt(DENTAL_DIR);
    const restaurant = buildImageNativePrompt(RESTAURANT_DIR);
    // Output starts with "PRIMARY HERO MOMENT\n..." — never raw narrative copy, never SCENE
    expect(dental).not.toMatch(/^A warm,/i);
    expect(dental).not.toMatch(/^A contemporary/i);
    expect(dental).not.toMatch(/^SCENE/);
    expect(restaurant).not.toMatch(/^In a warmly/i);
    expect(restaurant).not.toMatch(/^SCENE/);
  });

  it("blocks are separated by double newlines", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const blocks = result.split("\n\n");
    expect(blocks.length).toBeGreaterThanOrEqual(8);
  });

  it("Phase 10.4L: PRIMARY HERO MOMENT is block 0; SCENE appears later after hero sections", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const blocks = result.split("\n\n");
    expect(blocks[0]!.split("\n")[0]).toBe("PRIMARY HERO MOMENT");
    // SCENE is still present — just repositioned after hero
    const sceneIdx = blocks.findIndex(b => b.startsWith("SCENE"));
    expect(sceneIdx).toBeGreaterThan(2); // at minimum after hero, action, emotion
    expect(blocks[0]!.length).toBeGreaterThan(20);
  });
});

describe("Phase 10.3A — buildImageNativePrompt: all required blocks present", () => {
  it("contains SCENE block with industry context (Phase 10.3C)", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("SCENE");
    expect(result).toContain("consultation room"); // dental scene template
  });

  it("contains BACKGROUND ACTIVITY block with meaningful activity (Phase 10.3C)", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("BACKGROUND ACTIVITY");
    expect(result).not.toContain("blurred background");
  });

  it("contains PRIMARY ACTION with visualStory.moment", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("PRIMARY ACTION");
    expect(result).toContain("dentist's calm explanation");
  });

  it("contains VISIBLE EMOTION", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("VISIBLE EMOTION");
    expect(result).toContain("Quiet reassurance");
  });

  it("contains SECONDARY SUBJECTS", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("SECONDARY SUBJECTS");
    expect(result).toContain("patient's hands");
  });

  it("contains SCENE ATMOSPHERE block with environment but NOT as the opener", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const atmoIdx = result.indexOf("SCENE ATMOSPHERE");
    expect(atmoIdx).toBeGreaterThan(30); // present but never at position 0
    expect(result).toContain("contemporary dental consultation room");
  });

  it("SCENE ATMOSPHERE contains lightingMood content", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("SCENE ATMOSPHERE");
    expect(result).toContain("Warm and soft"); // lightingMood merged into SCENE ATMOSPHERE
  });

  it("contains CAMERA block with framing logic", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("CAMERA");
    expect(result).toContain("Slightly closer than comfortable");
  });

  it("SCENE ATMOSPHERE contains colorPsychology content", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("SCENE ATMOSPHERE");
    expect(result).toContain("Blues and warm whites"); // colorPsychology merged into SCENE ATMOSPHERE
  });

  it("contains TYPOGRAPHY SAFE SPACE with headline and CTA zones", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("TYPOGRAPHY SAFE SPACE");
    expect(result).toContain("Headline:");
    expect(result).toContain("CTA:");
  });

  it("contains NEGATIVE PROMPT with mustAvoid items", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("NEGATIVE PROMPT");
    expect(result).toContain("dental tools in the foreground");
  });
});

describe("Phase 10.3A — buildImageNativePrompt: block ordering invariants", () => {
  it("PRIMARY HERO MOMENT always precedes SCENE ATMOSPHERE (Phase 10.3A + 10.4L)", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result.indexOf("PRIMARY HERO MOMENT")).toBeLessThan(result.indexOf("SCENE ATMOSPHERE"));
  });

  it("Phase 10.4L: PRIMARY HERO MOMENT precedes SCENE (hero before environment)", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result.indexOf("PRIMARY HERO MOMENT")).toBeLessThan(result.indexOf("\nSCENE\n"));
  });

  it("SCENE ATMOSPHERE contains all three sources: environment, lighting, color", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const atmoBlock = result.split("\n\n").find(b => b.startsWith("SCENE ATMOSPHERE")) ?? "";
    expect(atmoBlock).toContain("contemporary dental consultation room"); // environment
    expect(atmoBlock).toContain("Warm and soft");                        // lightingMood
    expect(atmoBlock).toContain("Blues and warm whites");                 // colorPsychology
  });

  it("PRIMARY ACTION always precedes SCENE ATMOSPHERE", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result.indexOf("PRIMARY ACTION")).toBeLessThan(result.indexOf("SCENE ATMOSPHERE"));
  });

  it("NEGATIVE PROMPT is always the last block", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const lastBlock = result.split("\n\n").at(-1) ?? "";
    expect(lastBlock.startsWith("NEGATIVE PROMPT")).toBe(true);
  });

  it("Phase 10.4L: restaurant PRIMARY HERO MOMENT is first; SCENE appears later; chef is in hero block", () => {
    const result = buildImageNativePrompt(RESTAURANT_DIR);
    const blocks = result.split("\n\n");
    // First block is PRIMARY HERO MOMENT (not SCENE — Phase 10.4L rebalancing)
    expect(blocks[0]!.split("\n")[0]).toBe("PRIMARY HERO MOMENT");
    expect(blocks[0]).not.toContain("fine-dining restaurant");
    // PRIMARY HERO MOMENT block contains the chef
    const heroBlock = blocks.find(b => b.startsWith("PRIMARY HERO MOMENT")) ?? "";
    expect(heroBlock).toContain("Indian head chef");
    // SCENE is still present — just repositioned after hero
    const sceneIdx = blocks.findIndex(b => b.startsWith("SCENE"));
    expect(sceneIdx).toBeGreaterThan(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Backward compatibility — buildNarrativePrompt is unchanged
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.3A backward compatibility — buildNarrativePrompt is untouched", () => {
  it("buildNarrativePrompt does NOT start with PRIMARY HERO MOMENT (legacy behavior preserved)", () => {
    const result = buildNarrativePrompt(DENTAL_DIR);
    expect(result.startsWith("PRIMARY HERO MOMENT")).toBe(false);
  });

  it("buildNarrativePrompt and buildImageNativePrompt produce different outputs", () => {
    expect(buildNarrativePrompt(DENTAL_DIR)).not.toBe(buildImageNativePrompt(DENTAL_DIR));
  });

  it("buildNarrativePrompt still includes the scene description opener (P1/P2 structure)", () => {
    const result = buildNarrativePrompt(DENTAL_DIR);
    // Legacy function uses "P1 —" labels not "PRIMARY HERO MOMENT"
    expect(result).toContain("P1 —");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildGPTNarrativeSection uses image-native format (fallback path)
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.3A — buildGPTNarrativeSection fallback uses image-native format", () => {
  it("Phase 10.4L: narrativePrompt starts with PRIMARY HERO MOMENT — hero dominates first token", () => {
    const section = buildGPTNarrativeSection(DENTAL_DIR);
    expect(section.narrativePrompt.startsWith("PRIMARY HERO MOMENT")).toBe(true);
  });

  it("narrativePrompt PRIMARY HERO MOMENT block contains the Creative Brain heroSubject", () => {
    const section = buildGPTNarrativeSection(DENTAL_DIR);
    const heroBlock = section.narrativePrompt.split("\n\n").find(b => b.startsWith("PRIMARY HERO MOMENT")) ?? "";
    expect(heroBlock).toContain(DENTAL_DIR.heroSubject);
  });

  it("narrativePrompt does NOT open with scene description (no screenplay opener, no SCENE block first)", () => {
    const section = buildGPTNarrativeSection(DENTAL_DIR);
    expect(section.narrativePrompt).not.toMatch(/^A warm,/i);
    expect(section.narrativePrompt).not.toMatch(/^In a/i);
    expect(section.narrativePrompt).not.toMatch(/^SCENE\n/);
  });

  it("quality validation still runs and is not failed for complete input", () => {
    const section = buildGPTNarrativeSection(DENTAL_DIR);
    expect(section.quality.status).not.toBe("failed");
    expect(section.quality.score).toBeGreaterThanOrEqual(50);
  });

  it("fieldsConsumed includes heroSubject and visualStory", () => {
    const section = buildGPTNarrativeSection(DENTAL_DIR);
    expect(section.fieldsConsumed).toContain("heroSubject");
    expect(section.fieldsConsumed).toContain("visualStory");
  });

  it("Phase 10.4L: restaurant narrativePrompt starts with PRIMARY HERO MOMENT, chef in hero block", () => {
    const section = buildGPTNarrativeSection(RESTAURANT_DIR);
    expect(section.narrativePrompt.startsWith("PRIMARY HERO MOMENT")).toBe(true);
    const heroBlock = section.narrativePrompt.split("\n\n").find(b => b.startsWith("PRIMARY HERO MOMENT")) ?? "";
    expect(heroBlock).toContain("Indian head chef");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.3B — de-duplication, signal priority, SCENE ATMOSPHERE merge
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.3B — deduplication and signal priority", () => {
  it("no standalone BACKGROUND, LIGHTING, or COLOR block labels exist", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const blockLabels = result.split("\n\n").map(b => b.split("\n")[0]);
    expect(blockLabels).not.toContain("BACKGROUND");
    expect(blockLabels).not.toContain("LIGHTING");
    expect(blockLabels).not.toContain("COLOR");
    expect(blockLabels).toContain("SCENE ATMOSPHERE");
  });

  it("sceneDescription hero-repeating sentence is NOT included in SCENE ATMOSPHERE", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    // "A dentist seated across from a patient at eye level" repeats the hero → must be absent
    expect(result).not.toContain("dentist seated across from a patient");
  });

  it("sceneDescription env-only sentences ARE present in SCENE ATMOSPHERE", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    // "A warm, modern consultation room" and "Morning light through frosted glass"
    // are environment-only sentences from sceneDescription — they must be kept
    expect(result).toContain("warm, modern consultation room");
    expect(result).toContain("Morning light through frosted glass");
  });

  it("hero subject appears exactly once across the entire output", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    // Distinctive hero phrase must appear once — not repeated in other blocks
    const phrase = "genuine smile leans forward";
    const matches = result.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? [];
    expect(matches.length).toBe(1);
  });

  it("PRIMARY ACTION is kept when it does not duplicate the hero", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    // "A dentist's calm explanation lands" is a distinct moment, not a hero repeat
    expect(result).toContain("PRIMARY ACTION");
    expect(result).toContain("dentist's calm explanation");
  });

  it("micro-interaction that duplicates secondary subjects is filtered out", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    // SECONDARY SUBJECTS already contains "patient's hands relaxed on the armrests"
    // The first micro-interaction is a near-identical phrase and must not appear a second time
    const matches = result.match(/patient.*?hands.*?relaxed/gi) ?? [];
    expect(matches.length).toBe(1); // appears once, in SECONDARY SUBJECTS
  });

  it("output is deterministic — identical for repeated calls with the same input", () => {
    expect(buildImageNativePrompt(DENTAL_DIR)).toBe(buildImageNativePrompt(DENTAL_DIR));
    expect(buildImageNativePrompt(RESTAURANT_DIR)).toBe(buildImageNativePrompt(RESTAURANT_DIR));
  });

  it("restaurant: sceneDescription chef sentence is excluded from SCENE ATMOSPHERE", () => {
    const result = buildImageNativePrompt(RESTAURANT_DIR);
    // "the chef stands at the pass" is a hero-repeating sentence — must be absent
    expect(result).not.toContain("chef stands at the pass");
  });

  it("restaurant: SCENE ATMOSPHERE still contains all three env/lighting/color sources", () => {
    const result = buildImageNativePrompt(RESTAURANT_DIR);
    const atmoBlock = result.split("\n\n").find(b => b.startsWith("SCENE ATMOSPHERE")) ?? "";
    expect(atmoBlock.length).toBeGreaterThan(0);
    expect(atmoBlock).toContain("premium Indian fine-dining restaurant"); // environment
    expect(atmoBlock).toContain("Warm amber chandeliers");                // lightingMood
    expect(atmoBlock).toContain("Deep ambers and warm golds");            // colorPsychology
  });

  it("Phase 10.4L: PRIMARY HERO MOMENT is first; SCENE appears later; chef is in hero block", () => {
    const result = buildImageNativePrompt(RESTAURANT_DIR);
    const blocks = result.split("\n\n");
    // First block is PRIMARY HERO MOMENT (not SCENE — Phase 10.4L rebalancing)
    expect(blocks[0]!.split("\n")[0]).toBe("PRIMARY HERO MOMENT");
    // PRIMARY HERO MOMENT block contains the chef
    const heroBlock = blocks.find(b => b.startsWith("PRIMARY HERO MOMENT")) ?? "";
    expect(heroBlock).toContain("Indian head chef");
    expect(heroBlock).not.toContain("fine-dining restaurant");
    // SCENE is still present but repositioned after hero sections
    const sceneBlock = blocks.find(b => b.startsWith("SCENE"));
    expect(sceneBlock).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4K.3 — Complete buildImageNativePrompt: 5 previously-dead fields
// coreMessage, supportingObjects, mustInclude, commercialStyle,
// compositionIntent.subjectBalance — were in buildNarrativePrompt but
// accidentally omitted from buildImageNativePrompt during the 10.3A rewrite.
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.4K.3 — coreMessage consumed as CAMPAIGN MANDATE", () => {
  it("CAMPAIGN MANDATE block is present in output", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("CAMPAIGN MANDATE");
  });

  it("CAMPAIGN MANDATE block contains the coreMessage text", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const block = result.split("\n\n").find(b => b.startsWith("CAMPAIGN MANDATE")) ?? "";
    expect(block).toContain("Expert care");
  });

  it("CAMPAIGN MANDATE appears after VISIBLE EMOTION and before SECONDARY SUBJECTS", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const mandateIdx  = result.indexOf("CAMPAIGN MANDATE");
    const emotionIdx  = result.indexOf("VISIBLE EMOTION");
    const secondaryIdx = result.indexOf("SECONDARY SUBJECTS");
    expect(mandateIdx).toBeGreaterThan(emotionIdx);
    expect(mandateIdx).toBeLessThan(secondaryIdx);
  });

  it("CAMPAIGN MANDATE is absent when coreMessage is empty", () => {
    const result = buildImageNativePrompt({ ...DENTAL_DIR, coreMessage: "" });
    expect(result).not.toContain("CAMPAIGN MANDATE");
  });
});

describe("Phase 10.4K.3 — supportingObjects consumed as SUPPORTING DETAILS", () => {
  it("SUPPORTING DETAILS block is present in output", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("SUPPORTING DETAILS");
  });

  it("SUPPORTING DETAILS block contains the supportingObjects text", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const block = result.split("\n\n").find(b => b.startsWith("SUPPORTING DETAILS")) ?? "";
    expect(block).toContain("framed certification");
  });

  it("SUPPORTING DETAILS appears after SECONDARY SUBJECTS and before BACKGROUND ACTIVITY", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const detailsIdx    = result.indexOf("SUPPORTING DETAILS");
    const secondaryIdx  = result.indexOf("SECONDARY SUBJECTS");
    const backgroundIdx = result.indexOf("BACKGROUND ACTIVITY");
    expect(detailsIdx).toBeGreaterThan(secondaryIdx);
    expect(detailsIdx).toBeLessThan(backgroundIdx);
  });

  it("SUPPORTING DETAILS is absent when supportingObjects is empty", () => {
    const result = buildImageNativePrompt({ ...DENTAL_DIR, supportingObjects: "" });
    expect(result).not.toContain("SUPPORTING DETAILS");
  });
});

describe("Phase 10.4K.3 — commercialStyle consumed as STYLE DIRECTION", () => {
  it("STYLE DIRECTION block is present in output", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("STYLE DIRECTION");
  });

  it("STYLE DIRECTION block contains the commercialStyle text", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const block = result.split("\n\n").find(b => b.startsWith("STYLE DIRECTION")) ?? "";
    expect(block).toContain("Premium local professional service");
  });

  it("STYLE DIRECTION appears after SURFACE MATERIALS and before CAMERA", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const styleIdx    = result.indexOf("STYLE DIRECTION");
    const materialIdx = result.indexOf("SURFACE MATERIALS");
    const cameraIdx   = result.indexOf("CAMERA");
    expect(styleIdx).toBeGreaterThan(materialIdx);
    expect(styleIdx).toBeLessThan(cameraIdx);
  });

  it("STYLE DIRECTION is absent when commercialStyle is empty", () => {
    const result = buildImageNativePrompt({ ...DENTAL_DIR, commercialStyle: "" });
    expect(result).not.toContain("STYLE DIRECTION");
  });
});

describe("Phase 10.4K.3 — compositionIntent.subjectBalance merged into CAMERA", () => {
  it("CAMERA block contains subjectBalance text", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const block = result.split("\n\n").find(b => b.startsWith("CAMERA")) ?? "";
    expect(block).toContain("Two human subjects");
  });

  it("subjectBalance does not appear in its own standalone block", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const blockLabels = result.split("\n\n").map(b => b.split("\n")[0]);
    expect(blockLabels).not.toContain("SUBJECT BALANCE");
    expect(blockLabels).not.toContain("COMPOSITION");
  });

  it("CAMERA block still contains framingLogic content", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const block = result.split("\n\n").find(b => b.startsWith("CAMERA")) ?? "";
    expect(block).toContain("Slightly closer than comfortable");
  });

  it("CAMERA block still contains eyeFlow content", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const block = result.split("\n\n").find(b => b.startsWith("CAMERA")) ?? "";
    expect(block).toContain("From headline to dentist");
  });
});

describe("Phase 10.4K.3 — mustInclude consumed as MUST INCLUDE", () => {
  it("MUST INCLUDE block is present in output", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result).toContain("MUST INCLUDE");
  });

  it("MUST INCLUDE block contains mustInclude items", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const block = result.split("\n\n").find(b => b.startsWith("MUST INCLUDE")) ?? "";
    expect(block).toContain("Real human connection");
    expect(block).toContain("trust credential");
  });

  it("MUST INCLUDE appears before NEGATIVE PROMPT", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const mustIdx = result.indexOf("MUST INCLUDE");
    const negIdx  = result.indexOf("NEGATIVE PROMPT");
    expect(mustIdx).toBeGreaterThan(0);
    expect(mustIdx).toBeLessThan(negIdx);
  });

  it("NEGATIVE PROMPT is still the last block when MUST INCLUDE is present", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const lastBlock = result.split("\n\n").at(-1) ?? "";
    expect(lastBlock.startsWith("NEGATIVE PROMPT")).toBe(true);
  });

  it("MUST INCLUDE is absent when mustInclude array is empty", () => {
    const result = buildImageNativePrompt({ ...DENTAL_DIR, mustInclude: [] });
    expect(result).not.toContain("MUST INCLUDE");
  });
});

describe("Phase 10.4K.3 — no field duplication across new blocks", () => {
  it("coreMessage content does not appear more than once in the full output", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const matches = result.match(/Expert care/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("supportingObjects content does not appear more than once in the full output", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    // "framed certification" comes from supportingObjects and must appear only once
    const matches = result.match(/framed certification/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("all 5 new block labels are distinct and appear exactly once each", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const blockLabels = result.split("\n\n").map(b => b.split("\n")[0]);
    expect(blockLabels.filter(l => l === "CAMPAIGN MANDATE").length).toBe(1);
    expect(blockLabels.filter(l => l === "SUPPORTING DETAILS").length).toBe(1);
    expect(blockLabels.filter(l => l === "STYLE DIRECTION").length).toBe(1);
    expect(blockLabels.filter(l => l === "MUST INCLUDE").length).toBe(1);
  });

  it("full output now has at least 12 blocks — 5 new on top of the previous 7+", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    expect(result.split("\n\n").length).toBeGreaterThanOrEqual(12);
  });
});
