import type { LLMGenerateRequest, LLMGenerateResult, LLMProvider } from "./types";

function extractField(prompt: string, label: string): string | null {
  const match = prompt.match(new RegExp(`${label}:\\s*(.+)`, "i"));
  return match ? match[1].trim() : null;
}

const HOOK_BY_LANGUAGE: Record<string, string> = {
  EN: "Stop scrolling — here's something you don't want to miss!",
  HI: "रुकिए! यह आपके लिए खास है।",
  HINGLISH: "Ruko zara — yeh dekhna zaroori hai!",
};

const CTA_FALLBACK_BY_LANGUAGE: Record<string, string> = {
  EN: "Visit us today and see the difference for yourself.",
  HI: "आज ही हमसे जुड़ें।",
  HINGLISH: "Aaj hi visit karo aur khud dekho!",
};

// Milestone 8 (Script Studio) — extra variant phrasings so hook/cta
// generation can return multiple distinguishable options without a real LLM.
const HOOK_VARIANTS_EN = [
  "Stop scrolling — here's something you don't want to miss!",
  "Wait — you need to see this before you scroll past.",
  "This is the kind of thing your friends will ask you about.",
];
const CTA_VARIANTS_EN = [
  "Visit us today and see the difference for yourself.",
  "Don't wait — come experience it in person.",
  "Tap the link and book your visit now.",
];

function extractOriginal(prompt: string): string | null {
  const match = prompt.match(/Original:\s*\n([\s\S]+)/i);
  return match ? match[1].trim() : null;
}

// Milestone 16 — the Universal JSON Prompt builder (lib/prompt-os/builder.ts)
// and the Design Intelligence analyzer (lib/design-intelligence/analyze-asset.ts)
// both request responseFormat: "json". Mock can't run a real model, so it
// returns a deterministic, schema-shaped object for each — distinguished by
// whether an image is attached (asset analysis) or not (prompt building) —
// so both pipelines stay exercisable without API credentials, same as every
// other Mock branch in this file.
function simulateAssetAnalysisJson(): string {
  return JSON.stringify({
    industry: "hospitality",
    category: "lifestyle photography",
    style: "premium editorial",
    mood: "aspirational",
    platform: "instagram",
    lighting: "soft diffused key light from upper-left with a subtle rim light",
    composition: "rule-of-thirds, single focal subject, generous negative space",
    typography: "clean sans-serif, generous letter-spacing, grid-aligned",
    camera: "slightly elevated three-quarter view",
    lens: "35mm-equivalent, f/4-f/5.6",
    perspective: "eye-level to slightly elevated",
    depth: "shallow-to-moderate depth of field",
    texture: "natural skin texture, visible fabric weave, physically plausible reflections",
    hierarchy: "single clear focal point with one restrained accent color",
    whiteSpace: "generous negative space reserved for headline typography",
    luxuryLevel: "high",
    modernLevel: "contemporary",
    minimalism: "moderate",
    aspectRatio: "4:5",
    headlinePosition: "upper third",
    ctaPosition: "lower right",
    logoPosition: "lower left",
    marketingGoal: "brand awareness",
    targetAudience: "affluent lifestyle consumers",
    visualLanguage:
      "warm-neutral palette with one saturated accent color, soft directional lighting with realistic shadow falloff, grid-aligned typography",
    colorPalette: ["muted gold", "soft cream", "deep charcoal"],
    objects: ["primary subject", "negative-space backdrop"],
  });
}

function extractIdea(prompt: string): string | null {
  const match = prompt.match(/^Idea:\s*(.+)$/im);
  return match ? match[1].trim() : null;
}

// lib/creative/scene-split.ts requests responseFormat: "json" with a
// `Script:\n<script>` prompt and expects exactly
// `{ scenes: [{ sceneNumber, visualPrompt, durationSeconds }], textOverlays: [...] }`
// (sceneSplitSchema) — a different JSON shape from the two below
// (asset-analysis, universal-prompt-builder). Missing this branch meant
// every scene-split call against Mock fell through to
// simulateUniversalPromptJson()'s unrelated shape (no `scenes` field at
// all), failing sceneSplitSchema validation for every founder using Mock —
// the default for anyone without a real LLM provider configured. Confirmed
// live: this is exactly what broke video-project creation end-to-end.
function extractScript(prompt: string): string | null {
  const match = prompt.match(/^Script:\s*\n([\s\S]+)/i);
  return match ? match[1].trim() : null;
}

