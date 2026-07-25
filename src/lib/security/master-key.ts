import { randomBytes } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Milestone 10 — the one secret that can't itself live encrypted in the
// database (a key stored in the same DB it protects secures nothing). Two
// supply paths, both producing a 32-byte (256-bit) key:
//   1. CREDENTIAL_ENCRYPTION_KEY env var (64 hex chars) — standard practice,
//      set this if your deployment already manages secrets via env vars.
//   2. Auto-generated on first use and persisted to a gitignored local file
//      (.encryption-key at the project root) — the zero-setup default this
//      milestone's "no .env editing" goal calls for. Losing that file means
//      every encrypted ProviderConfig credential must be re-entered in the
//      Admin Panel (nothing else is lost — this key never touches anything
//      but those credential columns).
const KEY_FILE_PATH = join(process.cwd(), ".encryption-key");
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;

function readKeyFile(): Buffer | null {
  if (!existsSync(KEY_FILE_PATH)) return null;
  const hex = readFileSync(KEY_FILE_PATH, "utf-8").trim();
  if (hex.length !== KEY_BYTES * 2) return null;
  return Buffer.from(hex, "hex");
}

function generateAndPersistKey(): Buffer {
  const key = randomBytes(KEY_BYTES);
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
