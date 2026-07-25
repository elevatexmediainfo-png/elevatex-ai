import { describe, expect, it } from "vitest";

import { analyzeUserRequest } from "../user-understanding";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCreativeContext } from "../creative-context";
import type { CreativeRequest } from "../types";
import type { GPTCampaignDirection } from "../creative-director/gpt-types";
import { runDesignIntelligenceLayer } from "./index";
import { compileDesignIntelligencePrompt } from "./prompt-compiler";
import { buildDesignDirectorOutput }      from "./design-director";
import { buildPhotographyDirectorOutput } from "./photography-director";
import { buildTypographyDirectorOutput }  from "./typography-director";
import { buildLayoutDirectorOutput }      from "./layout-director";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeStrategy(rawIdea: string) {
  const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
  const userUnderstanding = analyzeUserRequest(request);
  const context = buildCreativeContext(request, userUnderstanding, {}, { userId: "test" });
  return buildCreativeStrategy(context);
}

const DENTAL_DIR: GPTCampaignDirection = {
  campaignConcept:    "Trust earned through expertise.",
  marketingObjective: "Drive first-consultation bookings.",
  psychologicalGoal:  "Convert fear of the unknown into confidence in care.",
  viewerEmotion:      "Quiet reassurance.",
  coreMessage:        "Expert care, compassionate approach, natural results.",
  heroSubject:        "A calm dentist with a genuine smile leans forward slightly, explaining treatment to a patient whose expression softens from tension to relief.",
  secondarySubjects:  "The patient's hands relaxed on the armrests — a visual cue that anxiety has lifted.",
  supportingObjects:  "A framed certification on the wall, visible enough to signal trust.",
  visualStory: {
    before: "The patient has delayed this appointment for months.",
    moment: "The dentist's calm explanation lands and the patient feels genuinely understood.",
    after:  "The patient leaves with their appointment booked — not just informed, but reassured.",
  },
  sceneDescription:    "A warm, modern consultation room. Morning light through frosted glass. A dentist seated at eye level with a patient.",
  visualHierarchy: {
    primary:    "The dentist-patient connection — eye contact, body language, warmth.",
    secondary:  "Patient expression shifting from worry to relief.",
    background: "A subtly visible certification and modern clinic environment.",
    decorative: "Natural light and soft interior tones.",
  },
  negativeSpace: {
    headline: "Upper third — headline before the scene draws the eye in.",
    cta:      "Bottom strip — unmissable once the emotional sell is complete.",
    logo:     "Lower right corner — present, confident, not competing.",
  },
  compositionIntent: {
    eyeFlow:        "Headline → dentist's face → patient's expression → CTA.",
    subjectBalance: "Two human subjects, patient as the emotional anchor.",
    framingLogic:   "Slightly closer than comfortable — intimate yet professional.",
  },
  lightingMood:    "Warm and soft — the light of a clinic that wants you to relax, not a hospital.",
  environment:     "Contemporary dental consultation room that feels more like a private office.",
  colorPsychology: "Blues and warm whites build clinical trust; warm amber accents signal comfort.",
  marketingTriggers: ["Authority — visible credentials signal expertise", "Liking — the dentist is approachable"],
  trustTriggers:     ["Visible certification", "Real doctor-patient interaction, not stock photo"],
  microInteractions: ["Patient's hands relaxed", "Dentist's slight forward lean — interested, not rushed"],
  mustInclude:       ["Real human connection between dentist and patient", "At least one visible trust credential"],
  mustAvoid:         ["Dental tools in foreground — creates anxiety", "Sterile white backgrounds"],
  commercialStyle:   "Premium local professional service — warm authority, human-first.",
  narrative:         "A hesitant patient finally walks into the consultation they've been delaying. The dentist listens.",
};

