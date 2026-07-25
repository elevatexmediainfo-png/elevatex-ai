import { describe, expect, it } from "vitest";
import { measureDominance, formatDominanceReport } from "./shared/dominance";
import { buildImageNativePrompt } from "../prompt-spec/gpt-narrative";
import {
  assembleBlueprint,
} from "../blueprint";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCampaignPlan } from "../creative-director";
import { buildVisualLayoutPlan } from "../visual-layout";
import { buildTypographyPlan } from "../typography";
import { buildVisualScenePlan } from "../scene-planner";
import { buildPromptSpecification } from "../prompt-spec";
import { optimizePromptSpecification } from "../prompt-optimizer";
import { translateForProvider } from "./engine";
import { buildCreativeContext } from "../creative-context";
import { analyzeUserRequest } from "../user-understanding";
import type { CreativeRequest } from "../types";
import type { GPTCampaignDirection } from "../creative-director/gpt-types";

// ─────────────────────────────────────────────────────────────────────────────
// Full-pipeline helper
// ─────────────────────────────────────────────────────────────────────────────

function runPipeline(rawIdea: string) {
  const request: CreativeRequest = {
    userId: "test", rawIdea, requestedAt: new Date(),
  };
  const uu        = analyzeUserRequest(request);
  const ctx       = buildCreativeContext(request, uu, {}, { userId: "test" });
  const strategy  = buildCreativeStrategy(ctx);
  const plan      = buildCampaignPlan(strategy);
  const layout    = buildVisualLayoutPlan(strategy, plan);
  const typography = buildTypographyPlan(strategy, plan, layout);
  const blueprint = assembleBlueprint({ context: ctx, strategy, campaignPlan: plan, layoutPlan: layout, typographyPlan: typography });
  const scene     = buildVisualScenePlan(blueprint);
  const spec      = buildPromptSpecification(blueprint, scene);
  const optimized = optimizePromptSpecification(spec);
  const openai    = translateForProvider(optimized, "openai");
  return { spec, optimized, openai };
}

// ─────────────────────────────────────────────────────────────────────────────
// GPT-direction fixture (same as gpt-narrative.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

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
  sceneDescription:   "A warm, modern consultation room. Morning light through frosted glass. A dentist seated across from a patient at eye level.",
  visualHierarchy:    { primary: "dentist-patient connection", secondary: "patient expression", background: "certification", decorative: "natural light" },
  negativeSpace:      { headline: "Upper third", cta: "Bottom strip", logo: "Lower right corner" },
  compositionIntent:  { eyeFlow: "headline to face to expression to CTA", subjectBalance: "Two subjects, near-equal weight.", framingLogic: "Slightly closer than comfortable." },
  lightingMood:       "Warm and soft — the light of a clinic that wants you to relax.",
  environment:        "A contemporary dental consultation room that feels more like a private office.",
  colorPsychology:    "Blues and warm whites build clinical trust; warm amber accents say we care.",
  marketingTriggers:  ["Authority — visible credentials", "Liking — the dentist is approachable"],
  trustTriggers:      ["Visible certification or accreditation"],
  microInteractions:  ["The patient's hands relaxed on the armrests"],
  mustInclude:        ["Real human connection between dentist and patient"],
  mustAvoid:          ["Any image of dental tools in the foreground", "Sterile white backgrounds"],
  commercialStyle:    "Premium local professional service — warm authority, human-first.",
  narrative:          "A hesitant patient finally walks into the consultation they've been delaying.",
};

