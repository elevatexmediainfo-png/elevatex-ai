// Phase 15 — Storage adapter interface.
// Decouples the generation engine from any specific storage backend.
// Current implementation: returns data as-is (data URLs or external URLs).
// Future: S3, Cloudflare R2, local file system.

export interface StorageUploadResult {
  /** Permanent, publicly accessible URL of the stored asset. */
  url:         string;
  /** Storage key/path within the bucket. */
  key:         string;
  /** Storage backend used. */
  backend:     StorageBackend;
  /** File size in bytes (if known). */
  sizeBytes?:  number;
  /** MIME type. */
  contentType: string;
}

export type StorageBackend = "s3" | "r2" | "local" | "pass_through";

export interface StorageAdapter {
  upload(
    data: string,        // URL or base64 data URL
    key: string,
    contentType: string
  ): Promise<StorageUploadResult>;
}

/** Pass-through adapter: returns data URL or external URL as-is without uploading. */
export class PassThroughStorageAdapter implements StorageAdapter {
  async upload(data: string, key: string, contentType: string): Promise<StorageUploadResult> {
    return {
      url:         data,
      key,
      backend:     "pass_through",
      contentType,
    };
  }
}

/** Default adapter: pass-through (no storage). Replaced by real adapters in production. */
export const defaultStorageAdapter: StorageAdapter = new PassThroughStorageAdapter();
