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

  // Prompt-tuning (2026-07-24) — "every second must earn its place." With
  // only 8 seconds available, this pushes away from generic ambient footage
  // toward one high-impact ad moment.
  sentences.push(
    "Every second must earn its place — no filler, no idle moments with nothing happening. This should feel like a single high-impact beat from a real, punchy advertisement, not generic stock footage."
  );

  // Meta-ad / performance-marketing rewrite (2026-07-25) — founder feedback
  // on the previous "premium brand commercial" sentence (2026-07-24, see
  // git history): too slow/polished for a real Meta ad. Matches the same
  // rewrite applied to FILM's and GENERATED's scene prompts (see their own
  // comments for the real live before/after this was validated against).
  // Quick Video's prompt is a deterministic template sent straight to the
  // video provider (no LLM step in between), so this sentence is always
  // included verbatim rather than tested for LLM-compliance.
  sentences.push(
    "This is a Meta (Instagram/Facebook Reels) ad, not a brand commercial — it needs to stop a thumb mid-scroll in its first 1-2 seconds with a bold visual or unexpected moment, never a slow warm-up. Favor an authentic, slightly raw, creator/UGC-adjacent energy over a slow, over-polished commercial look — a quick, purposeful camera move or handheld feel rather than a slow push-in — while the shot still stays clean enough to read as real production. The main subject is always the clear visual focus, vertical framing throughout."
  );

  if (answers.see?.trim()) {
    sentences.push(`The video shows: ${answers.see.trim()}.`);
  }

  // Real bug fix (2026-07-25) — this used to ask the video model to render
  // its OWN native lip-synced speech via "...saying: '...'". Now that Quick
  // Video also generates a real, separate ElevenLabs voiceover for this
  // exact line (see generateVeoLiteVideo()'s own comment) and dubs it over
  // the clip, asking the video model to ALSO voice the same words would
  // risk two competing voices in the final output. Keeps the person
  // visually present and engaged — matches GENERATED's own established
  // convention (scene-split.ts explicitly treats spoken dialogue as
  // "context for mood/setting, not words to render") rather than a new,
  // untested trade-off.
  if (answers.speechEnabled && answers.spokenLine?.trim()) {
    sentences.push(
      "A person on screen looks directly at the camera with warm, engaged energy, as if mid-conversation with the viewer — real narration is dubbed in separately, so the video itself should not attempt to render spoken audio."
    );
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
