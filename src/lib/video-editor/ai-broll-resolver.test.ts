import { afterEach, describe, expect, it, vi } from "vitest";
import type { StockSearchProviderOutcome } from "@/lib/providers/stock-media/search-service";
import type { StockSearchResult } from "@/lib/providers/stock-media/types";
import type { AIBroll } from "@/lib/validations/ai-timeline";

const searchStockMediaMock = vi.fn();
const materializeStockAssetMock = vi.fn();
vi.mock("@/lib/providers/stock-media/search-service", () => ({
  searchStockMedia: (...args: unknown[]) => searchStockMediaMock(...args),
  materializeStockAsset: (...args: unknown[]) => materializeStockAssetMock(...args),
}));

const generateImageMock = vi.fn();
vi.mock("@/lib/generation/image", () => ({ generateImage: (...args: unknown[]) => generateImageMock(...args) }));

const renderVideoMock = vi.fn();
vi.mock("@/lib/generation/video", () => ({ renderVideo: (...args: unknown[]) => renderVideoMock(...args) }));

const editorAssetCreateMock = vi.fn();
const editorAssetUpdateMock = vi.fn();
const editorAssetFindUniqueOrThrowMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    editorAsset: {
      create: (...args: unknown[]) => editorAssetCreateMock(...args),
      update: (...args: unknown[]) => editorAssetUpdateMock(...args),
      findUniqueOrThrow: (...args: unknown[]) => editorAssetFindUniqueOrThrowMock(...args),
    },
  },
}));

const storageUploadMock = vi.fn().mockResolvedValue(undefined);
const storageGetPublicUrlMock = vi.fn((key: string) => `https://cdn.test/${key}`);
vi.mock("@/lib/providers/storage", () => ({
  getStorageProvider: vi.fn().mockResolvedValue({ upload: (...args: unknown[]) => storageUploadMock(...args), getPublicUrl: (key: string) => storageGetPublicUrlMock(key) }),
}));

vi.mock("./thumbnails", () => ({
  generateImageThumbnail: vi.fn().mockResolvedValue(Buffer.from("thumb")),
  generateVideoThumbnail: vi.fn().mockResolvedValue(Buffer.from("thumb")),
}));

