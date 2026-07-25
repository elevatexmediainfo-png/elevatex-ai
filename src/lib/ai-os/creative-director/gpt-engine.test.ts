import { describe, expect, it, vi, beforeEach } from "vitest";

import { analyzeUserRequest } from "../user-understanding";
import { buildCreativeStrategy } from "../creative-brain";
import { buildCreativeContext } from "../creative-context";
import type { CreativeRequest } from "../types";
import type { GPTCampaignDirection, GPTDirectorInput } from "./gpt-types";
import { validateGPTCampaignDirection } from "./gpt-validation";
import { buildCreativeDirectorPrompt, buildRepairPrompt, GPT_CD_SYSTEM_PROMPT } from "./gpt-prompt";

// ─────────────────────────────────────────────────────────────────────────────
// Mock LLMOrchestrator — prevents real network calls in tests
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/ai-os/llm", () => ({
  LLMOrchestrator: {
    generateText: vi.fn(),
  },
}));

// Import AFTER vi.mock() so the module is already mocked when imported
import { LLMOrchestrator } from "@/lib/ai-os/llm";
const getEngine = async () => import("./gpt-engine");

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeInput(rawIdea: string): GPTDirectorInput {
  const request: CreativeRequest = { userId: "test", rawIdea, requestedAt: new Date() };
  const userUnderstanding = analyzeUserRequest(request);
  const context = buildCreativeContext(request, userUnderstanding, {}, { userId: "test" });
  const strategy = buildCreativeStrategy(context);
  return { strategy, userUnderstanding, rawIdea };
}

const VALID_DIRECTION: GPTCampaignDirection = {
  campaignConcept:    "Trust earned through expertise — not promises.",
  marketingObjective: "Drive consultation bookings from hesitant first-time patients.",
  psychologicalGoal:  "Convert fear of the unknown into confidence that care is in the right hands.",
  viewerEmotion:      "Quiet reassurance — the feeling of being understood.",
  coreMessage:        "Expert care, compassionate approach, natural results.",
  heroSubject:        "A calm dentist with a genuine smile leans forward slightly, explaining the process to a patient whose expression softens from tension to relief. The consultation feels like a conversation, not a procedure.",
  secondarySubjects:  "The patient's hands relaxed on the armrests — a subtle visual cue that the anxiety has lifted.",
  supportingObjects:  "A framed certification on the wall, just visible enough to signal trust without being the focus.",
  visualStory: {
    before: "The patient has delayed this appointment for months — uncertain, searching for reasons to trust.",
    moment: "A dentist's calm explanation lands. The patient sees someone who listens, not just a clinic that processes.",
    after:  "The patient leaves with their first appointment booked — not just informed, but genuinely reassured.",
  },
  sceneDescription:    "A warm, modern consultation room. Morning light through frosted glass. A dentist seated across from a patient at eye level — equal, not elevated. The patient's expression is moving from guarded to open. Nothing clinical is the focus; the human connection is.",
  visualHierarchy: {
    primary:    "The dentist-patient connection — eye contact, body language, warmth.",
    secondary:  "The patient's expression shifting from worry to relief.",
    background: "A subtly visible certification and tidy, modern clinic environment.",
    decorative: "Natural light and soft interior tones that say 'safe' without saying 'hospital'.",
  },
  negativeSpace: {
    headline: "Upper third — the viewer reads the headline before the scene pulls them in.",
    cta:      "Bottom strip — low visual weight but unmissable once the emotional sell is done.",
    logo:     "Lower right corner — present and confident, not competing with the story.",
  },
  compositionIntent: {
    eyeFlow:        "From headline → dentist's face → patient's expression → CTA — a narrative arc in four beats.",
    subjectBalance: "Two human subjects of near-equal weight, balanced but with the patient as the emotional anchor.",
    framingLogic:   "Slightly closer than comfortable — intimate enough to feel the moment, respectful enough to feel professional.",
  },
  lightingMood:    "Warm and soft — the light of a clinic that wants you to relax, not a hospital that wants to process you.",
  environment:     "A contemporary dental consultation room that feels more like a private office than a medical facility.",
  colorPsychology: "Blues and warm whites build clinical trust; accents of warm amber say 'we care about your comfort'.",
  marketingTriggers: ["Authority — visible credentials signal expertise without overselling", "Liking — the dentist is approachable, not intimidating", "Social proof — implied by a full, well-maintained consultation room"],
  trustTriggers:     ["Visible certification or accreditation", "A real doctor-patient interaction, not a stock-photo pose", "Clean, modern, non-threatening environment"],
  microInteractions: ["The patient's hands relaxed on the armrests — the body says yes before the voice does", "The dentist's slight forward lean — interested, not rushed"],
  mustInclude:       ["Real human connection between dentist and patient", "At least one visible trust credential", "A warm but professional environment that doesn't look like a hospital"],
  mustAvoid:         ["Any image of dental tools in the foreground — creates anxiety, not trust", "Sterile white backgrounds with isolated props — impersonal", "Stock-photo smiles that no one believes"],
  commercialStyle:   "Premium local professional service — warm authority, human-first, evidence-supported without feeling corporate.",
  narrative:         "A hesitant patient finally walks into the consultation they've been delaying. The dentist doesn't sell — they listen. By the end of the conversation, the patient isn't just informed; they feel safe. The ad closes on that shift: from uncertainty to quiet confidence.",
};

