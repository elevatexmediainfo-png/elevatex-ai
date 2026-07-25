// Smart track creation on drop (2026-07-12) — pure resolution logic, kept
// separate from timeline-panel.tsx's DOM/drag-event handling so it's
// trivially unit-testable, matching this folder's existing split between
// pure math (timeline-engine.ts, track-stacking.ts) and DOM-bound UI code.
//
// The founder's own decision, not a heuristic guess: an IMAGE asset's
// target track kind is determined by its SOURCE — Stock search/Uploads
// (primary content) land on VIDEO, the curated Library's decorative
// categories (Shapes/Stickers/Logos/Icons — LibraryAssetCategory's
// SHAPE/STICKER/LOGO/STATIC_ICON/ANIMATED_ICON) land on OVERLAY. Every
// other asset kind maps one-to-one onto its matching track kind. Subtitle
// content is deliberately absent — it's created via Module 7's own
// dedicated flow, never a drag-drop case.
const OVERLAY_LIBRARY_CATEGORIES = new Set(["SHAPE", "STICKER", "LOGO", "STATIC_ICON", "ANIMATED_ICON"]);

export interface DropAssetInfo {
  assetKind: string | undefined;
  libraryCategory: string | undefined;
}

// String-literal union mirroring EditorTrackKind (app/editor/types.ts)
// rather than importing it — same reasoning as track-stacking.ts's own
// generic-parameter approach, keeping this lib layer's own type surface
// independent of the client layer's.
export type DropTrackKind = "VIDEO" | "AUDIO" | "SUBTITLE" | "TEXT" | "OVERLAY" | "EFFECTS";

// Returns null for any asset kind with no defined rule (e.g. FONT,
// ANIMATION not sourced from an overlay-decorative library category) —
// callers treat null as "don't guess, no-op the drop," the same
// conservative default a drop outside any valid track already has today.
export function resolveDropTrackKind({ assetKind, libraryCategory }: DropAssetInfo): DropTrackKind | null {
  switch (assetKind) {
    case "TEXT":
      return "TEXT";
    case "VIDEO":
      return "VIDEO";
    case "AUDIO":
      return "AUDIO";
    case "IMAGE":
      return libraryCategory && OVERLAY_LIBRARY_CATEGORIES.has(libraryCategory) ? "OVERLAY" : "VIDEO";
    default:
      return null;
  }
}

// Cross-track clip MOVE compatibility (2026-07-15) — deliberately a
// broader SET of valid destinations, not a reuse of resolveDropTrackKind's
// single-kind return above. A brand-new drop needs to pick exactly ONE
// default target for an asset it's seeing for the first time (hence
// `libraryCategory` to disambiguate IMAGE); an EXISTING clip being
// manually repositioned by dragging isn't ambiguous in the same way — the
// user is explicitly choosing the destination, so this only needs to gate
// "is this a sane place for this content type," not guess a single best
// default. VIDEO/IMAGE-backed clips are treated as compatible with BOTH
// VIDEO and OVERLAY tracks (matching the common "move a clip onto an
// overlay/PIP track" gesture) since the clip itself doesn't remember
// whether its source image came from a decorative library category —
// there's no way to narrow it further, and both are legitimate homes for
// visual content either way. `assetKind` is `EditorAssetKind | null` —
// `null` covers every content-only clip (TEXT/SUBTITLE never have a
// backing asset; there is no "TEXT" EditorAssetKind at all, unlike the
// drag-payload's own synthetic `kind` marker resolveDropTrackKind reads
// above), so those simply stay compatible with their own current track
// kind only, matching resolveDropTrackKind's "subtitle is never drag-drop"
// precedent — callers pass the clip's CURRENT track kind as
// `currentTrackKind` for this case.
export function getClipMoveCompatibleTrackKinds(assetKind: string | null, currentTrackKind: DropTrackKind): DropTrackKind[] {
  switch (assetKind) {
    case "VIDEO":
    case "IMAGE":
      return ["VIDEO", "OVERLAY"];
    case "AUDIO":
      return ["AUDIO"];
    default:
      // No backing asset (TEXT/SUBTITLE content clips) or an asset kind
      // with no defined cross-track rule (FONT/ANIMATION never back a
      // Timeline clip directly) — stay put, the same conservative
      // "don't guess" default resolveDropTrackKind uses for those kinds.
      return [currentTrackKind];
  }
}
