// Milestone 15 — fetches raw bytes from either shape an image provider or
// the Storage Provider's getPublicUrl() can hand back: a `data:` URI
// (gpt-image-1 returns b64_json, which generateImage() turns into a data
// URI) or a real http(s) URL (Flux/mock providers, and every uploaded
// Asset). Exposed standalone so the creative engine can get bytes *before*
// upload — needed to run sharp transforms in-memory ahead of the final
// storage.upload() call.
export interface FetchedBytes {
  buffer: Buffer;
  contentType: string;
}

export async function toBuffer(url: string): Promise<FetchedBytes> {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error("Unsupported data URI format.");
    }
    const [, contentType, base64] = match;
    return { buffer: Buffer.from(base64, "base64"), contentType };
  }

  // Real bug fix (2026-07-25, found during the FILM stuck-generation audit)
  // — no timeout meant a slow/unresponsive vendor CDN (this is called for
  // both image AND video bytes — see this file's own header comment) could
  // hang the whole request indefinitely, well past the Generation Engine's
  // own per-provider timeout (which only wraps the render/generate call
  // itself, not this post-success download step). Same 60s convention
  // already used for exactly this class of "download a finished media file"
  // fetch elsewhere (ai-broll-resolver.ts, stock-media/search-service.ts).
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    throw new Error(`Failed to fetch image bytes from ${url} (${res.status}).`);
  }
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}
