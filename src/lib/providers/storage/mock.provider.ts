import { createWriteStream } from "fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import crypto from "crypto";

import { signStorageKey } from "./sign";
import type {
  SignedUrlResult,
  StorageObjectRef,
  StorageProvider,
  StorageUploadFromUrlInput,
  StorageUploadInput,
} from "./types";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

function isExternalUrl(key: string): boolean {
  return /^https?:\/\//.test(key);
}

// Default provider (PROVIDER_STORAGE=mock) — local-disk backed, served from
// Next's /public/uploads. This is dev/single-instance only: a real
// deployment with multiple server instances or serverless functions has no
// shared local disk, which is exactly the gap S3Provider closes. Signed URLs
// are still real HMAC-verified tokens (see sign.ts + app/api/files/route.ts),
// not a fake passthrough — only the storage backend itself is mocked.
export class MockStorageProvider implements StorageProvider {
  // Fix (2026-07-21) — this used to write straight to `filePath` via a
  // plain writeFile(), which opens with the default 'w' flag (truncates
  // immediately, then fills in the new bytes). asset-normalize-worker.ts
  // calls this to overwrite an EXISTING, already-READY asset's storageKey
  // in place — for a large video this write is not instantaneous, so a
  // concurrent reader (e.g. this app's own server-to-server fetch for
  // transcription) hitting the file mid-write could see a truncated/
  // inconsistent read instead of the complete file. Same tmp-file+rename
  // pattern uploadFromStream() already uses for the exact same reason
  // (2026-07-20 fix, see that method's own comment) — a rename is atomic
  // on the same filesystem, so any reader either sees the old complete
  // file or the new complete file, never a partial one.
  async upload({ key, data, contentType }: StorageUploadInput): Promise<StorageObjectRef> {
    void contentType; // local mock infers nothing from it; a real adapter would set it as object metadata
    const filePath = path.join(UPLOAD_ROOT, key);
    const tmpPath = `${filePath}.uploading-${crypto.randomUUID()}.tmp`;
    await mkdir(path.dirname(filePath), { recursive: true });
    try {
      await writeFile(tmpPath, data);
      await rename(tmpPath, filePath);
    } catch (err) {
      await rm(tmpPath, { force: true }).catch(() => {});
      throw err;
    }
    return { key, url: this.getPublicUrl(key) };
  }

  // Fix (2026-07-20) — the browser-PUT upload path (mock-upload/route.ts)
  // used to do `Buffer.from(await req.arrayBuffer())` then call upload()
  // above: the entire file held in memory at once, all-or-nothing if the
  // transfer is interrupted partway (confirmed live: a real founder upload
  // repeatedly failed with the file completely absent from disk, not
  // truncated). This streams the incoming request body straight to disk
  // instead — never holds more than a chunk in memory regardless of file
  // size — and writes to a `.tmp` sibling first, renaming to the real key
  // only once the stream finishes successfully. If the stream is
  // interrupted at any point, the temp file is removed and the real
  // storageKey is never created — the exact same "file genuinely doesn't
  // exist" signal confirmEditorAssetUpload's integrity guard already
  // handles correctly, just reached with a fraction of the memory
  // footprint and without the framework-level double-buffering
  // middleware.ts's matcher exclusion (see that file's own comment) also
  // removes from this same request path.
  async uploadFromStream(key: string, stream: ReadableStream<Uint8Array>): Promise<StorageObjectRef> {
    const filePath = path.join(UPLOAD_ROOT, key);
    const tmpPath = `${filePath}.uploading-${crypto.randomUUID()}.tmp`;
    await mkdir(path.dirname(filePath), { recursive: true });
    try {
      await pipeline(Readable.fromWeb(stream as never), createWriteStream(tmpPath));
      await rename(tmpPath, filePath);
    } catch (err) {
      await rm(tmpPath, { force: true }).catch(() => {});
      throw err;
    }
    return { key, url: this.getPublicUrl(key) };
  }

  async uploadFromUrl({ key, sourceUrl, contentType }: StorageUploadFromUrlInput): Promise<StorageObjectRef> {
    // A provider with no hosted-URL response (e.g. OpenAI's gpt-image-1,
    // which only ever returns base64) hands back a data: URI instead of an
    // external link — there's nothing to "pass through" to, so decode it
    // and write it to local disk like a real upload.
    if (sourceUrl.startsWith("data:")) {
      const commaIndex = sourceUrl.indexOf(",");
      const header = sourceUrl.slice(5, commaIndex);
      const [mime] = header.split(";");
      const data = Buffer.from(sourceUrl.slice(commaIndex + 1), "base64");
      return this.upload({ key, data, contentType: contentType ?? mime ?? "application/octet-stream" });
    }
    // Mock mode doesn't re-host other mock providers' external demo URLs —
    // it passes them through, using the URL itself as the storage key. A
    // real adapter (S3Provider) actually fetches and re-uploads the bytes.
    return { key: sourceUrl, url: sourceUrl };
  }

  getPublicUrl(key: string): string {
    if (isExternalUrl(key)) return key;
    return `/uploads/${key}`;
  }

  async getSignedDownloadUrl(key: string, ttlSeconds: number): Promise<SignedUrlResult> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const sig = signStorageKey(key, expiresAt.getTime());
    const url = `/api/files?key=${encodeURIComponent(key)}&expires=${expiresAt.getTime()}&sig=${sig}`;
    return { url, expiresAt };
  }

  // Same HMAC-signed-token guarantee as getSignedDownloadUrl, in reverse —
  // the browser PUTs bytes straight to a Next.js route (app/api/assets/
  // mock-upload/route.ts) that verifies the signature before writing to
  // local disk. A real adapter (S3Provider) instead asks the vendor to sign
  // a PutObject URL pointed directly at cloud storage.
  async createSignedUploadUrl(key: string, contentType: string, ttlSeconds: number): Promise<SignedUrlResult> {
    void contentType;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const sig = signStorageKey(key, expiresAt.getTime());
    const url = `/api/assets/mock-upload?key=${encodeURIComponent(key)}&expires=${expiresAt.getTime()}&sig=${sig}`;
    return { url, expiresAt };
  }

  /** Used only by app/api/files/route.ts to serve local-disk objects. */
  async readLocalFile(key: string): Promise<Buffer> {
    return readFile(path.join(UPLOAD_ROOT, key));
  }

  async download(key: string): Promise<Buffer> {
    if (isExternalUrl(key)) {
      const res = await fetch(key);
      if (!res.ok) throw new Error(`Failed to download ${key} (${res.status}).`);
      return Buffer.from(await res.arrayBuffer());
    }
    return this.readLocalFile(key);
  }

  async getObjectSize(key: string): Promise<number | null> {
    if (isExternalUrl(key)) {
      const res = await fetch(key, { method: "HEAD" });
      if (!res.ok) return null;
      const len = res.headers.get("content-length");
      return len ? Number(len) : null;
    }
    try {
      const stats = await stat(path.join(UPLOAD_ROOT, key));
      return stats.size;
    } catch {
      return null;
    }
  }

  // Best-effort, same contract as S3StorageProvider.delete(). A no-op for
  // an external (passthrough) key — mock mode never owns that object, only
  // points at it.
  async delete(key: string): Promise<void> {
    if (isExternalUrl(key)) return;
    await rm(path.join(UPLOAD_ROOT, key), { force: true }).catch((err) => {
      console.error(`[MockStorageProvider] compensating delete failed for key ${key}`, err);
    });
  }
}
