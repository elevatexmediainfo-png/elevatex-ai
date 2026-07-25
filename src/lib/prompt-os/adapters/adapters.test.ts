import { describe, expect, it } from "vitest";

import { universalPromptSchema } from "../schema";
import { buildOpenAIPrompt } from "./openai.adapter";
import { buildFluxPrompt } from "./flux.adapter";
import { buildIdeogramPrompt } from "./ideogram.adapter";
import { buildGeminiPrompt } from "./gemini.adapter";
import { buildGenericPrompt } from "./generic.adapter";
import { resolvePromptAdapter } from "./index";

const SAMPLE = universalPromptSchema.parse({
  intent: "a luxury villa exterior at golden hour",
  objects: ["infinity pool", "palm trees"],
  style: { mood: "aspirational", aesthetic: "premium editorial", luxuryLevel: "high" },
  layout: { composition: "rule-of-thirds", headlinePosition: "upper third", ctaPosition: "lower right" },
  typography: { treatment: "clean sans-serif", fontStyle: "geometric" },
  lighting: { direction: "upper-left key light", quality: "soft diffused" },
  camera: { angle: "low angle", lens: "24mm", depthOfField: "shallow" },
  composition: { framing: "wide shot", focalPoint: "villa facade" },
  colors: { palette: ["gold", "cream", "charcoal"], harmony: "complementary" },
  marketing: { goal: "lead generation", targetAudience: "affluent homebuyers" },
  negative_constraints: ["cartoon look", "plastic faces", "distorted text"],
  quality: { keywords: ["photorealistic", "8k", "professional photography"] },
});

describe("provider adapters", () => {
  it("buildOpenAIPrompt produces flowing prose sentences, including negative constraints in the text (no separate channel)", () => {
    const text = buildOpenAIPrompt(SAMPLE);
    expect(text).toContain("aspirational");
    expect(text).toMatch(/Avoid:.*cartoon look.*plastic faces.*distorted text/);
    expect(text.split(". ").length).toBeGreaterThan(3); // multiple sentences
  });

  it("buildFluxPrompt produces a comma-separated tag list and omits negative constraints (dedicated channel handles those)", () => {
    const text = buildFluxPrompt(SAMPLE);
    expect(text).toContain("aspirational mood");
    expect(text).toContain("rule-of-thirds");
    expect(text).not.toContain("Avoid:");
    expect(text).not.toContain("cartoon look");
    expect(text.includes(", ")).toBe(true);
    expect(text.trim().endsWith(".")).toBe(false); // tag style, not prose
  });

  it("buildIdeogramPrompt explicitly calls out on-image text placement", () => {
    const text = buildIdeogramPrompt(SAMPLE);
    expect(text).toMatch(/on-image text/i);
    expect(text).toContain("headline text placed upper third");
    expect(text).toContain("call-to-action text placed lower right");
    expect(text).toMatch(/Avoid:.*cartoon look/);
  });

  it("buildGenericPrompt is a safe fallback descriptive paragraph", () => {
    const text = buildGenericPrompt(SAMPLE);
    expect(text).toContain("aspirational mood");
    expect(text).toMatch(/Avoid:.*cartoon look/);
  });

  it("buildGeminiPrompt (Phase 2.3) leads with the scene's objects, then flowing natural-language sentences", () => {
    const text = buildGeminiPrompt(SAMPLE);
    expect(text).toMatch(/^Scene contains: infinity pool, palm trees\./);
    expect(text).toContain("aspirational");
    expect(text).toMatch(/Avoid:.*cartoon look/);
  });

  it("the same input produces measurably different text across vendors — the core architectural proof", () => {
    const openai = buildOpenAIPrompt(SAMPLE);
    const flux = buildFluxPrompt(SAMPLE);
    const ideogram = buildIdeogramPrompt(SAMPLE);
    const gemini = buildGeminiPrompt(SAMPLE);
    const generic = buildGenericPrompt(SAMPLE);

    expect(openai).not.toBe(flux);
    expect(openai).not.toBe(ideogram);
    expect(openai).not.toBe(gemini);
    expect(flux).not.toBe(generic);
    expect(ideogram).not.toBe(generic);
    expect(gemini).not.toBe(generic);
  });
});

// Provider Prompt Optimization — reproduces the exact field shape confirmed
// live in production (project cmr0wey91002o9gu74z7a9ytq): style.mood and
// style.aesthetic combine the model's own short value with a Prompt
// Expander/Creative Brief sentence, ending in a period. Before this fix,
// buildOpenAIPrompt(SAMPLE_RICH) produced the literal confirmed bug:
// "...evoking a sense of well-being and self-care. mood, high luxury feel...".
const SAMPLE_RICH = universalPromptSchema.parse({
  intent: "a dental implant campaign",
  objects: ["dental chair", "smiling patient", "dentist"],
  style: {
    mood: "aspirational, Confidence and aspiration, evoking a sense of well-being and self-care.",
    aesthetic: "premium editorial — Sophisticated, aspirational, and trustworthy.",
    luxuryLevel: "high",
  },
  composition: { framing: "generous negative space around the primary subject" },
  marketing: {
    goal: "Increase brand awareness",
    psychologyHooks: [
      "A captivating image of a confident smile that communicates transformation and luxury",
      "Clinical certifications",
      "A captivating image of a confident smile that immediately communicates transformation and luxury.",
    ],
  },
  negative_constraints: ["cartoon look"],
});

