import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { ProviderRuntimeConfig } from "../credentials";
import type {
  SignedUrlResult,
  StorageObjectRef,
  StorageProvider,
  StorageUploadFromUrlInput,
  StorageUploadInput,
} from "./types";

// Real adapter — works against AWS S3 unmodified, and against Cloudflare R2
// or any other S3-API-compatible store by setting an `endpoint`. Selected
// when the STORAGE category's active ProviderConfig row has providerId
// "s3"; bucket/region/endpoint/publicBaseUrl and the access key pair are
// resolved by lib/providers/credentials.ts (Admin AI Providers panel,
// falling back to S3_BUCKET/S3_REGION/S3_ENDPOINT/S3_PUBLIC_BASE_URL/
// S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY) and injected here.
export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl: string;

  constructor(config: ProviderRuntimeConfig = {}) {
    const bucket = config.extraConfig?.bucket;
    const region = config.extraConfig?.region;
    if (!bucket || !region) {
      throw new Error(
        "s3 is enabled but bucket/region are not configured (Admin → AI Providers, or S3_BUCKET/S3_REGION)."
      );
    }
    this.bucket = bucket;
    const endpoint = config.extraConfig?.endpoint;
    // Fix (2026-07-21) — this used to fall back to the AWS URL pattern
    // (`{bucket}.s3.{region}.amazonaws.com`) whenever publicBaseUrl wasn't
    // set, with no regard for whether a custom `endpoint` (R2/MinIO/any
    // non-AWS S3-compatible provider) was configured. That fallback is
    // ALWAYS wrong once a custom endpoint is in play — R2 URLs never end
    // in amazonaws.com — and it fails silently: a plausible-looking but
    // completely unfetchable URL gets handed to every downstream caller
    // (confirmed live: a real R2 setup with the endpoint configured but
    // publicBaseUrl left unsaved produced
    // "https://{bucket}.s3.auto.amazonaws.com/..." — R2's literal region
    // value "auto" templated into an AWS-only pattern, breaking every real
    // fetch against it, including this app's own AI Auto-Edit pipeline
    // reading its own uploads back). Now: with a custom endpoint but no
    // publicBaseUrl, fail fast and clearly at construction time — the
    // exact same "broken config should error loudly, not silently produce
    // a wrong-but-plausible value" principle as this session's earlier
    // Test Connection "UnknownError" fix — instead of letting every
    // downstream read fail later with no indication why. The AWS pattern
    // remains the correct default ONLY for genuine AWS S3 (no endpoint).
    if (config.extraConfig?.publicBaseUrl) {
      this.publicBaseUrl = config.extraConfig.publicBaseUrl.replace(/\/$/, "");
    } else if (!endpoint) {
      this.publicBaseUrl = `https://${bucket}.s3.${region}.amazonaws.com`;
    } else {
      throw new Error(
        `s3 is configured with a custom endpoint (${endpoint}) but no Public base URL — a custom S3-compatible endpoint (R2/MinIO/etc.) has no reliable default public URL pattern to fall back to. Set "Public base URL" in Admin → AI Providers (e.g. R2's pub-*.r2.dev domain or a custom domain bound to the bucket).`
      );
    }

    this.client = new S3Client({
      region,
      endpoint, // set for R2/MinIO; unset = real AWS
      forcePathStyle: !!endpoint,
      credentials:
        config.apiKey && config.apiSecret
          ? {
              accessKeyId: config.apiKey,
              secretAccessKey: config.apiSecret,
            }
          : undefined, // falls back to the environment's default credential chain
      // Fix (2026-07-21) — a real, intermittent upload-stall bug traced to
      // this SDK's own default (`requestChecksumCalculation: "WHEN_SUPPORTED"`,
      // confirmed in the installed @aws-sdk/client-s3 version): it proactively
      // computes and embeds an x-amz-checksum-crc32 into presigned PutObject
      // URLs even though the real file bytes don't exist yet at sign time —
      // confirmed live, a real presigned URL contained
      // `x-amz-checksum-crc32=AAAAAA==`, the CRC32 of an EMPTY body. When the
      // browser later PUTs the REAL file directly to that URL, the checksum
      // baked into the URL doesn't match the actual bytes; R2's handling of
      // this newer SDK "flexible checksums" feature is inconsistent enough
      // that the browser's PUT request would sometimes hang or abort
      // (confirmed live via a real Playwright-driven upload: a real ~19MB
      // file's PUT fired `net::ERR_ABORTED`) rather than the upload silently
      // going through for every case, matching a real founder report of
      // uploads "stuck mid-progress." "WHEN_REQUIRED" is the documented fix —
      // only compute a checksum when an operation genuinely requires one
      // (e.g. object-lock features this app doesn't use), never for a plain
      // presigned PutObject where no real content exists to check yet.
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }

  async upload({ key, data, contentType }: StorageUploadInput): Promise<StorageObjectRef> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      })
    );
    return { key, url: this.getPublicUrl(key) };
  }

  async uploadFromUrl({ key, sourceUrl, contentType }: StorageUploadFromUrlInput): Promise<StorageObjectRef> {
    // Real bug fix (2026-07-25, found during the FILM stuck-generation
    // audit) — no timeout meant a slow/unresponsive vendor URL (this is the
    // real path FILM/GENERATED scenes use to pull a finished voice-over
    // clip from ElevenLabs/edge_tts before re-hosting it) could hang the
    // whole request indefinitely, well past the Generation Engine's own
    // per-provider timeout. Same 60s convention already used for exactly
    // this class of fetch elsewhere (ai-broll-resolver.ts, stock-media/
    // search-service.ts).
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      throw new Error(`Failed to fetch ${sourceUrl} for storage upload (${res.status})`);
    }
    const data = Buffer.from(await res.arrayBuffer());
    return this.upload({
      key,
      data,
      contentType: contentType ?? res.headers.get("content-type") ?? "application/octet-stream",
    });
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  async getSignedDownloadUrl(key: string, ttlSeconds: number): Promise<SignedUrlResult> {
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds }
    );
    return { url, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
  }

  async createSignedUploadUrl(key: string, contentType: string, ttlSeconds: number): Promise<SignedUrlResult> {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: ttlSeconds }
    );
    return { url, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
  }

  async download(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`S3 object ${key} returned no body.`);
    return Buffer.from(bytes);
  }

  async getObjectSize(key: string): Promise<number | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return res.ContentLength ?? null;
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "NotFound" || name === "NoSuchKey") return null;
      throw err;
    }
  }
}
