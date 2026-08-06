import { afterEach, describe, expect, it, vi } from "vitest";

import { GPT5ReasoningProvider, resolveCaptionTiming } from "./gpt5.provider";
import type { ReasoningPlanRequest, ReasoningReeditRequest } from "./types";

function chatResponse(content: string, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => ({ id: "chatcmpl-test", choices: [{ message: { content } }], usage: { total_tokens: 42 } }),
    text: async () => content,
  };
}

const BASE_REQUEST: ReasoningPlanRequest = {
  words: [
    { word: "Hello", startMs: 0, endMs: 300 },
    { word: "world", startMs: 300, endMs: 600 },
  ],
  videoAnalysis: null,
  sourceDurationMs: 5000,
  survivingSegmentCount: 1,
};

const VALID_JSON = JSON.stringify({
  captions: [{ text: "Hello world", sourceWordStartIndex: 0, sourceWordEndIndex: 1 }],
  zoom: [],
  broll: [],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GPT5ReasoningProvider.plan", () => {
  it("throws a clear error when no API key is configured", async () => {
    const provider = new GPT5ReasoningProvider({});
    await expect(provider.plan(BASE_REQUEST)).rejects.toThrow(/no API key/);
  });

  it("returns validated captions/zoom on a well-formed first response (happy path, 1 call)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    const result = await provider.plan(BASE_REQUEST);

    // Fix (2026-08-06, FIX 5) — captions now always end in real terminal
    // punctuation ("Hello world" -> "Hello world.").
    expect(result.captions).toEqual([{ text: "Hello world.", startMs: 0, endMs: 600 }]);
    expect(result.zoom).toEqual([]);
    expect(result.providerRef).toBe("chatcmpl-test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Real incident (2026-07-22) — a live run found GPT-5 estimating caption
  // startMs/endMs directly produces boundaries that don't land on the real
  // transcript's own word timestamps (confirmed even with zero style-preset
  // involvement — not a Hinglish-specific defect). Fix: the model cites
  // WHICH numbered transcript words a caption spans; the app computes the
  // real ms values, never trusting a model-estimated timestamp.
  it("derives caption startMs/endMs from the real transcript word timestamps at the cited indices, not any value the model might imply", async () => {
    const words = [
      { word: "one", startMs: 0, endMs: 100 },
      { word: "two", startMs: 100, endMs: 250 },
      { word: "three", startMs: 250, endMs: 900 }, // deliberately uneven gaps
      { word: "four", startMs: 900, endMs: 950 },
    ];
    const withMultipleCaptions = JSON.stringify({
      captions: [
        { text: "one two", sourceWordStartIndex: 0, sourceWordEndIndex: 1 },
        { text: "three four", sourceWordStartIndex: 2, sourceWordEndIndex: 3 },
      ],
      zoom: [],
      broll: [],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(chatResponse(withMultipleCaptions)));

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    const result = await provider.plan({ ...BASE_REQUEST, words });

    // Fix (2026-08-06, FIX 5) — proper terminal punctuation added.
    expect(result.captions).toEqual([
      { text: "one two.", startMs: 0, endMs: 250 },
      { text: "three four.", startMs: 250, endMs: 950 },
    ]);
  });

  // Rephrasing (Hinglish or otherwise) must never change which real words a
  // caption's timing is anchored to — the index citation is the ONLY thing
  // that determines timing, regardless of what the displayed text says.
  it("keeps real transcript-word timing even when the caption text is a rephrased/translated version of those words", async () => {
    const words = [
      { word: "क्या", startMs: 0, endMs: 260 },
      { word: "आप", startMs: 260, endMs: 360 },
    ];
    const hinglishResponse = JSON.stringify({
      captions: [{ text: "Kya aap", sourceWordStartIndex: 0, sourceWordEndIndex: 1, style: { fontWeight: 800 } }],
      zoom: [],
      broll: [],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(chatResponse(hinglishResponse)));

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    const result = await provider.plan({ ...BASE_REQUEST, words, stylePreset: "bold punchy hinglish energetic" });

    // Fix (2026-08-06, FIX 5) — proper terminal punctuation added.
    expect(result.captions).toEqual([{ text: "Kya aap.", startMs: 0, endMs: 360, style: { fontWeight: 800 } }]);
  });

  it("clamps an out-of-range word-index citation rather than crashing the job", async () => {
    const words = [{ word: "only", startMs: 0, endMs: 500 }];
    const outOfRange = JSON.stringify({
      captions: [{ text: "only", sourceWordStartIndex: 0, sourceWordEndIndex: 7 }],
      zoom: [],
      broll: [],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(chatResponse(outOfRange)));

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    const result = await provider.plan({ ...BASE_REQUEST, words });

    // Fix (2026-08-06, FIX 5) — proper terminal punctuation added.
    expect(result.captions).toEqual([{ text: "only.", startMs: 0, endMs: 500 }]);
  });

  // Fix (2026-08-06) — real production incident: OpenAI rejects any
  // custom `temperature` for reasoning-tier models (o-series, gpt-5
  // family) with a 400 "Unsupported value: 'temperature'." This adapter's
  // DEFAULT_MODEL is "gpt-5" — the exact model this incident was reported
  // against — so the request body must never include a temperature field
  // for the default configuration.
  it("omits `temperature` entirely for the default gpt-5 model (real incident: OpenAI rejects any non-default value for reasoning-tier models)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await provider.plan(BASE_REQUEST);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("gpt-5");
    expect("temperature" in body).toBe(false);
  });

  it("still sends a custom `temperature` for a non-reasoning model (e.g. a hypothetical gpt-4o override) — preserved, not dropped for every model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key", model: "gpt-4o-mini" });
    await provider.plan(BASE_REQUEST);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.temperature).toBe(0.4);
  });

  it("numbers the transcript word list and instructs the model to cite word indices, not estimate milliseconds, for captions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await provider.plan(BASE_REQUEST);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMessage).toContain("0:Hello@0-300 1:world@300-600");
    expect(userMessage).toContain("sourceWordStartIndex");
    expect(userMessage).toContain("sourceWordEndIndex");
    expect(userMessage).toContain("do NOT produce startMs/endMs yourself");
  });

  it("repairs a malformed response: retries once with the validation error fed back, succeeds on the second attempt", async () => {
    // First response: zoom item is missing scaleTo (fails reasoningZoomItemSchema) — a
    // deliberately malformed LLM response, exactly the case the founder asked to be tested.
    const malformed = JSON.stringify({
      captions: [{ text: "Hello world", sourceWordStartIndex: 0, sourceWordEndIndex: 1 }],
      zoom: [{ startMs: 0, endMs: 600, scaleFrom: 100 }],
      broll: [],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(chatResponse(malformed))
      .mockResolvedValueOnce(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    const result = await provider.plan(BASE_REQUEST);

    // Fix (2026-08-06, FIX 5) — proper terminal punctuation added.
    expect(result.captions).toEqual([{ text: "Hello world.", startMs: 0, endMs: 600 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // The repair call must include the model's own bad output plus a
    // message describing what was wrong with it — the actual "feed the
    // validation error back" repair-prompt mechanism, not just a blind retry.
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const messages = secondCallBody.messages as { role: string; content: string }[];
    expect(messages.some((m) => m.role === "assistant" && m.content === malformed)).toBe(true);
    const repairMessage = messages.find((m) => m.role === "user" && m.content.includes("failed schema validation"));
    expect(repairMessage).toBeDefined();
    expect(repairMessage!.content).toMatch(/scaleTo/);
  });

  it("repairs invalid JSON (not just schema mismatches) the same way", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(chatResponse("this is not JSON at all"))
      .mockResolvedValueOnce(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    const result = await provider.plan(BASE_REQUEST);

    expect(result.captions).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const messages = secondCallBody.messages as { role: string; content: string }[];
    expect(messages.some((m) => m.role === "user" && m.content.includes("not valid JSON"))).toBe(true);
  });

  // Fix (2026-08-06, FIX 2) — this used to assert the WHOLE plan() call
  // rejected when just ONE caption item was malformed, per the founder's
  // original "surface a clear failure, don't silently apply malformed
  // data" instruction. That instruction is still honored (nothing invalid
  // is ever applied, and the drop is surfaced via `warnings`) but the
  // production incident this fix addresses was the OTHER half of that
  // same behavior: one bad item was ALSO wiping out the other, perfectly
  // valid sections (zoom/broll here, and captions/broll/etc. in general).
  // Renamed and rewritten to assert the new, correct behavior: the bad
  // item is dropped, everything else that validated is kept, and the drop
  // is still visible via `warnings` — never silent. Also demonstrates FIX
  // 5's "never return empty captions": since the model's own caption
  // proposal was dropped but real transcript words exist (BASE_REQUEST's
  // "Hello"/"world"), the result falls back to those real words rather
  // than an empty array.
  it("drops an invalid item (not the whole plan) when the repair attempt ALSO still has it wrong, surfacing the drop via warnings, and falls back to real transcript words for captions", async () => {
    const stillMalformed = JSON.stringify({ captions: [{ text: "", sourceWordStartIndex: 0, sourceWordEndIndex: 1 }], zoom: [], broll: [] }); // empty text fails min(1)
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(stillMalformed));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    const result = await provider.plan(BASE_REQUEST);

    // The model's own (invalid, empty-text) proposal was dropped — but
    // real transcript words exist, so this is never a silent empty array.
    expect(result.captions).toEqual([{ text: "Hello world.", startMs: 0, endMs: 600 }]);
    expect(result.zoom).toEqual([]);
    expect(result.broll).toEqual([]);
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w) => w.includes("captions[0]"))).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2); // original + exactly 1 repair attempt, still surfaced, never silently retried forever
  });

  it("respects repairMaxAttempts: 0 (disables repair) — still returns whatever validated (falling back to real words for captions), with a warning for what didn't", async () => {
    const malformed = JSON.stringify({ captions: [{ text: "", sourceWordStartIndex: 0, sourceWordEndIndex: 1 }], zoom: [], broll: [] });
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(malformed));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    const result = await provider.plan({ ...BASE_REQUEST, repairMaxAttempts: 0 });

    expect(result.captions).toEqual([{ text: "Hello world.", startMs: 0, endMs: 600 }]);
    expect(result.warnings).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a valid section (captions) when a DIFFERENT section (broll) is invalid, instead of blanking everything — the exact production bug this fix addresses", async () => {
    const partiallyBad = JSON.stringify({
      captions: [{ text: "Hello world", sourceWordStartIndex: 0, sourceWordEndIndex: 1 }],
      zoom: [],
      broll: [{ startMs: 0, endMs: 1000, trackHint: "broll", source: "stock" }], // missing searchQuery — fails aiBrollSchema's refine
    });
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(partiallyBad));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    const result = await provider.plan({ ...BASE_REQUEST, repairMaxAttempts: 0 });

    expect(result.captions).toEqual([{ text: "Hello world.", startMs: 0, endMs: 600 }]);
    expect(result.broll).toEqual([]);
    expect(result.warnings?.some((w) => w.includes("broll[0]") && w.includes("searchQuery"))).toBe(true);
  });

  it("throws with the response body on a non-ok HTTP response, no repair attempted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse("server error", false));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await expect(provider.plan(BASE_REQUEST)).rejects.toThrow(/GPT-5 reasoning request failed \(500\)/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes videoAnalysis emphasis moments through to the prompt when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await provider.plan({
      ...BASE_REQUEST,
      videoAnalysis: {
        emphasisMoments: [{ startMs: 100, endMs: 200, description: "leans in" }],
        emotionBeats: [],
        visualContext: [],
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMessage).toContain("leans in");
  });

  // Phase 12 Module 8 — a pasted reference script is extra context ONLY,
  // never a timing source; the prompt must both include the script text
  // AND instruct the model to keep using the real transcript's own word
  // timestamps.
  it("includes a reference script in the prompt when provided, with the 'never a timing source' instruction", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await provider.plan({ ...BASE_REQUEST, referenceScript: "Welcome to Acme Rocket, the app that changes everything." });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMessage).toContain("Welcome to Acme Rocket, the app that changes everything.");
    expect(userMessage).toContain("CORRECT obvious mis-transcribed words in caption TEXT ONLY");
    expect(userMessage).toContain("never change a caption's sourceWordStartIndex/sourceWordEndIndex based on the script");
  });

  it("omits the reference-script section entirely when no script was provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await provider.plan(BASE_REQUEST);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMessage).not.toContain("Reference script");
    expect(userMessage).not.toContain("CORRECT obvious mis-transcribed words");
  });

  // Phase 12 Module 5 — TASK 3's own broll proposals, validated through
  // the SAME reasoningPlanOutputSchema/aiBrollSchema as captions/zoom.
  it("returns a valid stock broll proposal (source:\"stock\" with a searchQuery)", async () => {
    const withBroll = JSON.stringify({
      captions: [],
      zoom: [],
      broll: [{ startMs: 1000, endMs: 3000, trackHint: "broll", source: "stock", searchQuery: "typing on a laptop" }],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(chatResponse(withBroll)));

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    const result = await provider.plan(BASE_REQUEST);

    expect(result.broll).toEqual([{ startMs: 1000, endMs: 3000, trackHint: "broll", source: "stock", searchQuery: "typing on a laptop" }]);
  });

  it("returns stickers, music/SFX, and transitions in the same reasoning payload", async () => {
    const withExtras = JSON.stringify({
      captions: [],
      zoom: [],
      broll: [],
      stickers: [{ startMs: 2000, endMs: 4000, assetQuery: "sparkles" }],
      music: { searchQuery: "cinematic upbeat", duckingEnabled: true, duckingVoiceTrackHint: "voice" },
      sfx: [{ atMs: 1500, assetQuery: "whoosh" }],
      transitions: [{ betweenClipIds: ["clip-a", "clip-b"], type: "CROSSFADE", durationMs: 500 }],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(chatResponse(withExtras)));

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    const result = await provider.plan(BASE_REQUEST);

    expect(result.stickers).toEqual([{ startMs: 2000, endMs: 4000, assetQuery: "sparkles" }]);
    expect(result.music).toEqual({ searchQuery: "cinematic upbeat", duckingEnabled: true, duckingVoiceTrackHint: "voice" });
    expect(result.sfx).toEqual([{ atMs: 1500, assetQuery: "whoosh" }]);
    expect(result.transitions).toEqual([{ betweenClipIds: ["clip-a", "clip-b"], type: "CROSSFADE", durationMs: 500 }]);
  });

  // Fix (2026-08-06, FIX 4 — "important nouns, locations, products,
  // actions, people, brands automatically generate stock search queries").
  it("instructs TASK 3 to scan for the six named categories of concrete, visualizable mentions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await provider.plan(BASE_REQUEST);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMessage).toContain("Important NOUNS");
    expect(userMessage).toContain("LOCATIONS");
    expect(userMessage).toContain("PRODUCTS");
    expect(userMessage).toContain("ACTIONS");
    expect(userMessage).toContain("PEOPLE");
    expect(userMessage).toContain("BRANDS");
    expect(userMessage).toContain("a stock library almost never carries real licensed footage of a named brand");
  });

  it("strengthens the b-roll stock-vs-generate bias in TASK 3's prompt (real cost, generate as last resort)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await provider.plan(BASE_REQUEST);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user").content as string;
    // Explicitly widens what counts as "stock" to specific-sounding but
    // still real-world/photographable combinations, not just plain
    // everyday objects.
    expect(userMessage).toContain("even when fairly specific in COMBINATION");
    // Names the real cost tradeoff directly, rather than only implying it
    // via "fast/free" adjectives.
    expect(userMessage).toContain("real money is spent per generated item, stock costs nothing");
    expect(userMessage).toContain("rare last resort, never a coin-flip default");
    expect(userMessage).toContain('ALWAYS choose "stock"');
  });

  it("adds a POLICY OVERRIDE to TASK 3's prompt when brollStockOnly is true, mandating stock over generation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await provider.plan({ ...BASE_REQUEST, brollStockOnly: true });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMessage).toContain("POLICY OVERRIDE");
    expect(userMessage).toContain('generation is disabled right now');
    expect(userMessage).toContain('"source": "stock"');
  });

  it("omits the POLICY OVERRIDE from TASK 3's prompt when brollStockOnly is false/undefined (unchanged default behavior)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await provider.plan(BASE_REQUEST);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMessage).not.toContain("POLICY OVERRIDE");
  });

  it("includes TASK 4/5/6 instructions (stickers, music/sfx, transitions) in the prompt sent to the model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await provider.plan(BASE_REQUEST);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMessage).toContain("TASK 4");
    expect(userMessage).toContain("TASK 5");
    expect(userMessage).toContain("TASK 6");
    expect(userMessage).toMatch(/assetQuery/);
    expect(userMessage).toMatch(/duckingEnabled/);
    expect(userMessage).toContain("__scene_segment_N__");
  });

  it("tells the model there are NO internal boundaries (propose zero transitions) when only 1 segment survives", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await provider.plan({ ...BASE_REQUEST, survivingSegmentCount: 1 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMessage).toContain("NO internal boundaries");
    expect(userMessage).toContain("Propose zero transitions");
  });

  it("tells the model the valid boundary index range when multiple segments survive", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await provider.plan({ ...BASE_REQUEST, survivingSegmentCount: 4 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMessage).toContain("4 surviving segments");
    expect(userMessage).toContain("boundary indices 0 through 2");
  });

  it("returns a valid generate broll proposal (source:\"generate\" with a generation block) and rejects a malformed one (stock source missing searchQuery)", async () => {
    const validGenerate = JSON.stringify({
      captions: [],
      zoom: [],
      broll: [{ startMs: 0, endMs: 2000, trackHint: "broll", source: "generate", generation: { kind: "image", prompt: "a futuristic dashboard" } }],
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(chatResponse(validGenerate)));
    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    const result = await provider.plan(BASE_REQUEST);
    expect(result.broll[0].source).toBe("generate");
    vi.unstubAllGlobals();

    // A stock item with no searchQuery fails aiBrollSchema's own refine —
    // the repair loop should catch this exactly like any other malformed
    // field, never silently accept it.
    const missingSearchQuery = JSON.stringify({ captions: [], zoom: [], broll: [{ startMs: 0, endMs: 1000, trackHint: "broll", source: "stock" }] });
    const fetchMock = vi.fn().mockResolvedValueOnce(chatResponse(missingSearchQuery)).mockResolvedValueOnce(chatResponse(VALID_JSON));
    vi.stubGlobal("fetch", fetchMock);
    const provider2 = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await provider2.plan(BASE_REQUEST);
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    const repairMessage = secondCallBody.messages.find((m: { role: string; content: string }) => m.role === "user" && m.content.includes("failed schema validation"));
    expect(repairMessage.content).toMatch(/searchQuery/);
  });
});

