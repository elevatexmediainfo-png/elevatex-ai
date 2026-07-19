import type { SCRIPT_TONES } from "@/lib/validations/video";

// 4-option restructure Step 3 — Quick Video's prompt builder. Full natural
// sentences, not a comma-separated keyword list (same house style as
// buildPosterPrompt() in poster-prompt.ts). The Indian-default sentence
// below mirrors GEMINI_QUALITY_SENTENCE (provider-translator/providers/
// gemini/quality.ts) word-for-word except "image" → "video" — that exact
// wording is the proven, already-shipped fix for Western-default output;
// reusing it here keeps every generation surface in the app speaking with
// the same voice instead of drifting into a second, untested phrasing.
const QUICK_VIDEO_INDIAN_DEFAULT_SENTENCE =
  "Unless stated otherwise, every human subject in this video is Indian — including any secondary or background people, not only the main subject — with Indian faces, Indian skin tones, and natural features and styling appropriate to the setting.";

const MOOD_PHRASES: Record<(typeof SCRIPT_TONES)[number], string> = {
  FRIENDLY: "warm and friendly",
  PROFESSIONAL: "polished and professional",
  PLAYFUL: "playful and upbeat",
  URGENT: "energetic and urgent",
  LUXURY: "elegant and premium",
  INSPIRATIONAL: "uplifting and inspirational",
  BOLD: "bold and confident",
};

export interface QuickVideoAnswers {
  about: string;
  see?: string;
  speechEnabled: boolean;
  spokenLine?: string;
  mood?: (typeof SCRIPT_TONES)[number];
  avoid?: string;
}

export interface QuickVideoPrompt {
  prompt: string;
  negativePrompt: string;
}

export function buildQuickVideoPrompt(answers: QuickVideoAnswers): QuickVideoPrompt {
  const sentences: string[] = [`An 8-second vertical marketing video: ${answers.about.trim()}.`];

  if (answers.see?.trim()) {
    sentences.push(`The video shows: ${answers.see.trim()}.`);
  }

  if (answers.speechEnabled && answers.spokenLine?.trim()) {
    sentences.push(`A person on screen speaks directly to camera, saying: "${answers.spokenLine.trim()}"`);
  }

  if (answers.mood) {
    sentences.push(`The tone throughout is ${MOOD_PHRASES[answers.mood]}.`);
  }

  sentences.push(QUICK_VIDEO_INDIAN_DEFAULT_SENTENCE);
  sentences.push(
    "No on-screen text, captions, subtitles, or graphic overlays should appear anywhere in the video itself — the footage only."
  );

  const negativeParts = [
    "on-screen text",
    "subtitles",
    "captions",
    "watermark",
    "logo",
    "western faces when Indian is intended",
  ];
  if (answers.avoid?.trim()) {
    negativeParts.push(answers.avoid.trim());
  }

  // Fixed 2026-07-19 — Veo 3.1 Lite (veo.provider.ts's confirmed, real
  // finding) rejects any request that includes `negativePrompt` at all with
  // a 400, and Lite is the only model this feature's caller
  // (generateVeoLiteVideo) ever uses — so `negativePrompt` below was, and
  // remains, a complete no-op for every real Quick Video generation today.
  // That silently defeated not just the user's own "Anything to avoid?"
  // field but also the built-in ethnicity/no-text-overlay safety net items
  // above. Folded as an explicit main-prompt instruction instead — the
  // channel Veo Lite actually reads — while still returning `negativePrompt`
  // unchanged for the (currently hypothetical) case of a future non-Lite
  // caller that does honor it, same "harmless where unsupported" contract
  // the rest of this codebase already uses for negative prompts.
  sentences.push(`Do not show any of the following anywhere in the video: ${negativeParts.join(", ")}.`);

  return {
    prompt: sentences.join(" "),
    negativePrompt: negativeParts.join(", "),
  };
}