function simulateSceneSplitJson(script: string): string {
  const sentences = script
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const midpoint = Math.max(1, Math.ceil(sentences.length / 2));
  const hookText = sentences.slice(0, midpoint).join(" ") || script;
  const closeText = sentences.slice(midpoint).join(" ") || "A clear call-to-action closes the ad.";

  return JSON.stringify({
    scenes: [
      {
        sceneNumber: 1,
        visualPrompt: `An Indian host delivers the opening hook in a natural, energetic setting matching this beat: ${hookText}`,
        durationSeconds: 8,
      },
      {
        sceneNumber: 2,
        visualPrompt: `An Indian host delivers the closing call-to-action in a warm, inviting setting matching this beat: ${closeText}`,
        durationSeconds: 8,
      },
    ],
    textOverlays: [],
  });
}

function extractCreativeKind(prompt: string): string {
  const match = prompt.match(/^Creative kind:\s*(.+)$/im);
  return match ? match[1].trim() : "AI_IMAGE";
}

function simulateUniversalPromptJson(idea: string, kind: string): string {
  return JSON.stringify({
    intent: idea,
    creative_type: kind,
    style: {
      mood: "confident",
      aesthetic: "modern editorial",
      luxuryLevel: "moderate",
      modernLevel: "contemporary",
      minimalism: "balanced",
    },
    layout: {
      composition: "rule-of-thirds",
      hierarchy: "single clear focal point",
      whiteSpace: "generous",
    },
    typography: { treatment: "clean sans-serif", fontStyle: "geometric sans" },
    lighting: { direction: "upper-left key light", quality: "soft diffused", type: "natural" },
    camera: { angle: "eye-level", lens: "50mm-equivalent", depthOfField: "shallow", perspective: "straight-on" },
    composition: { framing: "centered subject", focalPoint: "primary subject", depth: "moderate", texture: "realistic" },
    colors: { palette: ["neutral warm tones"], harmony: "complementary" },
    marketing: { goal: "engagement", targetAudience: "general audience" },
    negative_constraints: ["cartoon look", "plastic faces", "low detail", "distorted text", "bad anatomy"],
    quality: { keywords: ["photorealistic", "ultra detailed", "professional photography", "8k"] },
    output: {},
  });
}

// Best-effort, deterministic text transforms so the Script Studio's
// Rewrite/Expand/Shorten/Translate operations are visibly exercisable in
// dev/demo without API credentials. Real adapters (OpenAI/Gemini) just
// receive the prompt's instruction text directly and follow it properly —
// this branch exists ONLY because Mock otherwise ignores `prompt` content.
function simulateTransform(prompt: string, original: string): string {
  const lower = prompt.toLowerCase();

  if (lower.startsWith("expand")) {
    return original
      .split("\n")
      .map((line) => (line.trim() ? `${line} This matters even more than it might first seem.` : line))
      .join("\n");
  }
  if (lower.startsWith("shorten")) {
    return original
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        const firstSentence = trimmed.split(/(?<=[.!?])\s/)[0];
        return firstSentence;
      })
      .join("\n");
  }
  if (lower.startsWith("translate")) {
    const langMatch = prompt.match(/translate the following video script into ([^,]+),/i);
    const language = langMatch ? langMatch[1].trim() : "the target language";
    return `[Translated to ${language}]\n${original}`;
  }
  // rewrite (and any other "Original:"-bearing prompt) — Mock can't truly
  // restyle tone without a model, so it visibly marks the rewrite while
  // preserving structure/meaning, which is honest about what Mock can do.
  const toneMatch = prompt.match(/in a (\w+) tone/i);
  const tonePrefix = toneMatch ? `[${toneMatch[1]} tone]\n` : "[Rewritten]\n";
  return `${tonePrefix}${original}`;
}

