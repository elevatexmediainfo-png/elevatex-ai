// Phase 12 Module 8 — curated style-preset picker, replacing the bare
// free-text input. Same DATA-not-branches shape as ANIMATION_PRESETS
// (lib/video-editor/transform.ts, Module 6) and EDITOR_TRANSITION_TYPES
// (Module 9) — a new preset is one more array entry, never a code change
// to the picker or the reasoning pipeline around it.
//
// `value` (not `label`) is what actually gets sent to the GPT-5 reasoning
// prompt as `stylePreset` — gpt5.provider.ts's buildPrompt() has NEVER
// needed a code change for this: it already interprets the field as free
// text and buckets it into "punchy/energetic/shorts-style" vs "calm/
// professional/documentary-style" reveal-mode behavior (live-proven in
// Module 4 with the exact strings "punchy energetic shorts" and "calm
// professional documentary" — kept verbatim as two of these `value`s so
// that already-proven behavior carries over unchanged). Every other
// preset's `value` is deliberately worded to land clearly in one of
// those same two buckets rather than inventing a third, unproven
// behavior the prompt was never designed to recognize.
export interface AIStylePreset {
  id: string;
  label: string;
  description: string;
  value: string;
}

export const AI_STYLE_PRESETS: AIStylePreset[] = [
  {
    id: "punchy-shorts",
    label: "Punchy Shorts",
    description: "Fast, word-by-word captions — short-form/social style.",
    value: "punchy energetic shorts",
  },
  {
    id: "calm-professional",
    label: "Calm Professional",
    description: "Static captions, no reveal animation — documentary/corporate style.",
    value: "calm professional documentary",
  },
  {
    id: "energetic-vlog",
    label: "Energetic Vlog",
    description: "Upbeat, fast-reveal captions — vlog/creator style.",
    value: "energetic upbeat vlog-style",
  },
  {
    id: "cinematic-documentary",
    label: "Cinematic Documentary",
    description: "Slow, static captions — cinematic/narrative style.",
    value: "calm cinematic documentary-style",
  },
  {
    id: "corporate-explainer",
    label: "Corporate Explainer",
    description: "Static captions, minimal motion — training/explainer style.",
    value: "calm professional corporate explainer",
  },
  // Founder request (2026-07-21) — bold, high-contrast captions phrased
  // in natural Hinglish (Hindi-English code-mixed, colloquial), matching
  // how real Indian creators actually caption their own content, rather
  // than formal English. A THIRD distinct bucket in gpt5.provider.ts's
  // buildPrompt() (see styleSection there) — not folded into the existing
  // punchy/calm buckets, since it carries its own caption-TEXT-language
  // instruction on top of the punchy/energetic reveal behavior it also
  // wants.
  {
    id: "bold-hinglish",
    label: "Bold Hinglish",
    description: "Bold, punchy captions in natural Hinglish — Indian creator/reels style.",
    value: "bold punchy hinglish energetic",
  },
];