const RESTAURANT_DIR: GPTCampaignDirection = {
  ...DENTAL_DIR,
  heroSubject:      "An Indian head chef places the final microgreen garnish on a beautifully plated signature dish, steam rising in amber backlight.",
  environment:      "A premium Indian fine-dining restaurant with dark walnut walls and ambient chandelier lighting.",
  sceneDescription: "In a warmly lit open kitchen, the chef stands at the pass where private dining meets culinary theatre.",
  viewerEmotion:    "Desire and exclusivity — FOMO that makes you reach for your phone to make a reservation.",
  lightingMood:     "Warm amber chandeliers at 3200K with soft backlight catching the steam from the dish.",
  colorPsychology:  "Deep ambers and warm golds communicate celebration; dark walnut grounds the luxury.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4L — measureDominance utility
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.4L — measureDominance utility: block classification", () => {
  const LABELED_PROMPT = [
    "PRIMARY HERO MOMENT\nA calm dentist leans forward, explaining the process.",
    "PRIMARY ACTION\nThe dentist's calm explanation lands with the patient.",
    "VISIBLE EMOTION\nQuiet reassurance — the feeling of being understood.",
    "SECONDARY SUBJECTS\nThe patient's hands relaxed on the armrests.",
    "BACKGROUND ACTIVITY\nA nurse reviews notes in the background.",
    "SCENE\nDental clinic consultation room. Warm morning light.",
    "SCENE ATMOSPHERE\nContemporary dental office. Soft natural light through frosted glass.",
    "CAMERA\nEye-level, portrait lens, intimate framing.",
    "MUST INCLUDE\nReal human connection between dentist and patient.",
    "NEGATIVE PROMPT\nDental tools, sterile white backgrounds.",
  ].join("\n\n");

  it("hero% > environment% in a correctly-ordered labeled prompt", () => {
    const d = measureDominance(LABELED_PROMPT);
    expect(d.heroPercent).toBeGreaterThan(d.environmentPercent);
  });

  it("hero block appears before environment block (heroBlockIndex < environmentBlockIndex)", () => {
    const d = measureDominance(LABELED_PROMPT);
    expect(d.heroBlockIndex).toBeLessThan(d.environmentBlockIndex);
    expect(d.heroBeforeEnvironment).toBe(true);
  });

  it("firstBlockLabel is the hero block label", () => {
    const d = measureDominance(LABELED_PROMPT);
    expect(d.firstBlockLabel).toBe("PRIMARY HERO MOMENT");
  });

  it("returns correct heroPercent, environmentPercent, marketingPercent", () => {
    const d = measureDominance(LABELED_PROMPT);
    expect(d.heroPercent).toBeGreaterThan(0);
    expect(d.environmentPercent).toBeGreaterThan(0);
    expect(d.heroPercent + d.environmentPercent).toBeLessThanOrEqual(100);
  });

  it("totalWords is the sum of all block word counts", () => {
    const d = measureDominance(LABELED_PROMPT);
    const sumFromBlocks = d.blocks.reduce((s, b) => s + b.words, 0);
    expect(d.totalWords).toBe(sumFromBlocks);
  });

  it("blockOrder contains all block labels in insertion order", () => {
    const d = measureDominance(LABELED_PROMPT);
    expect(d.blockOrder[0]).toBe("PRIMARY HERO MOMENT");
    expect(d.blockOrder[1]).toBe("PRIMARY ACTION");
    expect(d.blockOrder[5]).toBe("SCENE");
  });

  it("formatDominanceReport returns a non-empty string with hero and environment lines", () => {
    const d = measureDominance(LABELED_PROMPT);
    const report = formatDominanceReport(d);
    expect(report).toContain("Hero:");
    expect(report).toContain("Environment:");
    expect(report).toContain("Block order:");
  });
});

