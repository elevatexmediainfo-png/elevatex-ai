import { afterEach, describe, expect, it, vi } from "vitest";

import { LottieFilesAdapter } from "./lottiefiles.adapter";

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body, text: async () => JSON.stringify(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LottieFilesAdapter.search", () => {
  it("parses a data[] response shape into StockSearchResult[]", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: "abc123",
            name: "Loading Spinner",
            thumbnailUrl: "https://x/thumb.png",
            jsonUrl: "https://x/animation.json",
            author: { name: "Studio Y" },
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new LottieFilesAdapter({ apiKey: "test-key" });
    const results = await adapter.search("spinner");

    expect(results).toEqual([
      {
        externalId: "abc123",
        title: "Loading Spinner",
        previewUrl: "https://x/thumb.png",
        downloadUrl: "https://x/animation.json",
        kind: "IMAGE",
        attribution: "Studio Y",
      },
    ]);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-key");
  });

  it("skips items with no resolvable download url instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: "no-url", name: "Broken" }] }))
    );
    const adapter = new LottieFilesAdapter({ apiKey: "test-key" });
    const results = await adapter.search("broken");
    expect(results).toEqual([]);
  });

  it("throws on an unexpected top-level response shape rather than fabricating results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ unexpected: true })));
    const adapter = new LottieFilesAdapter({ apiKey: "test-key" });
    await expect(adapter.search("x")).rejects.toThrow(/unexpected response shape/);
  });

  it("throws a clear error when no API key is configured", async () => {
    const adapter = new LottieFilesAdapter({});
    await expect(adapter.search("spinner")).rejects.toThrow(/no API key/);
  });

  it("throws with the response body on a non-ok search response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "bad" }, false)));
    const adapter = new LottieFilesAdapter({ apiKey: "test-key" });
    await expect(adapter.search("x")).rejects.toThrow(/LottieFiles search failed \(500\)/);
  });
});