// Phase 12 Module 9 — reEdit() reuses runJsonRepairLoop (the SAME
// repair-retry mechanics plan() above exercises, just extracted into a
// shared helper) with a different prompt/schema. These tests mirror
// plan()'s own test shapes deliberately, to prove the shared extraction
// didn't lose any of the original behavior for this second caller either.
describe("GPT5ReasoningProvider.reEdit", () => {
  const BASE_REEDIT_REQUEST: ReasoningReeditRequest = {
    instruction: "remove the zoom",
    clip: {
      durationMs: 4000,
      transform: { scale: 120, position: { x: 0, y: 0 }, rotation: 0, opacity: 100 },
      hasZoomKeyframes: true,
      caption: null,
      adjacentTransitions: [],
    },
  };

  it("throws a clear error when no API key is configured", async () => {
    const provider = new GPT5ReasoningProvider({});
    await expect(provider.reEdit(BASE_REEDIT_REQUEST)).rejects.toThrow(/no API key/);
  });

  // Fix (2026-08-06) — reEdit() shares runJsonRepairLoop with plan() above;
  // same real incident, same fix must apply to this call site too.
  it("omits `temperature` entirely for the default gpt-5 model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(JSON.stringify({ action: "remove_effect", effect: "zoom" })));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await provider.reEdit(BASE_REEDIT_REQUEST);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("gpt-5");
    expect("temperature" in body).toBe(false);
  });

  it("returns a validated remove_effect response on a well-formed first response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(JSON.stringify({ action: "remove_effect", effect: "zoom" })));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    const result = await provider.reEdit(BASE_REEDIT_REQUEST);

    expect(result.response).toEqual({ action: "remove_effect", effect: "zoom" });
    expect(result.providerRef).toBe("chatcmpl-test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a validated cannot_do response, not an error, when the model declines", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(JSON.stringify({ action: "cannot_do", message: "This clip has no transition to remove." })));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    const result = await provider.reEdit({ ...BASE_REEDIT_REQUEST, instruction: "remove the transition" });

    expect(result.response).toEqual({ action: "cannot_do", message: "This clip has no transition to remove." });
  });

  it("includes the clip's real current state in the prompt (scale, hasZoomKeyframes, instruction)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(JSON.stringify({ action: "remove_effect", effect: "zoom" })));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await provider.reEdit(BASE_REEDIT_REQUEST);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMessage).toContain("scale 120%");
    expect(userMessage).toContain("Has a zoom/scale animation");
    expect(userMessage).toContain("YES");
    expect(userMessage).toContain('"remove the zoom"');
  });

  it("repairs a malformed response: retries once with the validation error fed back, succeeds on the second attempt", async () => {
    const malformed = JSON.stringify({ action: "adjust_transform", property: "position", value: 100 }); // fails the .refine() (position needs {x,y})
    const valid = JSON.stringify({ action: "adjust_transform", property: "position", value: { x: 10, y: 20 } });
    const fetchMock = vi.fn().mockResolvedValueOnce(chatResponse(malformed)).mockResolvedValueOnce(chatResponse(valid));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    const result = await provider.reEdit(BASE_REEDIT_REQUEST);

    expect(result.response).toEqual({ action: "adjust_transform", property: "position", value: { x: 10, y: 20 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces a clear error (not silently applying malformed data) when the repair attempt ALSO fails", async () => {
    const stillMalformed = JSON.stringify({ action: "not_a_real_action" });
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(stillMalformed));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await expect(provider.reEdit(BASE_REEDIT_REQUEST)).rejects.toThrow(/invalid re-edit instruction JSON even after 1 repair attempt/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws with the response body on a non-ok HTTP response, no repair attempted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse("server error", false));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GPT5ReasoningProvider({ apiKey: "test-key" });
    await expect(provider.reEdit(BASE_REEDIT_REQUEST)).rejects.toThrow(/GPT-5 re-edit request failed \(500\)/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("resolveCaptionTiming (pure)", () => {
  const words = [
    { word: "a", startMs: 0, endMs: 100 },
    { word: "b", startMs: 100, endMs: 200 },
    { word: "c", startMs: 200, endMs: 300 },
  ];

  it("resolves a single-word caption to that word's own span, with proper terminal punctuation added (FIX 5)", () => {
    const result = resolveCaptionTiming([{ text: "a", sourceWordStartIndex: 0, sourceWordEndIndex: 0 }], words);
    expect(result).toEqual([{ text: "a.", startMs: 0, endMs: 100, style: undefined, reveal: undefined }]);
  });

  it("returns an empty array when there are no real transcript words to anchor to", () => {
    const result = resolveCaptionTiming([{ text: "a", sourceWordStartIndex: 0, sourceWordEndIndex: 0 }], []);
    expect(result).toEqual([]);
  });

  // Fix (2026-08-06, FIX 5) — a caption citing a word range whose OWN text
  // is longer than 12 words (max 6 words/line x 2 lines) is split into
  // multiple real caption items, each line-balanced/punctuated, with
  // internal timing proportionally mapped across the real
  // [start,end] word-timestamp range (the overall anchors are always
  // real transcript timestamps; only the split points BETWEEN the
  // resulting captions are a proportional estimate — see this function's
  // own doc comment in gpt5.provider.ts).
  it("splits an oversized caption (>12 words in its own text) into multiple line-balanced, punctuated captions", () => {
    const longWords = Array.from({ length: 20 }, (_, i) => ({ word: `w${i}`, startMs: i * 100, endMs: i * 100 + 90 }));
    const longText = Array.from({ length: 14 }, (_, i) => `word${i}`).join(" "); // 14 words > 12
    const result = resolveCaptionTiming([{ text: longText, sourceWordStartIndex: 0, sourceWordEndIndex: 19 }], longWords);

    expect(result).toHaveLength(2); // 14 words -> ceil(14/12) = 2 captions
    for (const caption of result) {
      const lines = caption.text.split("\n");
      expect(lines.length).toBeLessThanOrEqual(2);
      for (const line of lines) {
        expect(line.split(" ").length).toBeLessThanOrEqual(6);
      }
    }
    // Anchored to the real overall range: first caption starts at the
    // real range start, last caption ends at the real range end.
    expect(result[0].startMs).toBe(longWords[0].startMs);
    expect(result[result.length - 1].endMs).toBe(longWords[19].endMs);
  });

  it("falls back to real transcript words (never empty) when given zero raw captions but real words exist", () => {
    const result = resolveCaptionTiming([], words);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].startMs).toBe(0);
  });
});
