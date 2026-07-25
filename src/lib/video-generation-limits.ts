// Real, non-admin-configurable hard cap (2026-07-24) — "hard cap" per the
// founder's own instruction, deliberately NOT wired into CONFIG_REGISTRY
// like almost everything else admin-editable in this codebase: this one is
// a real technical/cost ceiling, not a pricing/business knob an admin
// should be able to quietly raise. Applies to a video generation's TOTAL
// output duration — a single Quick Video/FILM-scene clip AND a GENERATED
// project's/FILM's full stitched multi-scene runtime, confirmed with the
// founder to mean the aggregate, not just one vendor call (a Veo/Seedance
// single call is already well under this per lib/providers/video/*'s own
// real vendor caps — 8s/15s respectively — so this mostly guards the
// multi-scene aggregate case, e.g. GENERATED's useSceneSplit path, which
// could previously reach 24-40s uncapped).
export const MAX_VIDEO_GENERATION_TOTAL_SECONDS = 20;

export class VideoDurationCapExceededError extends Error {
  constructor(requestedSeconds: number) {
    super(
      `Video generation requests are capped at ${MAX_VIDEO_GENERATION_TOTAL_SECONDS} seconds total (requested ${requestedSeconds}s).`
    );
    this.name = "VideoDurationCapExceededError";
  }
}

export function assertWithinVideoDurationCap(totalSeconds: number): void {
  if (totalSeconds > MAX_VIDEO_GENERATION_TOTAL_SECONDS) {
    throw new VideoDurationCapExceededError(totalSeconds);
  }
}