describe("provider adapters — fluent joining of Prompt Expander sentence fragments (Provider Prompt Optimization)", () => {
  it("never produces the confirmed production bug pattern (sentence-ending period directly followed by a dangling suffix word)", () => {
    const text = buildOpenAIPrompt(SAMPLE_RICH);
    expect(text).not.toMatch(/\.\s+mood,/i);
    expect(text).not.toMatch(/\.\s+luxury feel/i);
  });

  it("keeps a complete-sentence field intact as its own sentence, properly capitalized", () => {
    const text = buildOpenAIPrompt(SAMPLE_RICH);
    expect(text).toContain("Confidence and aspiration, evoking a sense of well-being and self-care.");
  });

  it("a label like 'A' or 'Shot with' is never glued directly onto an already-complete sentence", () => {
    const text = buildOpenAIPrompt(SAMPLE_RICH);
    expect(text).not.toMatch(/\bA The\b/);
    expect(text).not.toMatch(/Shot with [A-Z]/); // "Shot with" should only ever precede a lowercase short-tag clause
  });

  it("buildOpenAIPrompt, buildFluxPrompt, and buildIdeogramPrompt now all surface the objects array (previously only Gemini did)", () => {
    expect(buildOpenAIPrompt(SAMPLE_RICH)).toMatch(/dental chair.*smiling patient.*dentist/);
    expect(buildFluxPrompt(SAMPLE_RICH)).toMatch(/dental chair.*smiling patient.*dentist/);
    expect(buildIdeogramPrompt(SAMPLE_RICH)).toMatch(/dental chair.*smiling patient.*dentist/);
  });

  it("de-duplicates near-identical marketing psychology hooks instead of repeating the same idea twice", () => {
    const text = buildOpenAIPrompt(SAMPLE_RICH);
    const occurrences = (text.match(/communicates transformation and luxury/g) ?? []).length;
    expect(occurrences).toBe(1);
    // The richer (longer) phrasing should be the one kept.
    expect(text).toContain("immediately communicates transformation and luxury");
  });

  it("Flux's tag style degrades a full-sentence fragment into a clean tag with no stray mid-list period", () => {
    const text = buildFluxPrompt(SAMPLE_RICH);
    expect(text).not.toMatch(/\.\s*,/); // no "X., Y" — a period immediately followed by a comma
  });

  // Confirmed live in production (Dental implant test, 2026-06-30): a
  // sentence-ending psychologyHook positioned in the MIDDLE of the array
  // (not last) produced "...captures interest., clear call-to-action: ..."
  // — describeMarketing() was pre-joining hooks into one string with plain
  // ", " before composeFluently() ever saw them, so only the LAST hook's
  // punctuation was ever classified correctly.
  it("never produces a period immediately followed by a comma, even when a sentence-ending psychology hook is in the middle of the array", () => {
    const prompt = universalPromptSchema.parse({
      intent: "a dental implant campaign",
      marketing: {
        psychologyHooks: [
          "board-certified expertise",
          "A striking before-and-after visual that immediately captures interest.",
          "modern sterilized equipment",
        ],
      },
    });
    const text = buildOpenAIPrompt(prompt);
    expect(text).not.toMatch(/\.\s*,/);
    expect(text).toContain("A striking before-and-after visual that immediately captures interest.");
  });
});

describe("resolvePromptAdapter", () => {
  it("resolves openai_images to the OpenAI adapter", () => {
    expect(resolvePromptAdapter("openai_images")).toBe(buildOpenAIPrompt);
  });

  it("resolves flux to the Flux adapter", () => {
    expect(resolvePromptAdapter("flux")).toBe(buildFluxPrompt);
  });

  it("resolves ideogram to the Ideogram adapter", () => {
    expect(resolvePromptAdapter("ideogram")).toBe(buildIdeogramPrompt);
  });

  it("resolves gemini to the Gemini adapter (Phase 2.3 — prompt-formatting only, no real provider integration)", () => {
    expect(resolvePromptAdapter("gemini")).toBe(buildGeminiPrompt);
  });

  it("falls back to the generic adapter for mock and any unknown provider", () => {
    expect(resolvePromptAdapter("mock")).toBe(buildGenericPrompt);
    expect(resolvePromptAdapter("some_future_vendor")).toBe(buildGenericPrompt);
    expect(resolvePromptAdapter(undefined)).toBe(buildGenericPrompt);
  });
});
