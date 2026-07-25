import type { ProviderRuntimeConfig } from "../credentials";
import type { StockProviderAdapter, StockSearchOptions, StockSearchResult } from "./types";

const BASE_URL = "https://api.openverse.org/v1";

// Licenses that don't require attribution — everything else (any "by*"
// code: by, by-sa, by-nc, by-nd, by-nc-sa, by-nc-nd) does, per standard CC
// license terms. Confirmed against Openverse's own live API response
// shape (fetched 2026-07-18) — `license` is a short code, not the full
// "CC BY 4.0"-style display name.
const NO_ATTRIBUTION_LICENSES = new Set(["cc0", "pdm"]);

function licenseRequiresAttribution(license: string | undefined): boolean {
  if (!license) return true; // unknown license — the safe default is to assume attribution is required.
  return !NO_ATTRIBUTION_LICENSES.has(license.toLowerCase());
}

interface OpenverseImage {
  id: string;
  title: string;
  creator?: string;
  license?: string;
  attribution?: string;
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
}

interface OpenverseAudio {
  id: string;
  title: string;
  creator?: string;
  license?: string;
  attribution?: string;
  url: string;
  thumbnail?: string;
  duration?: number; // milliseconds, per Openverse's own schema
}

interface OpenverseListResponse<T> {
  result_count: number;
  page_count: number;
  page_size: number;
  page: number;
  results: T[];
}

function imageToResult(item: OpenverseImage): StockSearchResult {
  return {
    externalId: item.id,
    title: item.title,
    previewUrl: item.thumbnail || item.url,
    downloadUrl: item.url,
    kind: "IMAGE",
    attribution: item.attribution || item.creator,
    attributionRequired: licenseRequiresAttribution(item.license),
    widthPx: item.width,
    heightPx: item.height,
  };
}

function audioToResult(item: OpenverseAudio): StockSearchResult {
  return {
    externalId: item.id,
    title: item.title,
    previewUrl: item.thumbnail || item.url,
    downloadUrl: item.url,
    kind: "AUDIO",
    attribution: item.attribution || item.creator,
    attributionRequired: licenseRequiresAttribution(item.license),
    // Openverse reports duration in MILLISECONDS (confirmed live —
    // "duration: 5197 milliseconds" for a real result); every other
    // adapter/StockSearchResult.durationSeconds in this file is seconds.
    durationSeconds: item.duration !== undefined ? item.duration / 1000 : undefined,
  };
}

// Real adapter — Openverse's REST API (api.openverse.org, confirmed live,
// no authentication required for basic search — verified with real
// unauthenticated requests during development). Aggregates 50+ open-
// content sources across images and audio. UNLIKE every other adapter in
// this file, attribution here is a PER-ITEM decision driven by each
// result's own `license` field, not a blanket true/false for the whole
// provider — see licenseRequiresAttribution() above.
export class OpenverseAdapter implements StockProviderAdapter {
  readonly id = "openverse";

  constructor(private readonly config: ProviderRuntimeConfig = {}) {
    void config; // no credentials of any kind are used — kept only to match every other adapter's constructor shape.
  }

  async search(query: string, opts: StockSearchOptions = {}): Promise<StockSearchResult[]> {
    const type = opts.type ?? "image";
    if (type === "video" || type === "icon" || type === "animation") return [];

    const pageSize = Math.min(500, Math.max(1, opts.perPage ?? 20));
    const page = Math.max(1, opts.page ?? 1);
    const path = type === "audio" ? "audio" : "images";

    const res = await fetch(`${BASE_URL}/${path}/?q=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Openverse search failed (${res.status}): ${body.slice(0, 300)}`);
    }
    if (type === "audio") {
      const json = (await res.json()) as OpenverseListResponse<OpenverseAudio>;
      return (json.results ?? []).map(audioToResult);
    }
    const json = (await res.json()) as OpenverseListResponse<OpenverseImage>;
    return (json.results ?? []).map(imageToResult);
  }

  async fetch(externalId: string): Promise<StockSearchResult | null> {
    const imageRes = await fetch(`${BASE_URL}/images/${encodeURIComponent(externalId)}/`);
    if (imageRes.ok) return imageToResult((await imageRes.json()) as OpenverseImage);

    const audioRes = await fetch(`${BASE_URL}/audio/${encodeURIComponent(externalId)}/`);
    if (audioRes.ok) return audioToResult((await audioRes.json()) as OpenverseAudio);

    return null;
  }
}
