import { afterEach, describe, expect, it, vi } from "vitest";
import type { AIMusic, AISfx, AISticker } from "@/lib/validations/ai-timeline";

const getConfigMock = vi.fn();
vi.mock("@/lib/admin/config", () => ({ getConfig: (...args: unknown[]) => getConfigMock(...args) }));

const searchStockMediaMock = vi.fn();
const materializeStockAssetMock = vi.fn();
vi.mock("@/lib/providers/stock-media/search-service", () => ({
  searchStockMedia: (...args: unknown[]) => searchStockMediaMock(...args),
  materializeStockAsset: (...args: unknown[]) => materializeStockAssetMock(...args),
}));

const persistGeneratedMediaAssetMock = vi.fn();
const pickBestStockResultMock = vi.fn();
vi.mock("./ai-broll-resolver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ai-broll-resolver")>();
  return {
    ...actual,
    persistGeneratedMediaAsset: (...args: unknown[]) => persistGeneratedMediaAssetMock(...args),
    pickBestStockResult: (...args: unknown[]) => pickBestStockResultMock(...args),
  };
});

vi.mock("@/lib/observability/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

const { resolveStickers, resolveMusic, resolveSfx, resolveTimelinePlanAssets } = await import("./ai-asset-resolver");

const CTX = { userId: "user-1", aspectRatio: "RATIO_16_9" as const };

afterEach(() => {
  vi.clearAllMocks();
});

describe("resolveStickers", () => {
  it("resolves from the curated STOCK_ASSET_LIBRARY when the query matches a STICKER entry's label", async () => {
    getConfigMock.mockResolvedValue([
      { id: "sparkle-1", label: "Sparkles", kind: "STICKER", url: "https://cdn/curated/sparkles.png" },
      { id: "fire-1", label: "Fire", kind: "STICKER", url: "https://cdn/curated/fire.png" },
    ]);
    persistGeneratedMediaAssetMock.mockResolvedValue({ id: "asset-curated", url: "https://cdn/asset-curated.png", thumbnailUrl: "https://cdn/asset-curated.thumb.jpg" });

    const items: AISticker[] = [{ startMs: 0, endMs: 1000, assetQuery: "sparkles" }];
    const [result] = await resolveStickers(items, CTX);

    expect(result.assetId).toBe("asset-curated");
    expect(result.resolvedAssetUrl).toBe("https://cdn/asset-curated.thumb.jpg");
    expect(persistGeneratedMediaAssetMock).toHaveBeenCalledWith("user-1", "IMAGE", "https://cdn/curated/sparkles.png");
    expect(searchStockMediaMock).not.toHaveBeenCalled(); // curated hit — no vendor call needed
  });

  it("falls back to real stock icon/image search when no curated entry matches", async () => {
    getConfigMock.mockResolvedValue([]); // empty curated library
    searchStockMediaMock.mockResolvedValue({ outcomes: [{ providerId: "iconscout", results: [{ externalId: "icon-1", title: "thumbs up", previewUrl: "p", downloadUrl: "d", kind: "ICON" }] }] });
    pickBestStockResultMock.mockReturnValue({ providerId: "iconscout", result: { externalId: "icon-1", title: "thumbs up", previewUrl: "p", downloadUrl: "d", kind: "ICON" } });
    materializeStockAssetMock.mockResolvedValue({ id: "asset-icon", url: "https://cdn/asset-icon.png", thumbnailUrl: null });

    const items: AISticker[] = [{ startMs: 0, endMs: 1000, assetQuery: "thumbs up" }];
    const [result] = await resolveStickers(items, CTX);

    expect(result.assetId).toBe("asset-icon");
    expect(materializeStockAssetMock).toHaveBeenCalledWith("user-1", "iconscout", "ICON", expect.objectContaining({ externalId: "icon-1" }));
  });

  it("flags with a resolutionNote (not silently dropped) when neither curated nor stock has a match", async () => {
    getConfigMock.mockResolvedValue([]);
    searchStockMediaMock.mockResolvedValue({ outcomes: [{ providerId: "iconscout", results: [] }] });
    pickBestStockResultMock.mockReturnValue(null);

    const items: AISticker[] = [{ startMs: 0, endMs: 1000, assetQuery: "a very obscure nonsense query" }];
    const [result] = await resolveStickers(items, CTX);

    expect(result.assetId).toBeUndefined();
    expect(result.resolutionNote).toContain("No curated sticker or stock icon/image match");
  });

  it("passes through an item that already has an assetId unchanged (no vendor calls)", async () => {
    const items: AISticker[] = [{ startMs: 0, endMs: 1000, assetId: "already-resolved" }];
    const [result] = await resolveStickers(items, CTX);
    expect(result).toEqual(items[0]);
    expect(getConfigMock).not.toHaveBeenCalled();
  });
});

describe("resolveMusic", () => {
  it("resolves assetId via stock audio search while preserving duckingEnabled/duckingVoiceTrackHint UNTOUCHED", async () => {
    searchStockMediaMock.mockResolvedValue({ outcomes: [{ providerId: "pixabay", results: [{ externalId: "trk-1", title: "Upbeat", previewUrl: "p", downloadUrl: "d", kind: "AUDIO" }] }] });
    pickBestStockResultMock.mockReturnValue({ providerId: "pixabay", result: { externalId: "trk-1", title: "Upbeat", previewUrl: "p", downloadUrl: "d", kind: "AUDIO" } });
    materializeStockAssetMock.mockResolvedValue({ id: "asset-music", url: "https://cdn/asset-music.mp3", thumbnailUrl: null });

    const item: AIMusic = { searchQuery: "upbeat corporate", duckingEnabled: true, duckingVoiceTrackHint: "voice" };
    const result = await resolveMusic(item, CTX);

    expect(result?.assetId).toBe("asset-music");
    expect(result?.duckingEnabled).toBe(true);
    expect(result?.duckingVoiceTrackHint).toBe("voice");
    expect(searchStockMediaMock).toHaveBeenCalledWith("STOCK_MEDIA", "upbeat corporate", { type: "audio", perPage: 5 });
  });

  it("returns undefined for an undefined item (nothing proposed)", async () => {
    expect(await resolveMusic(undefined, CTX)).toBeUndefined();
    expect(searchStockMediaMock).not.toHaveBeenCalled();
  });

  it("flags a no-match search with a resolutionNote, not a silent drop", async () => {
    searchStockMediaMock.mockResolvedValue({ outcomes: [{ providerId: "pixabay", results: [] }] });
    pickBestStockResultMock.mockReturnValue(null);
    const result = await resolveMusic({ searchQuery: "no such mood", duckingEnabled: true }, CTX);
    expect(result?.assetId).toBeUndefined();
    expect(result?.resolutionNote).toContain("No stock audio match");
  });
});

describe("resolveSfx", () => {
  it("resolves each item independently via stock audio search", async () => {
    searchStockMediaMock.mockImplementation(async (_cat: string, query: string) => ({
      outcomes: [{ providerId: "pixabay", results: query === "whoosh" ? [{ externalId: "sfx-1", title: "whoosh", previewUrl: "p", downloadUrl: "d", kind: "AUDIO" }] : [] }],
    }));
    pickBestStockResultMock.mockImplementation((outcomes: { results: unknown[] }[]) =>
      outcomes[0]?.results.length ? { providerId: "pixabay", result: outcomes[0].results[0] } : null
    );
    materializeStockAssetMock.mockResolvedValue({ id: "asset-whoosh", url: "https://cdn/whoosh.mp3", thumbnailUrl: null });

    const items: AISfx[] = [{ atMs: 1000, assetQuery: "whoosh" }, { atMs: 2000, assetQuery: "no match" }];
    const results = await resolveSfx(items, CTX);

    expect(results[0].assetId).toBe("asset-whoosh");
    expect(results[1].assetId).toBeUndefined();
    expect(results[1].resolutionNote).toContain("No stock audio match");
  });
});

describe("resolveTimelinePlanAssets", () => {
  it("resolves stickers, music, and sfx in parallel and returns all three", async () => {
    getConfigMock.mockResolvedValue([]);
    searchStockMediaMock.mockResolvedValue({ outcomes: [{ providerId: "pixabay", results: [] }] });
    pickBestStockResultMock.mockReturnValue(null);

    const result = await resolveTimelinePlanAssets(
      { stickers: [{ startMs: 0, endMs: 500, assetQuery: "x" }], music: { searchQuery: "y", duckingEnabled: true }, sfx: [{ atMs: 0, assetQuery: "z" }] },
      CTX
    );

    expect(result.stickers).toHaveLength(1);
    expect(result.sfx).toHaveLength(1);
    expect(result.music).toBeDefined();
  });
});
