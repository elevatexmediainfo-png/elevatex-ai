// Phase 6 — Prompt Variant types.
// All 4 variants are derived from the same GPTCampaignDirection object.
// Only the field ordering changes — the creative intelligence is identical.

export type VariantType =
  | "balanced"          // A — current production order (buildNarrativePrompt)
  | "story_first"       // B — emotion and narrative lead
  | "composition_first" // C — visual arrangement leads
  | "marketing_first";  // D — commercial mandate leads

export const VARIANT_LABELS: Record<VariantType, string> = {
  balanced:          "A — Balanced",
  story_first:       "B — Story-first",
  composition_first: "C — Composition-first",
  marketing_first:   "D — Marketing-first",
};

export const VARIANT_FOCUS: Record<VariantType, string> = {
  balanced:
    "All 23 fields in narrative order: concept → emotion → scene → hero → story → composition → trust → closing mandate.",
  story_first:
    "Emotion and narrative first: viewer feeling → story arc → psychological shift → then scene, composition, commercial.",
  composition_first:
    "Visual arrangement first: scene → eye flow → hierarchy → breathing room → then narrative, emotion, commercial.",
  marketing_first:
    "Commercial purpose first: concept → objective → core message → triggers → then scene, story, visual.",
};

export interface BuiltVariant {
  type:         VariantType;
  label:        string;
  focus:        string;
  narrative:    string; // raw narrative string (quality boosters NOT yet appended)
}
