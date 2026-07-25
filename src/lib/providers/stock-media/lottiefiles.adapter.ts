import type { ProviderRuntimeConfig } from "../credentials";
import type { StockProviderAdapter, StockSearchOptions, StockSearchResult } from "./types";

const SEARCH_URL = "https://api.lottiefiles.com/search";

// CONFIRMED NOT WORKING (2026-07-10) — unlike the Pexels/Pixabay adapters
// (verified against their public, stable REST docs, and against real live
// requests), `api.lottiefiles.com` does not resolve at all (a live DNS
// lookup returned ENOTFOUND), and a real web search of LottieFiles'
// current developer docs (developers.lottiefiles.com, docs.lottiefiles.com)
// turned up no confirmed public REST search API to replace it with — their
// current developer portal documents embed/player SDKs, not a public
// search endpoint. This class is kept as a structurally-complete
// implementation of StockProviderAdapter (so wiring in a real endpoint
// later is a one-file fix, not a redesign), but it is deliberately NOT
// returned by registry.ts's getStockAdapter() — see that file's header
// comment. Do not re-wire this without first confirming a real,
// resolvable endpoint; shipping a guessed URL that doesn't even resolve
// would silently fail on every call.
interface LottieSearchItem {
  id: string | number;
  name?: string;
  title?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  jsonUrl?: string;
  lottieUrl?: string;
  url?: string;
  author?: { name?: string };
}

function itemToResult(item: LottieSearchItem): StockSearchResult | null {
  const downloadUrl = item.jsonUrl ?? item.lottieUrl ?? item.url;
  if (!downloadUrl) return null;
  return {
    externalId: String(item.id),
    title: item.name ?? item.title ?? `Lottie animation ${item.id}`,
    previewUrl: item.thumbnailUrl ?? item.imageUrl ?? downloadUrl,
    downloadUrl,
    kind: "IMAGE", // no ANIMATION member in StockSearchResult.kind (mirrors EditorAsset's
    // separate `kind`/`libraryCategory` split — the download step downstream
    // is what tags this as an animation-category asset when saved).
    attribution: item.author?.name,
  };
}

export class LottieFilesAdapter implements StockProviderAdapter {
  readonly id = "lottiefiles";

  constructor(private readonly config: ProviderRuntimeConfig = {}) {}

  private requireApiKey(): string {
    const apiKey = this.config.apiKey;
    if (!apiKey) throw new Error("lottiefiles is enabled but no API key is configured (Admin → AI Providers).");
    return apiKey;
  }

  async search(query: string, opts: StockSearchOptions = {}): Promise<StockSearchResult[]> {
    const apiKey = this.requireApiKey();
    const page = Math.max(1, opts.page ?? 1);
    const perPage = Math.min(100, Math.max(1, opts.perPage ?? 20));

    const res = await fetch(`${SEARCH_URL}?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`LottieFiles search failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = await res.json();
    const items: unknown = json.data ?? json.results ?? json.items;
    if (!Array.isArray(items)) {
      throw new Error("LottieFiles search returned an unexpected response shape.");
    }
    return (items as LottieSearchItem[]).map(itemToResult).filter((r): r is StockSearchResult => r !== null);
  }

  async fetch(externalId: string): Promise<StockSearchResult | null> {
    const apiKey = this.requireApiKey();
    const res = await fetch(`https://api.lottiefiles.com/animations/${encodeURIComponent(externalId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const item = (json.data ?? json) as LottieSearchItem;
    return itemToResult(item);
  }
}
