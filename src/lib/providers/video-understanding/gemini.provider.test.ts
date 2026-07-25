import { afterEach, describe, expect, it, vi } from "vitest";

import { GeminiVideoUnderstandingProvider } from "./gemini.provider";

// Phase 12 Module 10 — this adapter had no test coverage at all before
// this file. Scoped narrowly to the one thing Module 10 actually changed:
// real usage.tokens extraction from Gemini's usageMetadata (previously a
// hardcoded { seconds: 0 } placeholder that could never produce a real
// cost regardless of the configured rate — see this provider's own doc
// comment on `usage` in types.ts). NOT a full behavioral test of the
// upload/poll/analyze flow — a live vendor call was blocked this session
// by the real Gemini account's prepaid credits being depleted (429
// RESOURCE_EXHAUSTED, confirmed via server logs, an external account
// state this test can't and shouldn't try to reproduce), so this proves
// the extraction logic mechanically instead: given a realistic response
// shape, does the provider report the real token count.

function jsonResponse(body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? headers[name] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
    arrayBuffer: async () => new ArrayBuffer(8),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GeminiVideoUnderstandingProvider.analyze", () => {
  it("throws a clear error when no API key is configured", async () => {
    const provider = new GeminiVideoUnderstandingProvider({});
    await expect(provider.analyze({ videoUrl: "https://cdn.test/video.mp4" })).rejects.toThrow(/no API key/);
  });

  it("reports real usage.tokens from Gemini's usageMetadata.totalTokenCount, not a hardcoded 0", async () => {
    const fetchMock = vi
      .fn()
      // 1. download the source video
      .mockResolvedValueOnce(jsonResponse({}, { "content-type": "video/mp4" }))
      // 2. start resumable upload — file comes back ACTIVE, so no polling needed
      .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: (n: string) => (n === "x-goog-upload-url" ? "https://upload.test/session" : null) }, text: async () => "" })
      // 3. PUT the bytes, finalize
      .mockResolvedValueOnce(jsonResponse({ file: { name: "files/abc123", uri: "https://files.test/abc123", mimeType: "video/mp4", state: "ACTIVE" } }))
      // 4. analyze — the real vendor payload shape includes usageMetadata alongside candidates
      .mockResolvedValueOnce(
        jsonResponse({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({ emphasisMoments: [], emotionBeats: [], visualContext: [], gestures: [], flaggedSegments: [] }),
                  },
                ],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 1800, candidatesTokenCount: 240, totalTokenCount: 2040 },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeminiVideoUnderstandingProvider({ apiKey: "test-key" });
    const result = await provider.analyze({ videoUrl: "https://cdn.test/video.mp4" });

    expect(result.usage).toEqual({ tokens: 2040 });
  });

  it("reports usage.tokens as undefined (not a fabricated 0) when the vendor response has no usageMetadata", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, { "content-type": "video/mp4" }))
      .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: (n: string) => (n === "x-goog-upload-url" ? "https://upload.test/session" : null) }, text: async () => "" })
      .mockResolvedValueOnce(jsonResponse({ file: { name: "files/abc123", uri: "https://files.test/abc123", mimeType: "video/mp4", state: "ACTIVE" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ emphasisMoments: [], emotionBeats: [], visualContext: [], gestures: [], flaggedSegments: [] }) }] } }],
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeminiVideoUnderstandingProvider({ apiKey: "test-key" });
    const result = await provider.analyze({ videoUrl: "https://cdn.test/video.mp4" });

    expect(result.usage).toEqual({ tokens: undefined });
  });
});
