import type { ProviderRuntimeConfig } from "../credentials";
import type { StockProviderAdapter, StockSearchOptions, StockSearchResult } from "./types";

const SEARCH_URL = "https://api.iconscout.com/v3/search";

// Confirmed live (2026-07-11, before writing a single line of adapter code
// — same discipline the LottieFiles adapter should have used): a real
// unauthenticated request to this exact URL returns a real, structured
// error (`{"message":"Client-ID is missing.","status_code":500}`), and
// IconScout's own docs (api-docs.iconscout.com, cross-checked via search
// results since the docs site itself is JS-rendered and unfetchable as
// plain HTML) confirm `Client-ID` header auth and `asset=icon|lottie` as
// the search-endpoint's asset-type selector. The container/pagination
// shape (`data.items.data[]`, Laravel-style) is confirmed from IconScout's
// own API blog content. Per-item field names (id/name/urls/premium/owner)
// could NOT be confirmed against a real captured response (no production
// Client-ID available, and no public example response was found) — parsed
// defensively below with multiple fallback field-name candidates per
// value, throwing a clear error if NONE of a value's candidates resolve,
// rather than silently returning wrong/empty data. Fix the candidate list
// here (only here) once a real response is available to check against.
interface IconScoutItem {
  id: string | number;
  name?: string;
  title?: string;
  urls?: Record<string, string | undefined>;
  thumb?: string;
  thumbnail_url?: string;
  preview_url?: string;
  image?: string;
  download_url?: string;
  is_premium?: boolean;
  premium?: boolean;
  owner?: { name?: string };
  user?: { name?: string };
  author?: { name?: string };
}

interface IconScoutSearchResponse {
  status?: boolean;
  data?: {
    items?: {
      data?: IconScoutItem[];
    };
  };
}

function firstDefined(...candidates: (string | undefined)[]): string | undefined {
  return candidates.find((c) => typeof c === "string" && c.length > 0);
}

function itemToResult(item: IconScoutItem, assetType: "icon" | "lottie"): StockSearchResult {
  const preview = firstDefined(
    item.urls?.thumb,
    item.urls?.thumbnail_url,
    item.urls?.png_64,
    item.thumb,
    item.thumbnail_url,
    item.preview_url,
    item.image
  );
  const download = firstDefined(
    item.urls?.download,
    item.urls?.lottie_link,
    item.urls?.json,
    item.urls?.svg,
    item.urls?.png_512,
    item.download_url,
    preview
  );
  if (!preview || !download) {
    throw new Error(
      `IconScout item ${item.id} has no resolvable preview/download URL in any known field — the response shape may have changed, see this file's header comment.`
    );
  }
  return {
    externalId: String(item.id),
    title: item.name ?? item.title ?? `IconScout ${assetType} ${item.id}`,
    previewUrl: preview,
    downloadUrl: download,
    kind: assetType === "lottie" ? "ANIMATION" : "ICON",
    attribution: item.owner?.name ?? item.user?.name ?? item.author?.name,
  };
}

function resolveAssetType(type: StockSearchOptions["type"]): "icon" | "lottie" {
  return type === "animation" ? "lottie" : "icon";
}

// Real adapter — IconScout's v3 REST API. Covers both icons and Lottie
// animations (the spec's Animations + Icons sidebar tabs) through the same
// endpoint/key, selected via `opts.type: "icon" | "animation"` — same
// "one search shape, a type param picks the asset kind" convention the
// Pexels/Pixabay adapters already use for their own multi-kind catalogs.
export class IconScoutAdapter implements StockProviderAdapter {
  readonly id = "iconscout";

  constructor(private readonly config: ProviderRuntimeConfig = {}) {}

  private requireClientId(): string {
    const clientId = this.config.apiKey;
    if (!clientId) throw new Error("iconscout is enabled but no Client-ID is configured (Admin → AI Providers).");
    return clientId;
  }

  async search(query: string, opts: StockSearchOptions = {}): Promise<StockSearchResult[]> {
    const clientId = this.requireClientId();
    const assetType = resolveAssetType(opts.type);
    const perPage = Math.min(200, Math.max(1, opts.perPage ?? 20));
    const page = Math.max(1, opts.page ?? 1);

    const res = await fetch(
      `${SEARCH_URL}?query=${encodeURIComponent(query)}&asset=${assetType}&per_page=${perPage}&page=${page}`,
      { headers: { "Client-ID": clientId } }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`IconScout search failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as IconScoutSearchResponse;
    const items = json.data?.items?.data;
    if (!Array.isArray(items)) {
      throw new Error("IconScout search returned an unexpected response shape.");
    }
    return items.map((item) => itemToResult(item, assetType));
  }

  async fetch(externalId: string): Promise<StockSearchResult | null> {
    const clientId = this.requireClientId();
    // No documented single-item-by-id endpoint distinct from search was
    // confirmed — IconScout's item detail is conventionally reached via
    // /v3/items/{id} in Laravel-resource-style APIs, matching the same
    // naming convention as their /v3/search collection endpoint.
    const res = await fetch(`https://api.iconscout.com/v3/items/${encodeURIComponent(externalId)}`, {
      headers: { "Client-ID": clientId },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const item = (json.data ?? json) as IconScoutItem;
    // Asset type isn't knowable from an id alone here — ICON is the more
    // common of the two catalogs, so it's the safe default; a caller that
    // already knows it fetched a Lottie animation should treat kind
    // loosely rather than branch on it strictly for this one path.
    return itemToResult(item, "icon");
  }
}
