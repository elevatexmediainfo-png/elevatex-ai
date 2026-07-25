import { fileTypeFromBuffer } from "file-type";

// Milestone 12 — the MIME allowlist (lib/validations/editor.ts) only ever
// checked the browser-supplied Content-Type header, which an attacker fully
// controls (a renamed .exe sent as "image/jpeg" sails through). This checks
// the actual magic bytes instead. Only usable where the bytes transit our
// server (POST /api/assets/upload) — the presigned direct-to-storage path
// (/api/assets/upload-url) never sees the bytes at all, a documented gap,
// see KNOWN_LIMITATIONS.md.
export async function verifyFileSignature(buffer: Buffer, allowedMimeTypes: string[]): Promise<boolean> {
  const detected = await fileTypeFromBuffer(buffer);
  // Undetectable (e.g. plain text, some legacy formats) — fail closed only
  // when the allowlist is itself magic-byte-detectable (image/video/audio
  // all are); an allowlist that includes a non-sniffable type would need a
  // carve-out, but none currently does.
  if (!detected) return false;
  return allowedMimeTypes.includes(detected.mime);
}