const RESTAURANT_DIR: GPTCampaignDirection = {
  campaignConcept:    "An invitation to the best evening of the week.",
  marketingObjective: "Drive weekend reservations.",
  psychologicalGoal:  "Create immediate desire and FOMO.",
  viewerEmotion:      "Anticipation and desire.",
  coreMessage:        "Fine dining that feels like home.",
  heroSubject:        "A beautifully plated signature dish — truffle risotto in a deep dark bowl, garnish falling through morning side-light.",
  secondarySubjects:  "Wine glass with deep red catching the warm chandelier above.",
  supportingObjects:  "Polished cutlery, linen napkin folded with precision.",
  visualStory: {
    before: "A weekday that's felt too long.",
    moment: "The dish arrives and the evening changes entirely.",
    after:  "A meal they will talk about on Monday.",
  },
  sceneDescription:    "A premium restaurant table, evening service, warm side-light from wall sconces.",
  visualHierarchy: {
    primary:    "The hero dish — risotto, steam, garnish in mid-fall.",
    secondary:  "The wine glass catching chandelier light.",
    background: "A softly lit restaurant floor and other diners as a mood layer.",
    decorative: "Table setting precision — linen, crystal, silver.",
  },
  negativeSpace: {
    headline: "Upper third above the dish.",
    cta:      "Bottom strip below the table edge.",
    logo:     "Lower right.",
  },
  compositionIntent: {
    eyeFlow:        "Headline → hero dish → wine glass → CTA.",
    subjectBalance: "Dish as dominant hero, wine as supporting character.",
    framingLogic:   "Diagonal lead toward the golden ratio intersection.",
  },
  lightingMood:    "Warm candle and chandelier — 3200K, rich, intimate, never harsh.",
  environment:     "Premium restaurant interior, evening, warm practicals.",
  colorPsychology: "Deep plum, warm gold, cream — luxury hospitality palette.",
  marketingTriggers: ["Scarcity — only weekend tables remaining"],
  trustTriggers:     ["Premium plating quality signals kitchen skill"],
  microInteractions: ["Garnish frozen mid-fall", "Steam rising from the bowl surface"],
  mustInclude:       ["Hero dish as the undisputed focal point", "Warm ambient restaurant lighting"],
  mustAvoid:         ["Overhead flat lighting", "Empty or messy table"],
  commercialStyle:   "Luxury hospitality editorial — Condé Nast Traveller food quality.",
  narrative:         "The dish arrives and the evening becomes the best story of the week.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Integration: runDesignIntelligenceLayer
// ─────────────────────────────────────────────────────────────────────────────

describe("runDesignIntelligenceLayer — integration", () => {
  it("returns all five output fields", () => {
    const strategy = makeStrategy("Dental Implant Trust Campaign");
    const result = runDesignIntelligenceLayer({
      gptDirection: DENTAL_DIR,
      strategy,
      aspectRatio: "9:16",
    });

    expect(result).toHaveProperty("designPlan");
    expect(result).toHaveProperty("photographyPlan");
    expect(result).toHaveProperty("typographyPlan");
    expect(result).toHaveProperty("layoutPlan");
    expect(result).toHaveProperty("compiledPrompt");
    expect(typeof result.compiledPrompt).toBe("string");
    expect(result.compiledPrompt.length).toBeGreaterThan(200);
  });

  it("runs without throwing for restaurant campaign", () => {
    const strategy = makeStrategy("Fine Dining Restaurant Grand Opening Campaign");
    expect(() => runDesignIntelligenceLayer({
      gptDirection: RESTAURANT_DIR,
      strategy,
      aspectRatio: "9:16",
    })).not.toThrow();
  });

  it("handles all three aspect ratios without throwing", () => {
    const strategy = makeStrategy("Dental Clinic Campaign");
    for (const ar of ["9:16", "1:1", "16:9"] as const) {
      expect(() => runDesignIntelligenceLayer({
        gptDirection: DENTAL_DIR,
        strategy,
        aspectRatio: ar,
      })).not.toThrow();
    }
  });

  it("uses default 9:16 when aspectRatio is omitted", () => {
    const strategy = makeStrategy("Dental Clinic Campaign");
    expect(() => runDesignIntelligenceLayer({
      gptDirection: DENTAL_DIR,
      strategy,
    })).not.toThrow();
  });

  it("design weights sum to 100 in integration result", () => {
    const strategy = makeStrategy("Luxury Jewellery Campaign");
    const result = runDesignIntelligenceLayer({
      gptDirection: DENTAL_DIR,
      strategy,
      aspectRatio: "9:16",
    });
    const { designPlan: d } = result;
    expect(d.heroWeight + d.headlineWeight + d.ctaWeight + d.logoWeight + d.decorativeWeight).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// compileDesignIntelligencePrompt — output quality
// ─────────────────────────────────────────────────────────────────────────────

describe("compileDesignIntelligencePrompt — output quality", () => {
  function buildAll(dir: GPTCampaignDirection, idea: string, ar: "9:16" | "1:1" | "16:9" = "9:16") {
    const strategy = makeStrategy(idea);
    const design      = buildDesignDirectorOutput(dir, strategy);
    const photography = buildPhotographyDirectorOutput(dir, strategy, ar);
    const typography  = buildTypographyDirectorOutput(design, strategy);
    const layout      = buildLayoutDirectorOutput(design, typography, ar);
    return compileDesignIntelligencePrompt({ gptDirection: dir, design, photography, typography, layout });
  }

  it("produces multiple paragraphs separated by blank lines", () => {
    const prompt = buildAll(DENTAL_DIR, "Dental Clinic Trust Campaign");
    const paragraphs = prompt.split("\n\n").filter(p => p.trim().length > 0);
    expect(paragraphs.length).toBeGreaterThanOrEqual(4);
  });

  it("always contains camera specification keywords", () => {
    const prompt = buildAll(DENTAL_DIR, "Dental Clinic Campaign");
    expect(prompt.toLowerCase()).toMatch(/camera|lens|focal|depth of field/);
  });

  it("always contains lighting keywords", () => {
    const prompt = buildAll(RESTAURANT_DIR, "Fine Dining Restaurant Campaign");
    expect(prompt.toLowerCase()).toMatch(/light|kelvin|shadow|backlight/);
  });

  it("always contains whitespace/margin keywords", () => {
    const prompt = buildAll(DENTAL_DIR, "Dental Clinic Campaign");
    expect(prompt.toLowerCase()).toMatch(/margin|whitespace|zone|reserved/);
  });

  it("mentions the hero subject", () => {
    const prompt = buildAll(DENTAL_DIR, "Dental Clinic Campaign");
    // hero subject starts with "A calm dentist"
    expect(prompt.toLowerCase()).toMatch(/dentist|hero/);
  });

  it("mentions decisive moment ingredients", () => {
    const prompt = buildAll(RESTAURANT_DIR, "Fine Dining Restaurant Campaign");
    expect(prompt.toLowerCase()).toMatch(/moment|instant|captur|frozen/);
  });

  it("includes quality mandate language", () => {
    const prompt = buildAll(DENTAL_DIR, "Dental Clinic Campaign");
    expect(prompt.toLowerCase()).toMatch(/premium|quality|commercial|mandate|constraint/);
  });

  it("includes hard constraints", () => {
    const prompt = buildAll(DENTAL_DIR, "Dental Clinic Campaign");
    expect(prompt.toLowerCase()).toMatch(/no text|no logo|constraint/);
  });

  it("produces substantially different prompts for different industries", () => {
    const dental      = buildAll(DENTAL_DIR, "Dental Clinic Campaign");
    const restaurant  = buildAll(RESTAURANT_DIR, "Fine Dining Restaurant Campaign");
    // Not identical — industry-specific content must differ
    expect(dental).not.toBe(restaurant);
    // At least 50 characters must differ in some position
    const minDifferences = [...dental].filter((c, i) => c !== (restaurant[i] ?? "")).length;
    expect(minDifferences).toBeGreaterThan(50);
  });

  it("16:9 prompt mentions landscape composition", () => {
    const prompt = buildAll(DENTAL_DIR, "Dental Clinic Campaign", "16:9");
    expect(prompt.toLowerCase()).toMatch(/landscape|horizontal|left.*column|right.*column/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layout Director — structural correctness via integration
// ─────────────────────────────────────────────────────────────────────────────

describe("buildLayoutDirectorOutput — structure via integration", () => {
  it("all five regions are present", () => {
    const strategy = makeStrategy("Dental Clinic Campaign");
    const design      = buildDesignDirectorOutput(DENTAL_DIR, strategy);
    const typography  = buildTypographyDirectorOutput(design, strategy);
    const layout      = buildLayoutDirectorOutput(design, typography, "9:16");

    expect(layout.regions).toHaveProperty("headline");
    expect(layout.regions).toHaveProperty("hero");
    expect(layout.regions).toHaveProperty("cta");
    expect(layout.regions).toHaveProperty("logo");
    expect(layout.regions).toHaveProperty("footer");
  });

  it("all regions have zone, verticalStart, verticalEnd, priority, contents", () => {
    const strategy = makeStrategy("Dental Clinic Campaign");
    const design     = buildDesignDirectorOutput(DENTAL_DIR, strategy);
    const typography = buildTypographyDirectorOutput(design, strategy);
    const layout     = buildLayoutDirectorOutput(design, typography, "9:16");

    for (const key of ["headline", "hero", "cta", "logo", "footer"] as const) {
      const region = layout.regions[key];
      expect(typeof region.zone).toBe("string");
      expect(typeof region.verticalStart).toBe("string");
      expect(typeof region.verticalEnd).toBe("string");
      expect(typeof region.priority).toBe("number");
      expect(Array.isArray(region.contents)).toBe(true);
    }
  });

  it("safe margins are non-empty strings", () => {
    const strategy = makeStrategy("Restaurant Campaign");
    const design     = buildDesignDirectorOutput(RESTAURANT_DIR, strategy);
    const typography = buildTypographyDirectorOutput(design, strategy);
    const layout     = buildLayoutDirectorOutput(design, typography, "9:16");

    expect(layout.safeMargins.top.length).toBeGreaterThan(0);
    expect(layout.safeMargins.bottom.length).toBeGreaterThan(0);
    expect(layout.safeMargins.left.length).toBeGreaterThan(0);
    expect(layout.safeMargins.right.length).toBeGreaterThan(0);
  });

  it("ASCII layout is a non-empty string", () => {
    const strategy = makeStrategy("Dental Clinic Campaign");
    const design     = buildDesignDirectorOutput(DENTAL_DIR, strategy);
    const typography = buildTypographyDirectorOutput(design, strategy);
    const layout     = buildLayoutDirectorOutput(design, typography, "9:16");
    expect(layout.asciiLayout.length).toBeGreaterThan(10);
  });
});
