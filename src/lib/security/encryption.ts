import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import { getMasterKey } from "./master-key";

// Milestone 10 — encrypts provider credentials (API keys/secrets) at rest in
// ProviderConfig, the new home for what used to be env-var-only. Same `crypto`
// module already used for storage URL signing (lib/providers/storage/sign.ts);
// AES-256-GCM rather than HMAC here since this needs to be reversible
// (signing only ever needs to verify, never recover the original value).
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

// Format: ivHex:authTagHex:ciphertextHex — one self-contained string, safe to
// store directly in a single DB column with no separate columns for iv/tag.
export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, authTagHex, ciphertextHex] = payload.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted credential payload.");
  }

  const key = getMasterKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]);
  return plaintext.toString("utf-8");
}

// Masks a secret for display in the Admin Panel — never echo the real value
// back once saved, only enough characters to confirm which key is active.
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 4) return "••••";
  return `${"•".repeat(Math.max(4, plaintext.length - 4))}${plaintext.slice(-4)}`;
}
