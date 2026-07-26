import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

// Password hashing for the MVP install-flow "password" Credentials provider
// (lib/auth/index.ts). Node's built-in scrypt — no new dependency, and
// consistent with this codebase's existing security/ helpers (encryption.ts,
// master-key.ts) already using `crypto` directly rather than a third-party
// library. Format: "saltHex:hashHex", one self-contained string, matching
// encryption.ts's own "store one string, not separate columns" convention.
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scrypt(plain, salt, KEY_LENGTH)) as Buffer;
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const hash = Buffer.from(hashHex, "hex");
  const derived = (await scrypt(plain, salt, KEY_LENGTH)) as Buffer;

  // timingSafeEqual requires equal-length buffers — a length mismatch means
  // corrupt/foreign input, never a real match, so short-circuit before it.
  if (derived.length !== hash.length) return false;
  return timingSafeEqual(derived, hash);
}
