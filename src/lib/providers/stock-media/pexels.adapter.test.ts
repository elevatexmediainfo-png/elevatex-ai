import { afterEach, describe, expect, it, vi } from "vitest";

import { PexelsAdapter } from "./pexels.adapter";

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body, text: async () => JSON.stringify(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PexelsAdapter.search", () => {
  it("parses a real photo-search response shape into StockSearchResult[]", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        photos: [
          {
            id: 123,
            width: 1920,
            height: 1280,
            photographer: "Jane Doe",
            alt: "A mountain lake",
            src: { original: "https://x/orig.jpg", large: "https://x/large.jpg", medium: "https://x/medium.jpg" },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new PexelsAdapter({ apiKey: "test-key" });
    const results = await adapter.search("mountain", { type: "image" });

    expect(results).toEqual([
      {
        externalId: "123",
        title: "A mountain lake",
        previewUrl: "https://x/medium.jpg",
        downloadUrl: "https://x/large.jpg",
        kind: "IMAGE",
        attribution: "Jane Doe",
        widthPx: 1920,
        heightPx: 1280,
      },
    ]);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("api.pexels.com/v1/search");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("test-key");
  });

  it("parses a real video-search response shape and picks the hd file", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        videos: [
          {
            id: 456,
            width: 1920,
            height: 1080,
            duration: 12,
            image: "https://x/thumb.jpg",
            user: { name: "Studio X" },
            video_files: [
              { link: "https://x/sd.mp4", quality: "sd", width: 640, height: 360 },
              { link: "https://x/hd.mp4", quality: "hd", width: 1920, height: 1080 },
            ],
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new PexelsAdapter({ apiKey: "test-key" });
    const results = await adapter.search("studio", { type: "video" });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ externalId: "456", downloadUrl: "https://x/hd.mp4", kind: "VIDEO", durationSeconds: 12 });
    expect((fetchMock.mock.calls[0][0] as string)).toContain("api.pexels.com/videos/search");
  });

  it("returns no results for type: audio (Pexels has no audio catalog) without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new PexelsAdapter({ apiKey: "test-key" });
    const results = await adapter.search("anything", { type: "audio" });
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a clear error when no API key is configured", async () => {
    const adapter = new PexelsAdapter({});
    await expect(adapter.search("mountain")).rejects.toThrow(/no API key/);
  });

  it("throws with the response body on a non-ok search response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "invalid key" }, false)));
    const adapter = new PexelsAdapter({ apiKey: "bad-key" });
    await expect(adapter.search("mountain")).rejects.toThrow(/Pexels search failed \(500\)/);
  });
});
