import type { BusinessVertical } from "@/generated/prisma/enums";
import { OPENAI_QUALITY_SENTENCE } from "@/lib/ai-os/provider-translator/providers/openai/quality";
import { languageInstruction } from "@/lib/prompt-engine";

// Advertisement Poster mode (Step 2) — a direct, ChatGPT-style instruction
// that asks the model to render a complete, text-bearing advertisement in
// one image. This is deliberately the OPPOSITE of the AI-OS enhance
// pipeline's "clean photo, NO TEXT" prompts (provider-translator/providers/
// openai/translator.ts) — poster mode bypasses that pipeline entirely.
// generateCreativeImage() calls generateImage() directly, which never routes
// through translateForProvider, so nothing fights this prompt's "render
// text" instructions.

export const INDUSTRY_POSTER_META: Record<BusinessVertical, { label: string; cta: string }> = {
  // Labels mirror onboarding/page.tsx's VERTICAL_META (kept in sync by eye —
  // that file is "use client" with Lucide icon imports bundled in, so it
  // isn't imported directly into this server-only module).
  RESTAURANT: { label: "Restaurant / Cloud Kitchen", cta: "Reserve Your Table" },
  CAFE_BAKERY: { label: "Cafe / Bakery", cta: "Visit Us Today" },
  SALON_SPA: { label: "Salon / Spa", cta: "Book Your Appointment" },
  DENTAL_DIAGNOSTIC: { label: "Dental / Diagnostic", cta: "Book a Free Consultation" },
  REAL_ESTATE: { label: "Real Estate", cta: "Schedule a Site Visit" },
  RETAIL: { label: "Retail Store", cta: "Shop Now" },
  GYM_FITNESS: { label: "Gym / Fitness", cta: "Join Today" },
  HOSPITAL: { label: "Hospital / Clinic", cta: "Book an Appointment" },
  COACHING_EDTECH: { label: "Coaching / EdTech", cta: "Enroll Now" },
  HOTEL: { label: "Hotel / Guest House", cta: "Book Your Stay" },
  FINANCE: { label: "Finance", cta: "Talk to an Advisor" },
  OTHER: { label: "Business", cta: "Contact Us Today" },
};

export interface PosterPromptInput {
  userPrompt: string;
  presetLabel: string;
  businessName: string | null;
  industryLabel: string | null;
  cta: string;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  addressLine: string | null;
  websiteOrSocial: string | null;
  // Part B — from lib/admin/reference-library.ts's getIndustryStyleGuidance().
  // Pre-formatted and already compact; this module stays pure/Prisma-free,
  // so it just drops the string in rather than fetching it itself.
  styleGuidance: string | null;
  // Fixed 2026-07-19 — captured on the CreativeProject (contentLanguage)
  // but never threaded into this prompt, so a user requesting Hindi/
  // Hinglish copy got no model instruction telling it to render that —
  // every poster silently came back in English regardless. "EN" | "HI" |
  // "HINGLISH" (lib/validations/onboarding.ts's CONTENT_LANGUAGES).
  contentLanguage: string;
}

// Builds the poster-mode prompt as plain natural-language instructions, not
// a comma-separated keyword list. Every optional field is dropped cleanly
// when absent (never rendered as the literal string "null") so an
// incomplete BrandKit still produces a coherent prompt.
export function buildPosterPrompt(input: PosterPromptInput): string {
  const businessLine = input.businessName
    ? `Business: ${input.businessName}${input.industryLabel ? ` (${input.industryLabel})` : ""}`
    : null;

  const contactLines = [
    input.contactPhone ? `Phone: ${input.contactPhone}` : null,
    input.contactWhatsapp ? `WhatsApp: ${input.contactWhatsapp}` : null,
    input.addressLine ? `Address: ${input.addressLine}` : null,
    input.websiteOrSocial ? `Website / Social: ${input.websiteOrSocial}` : null,
  ].filter((line): line is string => Boolean(line));

  const contactBlock = contactLines.length
    ? `- The business's real contact details, rendered exactly as given below — do not invent, alter, guess, or omit any of these:\n  ${contactLines.join("\n  ")}`
    : null;

  const bullets = [
    `- A short, attention-grabbing headline about the above`,
    `- Two to three concise benefit points that would matter to a${input.industryLabel ? ` ${input.industryLabel}` : ""} customer`,
    `- A clear call-to-action reading exactly: "${input.cta}"`,
    contactBlock,
  ].filter((line): line is string => Boolean(line));

  // Reuses the same EN/HI/HINGLISH map every LLM text-generation path in
  // this codebase already shares (lib/prompt-engine.ts's languageInstruction,
  // also used by the OpenAI/Gemini LLM adapters) rather than a fourth
  // hand-copied version — just reframed for "text rendered in an image"
  // instead of "text you write." Omitted entirely for EN: every other
  // sentence in this prompt is already English, so stating the default
  // explicitly would only add noise.
  const languageLine =
    input.contentLanguage === "EN"
      ? null
      : `All text rendered in the image — the headline, benefit points, and call-to-action — must be in the same language as this instruction: ${languageInstruction(input.contentLanguage)}`;

  return [
    `Create a complete, ready-to-publish advertisement poster as a single image — a real designed advertisement with text rendered directly in the image, not a plain photo.`,
    // Placed here (near the top, right after the opening instruction) rather
    // than at the end of the Style block below — buried at the end let it
    // get under-weighted against the headline/benefit/CTA/contact bullets,
    // which is how posters ended up with mixed Indian/Western subjects.
    OPENAI_QUALITY_SENTENCE,
    languageLine,
    [businessLine, `What this poster is for: ${input.userPrompt}`].filter(Boolean).join("\n"),
    `Design a polished, professional ${input.presetLabel}-format advertisement that visibly renders, as real legible text within the image itself:\n${bullets.join("\n")}`,
    // Part B — omitted entirely when null (no active analyzed samples and
    // no guidance note for this industry), so an uncurated industry falls
    // back to exactly today's output, not an empty/awkward paragraph.
    input.styleGuidance,
    `Style: professional advertising design with clean modern typography, a strong visual hierarchy, and on-brand color use — the standard of a premium design agency, not a stock photo and not an image with no text. Every headline, benefit, call-to-action, and contact detail listed above must be accurately and legibly rendered as part of the image.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
