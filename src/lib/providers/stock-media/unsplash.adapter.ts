import type { ProviderRuntimeConfig } from "../credentials";
import type { StockProviderAdapter, StockSearchOptions, StockSearchResult } from "./types";

const SEARCH_URL = "https://api.unsplash.com/search/photos";
const PHOTO_URL = "https://api.unsplash.com/photos";

interface UnsplashPhoto {
  id: string;
  description: string | null;
  alt_description: string | null;
  width: number;
  height: number;
  urls: { regular: string; small: string };
  user: { name: string };
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
}

function photoToResult(photo: UnsplashPhoto): StockSearchResult {
  return {
    externalId: photo.id,
    title: photo.description?.trim() || photo.alt_description?.trim() || `Photo by ${photo.user.name}`,
    previewUrl: photo.urls.small,
    downloadUrl: photo.urls.regular,
    kind: "IMAGE",
    attribution: photo.user.name,
    // Real, confirmed finding (2026-07-18) — the founder's own brief for
    // this module said "no attribution required, same as Pexels/Pixabay,"
    // but that describes Unsplash's general/website LICENSE, not its API
    // TERMS. Fetched Unsplash's own API Guidelines + API Terms live: "All
    // applications must follow the API Guidelines, including properly
    // providing attribution for the photographer and Unsplash" — required,
    // not optional, for any app built on the API (unlike Pexels/Pixabay,
    // whose own terms genuinely say attribution is appreciated but not
    // required). Built as attributionRequired: true — the factually
    // correct default — flagged to the founder rather than silently
    // building the version their brief described.
    attributionRequired: true,
    widthPx: photo.width,
    heightPx: photo.height,
  };
}

// Real adapter — Unsplash's REST API (api.unsplash.com/search/photos,
// confirmed live). Images only — Unsplash has no video/audio catalog, so
// every other `type` returns [] here, same honest-empty convention every
// sibling adapter in this file uses for a content kind it doesn't serve.
export class UnsplashAdapter implements StockProviderAdapter {
  readonly id = "unsplash";

  constructor(private readonly config: ProviderRuntimeConfig = {}) {}

  private requireApiKey(): string {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error("unsplash is enabled but no API key is configured (Admin → AI Providers).");
    return apiKey;
  }

  async search(query: string, opts: StockSearchOptions = {}): Promise<StockSearchResult[]> {
    const apiKey = this.requireApiKey();
    const type = opts.type ?? "image";
    if (type !== "image") return [];

    // Unsplash's own documented cap is 30 per page.
    const perPage = Math.min(30, Math.max(1, opts.perPage ?? 20));
    const page = Math.max(1, opts.page ?? 1);

    const res = await fetch(`${SEARCH_URL}?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`, {
      headers: { Authorization: `Client-ID ${apiKey}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Unsplash search failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as UnsplashSearchResponse;
    return (json.results ?? []).map(photoToResult);
  }

  async fetch(externalId: string): Promise<StockSearchResult | null> {
    const apiKey = this.requireApiKey();
    const res = await fetch(`${PHOTO_URL}/${encodeURIComponent(externalId)}`, {
      headers: { Authorization: `Client-ID ${apiKey}` },
    });
    if (!res.ok) return null;
    return photoToResult((await res.json()) as UnsplashPhoto);
  }
}
