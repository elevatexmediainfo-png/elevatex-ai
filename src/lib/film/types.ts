import type { FILM_STYLES } from "@/lib/validations/video";

// The shape POST /api/videos/film writes into VideoProject.brief (Json) for
// sourceType FILM projects — kept as Json rather than dedicated columns for
// the same reason videoBriefSchema's brief already is (lib/validations/video.ts),
// but typed here since every later Film route needs to read it back.
export interface FilmBrief {
  idea: string;
  style: (typeof FILM_STYLES)[number];
  totalDurationSeconds: number;
  characterCount: number;
}

export function parseFilmBrief(brief: unknown): FilmBrief {
  return brief as FilmBrief;
}

// The single place that decides "which stored photo IS this character" —
// used by the character sheet route (what gets sent to the vision LLM),
// per-scene generation (what image to condition on as startImage), and the
// Character Sheet screen (what photo to display, hence this being a
// dependency-free file safe to import from a Client Component — no prisma,
// no server-only imports). A face upload wins over an AI variation when a
// user has both, since it's their own real photo, not a generated
// stand-in. One function so these call sites can never quietly drift onto
// different priorities.
export function resolveFilmCharacterReferenceAssetId(character: {
  faceUploadFrontAssetId: string | null;
  selectedVariationAssetId: string | null;
}): string | null {
  return character.faceUploadFrontAssetId ?? character.selectedVariationAssetId;
}
