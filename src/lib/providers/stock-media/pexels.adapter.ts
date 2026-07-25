import type { ProviderRuntimeConfig } from "../credentials";
import type { StockProviderAdapter, StockSearchOptions, StockSearchResult } from "./types";

const PHOTO_SEARCH_URL = "https://api.pexels.com/v1/search";
const PHOTO_BY_ID_URL = "https://api.pexels.com/v1/photos";
const VIDEO_SEARCH_URL = "https://api.pexels.com/videos/search";
const VIDEO_BY_ID_URL = "https://api.pexels.com/videos/videos";

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  photographer: string;
  alt: string | null;
  src: { original: string; large: string; medium: string };
}

interface PexelsVideoFile {
  link: string;
  quality: string;
  width: number | null;
  height: number | null;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string;
  user: { name: string };
  video_files: PexelsVideoFile[];
}

function pickBestVideoFile(files: PexelsVideoFile[]): PexelsVideoFile | undefined {
  // "hd" quality is the best balance of usable-resolution vs. file size for
  // a stock-footage preview/download — falls back to whatever's first if
  // Pexels ever stops labeling one "hd" for a given clip.
  return files.find((f) => f.quality === "hd") ?? files[0];
}

function photoToResult(photo: PexelsPhoto): StockSearchResult {
  return {
    externalId: String(photo.id),
    title: photo.alt?.trim() || `Photo by ${photo.photographer}`,
    previewUrl: photo.src.medium,
    downloadUrl: photo.src.large,
    kind: "IMAGE",
    attribution: photo.photographer,
    widthPx: photo.width,
    heightPx: photo.height,
  };
}

function videoToResult(video: PexelsVideo): StockSearchResult | null {
  const file = pickBestVideoFile(video.video_files);
  if (!file) return null;
  return {
    externalId: String(video.id),
    title: `Video by ${video.user.name}`,
    previewUrl: video.image,
    downloadUrl: file.link,
    kind: "VIDEO",
    attribution: video.user.name,
    widthPx: file.width ?? video.width,
    heightPx: file.height ?? video.height,
    durationSeconds: video.duration,
  };
}

// Real adapter — Pexels' REST API. One API key searches both photos and
// videos (Pexels has no stock-audio catalog), so `opts.type` picks which of
// the two distinct search endpoints this call hits rather than needing a
// second ProviderConfig row for the same key (see the STOCK_MEDIA category
// comment in prisma/schema.prisma).
export class PexelsAdapter implements StockProviderAdapter {
  readonly id = "pexels";

  constructor(private readonly config: ProviderRuntimeConfig = {}) {}

  private requireApiKey(): string {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error("pexels is enabled but no API key is configured (Admin → AI Providers).");
    return apiKey;
  }

  async search(query: string, opts: StockSearchOptions = {}): Promise<StockSearchResult[]> {
    const apiKey = this.requireApiKey();
    const perPage = Math.min(80, Math.max(1, opts.perPage ?? 20));
    const page = Math.max(1, opts.page ?? 1);
    const type = opts.type ?? "image";

    if (type === "audio") return []; // Pexels has no stock-audio catalog.

    const url = type === "video" ? VIDEO_SEARCH_URL : PHOTO_SEARCH_URL;
    const res = await fetch(`${url}?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Pexels search failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = await res.json();
    if (type === "video") {
      const videos = (json.videos as PexelsVideo[] | undefined) ?? [];
      return videos.map(videoToResult).filter((r): r is StockSearchResult => r !== null);
    }
    const photos = (json.photos as PexelsPhoto[] | undefined) ?? [];
    return photos.map(photoToResult);
  }

  async fetch(externalId: string): Promise<StockSearchResult | null> {
    const apiKey = this.requireApiKey();
    // Try photo first, then video — externalId alone doesn't tell us which
    // kind it is, and Pexels ids aren't namespaced across the two catalogs.
    const photoRes = await fetch(`${PHOTO_BY_ID_URL}/${encodeURIComponent(externalId)}`, {
      headers: { Authorization: apiKey },
    });
    if (photoRes.ok) return photoToResult(await photoRes.json());

    const videoRes = await fetch(`${VIDEO_BY_ID_URL}/${encodeURIComponent(externalId)}`, {
      headers: { Authorization: apiKey },
    });
    if (videoRes.ok) return videoToResult(await videoRes.json());

    return null;
  }
}
