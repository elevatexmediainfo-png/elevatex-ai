// Real, live-confirmed Veo constraint (2026-07-24, first real E2E test of
// this feature's VIDEO path) — 1:1 genuinely 400s against the real Veo API
// ("`aspectRatio` does not support `1:1` as a valid value"), even though
// VideoRenderRequest's own type has always accepted RATIO_1_1 (never
// actually exercised for video by FILM/GENERATED, which don't offer a
// square option). Shared by the admin manager's client-side Select
// filtering AND the admin API routes' own server-side validation — never
// trust the client-side restriction alone, same discipline this session's
// PAYMENT fix already established.
type AspectRatio = "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";

export const ASPECT_RATIOS_BY_OUTPUT_TYPE: Record<"IMAGE" | "VIDEO", readonly AspectRatio[]> = {
  IMAGE: ["RATIO_9_16", "RATIO_1_1", "RATIO_16_9"],
  VIDEO: ["RATIO_9_16", "RATIO_16_9"],
};