vi.mock("@/lib/observability/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

// Imports AFTER the mocks above (vitest hoists vi.mock calls, but keeping
// the import last mirrors the mocked-module convention this codebase's
// other vi.mock-based tests already use, e.g. track-stacking.test.ts).
const { buildBroadenedQueries, pickBestStockResult, resolveBrollItem, resolveBrollItems } = await import("./ai-broll-resolver");

function stockResult(overrides: Partial<StockSearchResult> = {}): StockSearchResult {
  return { externalId: "1", title: "A clip", previewUrl: "https://x/preview.jpg", downloadUrl: "https://x/download.mp4", kind: "VIDEO", ...overrides };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("pickBestStockResult", () => {
  it("returns null for no outcomes or all-empty outcomes", () => {
    expect(pickBestStockResult([], "VIDEO", "typing on a laptop")).toBeNull();
    expect(pickBestStockResult([{ providerId: "pexels", results: [] }], "VIDEO", "typing on a laptop")).toBeNull();
  });

  it("ignores outcomes with an error", () => {
    const outcomes: StockSearchProviderOutcome[] = [{ providerId: "pexels", results: [], error: "rate limited" }];
    expect(pickBestStockResult(outcomes, "VIDEO", "typing on a laptop")).toBeNull();
  });

  it("prefers the preferredKind even when it's ranked lower within its own results", () => {
    const outcomes: StockSearchProviderOutcome[] = [
      { providerId: "pexels", results: [stockResult({ externalId: "img-1", kind: "IMAGE" }), stockResult({ externalId: "vid-1", kind: "VIDEO" })] },
    ];
    const picked = pickBestStockResult(outcomes, "VIDEO", "a clip");
    expect(picked?.result.externalId).toBe("vid-1");
  });

  it("within the same kind, when titles are equally (ir)relevant, respects the vendor's own rank as a tiebreaker (earlier index wins)", () => {
    const outcomes: StockSearchProviderOutcome[] = [
      { providerId: "pexels", results: [stockResult({ externalId: "vid-1", kind: "VIDEO" }), stockResult({ externalId: "vid-2", kind: "VIDEO" })] },
    ];
    const picked = pickBestStockResult(outcomes, "VIDEO", "a clip");
    expect(picked?.result.externalId).toBe("vid-1");
  });

  it("falls back to a non-preferred kind when nothing of the preferred kind exists at all", () => {
    const outcomes: StockSearchProviderOutcome[] = [{ providerId: "pixabay", results: [stockResult({ externalId: "img-1", kind: "IMAGE" })] }];
    const picked = pickBestStockResult(outcomes, "VIDEO", "a clip");
    expect(picked?.result.externalId).toBe("img-1");
  });

  it("picks the best result across MULTIPLE providers, not just the first one", () => {
    const outcomes: StockSearchProviderOutcome[] = [
      { providerId: "pixabay", results: [stockResult({ externalId: "px-img", kind: "IMAGE" })] },
      { providerId: "pexels", results: [stockResult({ externalId: "pe-vid", kind: "VIDEO" })] },
    ];
    const picked = pickBestStockResult(outcomes, "VIDEO", "a clip");
    expect(picked).toEqual({ providerId: "pexels", result: expect.objectContaining({ externalId: "pe-vid" }), relevanceScore: 1 });
  });

  // B1 relevance re-ranking (2026-07-22) — a same-kind candidate that
  // actually matches the query's own words now outranks the vendor's
  // higher-ranked but irrelevant pick, reproducing the two real live
  // failures found in the AI Auto-Editor's own output.
  it("prefers a lower-ranked but query-relevant result over a higher-ranked irrelevant one (real 'automatic water pump' failure)", () => {
    const outcomes: StockSearchProviderOutcome[] = [
      {
        providerId: "coverr",
        results: [
          stockResult({ externalId: "wrong-pump", kind: "VIDEO", title: "construction__city__crane__building__concrete_pump__basements__truck" }),
          stockResult({ externalId: "right-pump", kind: "VIDEO", title: "water__pump__automatic__irrigation__farm__well" }),
        ],
      },
    ];
    const picked = pickBestStockResult(outcomes, "VIDEO", "automatic water pump");
    expect(picked?.result.externalId).toBe("right-pump");
  });

  it("prefers a lower-ranked but query-relevant result over a higher-ranked irrelevant one (real 'water conservation' failure)", () => {
    const outcomes: StockSearchProviderOutcome[] = [
      {
        providerId: "coverr",
        results: [
          stockResult({ externalId: "orca", kind: "VIDEO", title: "Majestic_Orca_Spyhops_Through_Ocean_Spray_at_Dawn_Light" }),
          stockResult({ externalId: "tap", kind: "VIDEO", title: "hand__turning__off__water__tap__conservation__save" }),
        ],
      },
    ];
    const picked = pickBestStockResult(outcomes, "VIDEO", "water conservation");
    expect(picked?.result.externalId).toBe("tap");
  });

  it("falls back to vendor rank when no candidate has any real relevance to the query", () => {
    const outcomes: StockSearchProviderOutcome[] = [
      {
        providerId: "coverr",
        results: [
          stockResult({ externalId: "first", kind: "VIDEO", title: "totally__unrelated__scene" }),
          stockResult({ externalId: "second", kind: "VIDEO", title: "also__unrelated__content" }),
        ],
      },
    ];
    const picked = pickBestStockResult(outcomes, "VIDEO", "automatic water pump");
    expect(picked?.result.externalId).toBe("first");
  });
});

// stockOnly: false — these tests exercise the pre-existing, GPT-judgment-
// respecting dispatch (item.source decides stock vs. generate). The
// stock-only policy override's own hard-enforcement behavior is covered
// separately below.
const CTX = { userId: "user-1", aspectRatio: "RATIO_16_9" as const, stockOnly: false, relevanceFallbackThreshold: 0.5 };

function brollStock(overrides: Partial<AIBroll> = {}): AIBroll {
  return { startMs: 1000, endMs: 3000, trackHint: "broll", source: "stock", searchQuery: "typing on a laptop", ...overrides };
}

// Fix (2026-08-06, FIX 4 — "never leave B-roll empty if stock footage
// exists").
describe("buildBroadenedQueries", () => {
  it("returns just the original query when it's already a single token", () => {
    expect(buildBroadenedQueries("pump")).toEqual(["pump"]);
  });

  it("strips stopwords, then progressively drops tokens from the front, without duplicates", () => {
    expect(buildBroadenedQueries("a domestic water pump appliance")).toEqual([
      "a domestic water pump appliance",
      "domestic water pump appliance", // stopword "a" stripped
      "water pump appliance",
      "pump appliance",
      "appliance",
    ]);
  });

  it("skips the stopword-stripped candidate when the query has no stopwords at all", () => {
    expect(buildBroadenedQueries("automatic water pump")).toEqual(["automatic water pump", "water pump", "pump"]);
  });
});

describe("resolveBrollItem — stock", () => {
  it("resolves successfully: searches, picks the best result, materializes, sets resolvedAssetId/Url", async () => {
    searchStockMediaMock.mockResolvedValue({ outcomes: [{ providerId: "pexels", results: [stockResult({ externalId: "vid-1", kind: "VIDEO" })] }] });
    materializeStockAssetMock.mockResolvedValue({ id: "asset-1", url: "https://cdn/asset-1.mp4", thumbnailUrl: "https://cdn/asset-1.thumb.jpg" });

    const result = await resolveBrollItem(brollStock(), CTX);

    expect(result.resolvedAssetId).toBe("asset-1");
    expect(result.resolvedAssetUrl).toBe("https://cdn/asset-1.thumb.jpg");
    expect(result.resolutionNote).toBeUndefined();
    expect(result.costUsd).toBe(0); // stock is free — no vendor generation call
    expect(searchStockMediaMock).toHaveBeenCalledWith("STOCK_MEDIA", "typing on a laptop", { type: "video", perPage: 5 });
    expect(searchStockMediaMock).toHaveBeenCalledWith("STOCK_MEDIA", "typing on a laptop", { type: "image", perPage: 5 });
    expect(materializeStockAssetMock).toHaveBeenCalledWith("user-1", "pexels", "STOCK_MEDIA", expect.objectContaining({ externalId: "vid-1" }));
  });

  it("flags a NO-RESULTS search as unresolved, with a real reason, WITHOUT throwing", async () => {
    searchStockMediaMock.mockResolvedValue({ outcomes: [{ providerId: "pexels", results: [] }] });

    const result = await resolveBrollItem(brollStock({ searchQuery: "a completely nonsense query xyzzy123" }), CTX);

    expect(result.resolvedAssetId).toBeUndefined();
    expect(result.resolutionNote).toContain("No stock results found");
    expect(materializeStockAssetMock).not.toHaveBeenCalled();
  });

  // Fix (2026-08-06, FIX 4) — the exact production requirement: the
  // over-specific original query finds nothing, but a broadened phrasing
  // of the SAME query finds something real — this must resolve, not stay
  // empty, since usable stock footage genuinely exists for the broader
  // idea.
  it("broadens an over-specific query that found nothing, and resolves via the broader phrasing", async () => {
    searchStockMediaMock.mockImplementation(async (_category: string, query: string) => {
      // Only the fully-broadened single-token query ("appliance") finds
      // anything — every more-specific phrasing returns empty.
      if (query === "appliance") return { outcomes: [{ providerId: "pixabay", results: [stockResult({ externalId: "appliance-1", kind: "VIDEO", title: "kitchen appliance closeup" })] }] };
      return { outcomes: [{ providerId: "pixabay", results: [] }] };
    });
    materializeStockAssetMock.mockResolvedValue({ id: "asset-broadened", url: "https://cdn/b.mp4", thumbnailUrl: null });

    const result = await resolveBrollItem(brollStock({ searchQuery: "a domestic water pump appliance" }), CTX);

    expect(result.resolvedAssetId).toBe("asset-broadened");
    expect(materializeStockAssetMock).toHaveBeenCalledWith("user-1", "pixabay", "STOCK_MEDIA", expect.objectContaining({ externalId: "appliance-1" }));
  });

  it("never broadens a query that already found something on the first, most-specific attempt (no extra round trips for an already-working query)", async () => {
    searchStockMediaMock.mockResolvedValue({ outcomes: [{ providerId: "pexels", results: [stockResult({ externalId: "vid-exact", kind: "VIDEO" })] }] });
    materializeStockAssetMock.mockResolvedValue({ id: "asset-exact", url: "https://cdn/e.mp4", thumbnailUrl: null });

    const result = await resolveBrollItem(brollStock({ searchQuery: "a domestic water pump appliance" }), CTX);

    expect(result.resolvedAssetId).toBe("asset-exact");
    // Exactly one video+image search pair — no broadened attempts fired.
    expect(searchStockMediaMock).toHaveBeenCalledTimes(2);
  });

  it("flags a materialize failure (e.g. download error) as unresolved, not a thrown exception", async () => {
    searchStockMediaMock.mockResolvedValue({ outcomes: [{ providerId: "pexels", results: [stockResult()] }] });
    materializeStockAssetMock.mockRejectedValue(new Error("Failed to download pexels asset (500)."));

    const result = await resolveBrollItem(brollStock(), CTX);

    expect(result.resolvedAssetId).toBeUndefined();
    expect(result.resolutionNote).toContain("Failed to download");
  });

  it("flags a stock item with no searchQuery as unresolved (defensive, schema should prevent this)", async () => {
    const result = await resolveBrollItem({ startMs: 0, endMs: 1000, trackHint: "broll", source: "stock" }, CTX);
    expect(result.resolutionNote).toContain("no searchQuery");
    expect(searchStockMediaMock).not.toHaveBeenCalled();
  });
});

describe("resolveBrollItem — generate", () => {
  it("resolves an IMAGE generation: calls generateImage, persists via storage+prisma, sets resolvedAssetId/Url", async () => {
    generateImageMock.mockResolvedValue({ imageUrl: "data:image/png;base64,aGVsbG8=", costUsd: 0.04 });
    editorAssetCreateMock.mockResolvedValue({ id: "gen-asset-1" });
    editorAssetFindUniqueOrThrowMock.mockResolvedValue({ id: "gen-asset-1", storageKey: "ai-broll/image/user-1/x", thumbnailKey: "ai-broll/image/user-1/x.thumb.jpg" });

    const item: AIBroll = { startMs: 0, endMs: 2000, trackHint: "broll", source: "generate", generation: { kind: "image", prompt: "a futuristic dashboard UI" } };
    const result = await resolveBrollItem(item, CTX);

    expect(generateImageMock).toHaveBeenCalledWith({ prompt: "a futuristic dashboard UI", aspectRatio: "RATIO_16_9" }, "ai_broll_image", { userId: "user-1" });
    expect(result.resolvedAssetId).toBe("gen-asset-1");
    expect(result.resolvedAssetUrl).toBe("https://cdn.test/ai-broll/image/user-1/x.thumb.jpg");
    expect(result.costUsd).toBe(0.04); // threaded straight from the Generation Engine's own result, not recomputed
    expect(editorAssetCreateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: "IMAGE", scope: "USER" }) }));
  });

  it("defaults costUsd to 0 (not undefined) when the generation result carries no costUsd at all", async () => {
    generateImageMock.mockResolvedValue({ imageUrl: "data:image/png;base64,aGVsbG8=" });
    editorAssetCreateMock.mockResolvedValue({ id: "gen-asset-2" });
    editorAssetFindUniqueOrThrowMock.mockResolvedValue({ id: "gen-asset-2", storageKey: "ai-broll/image/user-1/z", thumbnailKey: null });

    const item: AIBroll = { startMs: 0, endMs: 2000, trackHint: "broll", source: "generate", generation: { kind: "image", prompt: "x" } };
    const result = await resolveBrollItem(item, CTX);

    expect(result.costUsd).toBe(0);
  });

  it("resolves a VIDEO generation with a duration derived from the slot's own window", async () => {
    renderVideoMock.mockResolvedValue({ videoUrl: "data:video/mp4;base64,aGVsbG8=", durationSeconds: 3, costUsd: 0.75 });
    editorAssetCreateMock.mockResolvedValue({ id: "gen-video-1" });
    editorAssetFindUniqueOrThrowMock.mockResolvedValue({ id: "gen-video-1", storageKey: "ai-broll/video/user-1/y", thumbnailKey: null });

    const item: AIBroll = { startMs: 1000, endMs: 4000, trackHint: "broll", source: "generate", generation: { kind: "video", prompt: "a drone shot of mountains" } };
    const result = await resolveBrollItem(item, CTX);

    expect(renderVideoMock).toHaveBeenCalledWith(
      { script: "a drone shot of mountains", aspectRatio: "RATIO_16_9", durationSeconds: 3, quality: "720p" },
      "ai_broll_video",
      { userId: "user-1" }
    );
    expect(result.costUsd).toBe(0.75);
  });

  it("flags a generation failure as unresolved, not a thrown exception", async () => {
    generateImageMock.mockRejectedValue(new Error("openai_images is enabled but no API key is configured."));
    const item: AIBroll = { startMs: 0, endMs: 1000, trackHint: "broll", source: "generate", generation: { kind: "image", prompt: "x" } };

    const result = await resolveBrollItem(item, CTX);

    expect(result.resolvedAssetId).toBeUndefined();
    expect(result.resolutionNote).toContain("no API key");
  });
});

