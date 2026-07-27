// AI Director System — real, confirmed-not-guessed per-vendor duration
// constraints for VIDEO generation providers, declared exactly once here.
// Before this file existed, this same knowledge lived scattered as
// hardcoded magic numbers with an explanatory comment inside whichever
// feature happened to need it (film-storyboard.ts's
// `FILM_SCENE_GENERATION_FLOOR_SECONDS = 4`, scene-split.ts's fixed 8s
// scene length) — correct today, but silently wrong the moment a different
// vendor becomes the active one, since neither number was ever traceable
// to *which* vendor it actually described. Extend this table (never a
// prompt-building file) the next time a new vendor constraint is confirmed
// against real docs/behavior.
//
// Distinct from `VideoProvider.supportedDurationsSeconds`
// (lib/providers/video/types.ts) — that field already exists for an EXACT
// discrete list a vendor accepts (Sora: only 4, 8, or 12) and is read
// directly off the live provider instance by filterByDurationSupport()
// (lib/generation/video.ts). This table covers the different shape some
// vendors have instead: a continuous MIN/MAX range, or a single fixed
// value (expressed as min === max) — used by Directors deciding what
// duration to actually request, before a specific provider instance has
// even been selected by the render engine's own failover chain.
export interface VideoDurationCapability {
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
}

export const VIDEO_PROVIDER_DURATION_CAPABILITY: Record<string, VideoDurationCapability> = {
  // Confirmed against Seedance2.ai's real published docs
  // (seedance2.ai/api-docs) — a genuine 4-15s range, the source for AI
  // Film's "generate at the real floor, trim to the intended short
  // duration afterward" mechanism (film-director.ts).
  seedance2: { minDurationSeconds: 4, maxDurationSeconds: 15 },
  // Veo 3.1 Lite (the model veo.provider.ts's DEFAULT_MODEL actually uses
  // today) always returns exactly 8s regardless of what's requested —
  // confirmed live, not a real configurable range, hence min === max.
  // Standard (non-Lite) Veo's real 5-8s knob isn't declared here since no
  // caller requests that model today (see veo.provider.ts's own comment).
  veo: { minDurationSeconds: 8, maxDurationSeconds: 8 },
  // Sora's exact-list constraint already lives on the adapter itself
  // (VideoProvider.supportedDurationsSeconds = [4, 8, 12]) and is read
  // directly from there by filterByDurationSupport() — not duplicated
  // here to avoid two sources of truth for the same fact.
};

// Computes the duration a Director should actually REQUEST from a named
// video provider for a scene it intends to display on screen for
// `intendedSeconds` — the caller (the Director or its render step) is
// responsible for trimming the real generated clip back down to
// `intendedSeconds` afterward if the vendor's real floor forced a longer
// request (film-director.ts does this via the Editor's own trimStartMs
// mechanism, never a new primitive). Deliberately requires a specific
// `vendorId` rather than guessing across every vendor this table knows
// about — a "highest floor across every vendor regardless of which one is
// actually in use" default would silently inflate FILM's real 4s Seedance
// floor to 8s the moment Veo's entry was added here too, a real behavior
// change nothing asked for. Trusts the caller's own `intendedSeconds` as-is
// when the named vendor has no declared floor.
export function resolveSafeGenerationDuration(intendedSeconds: number, vendorId: string): number {
  const capability = VIDEO_PROVIDER_DURATION_CAPABILITY[vendorId];
  if (capability?.minDurationSeconds === undefined) return intendedSeconds;
  return Math.max(intendedSeconds, capability.minDurationSeconds);
}
