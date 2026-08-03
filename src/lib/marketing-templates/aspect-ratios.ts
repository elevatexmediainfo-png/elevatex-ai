// Real, live-confirmed Veo constraint (2026-07-24, first real E2E test of
// this feature's VIDEO path) — 1:1 genuinely 400s against the real Veo API
// ("`aspectRatio` does not support `1:1` as a valid value"), even though
// VideoRenderRequest's own type has always accepted RATIO_1_1 (never
// actually exercised for video by FILM/GENERATED, which don't offer a
// square option). Shared by the admin manager's client-side Select
// filtering AND the admin API routes' own server-side validation — never
// trust the client-side restriction alone, same discipline this session's
// PAYMENT fix already established.
//
// Expanded layout set (2026-08-03) — IMAGE only. VIDEO output stays
// restricted to the original 2 (RATIO_9_16/RATIO_16_9): Veo has no known
// support for the 5 new ratios either, and nothing asked for a wider VIDEO
// set, so widening it here would just be an unverified, unrequested risk.
type AspectRatio =
  | "RATIO_1_1"
  | "RATIO_4_5"
  | "RATIO_3_4"
  | "RATIO_2_3"
  | "RATIO_9_16"
  | "RATIO_16_9"
  | "RATIO_3_2"
  | "RATIO_4_3";

export const ASPECT_RATIOS_BY_OUTPUT_TYPE: Record<"IMAGE" | "VIDEO", readonly AspectRatio[]> = {
  IMAGE: ["RATIO_1_1", "RATIO_4_5", "RATIO_3_4", "RATIO_2_3", "RATIO_9_16", "RATIO_16_9", "RATIO_3_2", "RATIO_4_3"],
  VIDEO: ["RATIO_9_16", "RATIO_16_9"],
};

export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  RATIO_1_1: "1:1 (Square)",
  RATIO_4_5: "4:5 (Instagram Portrait)",
  RATIO_3_4: "3:4 (Portrait)",
  RATIO_2_3: "2:3 (Portrait)",
  RATIO_9_16: "9:16 (Story / Reel)",
  RATIO_16_9: "16:9 (Landscape)",
  RATIO_3_2: "3:2 (Landscape)",
  RATIO_4_3: "4:3 (Landscape)",
};