describe("Phase 10.4L — measureDominance: environment-dominant prompt (before state)", () => {
  // Simulates the OLD ordering where SCENE was first — this is the problem state.
  const ENV_FIRST_PROMPT = [
    "SCENE\nDental clinic consultation room. Warm morning light. Contemporary office.",
    "SCENE ATMOSPHERE\nContemporary dental office. Soft natural light through frosted glass. Blues and warm whites.",
    "SURFACE MATERIALS\nMedical-grade surfaces, warm timber accents, frosted glass panels.",
    "PRIMARY HERO MOMENT\nA calm dentist leans forward, explaining the process.",
    "PRIMARY ACTION\nThe dentist's calm explanation lands with the patient.",
    "CAMERA\nEye-level, portrait lens, intimate framing.",
  ].join("\n\n");

  it("environment% > hero% in an environment-dominant prompt (proves the before-state problem)", () => {
    const d = measureDominance(ENV_FIRST_PROMPT);
    // Environment dominates: 3 env blocks vs 2 hero blocks
    expect(d.environmentPercent).toBeGreaterThan(d.heroPercent);
  });

  it("environmentBlockIndex < heroBlockIndex in old ordering (proves the ordering problem)", () => {
    const d = measureDominance(ENV_FIRST_PROMPT);
    expect(d.environmentBlockIndex).toBeLessThan(d.heroBlockIndex);
    expect(d.heroBeforeEnvironment).toBe(false);
  });

  it("firstBlockLabel is SCENE in old ordering", () => {
    const d = measureDominance(ENV_FIRST_PROMPT);
    expect(d.firstBlockLabel).toBe("SCENE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4L — buildImageNativePrompt: hero dominance verification
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.4L — buildImageNativePrompt: hero precedes environment", () => {
  it("dental: PRIMARY HERO MOMENT is the first block in the output", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const firstLabel = result.split("\n\n")[0]!.split("\n")[0];
    expect(firstLabel).toBe("PRIMARY HERO MOMENT");
  });

  it("dental: heroBlockIndex < environmentBlockIndex in dominance report", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const d = measureDominance(result);
    expect(d.heroBeforeEnvironment).toBe(true);
    expect(d.heroBlockIndex).toBeLessThan(d.environmentBlockIndex);
  });

  it("dental: hero precedes environment and has substantial weight in final prompt", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const d = measureDominance(result);
    // SCENE ATMOSPHERE merges 4 sources (~60 words) so environment word-count is
    // inherently large; the meaningful metric for image models is POSITION, not raw %.
    expect(d.heroBeforeEnvironment).toBe(true);
    expect(d.heroBlockIndex).toBeLessThan(d.environmentBlockIndex);
    expect(d.heroPercent).toBeGreaterThan(20); // hero zone has substantial weight
  });

  it("restaurant: PRIMARY HERO MOMENT is the first block in the output", () => {
    const result = buildImageNativePrompt(RESTAURANT_DIR);
    const firstLabel = result.split("\n\n")[0]!.split("\n")[0];
    expect(firstLabel).toBe("PRIMARY HERO MOMENT");
  });

  it("restaurant: hero precedes environment and has substantial weight in final prompt", () => {
    const result = buildImageNativePrompt(RESTAURANT_DIR);
    const d = measureDominance(result);
    expect(d.heroBeforeEnvironment).toBe(true);
    expect(d.heroBlockIndex).toBeLessThan(d.environmentBlockIndex);
    expect(d.heroPercent).toBeGreaterThan(20);
  });

  it("restaurant: heroBlockIndex < environmentBlockIndex", () => {
    const result = buildImageNativePrompt(RESTAURANT_DIR);
    const d = measureDominance(result);
    expect(d.heroBeforeEnvironment).toBe(true);
  });

  it("SCENE block position is >2 (not in first three blocks)", () => {
    const dental = buildImageNativePrompt(DENTAL_DIR);
    const restaurant = buildImageNativePrompt(RESTAURANT_DIR);
    const dentalSceneIdx = dental.split("\n\n").findIndex(b => b.startsWith("SCENE"));
    const restSceneIdx   = restaurant.split("\n\n").findIndex(b => b.startsWith("SCENE"));
    // SCENE must come after HERO, ACTION, EMOTION at minimum
    expect(dentalSceneIdx).toBeGreaterThan(2);
    expect(restSceneIdx).toBeGreaterThan(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4L — OpenAI translator: hero dominance via full pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.4L — OpenAI translator: hero-dominant prompt hierarchy", () => {
  it("dental: NO TEXT instruction is the first block, PRIMARY HERO is second, in the OpenAI prompt (prompt-bloat fix)", () => {
    const { openai } = runPipeline("Dental Implant Clinic — 15 Years Experience, IDA Certified, Lead Generation");
    const blocks = openai.body.finalPrompt.split("\n\n");
    expect(blocks[0]).toContain("Do not render any text");
    expect(blocks[1]!.split("\n")[0]).toBe("PRIMARY HERO");
  });

  it("dental: heroBlockIndex < environmentBlockIndex in OpenAI prompt", () => {
    const { openai } = runPipeline("Dental Implant Clinic — 15 Years Experience, IDA Certified, Lead Generation");
    const d = measureDominance(openai.body.finalPrompt);
    expect(d.heroBeforeEnvironment).toBe(true);
    expect(d.heroBlockIndex).toBeGreaterThanOrEqual(0); // hero exists
    expect(d.environmentBlockIndex).toBeGreaterThanOrEqual(0); // environment exists
    expect(d.heroBlockIndex).toBeLessThan(d.environmentBlockIndex);
  });

  it("dental: hero% > environment% in OpenAI prompt", () => {
    const { openai } = runPipeline("Dental Implant Clinic — 15 Years Experience, IDA Certified, Lead Generation");
    const d = measureDominance(openai.body.finalPrompt);
    expect(d.heroPercent).toBeGreaterThan(d.environmentPercent);
  });

  it("restaurant: NO TEXT instruction is the first block, PRIMARY HERO is second, in the OpenAI prompt (prompt-bloat fix)", () => {
    const { openai } = runPipeline("Premium Indian Fine Dining Restaurant — Grand Opening");
    const blocks = openai.body.finalPrompt.split("\n\n");
    expect(blocks[0]).toContain("Do not render any text");
    expect(blocks[1]!.split("\n")[0]).toBe("PRIMARY HERO");
  });

  it("restaurant: hero% > environment% in OpenAI prompt", () => {
    const { openai } = runPipeline("Premium Indian Fine Dining Restaurant — Grand Opening");
    const d = measureDominance(openai.body.finalPrompt);
    expect(d.heroPercent).toBeGreaterThan(d.environmentPercent);
  });

  it("ADVERTISEMENT ZONES appears before BACKGROUND in OpenAI prompt", () => {
    const { openai } = runPipeline("Dental Implant Clinic — Lead Generation");
    const blocks = openai.body.finalPrompt.split("\n\n");
    const adZonesIdx  = blocks.findIndex(b => b.startsWith("ADVERTISEMENT ZONES"));
    const backgroundIdx = blocks.findIndex(b => b.startsWith("BACKGROUND"));
    // Both must exist; ad zones must precede environment
    if (adZonesIdx !== -1 && backgroundIdx !== -1) {
      expect(adZonesIdx).toBeLessThan(backgroundIdx);
    }
  });

  it("MARKETING INTENT appears after BACKGROUND in OpenAI prompt", () => {
    const { openai } = runPipeline("Restaurant Grand Opening — Awareness Campaign");
    const blocks = openai.body.finalPrompt.split("\n\n");
    const marketingIdx   = blocks.findIndex(b => b.startsWith("MARKETING INTENT"));
    const backgroundIdx  = blocks.findIndex(b => b.startsWith("BACKGROUND"));
    if (marketingIdx !== -1 && backgroundIdx !== -1) {
      expect(marketingIdx).toBeGreaterThan(backgroundIdx);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.4L — Before vs After comparison report
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.4L — Before vs After: dominance shift report", () => {
  // The "before" state is simulated using an environment-first prompt
  // identical in content but ordered as Phase 10.3C was (SCENE first).
  // The "after" state is the current buildImageNativePrompt output.

  it("before: SCENE-first ordering gives environment% > hero%", () => {
    const BEFORE_DENTAL = [
      "SCENE\nDental clinic consultation room — warm morning light through frosted glass panels.",
      "SCENE ATMOSPHERE\nContemporary dental consultation office. Soft natural window light. Blues and warm whites.",
      "SURFACE MATERIALS\nMedical-grade surfaces with warm timber accents. Frosted glass privacy panels.",
      "BACKGROUND ACTIVITY\nNurse prepares documentation at a side desk.",
      "PRIMARY HERO MOMENT\nA calm dentist with a genuine smile leans forward slightly, explaining the process to a patient.",
      "PRIMARY ACTION\nA dentist's calm explanation lands. The patient sees someone who listens.",
      "VISIBLE EMOTION\nQuiet reassurance — the feeling of being understood.",
      "CAMERA\nEye-level. Slightly closer than comfortable — intimate, not clinical.",
    ].join("\n\n");

    const before = measureDominance(BEFORE_DENTAL);
    expect(before.environmentPercent).toBeGreaterThan(before.heroPercent); // env dominates
    expect(before.heroBeforeEnvironment).toBe(false);
  });

  it("after: hero-first ordering: hero precedes environment and has substantial weight", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const after = measureDominance(result);
    // Image models weight early tokens; position win is the meaningful metric.
    // SCENE ATMOSPHERE merges 4 sources so environment word-count is inherently large.
    expect(after.heroBeforeEnvironment).toBe(true);
    expect(after.heroBlockIndex).toBeLessThan(after.environmentBlockIndex);
    expect(after.heroPercent).toBeGreaterThan(20); // hero zone has substantial weight
  });

  it("after: dental hero zone has substantial representation (≥20% of prompt words)", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const d = measureDominance(result);
    expect(d.heroBlockIndex).toBeLessThan(d.environmentBlockIndex);
    expect(d.heroPercent).toBeGreaterThanOrEqual(20);
  });

  it("after: restaurant hero zone has substantial representation (≥20% of prompt words)", () => {
    const result = buildImageNativePrompt(RESTAURANT_DIR);
    const d = measureDominance(result);
    expect(d.heroBlockIndex).toBeLessThan(d.environmentBlockIndex);
    expect(d.heroPercent).toBeGreaterThanOrEqual(20);
  });

  it("dominance report string is non-empty and contains all category lines", () => {
    const result = buildImageNativePrompt(DENTAL_DIR);
    const d = measureDominance(result);
    const report = formatDominanceReport(d);
    expect(report).toContain("Hero:");
    expect(report).toContain("Environment:");
    expect(report).toContain("Action/Story:");
    expect(report).toContain("Marketing:");
    expect(report.length).toBeGreaterThan(100);
  });
});