function simulateVariants(prompt: string, contentLanguage: string): string | null {
  const isHook = /alternative opening hook lines/i.test(prompt);
  const isCta = /alternative closing call-to-action lines/i.test(prompt);
  if (!isHook && !isCta) return null;

  const countMatch = prompt.match(/write (\d+)/i);
  const count = countMatch ? Math.min(5, Math.max(1, Number(countMatch[1]))) : 3;
  const base =
    contentLanguage === "EN"
      ? isHook
        ? HOOK_VARIANTS_EN
        : CTA_VARIANTS_EN
      : [isHook ? HOOK_BY_LANGUAGE[contentLanguage] ?? HOOK_BY_LANGUAGE.EN : CTA_FALLBACK_BY_LANGUAGE[contentLanguage] ?? CTA_FALLBACK_BY_LANGUAGE.EN];

  const variants = Array.from({ length: count }, (_, i) => base[i % base.length]);
  return variants.map((v, i) => `${i + 1}. ${v}`).join("\n");
}

// Default provider (selected when PROVIDER_LLM_PRIORITY has no other entry
// available) — simulates an LLM script-writer call
// with realistic latency so the UI's "generating…" state is real, without
// needing API credentials. Swap providers from /admin/providers; no code
// change needed to go live with a real one (see openai.provider.ts).
export class MockLLMProvider implements LLMProvider {
  readonly id = "mock";
  readonly category = "LLM" as const;

  async generate(req: LLMGenerateRequest): Promise<LLMGenerateResult> {
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Milestone 16 — JSON-mode requests (Universal JSON Prompt builder,
    // Design Intelligence asset analysis) are distinguished from each other
    // by whether an image is attached, not by prompt text matching.
    if (req.responseFormat === "json") {
      if (req.imageUrl) {
        return { text: simulateAssetAnalysisJson(), providerRef: `mock-llm-${Date.now()}` };
      }
      const script = extractScript(req.prompt);
      if (script) {
        return { text: simulateSceneSplitJson(script), providerRef: `mock-llm-${Date.now()}` };
      }
      const idea = extractIdea(req.prompt) ?? "a professional creative image";
      const kind = extractCreativeKind(req.prompt);
      return { text: simulateUniversalPromptJson(idea, kind), providerRef: `mock-llm-${Date.now()}` };
    }

    // Milestone 8 (Script Studio) — Rewrite/Expand/Shorten/Translate/Hook/CTA
    // all route through this same generate() call with a different prompt;
    // Mock needs to actually look at that prompt to behave distinguishably
    // (a real LLM adapter naturally follows the instruction text already).
    const variantsResponse = simulateVariants(req.prompt, req.contentLanguage);
    if (variantsResponse) {
      return { text: variantsResponse, providerRef: `mock-llm-${Date.now()}` };
    }
    const original = extractOriginal(req.prompt);
    if (original) {
      return { text: simulateTransform(req.prompt, original), providerRef: `mock-llm-${Date.now()}` };
    }

    const productOrService = extractField(req.prompt, "Product/Service") ?? "your offering";
    const keyMessage = extractField(req.prompt, "Key message") ?? "what makes you special";
    const offer = extractField(req.prompt, "Offer details");
    const cta = extractField(req.prompt, "Call to action");

    const hook = HOOK_BY_LANGUAGE[req.contentLanguage] ?? HOOK_BY_LANGUAGE.EN;
    const closingCta = cta || CTA_FALLBACK_BY_LANGUAGE[req.contentLanguage] || CTA_FALLBACK_BY_LANGUAGE.EN;

    const text = [
      `[HOOK]\n${hook}`,
      `[BODY]\nIntroducing ${productOrService}. ${keyMessage}.${offer ? ` ${offer}.` : ""}`,
      `[CTA]\n${closingCta}`,
    ].join("\n\n");

    return { text, providerRef: `mock-llm-${Date.now()}` };
  }
}
