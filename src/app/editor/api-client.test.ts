import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { toast } from "sonner";
import { editorApi, EditorApiError, isTransientApiFailure } from "./api-client";

function jsonResponse(status: number, body: unknown) {
  return { status, json: async () => body };
}

describe("isTransientApiFailure", () => {
  it("treats a 5xx EditorApiError as transient", () => {
    expect(isTransientApiFailure(new EditorApiError("boom", 500))).toBe(true);
    expect(isTransientApiFailure(new EditorApiError("boom", 503))).toBe(true);
  });

  it("treats a 429 EditorApiError as transient", () => {
    expect(isTransientApiFailure(new EditorApiError("rate limited", 429))).toBe(true);
  });

  it("treats a 4xx EditorApiError (validation/business-rule rejection) as NOT transient", () => {
    expect(isTransientApiFailure(new EditorApiError("bad input", 400))).toBe(false);
    expect(isTransientApiFailure(new EditorApiError("not found", 404))).toBe(false);
  });

  it("treats a real network-level TypeError (fetch() itself threw) as transient", () => {
    expect(isTransientApiFailure(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("treats an unrecognized error as NOT transient (fail closed, never retry an unknown shape)", () => {
    expect(isTransientApiFailure(new Error("something else"))).toBe(false);
  });
});

describe("editorApi retry (requirement 2, 2026-08 AI Auto-Edit apply reliability fix)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("without opts.retry (default), a single transient failure is NOT retried — preserves every pre-existing call site's behavior", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(500, { success: false, error: { code: "ERR_INTERNAL", message: "server exploded" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(editorApi("/api/editor/projects/p1/clips", "POST", { foo: "bar" })).rejects.toThrow("server exploded");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("server exploded");
  });

  it("with opts.retry, a transient 500 that succeeds on the 2nd attempt returns the successful result and never surfaces an error toast", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { success: false, error: { code: "ERR_INTERNAL", message: "transient blip" } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { clip: { id: "clip-1" } } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await editorApi<{ clip: { id: string } }>("/api/editor/projects/p1/clips", "POST", { foo: "bar" }, { retry: true });

    expect(result).toEqual({ clip: { id: "clip-1" } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("with opts.retry, a real network-level TypeError is retried the same as a 5xx", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await editorApi("/api/editor/projects/p1/tracks", "POST", { kind: "SUBTITLE" }, { retry: true });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("with opts.retry, a 400 validation error is NEVER retried — fails on the very first attempt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400, { success: false, error: { code: "ERR_VALIDATION", message: "Please check the clip fields and try again." } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(editorApi("/api/editor/projects/p1/clips", "POST", { bad: true }, { retry: true })).rejects.toThrow("Please check the clip fields and try again.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("with opts.retry, exhausting all attempts on a persistent 5xx still eventually throws (bounded, not an infinite retry loop)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, { success: false, error: { code: "ERR_INTERNAL", message: "still down" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(editorApi("/api/editor/projects/p1/clips", "POST", { foo: "bar" }, { retry: true })).rejects.toThrow("still down");
    // Bounded at 3 attempts total, not unbounded.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("EditorApiError carries the real HTTP status and server error code through to the caller", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { success: false, error: { code: "ERR_NOT_FOUND", message: "no such project" } }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      await editorApi("/api/editor/projects/missing/clips", "GET");
      throw new Error("expected editorApi to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(EditorApiError);
      expect((err as EditorApiError).status).toBe(404);
      expect((err as EditorApiError).code).toBe("ERR_NOT_FOUND");
    }
  });
});
