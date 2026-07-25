import { afterEach, describe, expect, it, vi } from "vitest";

import { PixabayAdapter } from "./pixabay.adapter";

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body, text: async () => JSON.stringify(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PixabayAdapter.search", () => {
  it("parses a real image-search response shape into StockSearchResult[]", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        hits: [
          {
            id: 789,
            tags: "forest, trees, nature",
            user: "photographer1",
            previewURL: "https://x/preview.jpg",
            largeImageURL: "https://x/large.jpg",
            imageWidth: 4000,
            imageHeight: 3000,
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new PixabayAdapter({ apiKey: "test-key" });
    const results = await adapter.search("forest", { type: "image" });

    expect(results).toEqual([
      {
        externalId: "789",
        title: "forest, trees, nature",
        previewUrl: "https://x/preview.jpg",
        downloadUrl: "https://x/large.jpg",
        kind: "IMAGE",
        attribution: "photographer1",
        widthPx: 4000,
        heightPx: 3000,
      },
    ]);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("pixabay.com/api/?");
    expect(calledUrl).toContain("key=test-key");
  });

  it("parses a real video-search response shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        hits: [
          {
            id: 321,
            tags: "ocean, waves",
            user: "videographer1",
            duration: 20,
            videos: {
              large: { url: "https://x/large.mp4", width: 1920, height: 1080 },
              medium: { url: "https://x/medium.mp4", width: 1280, height: 720 },
            },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new PixabayAdapter({ apiKey: "test-key" });
    const results = await adapter.search("ocean", { type: "video" });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ externalId: "321", downloadUrl: "https://x/large.mp4", kind: "VIDEO", durationSeconds: 20 });
    expect((fetchMock.mock.calls[0][0] as string)).toContain("pixabay.com/api/videos/");
  });

  it("enforces Pixabay's per_page >= 3 minimum", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ hits: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new PixabayAdapter({ apiKey: "test-key" });
    await adapter.search("x", { perPage: 1 });
    expect((fetchMock.mock.calls[0][0] as string)).toContain("per_page=3");
  });

  it("returns no results for type: audio (undocumented endpoint) without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new PixabayAdapter({ apiKey: "test-key" });
    const results = await adapter.search("anything", { type: "audio" });
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a clear error when no API key is configured", async () => {
    const adapter = new PixabayAdapter({});
    await expect(adapter.search("forest")).rejects.toThrow(/no API key/);
  });
});
