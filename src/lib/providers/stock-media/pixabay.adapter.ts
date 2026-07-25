import type { ProviderRuntimeConfig } from "../credentials";
import type { StockProviderAdapter, StockSearchOptions, StockSearchResult } from "./types";

const IMAGE_SEARCH_URL = "https://pixabay.com/api/";
const VIDEO_SEARCH_URL = "https://pixabay.com/api/videos/";

interface PixabayImageHit {
  id: number;
  tags: string;
  user: string;
  previewURL: string;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
}

interface PixabayVideoHit {
  id: number;
  tags: string;
  user: string;
  duration: number;
  videos: {
    large: { url: string; width: number; height: number };
    medium: { url: string; width: number; height: number };
  };
}

function imageToResult(hit: PixabayImageHit): StockSearchResult {
  return {
    externalId: String(hit.id),
    title: hit.tags,
    previewUrl: hit.previewURL,
    downloadUrl: hit.largeImageURL,
    kind: "IMAGE",
    attribution: hit.user,
    widthPx: hit.imageWidth,
    heightPx: hit.imageHeight,
  };
}

function videoToResult(hit: PixabayVideoHit): StockSearchResult {
  const file = hit.videos.large ?? hit.videos.medium;
  return {
    externalId: String(hit.id),
    title: hit.tags,
    previewUrl: hit.videos.medium?.url ?? file.url,
    downloadUrl: file.url,
    kind: "VIDEO",
    attribution: hit.user,
    widthPx: file.width,
    heightPx: file.height,
    durationSeconds: hit.duration,
  };
}

// Real adapter — Pixabay's REST API. Image and video are two separate
// endpoints under one API key, same "type param picks the endpoint" shape
// as the Pexels adapter. Pixabay's public API does not document an audio/
// music search endpoint, so `type: "audio"` returns no results here rather
// than guessing at an undocumented one — matches Pexels' honest handling of
// its own missing content kind.
export class PixabayAdapter implements StockProviderAdapter {
  readonly id = "pixabay";

  constructor(private readonly config: ProviderRuntimeConfig = {}) {}

  private requireApiKey(): string {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error("pixabay is enabled but no API key is configured (Admin → AI Providers).");
    return apiKey;
  }

  async search(query: string, opts: StockSearchOptions = {}): Promise<StockSearchResult[]> {
    const apiKey = this.requireApiKey();
    // Pixabay requires per_page in [3, 200].
    const perPage = Math.min(200, Math.max(3, opts.perPage ?? 20));
    const page = Math.max(1, opts.page ?? 1);
    const type = opts.type ?? "image";

    if (type === "audio") return [];

    const url = type === "video" ? VIDEO_SEARCH_URL : IMAGE_SEARCH_URL;
    const res = await fetch(
      `${url}?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Pixabay search failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = await res.json();
    if (type === "video") {
      const hits = (json.hits as PixabayVideoHit[] | undefined) ?? [];
      return hits.map(videoToResult);
    }
    const hits = (json.hits as PixabayImageHit[] | undefined) ?? [];
    return hits.map(imageToResult);
  }

  async fetch(externalId: string): Promise<StockSearchResult | null> {
    const apiKey = this.requireApiKey();
    // Pixabay's "get by id" is the same search endpoint filtered by `id` —
    // try image first, then video, same reasoning as the Pexels adapter.
    const imageRes = await fetch(`${IMAGE_SEARCH_URL}?key=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(externalId)}`);
    if (imageRes.ok) {
      const json = await imageRes.json();
      const hit = (json.hits as PixabayImageHit[] | undefined)?.[0];
      if (hit) return imageToResult(hit);
    }

    const videoRes = await fetch(`${VIDEO_SEARCH_URL}?key=${encodeURIComponent(apiKey)}&id=${encodeURIComponent(externalId)}`);
    if (videoRes.ok) {
      const json = await videoRes.json();
      const hit = (json.hits as PixabayVideoHit[] | undefined)?.[0];
      if (hit) return videoToResult(hit);
    }

    return null;
  }
}
