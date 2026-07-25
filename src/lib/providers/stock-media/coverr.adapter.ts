import type { ProviderRuntimeConfig } from "../credentials";
import type { StockProviderAdapter, StockSearchOptions, StockSearchResult } from "./types";

const BASE_URL = "https://api.coverr.co";

interface CoverrVideoHit {
  id: string;
  title: string;
  thumbnail: string;
  poster: string;
  duration: number;
  max_width: number;
  max_height: number;
  urls?: { mp4?: string; mp4_preview?: string; mp4_download?: string };
}

interface CoverrAudioHit {
  id: string;
  title: string;
  duration: number;
  urls?: { preview?: string; previewDownload?: string; masterDownload?: string };
}

interface CoverrListResponse<T> {
  page: number;
  pages: number;
  page_size: number;
  total: number;
  hits: T[];
}

function videoToResult(hit: CoverrVideoHit): StockSearchResult | null {
  const downloadUrl = hit.urls?.mp4_download ?? hit.urls?.mp4;
  if (!downloadUrl) return null; // urls block missing (urls=true wasn't honored) — nothing usable to return.
  return {
    externalId: hit.id,
    title: hit.title,
    previewUrl: hit.thumbnail || hit.poster,
    downloadUrl,
    kind: "VIDEO",
    // Coverr's own docs: "you'd have to show your users where the videos
    // are pulled from" — a platform-level requirement, not a per-creator
    // credit (their API returns no photographer/videographer name), so
    // the attribution text names the source itself.
    attribution: "Coverr",
    attributionRequired: true,
    widthPx: hit.max_width,
    heightPx: hit.max_height,
    // Fix (2026-07-21) — a real, live-confirmed incident: this interface
    // declares `duration: number`, but Coverr's actual API response
    // returns it as a numeric-looking STRING ("21.666667") — TypeScript
    // never validates a fetch()-parsed JSON shape at runtime, so this
    // string flowed straight through to prisma.editorAsset.create(),
    // which DOES validate and threw "Expected Float or Null, provided
    // String." on every real Coverr b-roll resolution. Number() coerces
    // either shape safely.
    durationSeconds: Number(hit.duration),
  };
}

function audioToResult(hit: CoverrAudioHit): StockSearchResult | null {
  const downloadUrl = hit.urls?.masterDownload || hit.urls?.previewDownload;
  if (!downloadUrl) return null;
  return {
    externalId: hit.id,
    title: hit.title,
    previewUrl: hit.urls?.preview || downloadUrl,
    downloadUrl,
    kind: "AUDIO",
    attribution: "Coverr",
    attributionRequired: true,
    durationSeconds: Number(hit.duration),
  };
}

// Real adapter — Coverr's REST API (api.coverr.co, docs confirmed live at
// api.coverr.co/docs). Two content kinds under one API key: /videos
// (b-roll footage) and /audios (music) — mirrors the Pexels/Pixabay "type
// param picks the endpoint" shape. Coverr has no image catalog, so
// type: "image"/"icon"/"animation" returns [] here, same honest handling
// Pexels/Pixabay already use for the content kinds THEY don't serve.
//
// `urls=true` is required on every list call — Coverr's own docs note the
// `urls` object (the only field carrying actual playable/downloadable
// file links) is omitted from list responses unless explicitly requested.
//
// Page numbering: Coverr's own `page` param is 0-indexed (`default: 0`),
// unlike every other adapter in this file (StockSearchOptions.page is
// 1-indexed, matching Pexels/Pixabay's own convention) — converted here,
// once, so callers never need to know this adapter is the odd one out.
export class CoverrAdapter implements StockProviderAdapter {
  readonly id = "coverr";

  constructor(private readonly config: ProviderRuntimeConfig = {}) {}

  private requireApiKey(): string {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error("coverr is enabled but no API key is configured (Admin → AI Providers).");
    return apiKey;
  }

  async search(query: string, opts: StockSearchOptions = {}): Promise<StockSearchResult[]> {
    const apiKey = this.requireApiKey();
    const pageSize = Math.min(100, Math.max(1, opts.perPage ?? 20));
    const page = Math.max(0, (opts.page ?? 1) - 1);
    const type = opts.type ?? "video";

    if (type === "image" || type === "icon" || type === "animation") return [];

    const path = type === "audio" ? "/audios" : "/videos";
    const res = await fetch(
      `${BASE_URL}${path}?query=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}&urls=true`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Coverr search failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = await res.json();
    if (type === "audio") {
      const hits = (json as CoverrListResponse<CoverrAudioHit>).hits ?? [];
      return hits.map(audioToResult).filter((r): r is StockSearchResult => r !== null);
    }
    const hits = (json as CoverrListResponse<CoverrVideoHit>).hits ?? [];
    return hits.map(videoToResult).filter((r): r is StockSearchResult => r !== null);
  }

  // Coverr's docs (fetched live) document the LIST shape in full but don't
  // show a single-item GET path — this follows the same REST convention
  // every other adapter's single-item endpoint here already uses
  // (list path + "/{id}"), with `urls=true` carried over so a fetched item
  // is immediately usable the same way a searched one is. Falls back to
  // null on a non-2xx rather than throwing, same resilience convention as
  // Pexels/Pixabay's own fetch() — an unconfirmed-by-docs endpoint guess
  // failing should degrade gracefully, not take down a caller.
  async fetch(externalId: string): Promise<StockSearchResult | null> {
    const apiKey = this.requireApiKey();
    const headers = { Authorization: `Bearer ${apiKey}` };

    const videoRes = await fetch(`${BASE_URL}/videos/${encodeURIComponent(externalId)}?urls=true`, { headers });
    if (videoRes.ok) {
      const hit = (await videoRes.json()) as CoverrVideoHit;
      const result = videoToResult(hit);
      if (result) return result;
    }

    const audioRes = await fetch(`${BASE_URL}/audios/${encodeURIComponent(externalId)}?urls=true`, { headers });
    if (audioRes.ok) {
      const hit = (await audioRes.json()) as CoverrAudioHit;
      const result = audioToResult(hit);
      if (result) return result;
    }

    return null;
  }
}
