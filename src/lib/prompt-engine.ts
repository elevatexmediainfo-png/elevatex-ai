import type { VideoBriefInput } from "@/lib/validations/video";

interface BuildPromptInput {
  promptTemplate: string;
  vertical: string;
  objective: string;
  brief: VideoBriefInput;
  businessName?: string | null;
  city?: string | null;
}

const LANGUAGE_INSTRUCTION: Record<string, string> = {
  EN: "Write entirely in English.",
  HI: "Write entirely in Hindi (Devanagari script).",
  HINGLISH: "Write in conversational Hinglish (Hindi-English code-mixed, Latin script).",
};

// Vendor-agnostic by design — this fills a per-template prompt
// (Template.promptTemplate, authored by the content team per vertical) with
// the structured brief the user supplied in the wizard, and hands a plain
// string to whichever LLMProvider is configured (lib/providers/llm). No
// provider-specific formatting (message roles, function-calling schemas,
// etc.) belongs here — that's the adapter's job.
export function buildScriptPrompt(input: BuildPromptInput): string {
  const { promptTemplate, vertical, objective, brief, businessName, city } = input;

  const context = [
    `Business: ${businessName || "the business"}${city ? `, ${city}` : ""}`,
    `Vertical: ${vertical}`,
    `Objective: ${objective}`,
    `Product/Service: ${brief.productOrService}`,
    `Key message: ${brief.keyMessage}`,
    brief.offerDetails ? `Offer details: ${brief.offerDetails}` : null,
    brief.callToAction ? `Call to action: ${brief.callToAction}` : null,
    // Milestone 8 (Script Studio tone selection) — optional, falls back to
    // whatever tone the base promptTemplate already implies.
    brief.tone ? `Tone: ${brief.tone}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `${promptTemplate.trim()}\n\n${context}`;
}

export function languageInstruction(contentLanguage: string): string {
  return LANGUAGE_INSTRUCTION[contentLanguage] ?? LANGUAGE_INSTRUCTION.EN;
}
