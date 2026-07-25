import { afterEach, describe, expect, it, vi } from "vitest";

import { CoverrAdapter } from "./coverr.adapter";

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body, text: async () => JSON.stringify(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CoverrAdapter.search", () => {
  it("parses a real video-search response shape into StockSearchResult[], always attributionRequired", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        page: 0,
        pages: 50,
        page_size: 20,
        total: 3602,
        hits: [
          {
            id: "S1YbPl1NfI",
            title: "Cutting Wood Building Material With a Circular Electric Saw",
            thumbnail: "https://storage.coverr.co/t/abc",
            poster: "https://storage.coverr.co/p/abc",
            duration: 11.625,
            max_width: 2048,
            max_height: 1152,
            urls: {
              mp4: "https://storage.coverr.co/videos/abc",
              mp4_preview: "https://storage.coverr.co/videos/abc/preview",
              mp4_download: "https://storage.coverr.co/videos/abc/download",
            },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new CoverrAdapter({ apiKey: "test-key" });
    const results = await adapter.search("wood", { type: "video" });

    expect(results).toEqual([
      {
        externalId: "S1YbPl1NfI",
        title: "Cutting Wood Building Material With a Circular Electric Saw",
        previewUrl: "https://storage.coverr.co/t/abc",
        downloadUrl: "https://storage.coverr.co/videos/abc/download",
        kind: "VIDEO",
        attribution: "Coverr",
        attributionRequired: true,
        widthPx: 2048,
        heightPx: 1152,
        durationSeconds: 11.625,
      },
    ]);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain("api.coverr.co/videos?");
    expect(calledUrl).toContain("urls=true");
    expect((calledInit.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
  });

  // Real incident (2026-07-21) — Coverr's actual API returns `duration` as
  // a numeric-looking STRING despite CoverrVideoHit's own type declaring
  // `number`; the previous unconverted passthrough reached
  // prisma.editorAsset.create() as a string and threw "Expected Float or
  // Null, provided String" on every real b-roll resolution.
  it("coerces a string duration from the real API response into a real number", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        page: 0,
        pages: 1,
        page_size: 20,
        total: 1,
        hits: [
          {
            id: "abc123",
            title: "Man in suit climbing down a ladder",
            thumbnail: "https://storage.coverr.co/t/xyz",
            poster: "https://storage.coverr.co/p/xyz",
            duration: "21.666667",
            max_width: 3840,
            max_height: 2160,
            urls: { mp4_download: "https://storage.coverr.co/videos/xyz/download" },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new CoverrAdapter({ apiKey: "test-key" });
    const results = await adapter.search("man in suit", { type: "video" });

    expect(results[0].durationSeconds).toBe(21.666667);
    expect(typeof results[0].durationSeconds).toBe("number");
  });

  it("parses a real audio-search response shape (music)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        page: 0,
        pages: 1,
        page_size: 20,
        total: 1,
        hits: [
          {
            id: "gpIAc9b7pk",
            title: "Zero Gravity",
            duration: 85.26,
            urls: { preview: "https://storage.coverr.co/a/preview", previewDownload: "", masterDownload: "https://storage.coverr.co/a/master" },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new CoverrAdapter({ apiKey: "test-key" });
    const results = await adapter.search("ambient", { type: "audio" });

    expect(results).toEqual([
      {
        externalId: "gpIAc9b7pk",
        title: "Zero Gravity",
        previewUrl: "https://storage.coverr.co/a/preview",
        downloadUrl: "https://storage.coverr.co/a/master",
        kind: "AUDIO",
        attribution: "Coverr",
        attributionRequired: true,
        durationSeconds: 85.26,
      },
    ]);
    expect((fetchMock.mock.calls[0][0] as string)).toContain("api.coverr.co/audios?");
  });

  it("converts 1-indexed page to Coverr's 0-indexed convention", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ hits: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new CoverrAdapter({ apiKey: "test-key" });
    await adapter.search("x", { page: 3 });
    expect((fetchMock.mock.calls[0][0] as string)).toContain("page=2");
  });

  it("returns no results for type: image (no image catalog) without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new CoverrAdapter({ apiKey: "test-key" });
    const results = await adapter.search("anything", { type: "image" });
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops a video hit whose urls block has no usable download link, rather than returning a broken result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ hits: [{ id: "x", title: "t", thumbnail: "https://x/t.jpg", poster: "https://x/p.jpg", duration: 5, max_width: 100, max_height: 100 }] })
    );
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new CoverrAdapter({ apiKey: "test-key" });
    const results = await adapter.search("x");
    expect(results).toEqual([]);
  });

  it("throws a clear error when no API key is configured", async () => {
    const adapter = new CoverrAdapter({});
    await expect(adapter.search("wood")).rejects.toThrow(/no API key/);
  });

  it("throws with vendor error detail on a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "rate limited" }, false));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new CoverrAdapter({ apiKey: "test-key" });
    await expect(adapter.search("wood")).rejects.toThrow(/Coverr search failed \(500\)/);
  });
});

describe("CoverrAdapter.fetch", () => {
  it("tries the video endpoint first, returns a parsed result on success", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ id: "S1YbPl1NfI", title: "t", thumbnail: "https://x/t.jpg", poster: "https://x/p.jpg", duration: 5, max_width: 100, max_height: 100, urls: { mp4_download: "https://x/d.mp4" } })
    );
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new CoverrAdapter({ apiKey: "test-key" });
    const result = await adapter.fetch("S1YbPl1NfI");
    expect(result?.kind).toBe("VIDEO");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the audio endpoint when the video lookup fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce(jsonResponse({ id: "gpIAc9b7pk", title: "t", duration: 5, urls: { masterDownload: "https://x/m.mp3" } }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new CoverrAdapter({ apiKey: "test-key" });
    const result = await adapter.fetch("gpIAc9b7pk");
    expect(result?.kind).toBe("AUDIO");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when neither endpoint has the id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new CoverrAdapter({ apiKey: "test-key" });
    const result = await adapter.fetch("nonexistent");
    expect(result).toBeNull();
  });
});
