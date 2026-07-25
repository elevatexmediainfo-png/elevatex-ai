import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenverseAdapter } from "./openverse.adapter";

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body, text: async () => JSON.stringify(body) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenverseAdapter.search", () => {
  it("parses a real image-search response shape, needs no API key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        result_count: 240,
        page_count: 12,
        page_size: 20,
        page: 1,
        results: [
          {
            id: "c8de3991-dc88-4130-8009-f9da85a4e759",
            title: "test",
            creator: "content_creation",
            license: "by-sa",
            attribution: '"test" by content_creation is licensed under CC BY-SA 2.0.',
            url: "https://live.staticflickr.com/full.jpg",
            thumbnail: "https://api.openverse.org/v1/images/c8de3991/thumb/",
            width: 1024,
            height: 768,
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new OpenverseAdapter({});
    const results = await adapter.search("test");

    expect(results).toEqual([
      {
        externalId: "c8de3991-dc88-4130-8009-f9da85a4e759",
        title: "test",
        previewUrl: "https://api.openverse.org/v1/images/c8de3991/thumb/",
        downloadUrl: "https://live.staticflickr.com/full.jpg",
        kind: "IMAGE",
        attribution: '"test" by content_creation is licensed under CC BY-SA 2.0.',
        attributionRequired: true,
        widthPx: 1024,
        heightPx: 768,
      },
    ]);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("api.openverse.org/v1/images/?q=test");
    // no Authorization header at all — this provider needs no credentials.
    expect(fetchMock.mock.calls[0][1]).toBeUndefined();
  });

  it("parses a real audio-search response shape, converts duration ms -> seconds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        result_count: 240,
        page_count: 240,
        page_size: 1,
        page: 1,
        results: [
          {
            id: "85a1637d-c129-45bd-8083-0270e2103291",
            title: "Guillottine test 02.ogg",
            creator: "Glaneur de sons",
            license: "by",
            attribution: '"Guillottine test 02.ogg" by Glaneur de sons is CC BY 4.0 licensed.',
            url: "https://cdn.freesound.org/previews/30/30187_161750-hq.mp3",
            duration: 5197,
          },
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new OpenverseAdapter({});
    const results = await adapter.search("test", { type: "audio" });

    expect(results[0]).toMatchObject({ kind: "AUDIO", durationSeconds: 5.197, attributionRequired: true });
    expect((fetchMock.mock.calls[0][0] as string)).toContain("api.openverse.org/v1/audio/?q=test");
  });

  it.each(["cc0", "pdm", "CC0", "PDM"])("does NOT require attribution for license %s", async (license) => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ results: [{ id: "x", title: "t", license, url: "https://x/u.jpg" }] })
    );
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new OpenverseAdapter({});
    const results = await adapter.search("x");
    expect(results[0].attributionRequired).toBe(false);
  });

  it.each(["by", "by-sa", "by-nc", "by-nd", "by-nc-sa", "by-nc-nd"])("DOES require attribution for license %s", async (license) => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ results: [{ id: "x", title: "t", license, url: "https://x/u.jpg" }] })
    );
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new OpenverseAdapter({});
    const results = await adapter.search("x");
    expect(results[0].attributionRequired).toBe(true);
  });

  it("defaults to attributionRequired: true when license is missing entirely (safe default)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [{ id: "x", title: "t", url: "https://x/u.jpg" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new OpenverseAdapter({});
    const results = await adapter.search("x");
    expect(results[0].attributionRequired).toBe(true);
  });

  it("returns no results for type: video (no video catalog) without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new OpenverseAdapter({});
    const results = await adapter.search("anything", { type: "video" });
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws with vendor error detail on a non-ok response (no API-key error path — none is needed)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new OpenverseAdapter({});
    await expect(adapter.search("x")).rejects.toThrow(/Openverse search failed \(500\)/);
  });
});

describe("OpenverseAdapter.fetch", () => {
  it("tries the images endpoint first, returns a parsed result on success", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ id: "x", title: "t", license: "cc0", url: "https://x/u.jpg" }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new OpenverseAdapter({});
    const result = await adapter.fetch("x");
    expect(result?.kind).toBe("IMAGE");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the audio endpoint when the image lookup fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce(jsonResponse({ id: "y", title: "t", license: "by", url: "https://x/u.mp3", duration: 1000 }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new OpenverseAdapter({});
    const result = await adapter.fetch("y");
    expect(result?.kind).toBe("AUDIO");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when neither endpoint has the id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new OpenverseAdapter({});
    const result = await adapter.fetch("nonexistent");
    expect(result).toBeNull();
  });
});
