import { afterEach, describe, expect, it, vi } from "vitest";

import { UnsplashAdapter } from "./unsplash.adapter";

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body, text: async () => JSON.stringify(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UnsplashAdapter.search", () => {
  it("parses a real search-photos response shape, always attributionRequired (real API Terms, not the general license)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        results: [
          {
            id: "c8de3991",
            description: null,
            alt_description: "a mountain range at sunset",
            width: 1024,
            height: 768,
            urls: { regular: "https://images.unsplash.com/photo-x?w=1080", small: "https://images.unsplash.com/photo-x?w=400" },
            user: { name: "Jane Doe" },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new UnsplashAdapter({ apiKey: "test-key" });
    const results = await adapter.search("mountains");

    expect(results).toEqual([
      {
        externalId: "c8de3991",
        title: "a mountain range at sunset",
        previewUrl: "https://images.unsplash.com/photo-x?w=400",
        downloadUrl: "https://images.unsplash.com/photo-x?w=1080",
        kind: "IMAGE",
        attribution: "Jane Doe",
        attributionRequired: true,
        widthPx: 1024,
        heightPx: 768,
      },
    ]);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("api.unsplash.com/search/photos?query=mountains");
    expect((calledInit.headers as Record<string, string>).Authorization).toBe("Client-ID test-key");
  });

  it("falls back to a generated title when description/alt_description are both absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        results: [
          { id: "x", description: null, alt_description: null, width: 100, height: 100, urls: { regular: "https://x/r", small: "https://x/s" }, user: { name: "Someone" } },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new UnsplashAdapter({ apiKey: "test-key" });
    const results = await adapter.search("x");
    expect(results[0].title).toBe("Photo by Someone");
  });

  it("clamps per_page to Unsplash's documented max of 30", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new UnsplashAdapter({ apiKey: "test-key" });
    await adapter.search("x", { perPage: 500 });
    expect((fetchMock.mock.calls[0][0] as string)).toContain("per_page=30");
  });

  it("returns no results for type: video (no video/audio catalog) without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new UnsplashAdapter({ apiKey: "test-key" });
    const results = await adapter.search("anything", { type: "video" });
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a clear error when no API key is configured", async () => {
    const adapter = new UnsplashAdapter({});
    await expect(adapter.search("mountains")).rejects.toThrow(/no API key/);
  });

  it("throws with vendor error detail on a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ errors: ["Invalid access token"] }, false));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new UnsplashAdapter({ apiKey: "bad-key" });
    await expect(adapter.search("mountains")).rejects.toThrow(/Unsplash search failed \(500\)/);
  });
});

describe("UnsplashAdapter.fetch", () => {
  it("resolves a single photo by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: "c8de3991", description: "a photo", alt_description: null, width: 10, height: 10, urls: { regular: "https://x/r", small: "https://x/s" }, user: { name: "Jane" } })
    );
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new UnsplashAdapter({ apiKey: "test-key" });
    const result = await adapter.fetch("c8de3991");
    expect(result?.externalId).toBe("c8de3991");
    expect((fetchMock.mock.calls[0][0] as string)).toBe("https://api.unsplash.com/photos/c8de3991");
  });

  it("returns null on a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new UnsplashAdapter({ apiKey: "test-key" });
    const result = await adapter.fetch("nonexistent");
    expect(result).toBeNull();
  });
});
