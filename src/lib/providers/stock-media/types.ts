// Milestone 26 — Admin Settings: the search/fetch contract every stock
// media/icon provider adapter implements. Deliberately narrow (two methods)
// since this only needs to support "search by text" and "resolve one result
// by id" — the two operations the Creative Studio Sidebar (Module 11, not
// wired yet) and a future reference-search flow both need. Server-only:
// nothing under lib/providers/stock-media/ is ever imported by client code,
// which is what actually keeps provider credentials off the client, not a
// route boundary that doesn't exist yet.

export interface StockSearchResult {
  externalId: string;
  title: string;
  previewUrl: string;
  downloadUrl: string;
  // Milestone 27 — ICON/ANIMATION added for IconScout (icons + Lottie
  // animations), joining the original STOCK_MEDIA-only VIDEO/IMAGE/AUDIO.
  kind: "VIDEO" | "IMAGE" | "AUDIO" | "ICON" | "ANIMATION";
  attribution?: string;
  // Phase 12 (stock providers expansion) — Pexels/Pixabay's `attribution`
  // is optional/appreciated (their own ToS), so it was never surfaced
  // anywhere downstream. Coverr requires it unconditionally ("show your
  // users where the videos are pulled from" — their own API docs) and
  // Openverse's requirement varies PER ITEM by license (cc0/pdm: no:
  // everything else, e.g. by/by-sa: yes) — this distinguishes "here's a
  // courtesy credit" from "you must display this or you're violating the
  // license," so a caller can't silently drop a real requirement by
  // treating every `attribution` string the same way.
  attributionRequired?: boolean;
  widthPx?: number;
  heightPx?: number;
  durationSeconds?: number;
}

export interface StockSearchOptions {
  page?: number;
  perPage?: number;
  // Some providers (Pexels, Pixabay, IconScout) serve multiple content
  // kinds through one API key/search call shape — this picks which one a
  // given search targets. Omitted defaults to the provider's primary kind.
  type?: "video" | "image" | "audio" | "icon" | "animation";
}

export interface StockProviderAdapter {
  search(query: string, opts?: StockSearchOptions): Promise<StockSearchResult[]>;
  fetch(externalId: string): Promise<StockSearchResult | null>;
}
