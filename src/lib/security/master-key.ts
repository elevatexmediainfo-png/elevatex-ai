import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Milestone 10 — the one secret that can't itself live encrypted in the
// database (a key stored in the same DB it protects secures nothing). Two
// supply paths, both producing a 32-byte (256-bit) key:
//   1. CREDENTIAL_ENCRYPTION_KEY env var (64 hex chars) — standard practice,
//      set this if your deployment already manages secrets via env vars.
//   2. Auto-generated on first use and persisted to a gitignored local file
//      — the zero-setup default this milestone's "no .env editing" goal
//      calls for. Losing that file means every encrypted ProviderConfig
//      credential must be re-entered in the Admin Panel (nothing else is
//      lost — this key never touches anything but those credential
//      columns).
//
// Fix (2026-07-27) — the file used to live at the project root
// (`.encryption-key`, directly under WORKDIR in Docker). The production
// image runs as a non-root user (`USER nextjs`, Dockerfile), and that root
// directory is owned by root from the build's COPY steps — a fresh
// container (no pre-existing key file yet) crashed with
// `EACCES: permission denied, open '/app/.encryption-key'` the first time
// any provider credential was saved, since the non-root user can't create a
// NEW file directly under a root-owned directory. New keys are now written
// under a dedicated `.data/` subdirectory instead, which the Dockerfile
// explicitly creates and chowns to that same non-root user — a real,
// permission-correct location rather than chmod 777 on the whole app root.
// `readKeyFile()` still checks the OLD root-level path first, purely so an
// already-generated key (this dev machine's included) keeps decrypting the
// exact same ProviderConfig rows it always has — never silently rotated
// out from under existing encrypted data.
const LEGACY_KEY_FILE_PATH = join(process.cwd(), ".encryption-key");
const KEY_FILE_DIR = join(process.cwd(), ".data");
const KEY_FILE_PATH = join(KEY_FILE_DIR, ".encryption-key");
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;

function readKeyFileAt(path: string): Buffer | null {
  if (!existsSync(path)) return null;
  const hex = readFileSync(path, "utf-8").trim();
  if (hex.length !== KEY_BYTES * 2) return null;
  return Buffer.from(hex, "hex");
}

function readKeyFile(): Buffer | null {
  return readKeyFileAt(LEGACY_KEY_FILE_PATH) ?? readKeyFileAt(KEY_FILE_PATH);
}

function generateAndPersistKey(): Buffer {
  const key = randomBytes(KEY_BYTES);
  // Safe to create — mkdirSync's recursive option is a no-op (not an
  // error) if the directory already exists, matching this function's own
  // "generate if missing" contract rather than assuming the Dockerfile (or
  // a local dev checkout) has already made it.
  mkdirSync(KEY_FILE_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(KEY_FILE_PATH, key.toString("hex"), { mode: 0o600 });
  return key;
}

export function getMasterKey(): Buffer {
  if (cachedKey) return cachedKey;

  const envKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (envKey) {
    if (envKey.length !== KEY_BYTES * 2) {
      throw new Error(
        `CREDENTIAL_ENCRYPTION_KEY must be exactly ${KEY_BYTES * 2} hex characters (${KEY_BYTES} bytes).`
      );
    }
    cachedKey = Buffer.from(envKey, "hex");
    return cachedKey;
  }

  cachedKey = readKeyFile() ?? generateAndPersistKey();
  return cachedKey;
}
