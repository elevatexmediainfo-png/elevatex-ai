import { afterEach, describe, expect, it, vi } from "vitest";

import { IconScoutAdapter } from "./iconscout.adapter";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("IconScoutAdapter.search", () => {
  it("parses a Laravel-style paginated icon response into StockSearchResult[]", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: true,
        data: {
          items: {
            current_page: 1,
            per_page: 20,
            total: 1,
            data: [
              {
                id: 12345,
                name: "Home icon",
                urls: { thumb: "https://x/thumb.png", png_512: "https://x/full.png" },
                owner: { name: "Design Studio" },
              },
            ],
          },
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new IconScoutAdapter({ apiKey: "test-client-id" });
    const results = await adapter.search("home", { type: "icon" });

    expect(results).toEqual([
      {
        externalId: "12345",
        title: "Home icon",
        previewUrl: "https://x/thumb.png",
        downloadUrl: "https://x/full.png",
        kind: "ICON",
        attribution: "Design Studio",
      },
    ]);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("api.iconscout.com/v3/search");
    expect(calledUrl).toContain("asset=icon");
    expect(fetchMock.mock.calls[0][1].headers["Client-ID"]).toBe("test-client-id");
  });

  it("requests asset=lottie and tags results as ANIMATION when type: animation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: { items: { data: [{ id: "lottie-1", name: "Loading spinner", urls: { lottie_link: "https://x/anim.json", thumb: "https://x/anim-thumb.gif" } }] } },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new IconScoutAdapter({ apiKey: "test-client-id" });
    const results = await adapter.search("spinner", { type: "animation" });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: "ANIMATION", downloadUrl: "https://x/anim.json" });
    expect((fetchMock.mock.calls[0][0] as string)).toContain("asset=lottie");
  });

  it("falls back through candidate field names when 'urls' is absent (defensive parsing)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { items: { data: [{ id: 1, title: "Fallback icon", thumb: "https://x/t.png", download_url: "https://x/d.png" }] } } })
    );
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new IconScoutAdapter({ apiKey: "test-client-id" });
    const results = await adapter.search("x");
    expect(results[0]).toMatchObject({ previewUrl: "https://x/t.png", downloadUrl: "https://x/d.png", title: "Fallback icon" });
  });

  it("throws a clear error for an item with no resolvable preview/download url in any known field", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: { items: { data: [{ id: 99, name: "Broken" }] } } })));
    const adapter = new IconScoutAdapter({ apiKey: "test-client-id" });
    await expect(adapter.search("x")).rejects.toThrow(/no resolvable preview\/download URL/);
  });

  it("throws on an unexpected top-level response shape rather than fabricating results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ unexpected: true })));
    const adapter = new IconScoutAdapter({ apiKey: "test-client-id" });
    await expect(adapter.search("x")).rejects.toThrow(/unexpected response shape/);
  });

  it("throws a clear error when no Client-ID is configured, without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new IconScoutAdapter({});
    await expect(adapter.search("home")).rejects.toThrow(/no Client-ID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws with the response body on a non-ok search response (mirrors IconScout's real error shape)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Client-ID is missing.", status_code: 500 }, false, 500)));
    const adapter = new IconScoutAdapter({ apiKey: "bad-id" });
    await expect(adapter.search("home")).rejects.toThrow(/IconScout search failed \(500\)/);
  });
});

describe("IconScoutAdapter.fetch", () => {
  it("resolves a single item by id via /v3/items/{id}", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { id: 555, name: "Star icon", urls: { thumb: "https://x/star-thumb.png", svg: "https://x/star.svg" } } })
    );
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new IconScoutAdapter({ apiKey: "test-client-id" });
    const result = await adapter.fetch("555");
    expect(result).toMatchObject({ externalId: "555", title: "Star icon", downloadUrl: "https://x/star.svg", kind: "ICON" });
    expect((fetchMock.mock.calls[0][0] as string)).toContain("api.iconscout.com/v3/items/555");
  });

  it("returns null for a non-ok response instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false, 404)));
    const adapter = new IconScoutAdapter({ apiKey: "test-client-id" });
    const result = await adapter.fetch("missing-id");
    expect(result).toBeNull();
  });
});
