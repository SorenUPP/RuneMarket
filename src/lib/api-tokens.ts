import { randomBytes, createHash, timingSafeEqual } from "crypto";

/**
 * Personal API tokens used by external clients (the RuneLite plugin) that
 * cannot authenticate via the Supabase cookie session. A token is only
 * ever shown to the user once, at creation time. We store a SHA-256 hash
 * of it, never the raw value, mirroring how the app already avoids storing
 * plaintext secrets elsewhere.
 */

const TOKEN_PREFIX = "rm_live_";

/** Generates a new raw token and its hash for storage. */
export function generateApiToken() {
  const raw = TOKEN_PREFIX + randomBytes(24).toString("base64url");
  return { raw, hash: hashApiToken(raw) };
}

export function hashApiToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Extracts a bearer token from an Authorization header and compares it
 * against a stored hash using a constant-time comparison, so response
 * timing can't be used to guess a valid hash byte by byte.
 */
export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
