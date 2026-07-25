export interface StorageUploadInput {
  key: string;
  data: Buffer;
  contentType: string;
}

export interface StorageUploadFromUrlInput {
  key: string;
  sourceUrl: string;
  contentType?: string;
}

export interface StorageObjectRef {
  key: string;
  url: string;
}

export interface SignedUrlResult {
  url: string;
  expiresAt: Date;
}

export interface StorageProvider {
  /** Upload raw bytes (e.g. TTS audio, generated images) and get back a durable URL. */
  upload(input: StorageUploadInput): Promise<StorageObjectRef>;

  /** Mirror an externally-hosted asset (e.g. a render provider's delivery URL) into this storage. */
  uploadFromUrl(input: StorageUploadFromUrlInput): Promise<StorageObjectRef>;

  /** Permanent, unsigned URL — fine for free preview assets, never for gated master assets. */
  getPublicUrl(key: string): string;

  /** Short-lived signed URL — what the Download Service hands to a paying user. */
  getSignedDownloadUrl(key: string, ttlSeconds: number): Promise<SignedUrlResult>;

  /** Short-lived signed PUT URL — the browser uploads bytes directly to storage, bypassing the Next.js server's request-body limit. Used by large (multi-GB) talking-head video uploads. */
  createSignedUploadUrl(key: string, contentType: string, ttlSeconds: number): Promise<SignedUrlResult>;

  /** Reads an object's raw bytes server-side, by key — never via getPublicUrl() + fetch(), since a mock-mode public URL is app-relative and unfetchable outside a browser. Used for server-side post-processing (e.g. logo compositing) of an already-stored asset. */
  download(key: string): Promise<Buffer>;

  /**
   * Actual stored byte size for an object, by key — a cheap metadata read
   * (fs.stat / HeadObject), never a full download(). Returns null if the
   * object doesn't exist. Used to catch a silently-truncated upload (e.g.
   * a proxy/middleware body-size cap cutting a file off mid-transfer):
   * confirm-upload compares this against the client-declared
   * fileSizeBytes before ever marking an asset READY, rather than trusting
   * that a completed PUT request means the full file arrived intact.
   */
  getObjectSize(key: string): Promise<number | null>;
}
