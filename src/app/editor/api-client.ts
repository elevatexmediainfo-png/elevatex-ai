import { toast } from "sonner";

// Shared fetch wrapper for the Cloud Video Editor's TanStack Query hooks
// (Milestone 24) — same {success, data|error} envelope check the existing
// AI editor's editor-client.tsx `api()` helper already uses, just promoted
// out of a single component so every hook in this module can share it.

// AI Auto-Edit apply reliability fix (2026-08) — carries the real HTTP
// status + server error `code` (see lib/api-response.ts's Standard
// Response Envelope) with the thrown error, so a caller can tell a
// genuine business-rule rejection (4xx, e.g. ERR_VALIDATION) apart from a
// transient server/network failure (5xx / no response at all) instead of
// every failure looking like an identical opaque Error. `isTransientApiFailure`
// below is the one place that decision is made — retry logic must only
// ever consult it, never re-derive its own status/message heuristic.
export class EditorApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "EditorApiError";
    this.status = status;
    this.code = code;
  }
}

async function editorApiOnce<T>(url: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    throw new EditorApiError(json.error?.message ?? "Something went wrong.", res.status, json.error?.code);
  }
  return json.data as T;
}

// Requirement 2 (AI Auto-Edit apply reliability fix, 2026-08) — a batch AI
// Auto-Edit apply makes dozens of sequential addClip/addTrack HTTP calls
// with (previously) zero resilience; one transient blip anywhere in the
// batch permanently killed the whole thing (see createAddTrackWithClipsCommand's
// own history). Retries ONLY a genuinely transient failure:
//   - a real network-level error (fetch() itself threw — the request never
//     reached the server, or no response ever arrived at all; surfaces as
//     a TypeError, never a parsed API response), or
//   - a 5xx/429 server response.
// NEVER retries a 4xx response: the server received the request and
// correctly rejected it (ERR_VALIDATION and every other business-rule
// rejection) — retrying would just fail again identically, and could even
// mask a real bug behind a slow, confusing multi-second delay.
export function isTransientApiFailure(err: unknown): boolean {
  if (err instanceof EditorApiError) return err.status >= 500 || err.status === 429;
  return err instanceof TypeError;
}

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function editorApiWithRetry<T>(url: string, method: "GET" | "POST" | "PATCH" | "DELETE", body: unknown, retry: boolean): Promise<T> {
  const attempts = retry ? RETRY_MAX_ATTEMPTS : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await editorApiOnce<T>(url, method, body);
    } catch (err) {
      if (attempt === attempts || !isTransientApiFailure(err)) throw err;
      // Exponential backoff (300ms, 600ms, ...) + jitter, so a batch of
      // concurrent retries doesn't thundering-herd the same endpoint.
      const backoffMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + Math.round(Math.random() * 100);
      await sleep(backoffMs);
    }
  }
  /* istanbul ignore next -- the loop above always returns or throws */
  throw new Error("editorApi: retry loop exited without a result");
}

// `opts.retry` (default false, preserves every existing call site's exact
// prior behavior) — opt in per call site, not globally, so this stays a
// deliberate choice for the batch-apply-critical mutations (addClip,
// addTrack) rather than silently changing every interactive single-click
// editor action's failure behavior too.
export async function editorApi<T>(
  url: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown,
  opts?: { retry?: boolean }
): Promise<T> {
  try {
    return await editorApiWithRetry<T>(url, method, body, opts?.retry ?? false);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    toast.error(message);
    throw err;
  }
}
