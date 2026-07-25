import { createHmac, timingSafeEqual } from "crypto";

// Used by the Mock storage provider to make "signed URL" a real, verifiable
// guarantee in dev — not just a passthrough string — so the Download
// Service's time-limited-access contract is actually exercised end-to-end
// without needing real cloud storage. A real adapter (S3Provider) instead
// asks the vendor to sign the URL.
function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET must be set to sign storage URLs.");
  return secret;
}

export function signStorageKey(key: string, expiresAtMs: number): string {
  return createHmac("sha256", getSecret()).update(`${key}:${expiresAtMs}`).digest("hex");
}

export function verifyStorageSignature(
  key: string,
  expiresAtMs: number,
  signature: string
): boolean {
  const expected = signStorageKey(key, expiresAtMs);
  // Buffer.from(str, "hex") silently stops at the first invalid hex pair
  // instead of throwing — appending non-hex garbage to a valid signature
  // would otherwise decode to the same bytes as `expected` and incorrectly
  // verify. Reject anything that isn't exactly the canonical hex length
  // before ever constructing a Buffer from it.
  if (signature.length !== expected.length) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return timingSafeEqual(a, b);
}