describe("resolveBrollItem — stock-only policy override (2026-07-18)", () => {
  const STOCK_ONLY_CTX = { ...CTX, stockOnly: true };

  it("a GPT-proposed 'generate' item resolves via stock instead when stock-only is active — generation never called", async () => {
    searchStockMediaMock.mockResolvedValue({ outcomes: [{ providerId: "pixabay", results: [stockResult({ externalId: "vid-2", kind: "VIDEO", title: "a neon jellyfish octopus hybrid underwater scene" })] }] });
    materializeStockAssetMock.mockResolvedValue({ id: "asset-override", url: "https://cdn/o.mp4", thumbnailUrl: null });

    const item: AIBroll = { startMs: 0, endMs: 2000, trackHint: "broll", source: "generate", generation: { kind: "image", prompt: "a neon jellyfish octopus hybrid" } };
    const result = await resolveBrollItem(item, STOCK_ONLY_CTX);

    // No searchQuery was ever set on this item (GPT proposed "generate") —
    // the resolver must derive its stock search from the generation
    // prompt's own text as the fallback query.
    expect(searchStockMediaMock).toHaveBeenCalledWith("STOCK_MEDIA", "a neon jellyfish octopus hybrid", { type: "video", perPage: 5 });
    expect(result.resolvedAssetId).toBe("asset-override");
    expect(generateImageMock).not.toHaveBeenCalled();
    expect(renderVideoMock).not.toHaveBeenCalled();
  });

  it("falls back to generation as a LAST RESORT only when stock genuinely finds nothing, and flags why in resolutionNote", async () => {
    searchStockMediaMock.mockResolvedValue({ outcomes: [{ providerId: "pixabay", results: [] }] });
    generateImageMock.mockResolvedValue({ imageUrl: "data:image/png;base64,aGVsbG8=", costUsd: 0.04 });
    editorAssetCreateMock.mockResolvedValue({ id: "gen-fallback-1" });
    editorAssetFindUniqueOrThrowMock.mockResolvedValue({ id: "gen-fallback-1", storageKey: "ai-broll/image/user-1/f", thumbnailKey: null });

    const item: AIBroll = { startMs: 0, endMs: 2000, trackHint: "broll", source: "generate", generation: { kind: "image", prompt: "a physically impossible floating city" } };
    const result = await resolveBrollItem(item, STOCK_ONLY_CTX);

    expect(generateImageMock).toHaveBeenCalledTimes(1);
    expect(result.resolvedAssetId).toBe("gen-fallback-1");
    expect(result.resolutionNote).toContain("Stock-only policy active");
    expect(result.resolutionNote).toContain("last resort");
  });

  it("a GPT-proposed 'stock' item still resolves normally under stock-only (no behavior change on the already-compliant path)", async () => {
    // brollStock()'s default searchQuery is "typing on a laptop" — title
    // must actually match it now that a low-relevance match gets rejected.
    searchStockMediaMock.mockResolvedValue({ outcomes: [{ providerId: "pexels", results: [stockResult({ externalId: "vid-3", kind: "VIDEO", title: "person typing on a laptop keyboard" })] }] });
    materializeStockAssetMock.mockResolvedValue({ id: "asset-compliant", url: "https://cdn/c.mp4", thumbnailUrl: null });

    const result = await resolveBrollItem(brollStock(), STOCK_ONLY_CTX);

    expect(result.resolvedAssetId).toBe("asset-compliant");
    expect(generateImageMock).not.toHaveBeenCalled();
  });

  it("stays unresolved (never generates) when stock finds nothing AND there's no generation block to fall back to", async () => {
    searchStockMediaMock.mockResolvedValue({ outcomes: [{ providerId: "pixabay", results: [] }] });

    const result = await resolveBrollItem(brollStock({ searchQuery: "a completely nonsense query xyzzy123" }), STOCK_ONLY_CTX);

    expect(result.resolvedAssetId).toBeUndefined();
    expect(result.resolutionNote).toContain("stock-only policy active");
    expect(generateImageMock).not.toHaveBeenCalled();
    expect(renderVideoMock).not.toHaveBeenCalled();
  });

  // Generation fallback for low-relevance stock (2026-07-23) — real stock
  // RESULTS exist, but they don't actually match the query well enough to
  // trust (relevanceScore below relevanceFallbackThreshold). Distinct from
  // the "stock finds literally nothing" tests above.
  it("falls back to generation when stock found results but the best one scores below relevanceFallbackThreshold", async () => {
    searchStockMediaMock.mockResolvedValue({
      outcomes: [{ providerId: "pixabay", results: [stockResult({ externalId: "weak-1", kind: "VIDEO", title: "unrelated scene, nothing to do with the query" })] }],
    });
    generateImageMock.mockResolvedValue({ imageUrl: "data:image/png;base64,aGVsbG8=", costUsd: 0.04 });
    editorAssetCreateMock.mockResolvedValue({ id: "gen-low-relevance" });
    editorAssetFindUniqueOrThrowMock.mockResolvedValue({ id: "gen-low-relevance", storageKey: "ai-broll/image/user-1/g", thumbnailKey: null });

    const item = brollStock({ searchQuery: "automatic water pump", generation: { kind: "image", prompt: "an automatic water pump appliance" } });
    const result = await resolveBrollItem(item, STOCK_ONLY_CTX);

    expect(materializeStockAssetMock).not.toHaveBeenCalled();
    expect(generateImageMock).toHaveBeenCalledTimes(1);
    expect(result.resolvedAssetId).toBe("gen-low-relevance");
    expect(result.resolutionNote).toContain("Stock-only policy active");
  });

  it("stays unresolved (never generates) when the best stock match is below threshold AND there's no generation block", async () => {
    searchStockMediaMock.mockResolvedValue({
      outcomes: [{ providerId: "pixabay", results: [stockResult({ externalId: "weak-2", kind: "VIDEO", title: "completely unrelated content" })] }],
    });

    const result = await resolveBrollItem(brollStock({ searchQuery: "automatic water pump" }), STOCK_ONLY_CTX);

    expect(result.resolvedAssetId).toBeUndefined();
    expect(result.resolutionNote).toContain("below the");
    expect(generateImageMock).not.toHaveBeenCalled();
  });

  it("uses stock, never generates, when the best match's relevance is AT OR ABOVE relevanceFallbackThreshold", async () => {
    searchStockMediaMock.mockResolvedValue({
      outcomes: [{ providerId: "pexels", results: [stockResult({ externalId: "strong-1", kind: "VIDEO", title: "automatic water pump irrigation farm well" })] }],
    });
    materializeStockAssetMock.mockResolvedValue({ id: "asset-strong", url: "https://cdn/strong.mp4", thumbnailUrl: null });

    const result = await resolveBrollItem(brollStock({ searchQuery: "automatic water pump" }), STOCK_ONLY_CTX);

    expect(result.resolvedAssetId).toBe("asset-strong");
    expect(generateImageMock).not.toHaveBeenCalled();
  });

  it("respects a custom (non-default) relevanceFallbackThreshold from ctx", async () => {
    searchStockMediaMock.mockResolvedValue({
      // "automatic water pump" vs this title: matches "water"+"pump" = 2/3 = 0.667
      outcomes: [{ providerId: "pixabay", results: [stockResult({ externalId: "mid-1", kind: "VIDEO", title: "garden water pump hose" })] }],
    });
    generateImageMock.mockResolvedValue({ imageUrl: "data:image/png;base64,aGVsbG8=", costUsd: 0.04 });
    editorAssetCreateMock.mockResolvedValue({ id: "gen-strict-threshold" });
    editorAssetFindUniqueOrThrowMock.mockResolvedValue({ id: "gen-strict-threshold", storageKey: "ai-broll/image/user-1/s", thumbnailKey: null });

    // A stricter-than-default threshold (0.9) should reject a 0.667 match
    // that the default 0.5 would have accepted.
    const strictCtx = { ...STOCK_ONLY_CTX, relevanceFallbackThreshold: 0.9 };
    const item = brollStock({ searchQuery: "automatic water pump", generation: { kind: "image", prompt: "an automatic water pump appliance" } });
    const result = await resolveBrollItem(item, strictCtx);

    expect(materializeStockAssetMock).not.toHaveBeenCalled();
    expect(generateImageMock).toHaveBeenCalledTimes(1);
    expect(result.resolvedAssetId).toBe("gen-strict-threshold");
  });
});

describe("resolveBrollItems", () => {
  it("resolves every item independently — one failure never blocks another item's success", async () => {
    searchStockMediaMock.mockImplementation(async (_category: string, query: string) => {
      if (query === "good query") return { outcomes: [{ providerId: "pexels", results: [stockResult()] }] };
      return { outcomes: [{ providerId: "pexels", results: [] }] };
    });
    materializeStockAssetMock.mockResolvedValue({ id: "asset-good", url: "https://cdn/good.mp4", thumbnailUrl: null });

    const items: AIBroll[] = [brollStock({ searchQuery: "good query" }), brollStock({ searchQuery: "bad query" })];
    const results = await resolveBrollItems(items, CTX);

    expect(results[0].resolvedAssetId).toBe("asset-good");
    expect(results[1].resolvedAssetId).toBeUndefined();
    expect(results[1].resolutionNote).toContain("No stock results found");
  });
});
