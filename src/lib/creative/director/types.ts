// AI Director System (2026-07-27) — the shared, model-agnostic cinematic
// plan every video-generation feature is meant to route through, per the
// founder's explicit architecture decision: "The AI Director creates the
// cinematic plan. The model only renders it." A `DirectorPlan` never names
// a vendor, a duration constraint, or a request-shape detail — those live
// in `video-provider-capabilities.ts` and in each `lib/providers/video/*`
// adapter, entirely separate layers. Two concrete Directors exist today,
// one per real product surface with a genuinely different directing style:
// `commercial-director.ts` (fast cuts, hook-first, CTA — AI Video/
// GENERATED) and `film-director.ts` (longer shots, character arcs,
// emotion-first — AI Film). Both produce this same shape so any future
// caller (or a future third Director style) can consume a plan uniformly
// without knowing which one produced it.

export type DirectorStyle = "commercial" | "film";

export interface DirectorScene {
  sceneNumber: number;
  /** The entire creative brief for the video model — camera, lighting, subject, motion, negative exclusions, all folded into one flowing prose paragraph (no vendor understands a labeled/structured shot list, only natural prompt text). */
  visualPrompt: string;
  /** The Director's INTENDED on-screen duration — not necessarily what gets requested from a vendor (see resolveSafeGenerationDuration in video-provider-capabilities.ts for why those can differ). */
  durationSeconds: number;
  /** Dialogue for this scene, dubbed in separately (real ElevenLabs voiceover) — never rendered as on-screen speech by the video model itself. Commercial-style plans currently leave this unset (GENERATED's scenes are visual-only); Film-style plans set it per character scene. */
  spokenLine?: string | null;
  /** Which of the input's characters (by slot index) this scene features, for Scene.filmCharacterId. Commercial-style plans have no characters and leave this unset. */
  characterSlotIndex?: number | null;
}

export interface DirectorTextOverlay {
  afterSceneNumber: number;
  text: string;
}

export interface DirectorPlan {
  style: DirectorStyle;
  scenes: DirectorScene[];
  /** On-screen text/graphic cues the video model never renders itself — an Editor overlay track instead. Only the commercial style currently produces these (GENERATED's bracketed "[Text on screen: ...]" cues); film-style plans leave this empty. */
  textOverlays: DirectorTextOverlay[];
}
