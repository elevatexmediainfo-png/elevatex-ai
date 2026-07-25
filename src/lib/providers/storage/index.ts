import { listEnabledProviderConfigs, resolveProviderCredentials } from "../credentials";
import { MockStorageProvider } from "./mock.provider";
import { S3StorageProvider } from "./s3.provider";
import type { StorageProvider } from "./types";

export * from "./types";

export class StorageProviderUnavailableError extends Error {
  constructor() {
    super(
      "Storage is misconfigured — no real storage provider is enabled. Refusing to silently write to local-disk storage in production."
    );
    this.name = "StorageProviderUnavailableError";
  }
}

// SECURITY (2026-07-23) — same class of gap already fixed for PAYMENT:
// getStorageProvider() used to silently fall back to MockStorageProvider
// (local disk, non-durable, wrong on any multi-instance/serverless
// production host) whenever the "s3" ProviderConfig row was ever missing
// or disabled — a real misconfiguration (deleted row, admin mistake, a
// fresh deploy before storage is configured) would silently start writing
// real user uploads/exports to ephemeral local disk with zero error
// anywhere. Real production (NODE_ENV === "production") now hard-refuses
// instead — every storage call becomes a loud, visible failure rather than
// silent, hard-to-detect data loss. Non-production keeps the old fallback
// so local dev still works with zero cloud credentials.
//
// STORAGE has no failover concept — whichever provider id is first (the
// single active driver, per lib/providers/credentials.ts) is used.
export async function getStorageProvider(): Promise<StorageProvider> {
  const [selection] = await listEnabledProviderConfigs("STORAGE");
  if (selection === "s3") {
    return new S3StorageProvider(await resolveProviderCredentials("STORAGE", "s3"));
  }
  if (process.env.NODE_ENV === "production") {
    throw new StorageProviderUnavailableError();
  }
  return new MockStorageProvider();
}
