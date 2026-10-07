import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing for stored credentials.
 *
 * Uses Node's built-in `scrypt` (a memory-hard KDF) so we take on no native
 * dependency. A fresh 16-byte random salt is generated per password and stored
 * alongside the derived key in a self-describing string:
 *
 *   scrypt:<saltHex>:<hashHex>
 *
 * The scheme prefix lets us migrate to different parameters or algorithms later
 * without a data migration - `verifyPassword` can branch on it.
 *
 * Server-only: never import this into client code (it would leak nothing secret
 * but relies on `node:crypto`).
 */
const scrypt = promisify(scryptCallback);

const SCHEME = "scrypt";
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${SCHEME}:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hashHex] = stored.split(":");
  if (scheme !== SCHEME || !salt || !hashHex) {
    return false;
  }

  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");

  // Length guard before timingSafeEqual (it throws on mismatched lengths).
  if (expected.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(expected, derived);
}
