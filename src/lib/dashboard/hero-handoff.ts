// Same-tab sessionStorage handoff from the Dashboard hero's prompt box to
// CreativeStudio (AI Image / Marketing Creative) — avoids stuffing asset
// preview URLs into a query string. One-shot: CreativeStudio reads and
// clears it on mount.
export const HERO_HANDOFF_KEY = "elevatex:hero-handoff";

export interface HeroHandoff {
  idea: string;
  reference: { assetId: string; previewUrl: string } | null;
  logo: { assetId: string; previewUrl: string } | null;
  // Phase 2 — present only when the hero already ran the idea through the
  // Universal Creative Engine's auto mode (enhance-prompt with no
  // kind/presetKey, letting the Creative Brain decide both). When set,
  // CreativeStudio skips straight to generating instead of starting at the
  // empty "input" step — the true "type a sentence, get a result" flow.
  enhancedPrompt?: string;
  universalPrompt?: unknown;
  presetKey?: string;
}