const VALID_MOCK_RESPONSE = JSON.stringify(VALID_DIRECTION);

// ─────────────────────────────────────────────────────────────────────────────
// 1 — Schema validation
// ─────────────────────────────────────────────────────────────────────────────

describe("validateGPTCampaignDirection", () => {
  it("accepts a valid complete direction", () => {
    expect(() => validateGPTCampaignDirection(VALID_DIRECTION)).not.toThrow();
  });

  it("throws when input is not an object", () => {
    expect(() => validateGPTCampaignDirection("a string")).toThrow("not a JSON object");
    expect(() => validateGPTCampaignDirection(null)).toThrow("not a JSON object");
    expect(() => validateGPTCampaignDirection([])).toThrow("not a JSON object");
  });

  it("throws on missing top-level string field", () => {
    const bad = { ...VALID_DIRECTION, campaignConcept: undefined };
    expect(() => validateGPTCampaignDirection(bad)).toThrow("campaignConcept");
  });

  it("throws on empty string field", () => {
    const bad = { ...VALID_DIRECTION, narrative: "" };
    expect(() => validateGPTCampaignDirection(bad)).toThrow("narrative");
  });

  it("throws on missing nested object", () => {
    const bad = { ...VALID_DIRECTION, visualStory: undefined };
    expect(() => validateGPTCampaignDirection(bad)).toThrow("visualStory");
  });

  it("throws on missing nested field", () => {
    const bad = { ...VALID_DIRECTION, visualStory: { before: "x", moment: "y" } };
    expect(() => validateGPTCampaignDirection(bad)).toThrow("visualStory.after");
  });

  it("throws on empty array", () => {
    const bad = { ...VALID_DIRECTION, marketingTriggers: [] };
    expect(() => validateGPTCampaignDirection(bad)).toThrow("marketingTriggers");
  });

  it("throws on non-array field where array is expected", () => {
    const bad = { ...VALID_DIRECTION, trustTriggers: "not an array" };
    expect(() => validateGPTCampaignDirection(bad)).toThrow("trustTriggers");
  });

  it("validates all 23 top-level fields and 9 nested fields", () => {
    const result = validateGPTCampaignDirection(VALID_DIRECTION);
    expect(result.campaignConcept).toBeTruthy();
    expect(result.visualStory.before).toBeTruthy();
    expect(result.visualHierarchy.primary).toBeTruthy();
    expect(result.negativeSpace.cta).toBeTruthy();
    expect(result.compositionIntent.eyeFlow).toBeTruthy();
    expect(result.marketingTriggers.length).toBeGreaterThanOrEqual(1);
    expect(result.mustAvoid.length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 — Prompt builder
// ─────────────────────────────────────────────────────────────────────────────

describe("buildCreativeDirectorPrompt", () => {
  it("includes the raw idea in the prompt", () => {
    const input = makeInput("Dental Implant Consultation");
    const prompt = buildCreativeDirectorPrompt(input);
    expect(prompt).toContain("Dental Implant Consultation");
  });

  it("includes industry signal from strategy", () => {
    const input = makeInput("Dental Implant — painless procedure, 15 years experience");
    const prompt = buildCreativeDirectorPrompt(input);
    expect(prompt.toLowerCase()).toMatch(/healthcare|dental/);
  });

  it("includes extracted pain points when present", () => {
    const input = makeInput("Dental implant for people afraid of pain and needles");
    const prompt = buildCreativeDirectorPrompt(input);
    // Pain point about fear should be reflected somewhere in prompt
    expect(prompt.length).toBeGreaterThan(500);
  });

  it("includes schema block", () => {
    const input = makeInput("Restaurant Grand Opening");
    const prompt = buildCreativeDirectorPrompt(input);
    expect(prompt).toContain("campaignConcept");
    expect(prompt).toContain("marketingTriggers");
    expect(prompt).toContain("narrative");
  });

  it("includes brand context when provided", () => {
    const input = makeInput("Jewellery brand launch");
    input.brandContext = { primaryColor: "#C8A96E", fontFamily: "Playfair Display" };
    const prompt = buildCreativeDirectorPrompt(input);
    expect(prompt).toContain("#C8A96E");
    expect(prompt).toContain("Playfair Display");
  });

  it("includes reference image analysis when provided", () => {
    const input = makeInput("Real estate premium project");
    input.referenceImageAnalysis = "Warm golden tones, a luxury apartment living room, affluent family silhouette";
    const prompt = buildCreativeDirectorPrompt(input);
    expect(prompt).toContain("Warm golden tones");
  });
});

describe("buildRepairPrompt", () => {
  it("contains the parse error message", () => {
    const repair = buildRepairPrompt("original prompt", "Unexpected token < in JSON");
    expect(repair).toContain("Unexpected token < in JSON");
    expect(repair).toContain("CORRECTION REQUIRED");
    expect(repair).toContain("original prompt");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 — GPT engine: success path
// ─────────────────────────────────────────────────────────────────────────────

describe("runGPTCreativeDirector — success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mode=gpt with valid direction when LLM succeeds", async () => {
    // LLMOrchestrator is already imported as the mocked version
    vi.mocked(LLMOrchestrator.generateText).mockResolvedValueOnce({
      text: VALID_MOCK_RESPONSE,
      cached: false,
      taskType: "json_extraction",
      providerRef: "openai/gpt-4o-mini",
    });

    const { runGPTCreativeDirector } = await getEngine();
    const result = await runGPTCreativeDirector(makeInput("Dental Implant Consultation"));

    expect(result.mode).toBe("gpt");
    expect(result.direction).not.toBeNull();
    expect(result.direction?.campaignConcept).toBeTruthy();
    expect(result.fallbackPlan).toBeDefined();
    expect(result.debug.error).toBeNull();
    expect(result.debug.retryCount).toBe(0);
    expect(result.debug.model).toBe("openai/gpt-4o-mini");
  });

  it("strips markdown fences from LLM response", async () => {
    // LLMOrchestrator is already imported as the mocked version
    vi.mocked(LLMOrchestrator.generateText).mockResolvedValueOnce({
      text: "```json\n" + VALID_MOCK_RESPONSE + "\n```",
      cached: false,
      taskType: "json_extraction",
    });

    const { runGPTCreativeDirector } = await getEngine();
    const result = await runGPTCreativeDirector(makeInput("Restaurant promo"));
    expect(result.mode).toBe("gpt");
    expect(result.direction).not.toBeNull();
  });

  it("records raw output in debug", async () => {
    // LLMOrchestrator is already imported as the mocked version
    vi.mocked(LLMOrchestrator.generateText).mockResolvedValueOnce({
      text: VALID_MOCK_RESPONSE,
      cached: false,
      taskType: "json_extraction",
    });

    const { runGPTCreativeDirector } = await getEngine();
    const result = await runGPTCreativeDirector(makeInput("Fitness brand awareness"));
    expect(result.debug.rawOutput).toBe(VALID_MOCK_RESPONSE);
    expect(result.debug.promptSizeChars).toBeGreaterThan(0);
    expect(result.debug.executionTimeMs).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 — GPT engine: retry
// ─────────────────────────────────────────────────────────────────────────────

describe("runGPTCreativeDirector — retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries once on JSON parse failure and succeeds on second call", async () => {
    // LLMOrchestrator is already imported as the mocked version
    vi.mocked(LLMOrchestrator.generateText)
      .mockResolvedValueOnce({ text: "not valid json at all {{{{", cached: false, taskType: "json_extraction" })
      .mockResolvedValueOnce({ text: VALID_MOCK_RESPONSE, cached: false, taskType: "json_extraction" });

    const { runGPTCreativeDirector } = await getEngine();
    const result = await runGPTCreativeDirector(makeInput("Dental Implant"));

    expect(result.mode).toBe("gpt");
    expect(result.direction).not.toBeNull();
    expect(result.debug.retryCount).toBe(1);
    expect(vi.mocked(LLMOrchestrator.generateText)).toHaveBeenCalledTimes(2);
  });

  it("retries once on schema validation failure and succeeds on second call", async () => {
    // LLMOrchestrator is already imported as the mocked version
    const missingField = { ...VALID_DIRECTION, narrative: "" }; // will fail validation
    vi.mocked(LLMOrchestrator.generateText)
      .mockResolvedValueOnce({ text: JSON.stringify(missingField), cached: false, taskType: "json_extraction" })
      .mockResolvedValueOnce({ text: VALID_MOCK_RESPONSE, cached: false, taskType: "json_extraction" });

    const { runGPTCreativeDirector } = await getEngine();
    const result = await runGPTCreativeDirector(makeInput("Finance brand"));

    expect(result.mode).toBe("gpt");
    expect(result.debug.retryCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5 — GPT engine: fallback
// ─────────────────────────────────────────────────────────────────────────────

describe("runGPTCreativeDirector — fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back silently when both GPT attempts fail", async () => {
    // LLMOrchestrator is already imported as the mocked version
    vi.mocked(LLMOrchestrator.generateText).mockRejectedValue(new Error("API rate limit exceeded"));

    const { runGPTCreativeDirector } = await getEngine();
    const result = await runGPTCreativeDirector(makeInput("Dental Implant"));

    expect(result.mode).toBe("fallback");
    expect(result.direction).toBeNull();
    expect(result.fallbackPlan).toBeDefined();
    expect(result.fallbackPlan.concept).toBeDefined();
    expect(result.debug.error).toContain("API rate limit exceeded");
    expect(result.debug.retryCount).toBe(1);
  });

  it("always returns a valid fallbackPlan regardless of GPT outcome", async () => {
    // LLMOrchestrator is already imported as the mocked version
    vi.mocked(LLMOrchestrator.generateText).mockRejectedValue(new Error("Network error"));

    const { runGPTCreativeDirector } = await getEngine();
    const result = await runGPTCreativeDirector(makeInput("Restaurant promotion 50% off"));

    expect(result.fallbackPlan.concept).toBeDefined();
    expect(result.fallbackPlan.visualStory).toBeDefined();
    expect(result.fallbackPlan.confidenceScore).toBeGreaterThanOrEqual(0);
  });

  it("does not throw to the caller on GPT failure", async () => {
    // LLMOrchestrator is already imported as the mocked version
    vi.mocked(LLMOrchestrator.generateText).mockRejectedValue(new Error("500 Internal Server Error"));

    const { runGPTCreativeDirector } = await getEngine();
    await expect(runGPTCreativeDirector(makeInput("Beauty salon ad"))).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6 — LLMOrchestrator integration: correct call shape
// ─────────────────────────────────────────────────────────────────────────────

describe("runGPTCreativeDirector — LLMOrchestrator integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls LLMOrchestrator.generateText (not generateScript or generateJSON)", async () => {
    // LLMOrchestrator is already imported as the mocked version
    vi.mocked(LLMOrchestrator.generateText).mockResolvedValueOnce({
      text: VALID_MOCK_RESPONSE,
      cached: false,
      taskType: "json_extraction",
    });

    const { runGPTCreativeDirector } = await getEngine();
    await runGPTCreativeDirector(makeInput("Dental clinic"));

    expect(vi.mocked(LLMOrchestrator.generateText)).toHaveBeenCalledOnce();
    const call = vi.mocked(LLMOrchestrator.generateText).mock.calls[0][0];
    expect(call.operation).toBe("creative_director");
    expect(call.taskType).toBe("json_extraction");
    expect(call.language).toBe("EN");
  });

  it("passes the correct system prompt", async () => {
    // LLMOrchestrator is already imported as the mocked version
    vi.mocked(LLMOrchestrator.generateText).mockResolvedValueOnce({
      text: VALID_MOCK_RESPONSE,
      cached: false,
      taskType: "json_extraction",
    });

    const { runGPTCreativeDirector } = await getEngine();
    await runGPTCreativeDirector(makeInput("Restaurant"));

    const call = vi.mocked(LLMOrchestrator.generateText).mock.calls[0][0];
    expect(call.systemPrompt).toContain("Creative Director");
    expect(call.systemPrompt).toContain("NEVER WRITE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.2C — System prompt hero bias removal
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.2C — GPT system prompt contains no hardcoded hero defaults", () => {
  // INDIAN MARKET DEFAULTS — hero subjects removed
  it("RESTAURANT: no hardcoded chef or guest hero", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("An Indian head chef in whites with a black apron");
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("Indian guests — a couple, a family, a business table");
  });

  it("DENTAL: no hardcoded dentist or patient hero", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("An Indian dentist in clinical white with blue nitrile gloves");
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("An Indian patient — adult, upper-middle-class, anxious on arrival");
  });

  it("REAL ESTATE: no hardcoded family hero", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("An Indian family — parents, one or two children, possibly a grandparent");
  });

  it("FINANCE: no hardcoded couple or professional hero", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("An Indian couple at a kitchen table");
  });

  it("JEWELLERY: no hardcoded bride hero", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("An Indian bride or Indian woman in her 30s");
  });

  it("HEALTHCARE: no hardcoded doctor/patient/family hero", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("An Indian doctor, Indian patient, Indian family member");
  });

  it("SALON: no hardcoded woman/stylist hero", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("An Indian woman, Indian stylist");
  });

  it("GYM: no hardcoded fitness model hero", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("An Indian fitness model — lean, dark-featured, determined");
  });

  it("EDUCATION: no hardcoded student/classroom hero", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("Indian student, Indian classroom, Indian campus environment");
  });

  it("no 'Default:' hero prescription pattern in any industry section", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toMatch(/^Default:/m);
  });

  // DECISIVE MOMENT EXAMPLES — prescriptive scenes removed
  it("DECISIVE MOMENT: no prescriptive restaurant chef scene", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("The head chef — an Indian man in his 40s");
  });

  it("DECISIVE MOMENT: no prescriptive dental doctor scene", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("An Indian dentist in a white coat and powder-blue gloves");
  });

  it("DECISIVE MOMENT: no prescriptive real estate family scene", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("An Indian family crosses the threshold");
  });

  it("DECISIVE MOMENT: no prescriptive finance parents scene", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("Two Indian parents sit at the kitchen table");
  });

  it("DECISIVE MOMENT: no prescriptive jewellery bride scene", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("An Indian bride has put on the necklace herself");
  });

  it("DECISIVE MOMENT: no prescriptive healthcare father scene", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("An Indian father walks out of the hospital corridor");
  });

  it("DECISIVE MOMENT: no prescriptive education girl scene", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("An Indian girl — 18, the first in her family");
  });

  // ACTION OVER POSE — industry-specific examples removed
  it("ACTION OVER POSE: no hardcoded chef action example", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("A chef finishes garnishing the last detail");
  });

  it("ACTION OVER POSE: no hardcoded dentist action example", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("A dentist places an implant model");
  });

  it("ACTION OVER POSE: no hardcoded bride action example", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("A bride touches the necklace");
  });

  it("ACTION OVER POSE: no hardcoded doctor action example", () => {
    expect(GPT_CD_SYSTEM_PROMPT).not.toContain("A doctor leans forward to show a scan result");
  });

  // Style guidance PRESERVED — these must still be present
  it("style guidance PRESERVED: restaurant atmospheric language still present", () => {
    expect(GPT_CD_SYSTEM_PROMPT).toContain("deep amber chandeliers");
    expect(GPT_CD_SYSTEM_PROMPT).toContain("warmth, hospitality");
  });

  it("style guidance PRESERVED: dental clinical atmosphere still present", () => {
    expect(GPT_CD_SYSTEM_PROMPT).toContain("clinical competence");
    expect(GPT_CD_SYSTEM_PROMPT).toContain("premium but never sterile");
  });

  it("style guidance PRESERVED: real estate visual language still present", () => {
    expect(GPT_CD_SYSTEM_PROMPT).toContain("marble flooring");
    expect(GPT_CD_SYSTEM_PROMPT).toContain("vastu-considered");
  });

  it("style guidance PRESERVED: cultural defaults still present", () => {
    expect(GPT_CD_SYSTEM_PROMPT).toContain("ALL human subjects are Indian");
    expect(GPT_CD_SYSTEM_PROMPT).toContain("Indian faces. Indian skin tones. Indian expressions.");
  });

  it("Creative Brain declared as the sole hero source in every industry section", () => {
    const matches = (GPT_CD_SYSTEM_PROMPT.match(/determined by the Creative Brain/g) ?? []).length;
    expect(matches).toBeGreaterThanOrEqual(9);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 10.2D — Hero Subject Integrity
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 10.2D — Hero Subject Integrity: schema must elaborate, never replace", () => {
  it("schema block instructs GPT to use the provided Hero Subject Directive", () => {
    const prompt = buildCreativeDirectorPrompt(makeInput("Dental Implant Consultation"));
    expect(prompt).toContain("Hero Subject Directive");
  });

  it("schema block instructs GPT not to invent a different hero", () => {
    const prompt = buildCreativeDirectorPrompt(makeInput("Dental Implant Consultation"));
    expect(prompt).toContain("Do not invent a different hero");
  });

  it("schema block instructs GPT not to replace the Creative Brain's decision", () => {
    const prompt = buildCreativeDirectorPrompt(makeInput("Restaurant Grand Opening"));
    expect(prompt).toContain("Do not replace the Creative Brain");
  });

  it("schema block NO LONGER asks GPT to generate a vivid human scene from scratch", () => {
    const prompt = buildCreativeDirectorPrompt(makeInput("Jewellery Brand Campaign"));
    // Old instruction: "described as a vivid human scene, not a label" — a generate-new command
    expect(prompt).not.toContain("not a label");
  });

  it("schema block allows GPT to enrich descriptive detail without changing the hero", () => {
    const prompt = buildCreativeDirectorPrompt(makeInput("Beauty Salon — before/after transformation"));
    expect(prompt).toContain("You may enrich");
  });

  it("schema block references the NON-NEGOTIABLE section for hero subject", () => {
    const prompt = buildCreativeDirectorPrompt(makeInput("Real Estate Premium Apartments"));
    expect(prompt).toContain("NON-NEGOTIABLE section");
  });

  it("prompt includes HERO SUBJECT DIRECTIVE block for campaigns with a known hero", () => {
    const prompt = buildCreativeDirectorPrompt(makeInput("Dental Implant Consultation — 15 years experience"));
    expect(prompt).toContain("HERO SUBJECT DIRECTIVE — NON-NEGOTIABLE");
  });

  it("NON-NEGOTIABLE block includes the Creative Brain's actual hero subject value", () => {
    const input = makeInput("Dental Implant Consultation");
    const strategy = input.strategy;
    const prompt = buildCreativeDirectorPrompt(input);
    if (strategy.creative.heroSubject.value !== "unknown") {
      expect(prompt).toContain(strategy.creative.heroSubject.value);
    }
  });

  it("prompt explicitly blocks GPT from generating its own hero subject", () => {
    const prompt = buildCreativeDirectorPrompt(makeInput("Dental Implant Consultation"));
    // The NON-NEGOTIABLE directive block tells GPT to use this exact direction
    expect(prompt).toContain("Do not generate your own hero subject");
  });

  it("heroSubject schema instruction is downstream of the NON-NEGOTIABLE directive in the prompt", () => {
    const prompt = buildCreativeDirectorPrompt(makeInput("Restaurant Grand Opening"));
    const directiveIdx = prompt.indexOf("HERO SUBJECT DIRECTIVE — NON-NEGOTIABLE");
    const schemaIdx    = prompt.indexOf("heroSubject");
    // The NON-NEGOTIABLE block (directive source) appears before the schema block
    expect(directiveIdx).toBeGreaterThan(-1);
    expect(schemaIdx).toBeGreaterThan(directiveIdx);
  });
});
